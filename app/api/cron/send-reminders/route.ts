import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendMultiTournamentReminderEmail } from '@/lib/email/send'
import { sendPushNotification } from '@/lib/firebase-admin'

// Configuration
const BATCH_SIZE = 50 // Nombre d'utilisateurs à traiter par exécution

// Mettre CRON_ENABLED=true dans les variables d'environnement pour activer
const CRON_ENABLED = process.env.CRON_ENABLED === 'true'

// Type pour stocker les infos par utilisateur
interface UserMissingMatches {
  user_id: string
  email: string
  username: string
  fcm_token: string | null
  tournaments: {
    id: string
    name: string
    slug: string
    competition_name: string
    matches: {
      id: string
      matchday: number
      home_team: string
      away_team: string
      utc_date: string
    }[]
  }[]
}

export async function GET(request: NextRequest) {
  // Vérifier le secret CRON pour sécuriser l'endpoint
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[CRON] CRON_SECRET is not configured')
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Vérifier si le CRON est activé
  if (!CRON_ENABLED) {
    return NextResponse.json({
      success: true,
      message: 'CRON désactivé (CRON_ENABLED=false)',
      processed: 0,
      skipped: 0
    })
  }

  try {
    const supabase = createAdminClient()
    const now = new Date()

    // Plan Hobby Vercel : 1 exécution/jour à 10h
    // On récupère tous les matchs du jour (de maintenant jusqu'à minuit)
    const endOfDay = new Date(now)
    endOfDay.setHours(23, 59, 59, 999)

    // 1. Récupérer les matchs du jour qui n'ont pas encore commencé
    const { data: upcomingMatches, error: matchesError } = await supabase
      .from('imported_matches')
      .select('id, competition_id, matchday, home_team_name, away_team_name, utc_date')
      .gte('utc_date', now.toISOString())
      .lte('utc_date', endOfDay.toISOString())
      .in('status', ['SCHEDULED', 'TIMED'])

    if (matchesError) {
      console.error('Error fetching matches:', matchesError)
      return NextResponse.json({ error: 'Erreur récupération matchs' }, { status: 500 })
    }

    if (!upcomingMatches || upcomingMatches.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Aucun match dans la fenêtre de rappel',
        processed: 0,
        skipped: 0
      })
    }

    // 2. Récupérer les tournois actifs concernés
    const competitionIds = [...new Set(upcomingMatches.map(m => m.competition_id))]
    const matchdays = [...new Set(upcomingMatches.map(m => m.matchday))]

    const { data: activeTournaments, error: tournamentsError } = await supabase
      .from('tournaments')
      .select('id, name, slug, competition_id, competition_name, starting_matchday, ending_matchday')
      .in('competition_id', competitionIds)
      .eq('status', 'active')

    if (tournamentsError || !activeTournaments) {
      console.error('Error fetching tournaments:', tournamentsError)
      return NextResponse.json({ error: 'Erreur récupération tournois' }, { status: 500 })
    }

    // Filtrer les tournois qui couvrent les journées concernées
    const relevantTournaments = activeTournaments.filter(t => {
      return matchdays.some(md =>
        md >= (t.starting_matchday || 1) && md <= (t.ending_matchday || 999)
      )
    })

    if (relevantTournaments.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Aucun tournoi actif pour ces matchs',
        processed: 0,
        skipped: 0
      })
    }

    // 3. Construire la map des matchs manquants par utilisateur
    const userMissingMap = new Map<string, UserMissingMatches>()

    // Récupérer TOUS les participants de TOUS les tournois en une seule requête
    const tournamentIds = relevantTournaments.map(t => t.id)
    const { data: allParticipants } = await supabase
      .from('tournament_participants')
      .select('tournament_id, user_id, profiles(id, username, email, notification_preferences, fcm_token)')
      .in('tournament_id', tournamentIds)

    if (!allParticipants || allParticipants.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Aucun participant dans les tournois actifs',
        processed: 0,
        skipped: 0
      })
    }

    // Grouper participants par tournoi
    const participantsByTournament = new Map<string, typeof allParticipants>()
    for (const p of allParticipants) {
      if (!participantsByTournament.has(p.tournament_id)) {
        participantsByTournament.set(p.tournament_id, [])
      }
      participantsByTournament.get(p.tournament_id)!.push(p)
    }

    // Récupérer TOUTES les predictions en une seule requête
    const allMatchIds = upcomingMatches.map(m => m.id)
    const { data: allPredictions } = await supabase
      .from('predictions')
      .select('user_id, match_id, tournament_id')
      .in('tournament_id', tournamentIds)
      .in('match_id', allMatchIds)

    // Créer un set global des pronostics (tournament_id:user_id:match_id)
    const predictedSet = new Set(
      (allPredictions || []).map(p => `${p.tournament_id}:${p.user_id}:${p.match_id}`)
    )

    for (const tournament of relevantTournaments) {
      // Matchs concernés pour ce tournoi
      const tournamentMatches = upcomingMatches.filter(m =>
        m.competition_id === tournament.competition_id &&
        m.matchday >= (tournament.starting_matchday || 1) &&
        m.matchday <= (tournament.ending_matchday || 999)
      )

      if (tournamentMatches.length === 0) continue

      const participants = participantsByTournament.get(tournament.id) || []
      if (participants.length === 0) continue

      // Filtrer les utilisateurs qui ont activé les rappels
      const eligibleUsers = participants.filter(p => {
        const profile = p.profiles as any
        return profile && profile.notification_preferences?.email_reminder === true && profile.email
      })

      // Pour chaque utilisateur éligible, vérifier ses matchs manquants
      for (const participant of eligibleUsers) {
        const profile = participant.profiles as any
        if (!profile?.email) continue

        // Vérifier les heures calmes
        const currentHour = now.getHours()
        const quietStart = 22
        const quietEnd = 8
        if (currentHour >= quietStart || currentHour < quietEnd) continue

        // Trouver les matchs non pronostiqués
        const missingMatches = tournamentMatches.filter(m =>
          !predictedSet.has(`${tournament.id}:${profile.id}:${m.id}`)
        )

        if (missingMatches.length === 0) continue

        // Ajouter à la map
        if (!userMissingMap.has(profile.id)) {
          userMissingMap.set(profile.id, {
            user_id: profile.id,
            email: profile.email,
            username: profile.username || 'Joueur',
            fcm_token: profile.fcm_token,
            tournaments: []
          })
        }

        const userData = userMissingMap.get(profile.id)!
        userData.tournaments.push({
          id: tournament.id,
          name: tournament.name,
          slug: tournament.slug,
          competition_name: tournament.competition_name,
          matches: missingMatches.map(m => ({
            id: m.id,
            matchday: m.matchday,
            home_team: m.home_team_name,
            away_team: m.away_team_name,
            utc_date: m.utc_date
          }))
        })
      }
    }

    // 4. Envoyer UNE notification par utilisateur
    let processed = 0
    let skipped = 0
    const errors: string[] = []

    const usersToProcess = Array.from(userMissingMap.values()).slice(0, BATCH_SIZE)

    for (const userData of usersToProcess) {
      // Vérifier si on a déjà envoyé un rappel aujourd'hui pour cet utilisateur
      const todayStart = new Date(now)
      todayStart.setHours(0, 0, 0, 0)

      const { data: existingLog } = await supabase
        .from('notification_logs')
        .select('id')
        .eq('user_id', userData.user_id)
        .eq('notification_type', 'reminder')
        .gte('scheduled_at', todayStart.toISOString())
        .single()

      if (existingLog) {
        skipped++
        continue
      }

      // Calculer le total des matchs manquants
      const totalMissingMatches = userData.tournaments.reduce(
        (sum, t) => sum + t.matches.length, 0
      )

      // Trouver la deadline la plus proche
      let earliestDeadline = new Date('2099-12-31')
      for (const tournament of userData.tournaments) {
        for (const match of tournament.matches) {
          const matchDate = new Date(match.utc_date)
          const deadline = new Date(matchDate.getTime() - 30 * 60 * 1000)
          if (deadline < earliestDeadline) {
            earliestDeadline = deadline
          }
        }
      }
      const deadlineStr = earliestDeadline.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })

      // Créer le log de notification
      const { error: logError } = await supabase
        .from('notification_logs')
        .insert({
          user_id: userData.user_id,
          notification_type: 'reminder',
          tournament_id: userData.tournaments[0].id,
          matchday: userData.tournaments[0].matches[0]?.matchday,
          status: 'pending',
          scheduled_at: now.toISOString()
        })

      if (logError) {
        errors.push(`Log error for ${userData.user_id}: ${logError.message}`)
        continue
      }

      let emailSent = false
      let pushSent = false

      // 1. Envoi email (avec TOUS les tournois et matchs)
      try {
        const result = await sendMultiTournamentReminderEmail(userData.email, {
          username: userData.username,
          tournaments: userData.tournaments.map(t => ({
            name: t.name,
            slug: t.slug,
            competitionName: t.competition_name,
            matches: t.matches.map(m => {
              const matchDate = new Date(m.utc_date)
              return {
                homeTeam: m.home_team,
                awayTeam: m.away_team,
                matchDate: matchDate.toLocaleDateString('fr-FR', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: 'Europe/Paris'
                }),
                deadlineTime: new Date(matchDate.getTime() - 30 * 60 * 1000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
              }
            })
          })),
          defaultPredictionMaxPoints: 1,
          earliestDeadline: deadlineStr
        })
        emailSent = result.success
        if (!result.success) {
          errors.push(`Email error for ${userData.user_id}: ${result.error}`)
        }
      } catch (emailError: any) {
        errors.push(`Email error for ${userData.user_id}: ${emailError.message}`)
      }

      // 2. Envoi push notification GLOBALE (résumé de tous les tournois)
      if (userData.fcm_token) {
        try {
          // Construire le message selon le nombre de tournois
          let title: string
          let body: string

          if (userData.tournaments.length === 1) {
            // Un seul tournoi
            const t = userData.tournaments[0]
            title = `${totalMissingMatches} match${totalMissingMatches > 1 ? 's' : ''} à pronostiquer`
            body = `N'oublie pas tes pronostics pour ${t.name} avant ${deadlineStr} !`
          } else {
            // Plusieurs tournois
            title = `${totalMissingMatches} matchs à pronostiquer`
            const tournamentNames = userData.tournaments.map(t => t.name).join(', ')
            body = `${userData.tournaments.length} tournois en attente : ${tournamentNames}. Limite : ${deadlineStr}`
          }

          pushSent = await sendPushNotification(
            userData.fcm_token,
            title,
            body,
            {
              type: 'reminder',
              totalMatches: String(totalMissingMatches),
              tournamentsCount: String(userData.tournaments.length),
              clickAction: '/dashboard'
            }
          )
        } catch (pushError: any) {
          errors.push(`Push error for ${userData.user_id}: ${pushError.message}`)
        }
      }

      // Mettre à jour le log
      const status = (emailSent || pushSent) ? 'sent' : 'failed'
      await supabase
        .from('notification_logs')
        .update({
          status,
          sent_at: (emailSent || pushSent) ? new Date().toISOString() : null,
          error_message: (!emailSent && !pushSent) ? 'Email et push échoués' : null
        })
        .eq('user_id', userData.user_id)
        .eq('notification_type', 'reminder')
        .gte('scheduled_at', todayStart.toISOString())

      if (emailSent || pushSent) {
        processed++
      }
    }

    return NextResponse.json({
      success: true,
      message: 'CRON exécuté avec succès',
      processed,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
      matchesFound: upcomingMatches.length,
      tournamentsFound: relevantTournaments.length,
      usersWithMissingMatches: userMissingMap.size
    })

  } catch (error: any) {
    console.error('CRON error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
