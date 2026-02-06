import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendMultiTournamentReminderEmail } from '@/lib/email/send'
import { sendPushNotification } from '@/lib/firebase-admin'

// Configuration
const BATCH_SIZE = 50 // Nombre d'utilisateurs à traiter par exécution

// Mettre CRON_ENABLED=true dans les variables d'environnement pour activer
const CRON_ENABLED = process.env.CRON_ENABLED === 'true'

// Type pour un match normalisé (imported ou custom)
interface NormalizedMatch {
  id: string
  matchday: number
  home_team: string
  away_team: string
  home_team_crest: string | null
  away_team_crest: string | null
  utc_date: string
  competition_id: number | null
  custom_competition_id: string | null
}

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
    competition_emblem: string | null
    matches: {
      id: string
      matchday: number
      home_team: string
      away_team: string
      home_team_crest: string | null
      away_team_crest: string | null
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

    // 1a. Récupérer les matchs IMPORTÉS du jour qui n'ont pas encore commencé
    const { data: importedMatches, error: importedMatchesError } = await supabase
      .from('imported_matches')
      .select('id, competition_id, matchday, home_team_name, away_team_name, home_team_crest, away_team_crest, utc_date')
      .gte('utc_date', now.toISOString())
      .lte('utc_date', endOfDay.toISOString())
      .in('status', ['SCHEDULED', 'TIMED'])

    if (importedMatchesError) {
      console.error('Error fetching imported matches:', importedMatchesError)
      return NextResponse.json({ error: 'Erreur récupération matchs importés' }, { status: 500 })
    }

    // 1b. Récupérer les matchs CUSTOM du jour (via custom_competition_matchdays)
    // D'abord, récupérer toutes les journées de compétitions custom
    const { data: customMatchdays } = await supabase
      .from('custom_competition_matchdays')
      .select('id, matchday_number, custom_competition_id')

    // Puis récupérer les matchs custom du jour
    const { data: customMatches, error: customMatchesError } = await supabase
      .from('custom_competition_matches')
      .select(`
        id,
        custom_matchday_id,
        imported_match_id,
        cached_home_team,
        cached_away_team,
        cached_utc_date
      `)
      .gte('cached_utc_date', now.toISOString())
      .lte('cached_utc_date', endOfDay.toISOString())

    if (customMatchesError) {
      console.error('Error fetching custom matches:', customMatchesError)
      return NextResponse.json({ error: 'Erreur récupération matchs custom' }, { status: 500 })
    }

    // Créer une map pour les journées custom
    const customMatchdayMap = new Map<string, { matchday_number: number; custom_competition_id: string }>()
    for (const md of customMatchdays || []) {
      customMatchdayMap.set(md.id, { matchday_number: md.matchday_number, custom_competition_id: md.custom_competition_id })
    }

    // Normaliser les matchs importés
    const normalizedImportedMatches: NormalizedMatch[] = (importedMatches || []).map(m => ({
      id: m.id,
      matchday: m.matchday,
      home_team: m.home_team_name,
      away_team: m.away_team_name,
      home_team_crest: m.home_team_crest || null,
      away_team_crest: m.away_team_crest || null,
      utc_date: m.utc_date,
      competition_id: m.competition_id,
      custom_competition_id: null
    }))

    // Normaliser les matchs custom
    const normalizedCustomMatches: NormalizedMatch[] = (customMatches || [])
      .filter(m => customMatchdayMap.has(m.custom_matchday_id))
      .map(m => {
        const mdInfo = customMatchdayMap.get(m.custom_matchday_id)!
        return {
          id: m.imported_match_id || m.id, // Utiliser imported_match_id si disponible, sinon l'ID custom
          matchday: mdInfo.matchday_number,
          home_team: m.cached_home_team || 'Équipe A',
          away_team: m.cached_away_team || 'Équipe B',
          home_team_crest: null, // Custom matches n'ont pas de logos
          away_team_crest: null,
          utc_date: m.cached_utc_date,
          competition_id: null,
          custom_competition_id: mdInfo.custom_competition_id
        }
      })

    // Fusionner les matchs
    const allUpcomingMatches = [...normalizedImportedMatches, ...normalizedCustomMatches]

    if (allUpcomingMatches.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Aucun match dans la fenêtre de rappel',
        processed: 0,
        skipped: 0
      })
    }

    console.log(`[REMINDERS] ${normalizedImportedMatches.length} matchs importés, ${normalizedCustomMatches.length} matchs custom`)

    // 2a. Récupérer les tournois actifs avec competition_id
    const competitionIds = [...new Set(normalizedImportedMatches.map(m => m.competition_id).filter(Boolean))] as number[]
    const { data: standardTournaments } = await supabase
      .from('tournaments')
      .select('id, name, slug, competition_id, custom_competition_id, competition_name, starting_matchday, ending_matchday')
      .in('competition_id', competitionIds.length > 0 ? competitionIds : [-1])
      .eq('status', 'active')

    // 2b. Récupérer les tournois actifs avec custom_competition_id
    const customCompetitionIds = [...new Set(normalizedCustomMatches.map(m => m.custom_competition_id).filter(Boolean))] as string[]
    const { data: customTournaments } = await supabase
      .from('tournaments')
      .select('id, name, slug, competition_id, custom_competition_id, competition_name, starting_matchday, ending_matchday')
      .in('custom_competition_id', customCompetitionIds.length > 0 ? customCompetitionIds : ['00000000-0000-0000-0000-000000000000'])
      .eq('status', 'active')

    // Type pour les tournois
    type TournamentInfo = {
      id: string
      name: string
      slug: string
      competition_id: number | null
      custom_competition_id: string | null
      competition_name: string | null
      starting_matchday: number | null
      ending_matchday: number | null
    }

    // Fusionner les tournois (éviter les doublons par ID)
    const tournamentMap = new Map<string, TournamentInfo>()
    for (const t of (standardTournaments || []) as TournamentInfo[]) {
      tournamentMap.set(t.id, t)
    }
    for (const t of (customTournaments || []) as TournamentInfo[]) {
      tournamentMap.set(t.id, t)
    }
    const allActiveTournaments = Array.from(tournamentMap.values())

    // Récupérer les noms des compétitions custom si nécessaire
    const customCompNames = new Map<string, string>()
    if (customCompetitionIds.length > 0) {
      const { data: customComps } = await supabase
        .from('custom_competitions')
        .select('id, name')
        .in('id', customCompetitionIds)
      for (const cc of customComps || []) {
        customCompNames.set(cc.id, cc.name)
      }
    }

    // Récupérer les emblèmes des compétitions standard
    const competitionEmblems = new Map<number, string>()
    if (competitionIds.length > 0) {
      const { data: competitions } = await supabase
        .from('competitions')
        .select('id, emblem')
        .in('id', competitionIds)
      for (const comp of competitions || []) {
        if (comp.emblem) {
          competitionEmblems.set(comp.id, comp.emblem)
        }
      }
    }

    // Calculer les matchdays concernés
    const matchdays = [...new Set(allUpcomingMatches.map(m => m.matchday))]

    // Filtrer les tournois qui couvrent les journées concernées
    const relevantTournaments = allActiveTournaments.filter(t => {
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

    console.log(`[REMINDERS] ${relevantTournaments.length} tournois actifs concernés`)

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
    const allMatchIds = allUpcomingMatches.map(m => m.id)
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
      // Matchs concernés pour ce tournoi (supports both standard and custom competitions)
      const tournamentMatches = allUpcomingMatches.filter(m => {
        // Vérifier la journée
        if (m.matchday < (tournament.starting_matchday || 1) || m.matchday > (tournament.ending_matchday || 999)) {
          return false
        }
        // Vérifier la compétition (standard ou custom)
        if (tournament.custom_competition_id) {
          return m.custom_competition_id === tournament.custom_competition_id
        } else {
          return m.competition_id === tournament.competition_id
        }
      })

      if (tournamentMatches.length === 0) continue

      const participants = participantsByTournament.get(tournament.id) || []
      if (participants.length === 0) continue

      // Déterminer le nom de la compétition
      const competitionName = tournament.custom_competition_id
        ? (customCompNames.get(tournament.custom_competition_id) || tournament.competition_name || 'Compétition')
        : (tournament.competition_name || 'Compétition')

      // Filtrer les utilisateurs qui ont activé les rappels (défaut: true si non configuré)
      const eligibleUsers = participants.filter(p => {
        const profile = p.profiles as any
        if (!profile || !profile.email) return false
        const prefs = profile.notification_preferences || {}
        // Par défaut, email_reminder est activé sauf si explicitement désactivé
        return prefs.email_reminder !== false
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
        // Récupérer l'emblème de la compétition
        const competitionEmblem = tournament.competition_id
          ? competitionEmblems.get(tournament.competition_id) || null
          : null

        userData.tournaments.push({
          id: tournament.id,
          name: tournament.name,
          slug: tournament.slug,
          competition_name: competitionName,
          competition_emblem: competitionEmblem,
          matches: missingMatches.map(m => ({
            id: m.id,
            matchday: m.matchday,
            home_team: m.home_team,
            away_team: m.away_team,
            home_team_crest: m.home_team_crest,
            away_team_crest: m.away_team_crest,
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
      // Délai pour respecter le rate limit Resend (2 req/sec max)
      await new Promise(resolve => setTimeout(resolve, 600))

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
            title = `⚽ ${totalMissingMatches} match${totalMissingMatches > 1 ? 's' : ''} à pronostiquer`
            body = `N'oublie pas tes pronostics pour ${t.name} avant ${deadlineStr} !`
          } else {
            // Plusieurs tournois
            title = `⚽ ${totalMissingMatches} matchs à pronostiquer`
            const tournamentNames = userData.tournaments.map(t => t.name).join(', ')
            body = `${userData.tournaments.length} tournois en attente : ${tournamentNames}. Limite : ${deadlineStr}`
          }

          // Construire l'URL de l'image dynamique avec les matchs
          // On aplatit les matchs avec l'info du tournoi pour pouvoir récupérer le logo compétition
          const allMatchesWithTournament = userData.tournaments.flatMap(t =>
            t.matches.map(m => ({ ...m, competition_emblem: t.competition_emblem }))
          )
          // Trier par date pour avoir le premier match chronologiquement
          allMatchesWithTournament.sort((a, b) => new Date(a.utc_date).getTime() - new Date(b.utc_date).getTime())

          const firstMatch = allMatchesWithTournament[0]
          const firstMatchDate = new Date(firstMatch.utc_date)
          const matchTime = firstMatchDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
          const deadlineTime = new Date(firstMatchDate.getTime() - 30 * 60 * 1000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })

          const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pronohub.app'
          const imageParams = new URLSearchParams({
            home: firstMatch.home_team,
            away: firstMatch.away_team,
            homeLogo: firstMatch.home_team_crest || '',
            awayLogo: firstMatch.away_team_crest || '',
            competitionLogo: firstMatch.competition_emblem || '',
            time: matchTime,
            deadline: deadlineTime,
            otherCount: String(allMatchesWithTournament.length - 1)
          })
          const imageUrl = `${baseUrl}/api/og/reminder?${imageParams.toString()}`

          pushSent = await sendPushNotification(
            userData.fcm_token,
            title,
            body,
            {
              type: 'reminder',
              totalMatches: String(totalMissingMatches),
              tournamentsCount: String(userData.tournaments.length),
              clickAction: '/dashboard'
            },
            imageUrl // Image dynamique avec les matchs du jour
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
      matchesFound: allUpcomingMatches.length,
      importedMatchesFound: normalizedImportedMatches.length,
      customMatchesFound: normalizedCustomMatches.length,
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
