import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendDetailedReminderEmail } from '@/lib/email/send'
import { sendPronosticReminder } from '@/lib/notifications'

// Configuration
const BATCH_SIZE = 50 // Nombre d'emails à traiter par exécution

// Mettre CRON_ENABLED=true dans les variables d'environnement pour activer
const CRON_ENABLED = process.env.CRON_ENABLED === 'true'

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

    // Récupérer les matchs du jour qui n'ont pas encore commencé
    // SCHEDULED = date prévue, TIMED = date et heure fixées
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

    // 2. Pour chaque match, trouver les tournois actifs sur cette compétition/journée
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

    // 3. Pour chaque tournoi, trouver les participants qui n'ont pas pronostiqué
    let processed = 0
    let skipped = 0
    const errors: string[] = []

    for (const tournament of relevantTournaments) {
      // Récupérer les matchs concernés pour ce tournoi
      const tournamentMatches = upcomingMatches.filter(m =>
        m.competition_id === tournament.competition_id &&
        m.matchday >= (tournament.starting_matchday || 1) &&
        m.matchday <= (tournament.ending_matchday || 999)
      )

      if (tournamentMatches.length === 0) continue

      // Récupérer les participants du tournoi
      const { data: participants } = await supabase
        .from('tournament_participants')
        .select('user_id')
        .eq('tournament_id', tournament.id)

      if (!participants || participants.length === 0) continue

      const userIds = participants.map(p => p.user_id)

      // Récupérer les préférences de notification depuis les profils
      const { data: userProfiles } = await supabase
        .from('profiles')
        .select('id, notification_preferences, fcm_token')
        .in('id', userIds)

      // Filtrer les utilisateurs qui ont activé les rappels (même préférence pour email et push)
      const preferences = (userProfiles || [])
        .filter(p => p.notification_preferences?.email_reminder === true)
        .map(p => ({
          user_id: p.id,
          email_enabled: true, // Si email_reminder est true, envoyer email
          push_enabled: !!p.fcm_token, // Si email_reminder est true ET token FCM, envoyer push aussi
          fcm_token: p.fcm_token,
          quiet_hours_start: '22:00',
          quiet_hours_end: '08:00'
        }))

      if (preferences.length === 0) continue

      // Pour chaque match, vérifier qui n'a pas pronostiqué
      for (const match of tournamentMatches) {
        // Récupérer les pronostics existants pour ce match
        const { data: existingPredictions } = await supabase
          .from('predictions')
          .select('user_id')
          .eq('tournament_id', tournament.id)
          .eq('match_id', match.id)

        const usersWithPrediction = new Set(existingPredictions?.map(p => p.user_id) || [])

        // Filtrer les utilisateurs qui n'ont pas pronostiqué et qui veulent des rappels
        const usersToNotify = preferences.filter(pref => {
          // Vérifier si l'utilisateur a déjà pronostiqué
          if (usersWithPrediction.has(pref.user_id)) return false

          // Vérifier les heures calmes
          const currentHour = now.getHours()
          const quietStart = parseInt(pref.quiet_hours_start?.split(':')[0] || '22')
          const quietEnd = parseInt(pref.quiet_hours_end?.split(':')[0] || '8')

          if (quietStart > quietEnd) {
            // Heures calmes passent minuit (ex: 22h-8h)
            if (currentHour >= quietStart || currentHour < quietEnd) return false
          } else {
            // Heures calmes dans la même journée
            if (currentHour >= quietStart && currentHour < quietEnd) return false
          }

          return true
        })

        // Vérifier si on n'a pas déjà envoyé un rappel pour ce match
        for (const userPref of usersToNotify.slice(0, BATCH_SIZE - processed)) {
          // Vérifier si un log existe déjà
          const { data: existingLog } = await supabase
            .from('notification_logs')
            .select('id')
            .eq('user_id', userPref.user_id)
            .eq('notification_type', 'reminder')
            .eq('tournament_id', tournament.id)
            .eq('match_id', match.id)
            .single()

          if (existingLog) {
            skipped++
            continue
          }

          // Récupérer les infos de l'utilisateur
          const { data: userProfile } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', userPref.user_id)
            .single()

          const { data: authUser } = await supabase.auth.admin.getUserById(userPref.user_id)
          const userEmail = authUser?.user?.email

          if (!userEmail) {
            skipped++
            continue
          }

          // Créer le log de notification (statut pending)
          const { error: logError } = await supabase
            .from('notification_logs')
            .insert({
              user_id: userPref.user_id,
              notification_type: 'reminder',
              tournament_id: tournament.id,
              matchday: match.matchday,
              match_id: match.id,
              status: 'pending',
              scheduled_at: now.toISOString()
            })

          if (logError) {
            errors.push(`Log error for ${userPref.user_id}: ${logError.message}`)
            continue
          }

          // Envoi des rappels (email + push)
          const tournamentSlug = `${tournament.name.toLowerCase().replace(/\s+/g, '-')}_${tournament.slug}`
          const matchDate = new Date(match.utc_date)
          const formattedDate = matchDate.toLocaleDateString('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            hour: '2-digit',
            minute: '2-digit'
          })

          let emailSent = false
          let pushSent = false

          // 1. Envoi email si activé
          if (userPref.email_enabled && userEmail) {
            try {
              const result = await sendDetailedReminderEmail(userEmail, {
                username: userProfile?.username || 'Joueur',
                tournamentName: tournament.name,
                tournamentSlug,
                competitionName: tournament.competition_name,
                matchdayName: `Journée ${match.matchday}`,
                matches: [{
                  homeTeam: match.home_team_name,
                  awayTeam: match.away_team_name,
                  matchDate: formattedDate,
                  deadlineTime: new Date(matchDate.getTime() - 30 * 60 * 1000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                }],
                defaultPredictionMaxPoints: 1
              })
              emailSent = result.success
              if (!result.success) {
                errors.push(`Email error for ${userPref.user_id}: ${result.error}`)
              }
            } catch (emailError: any) {
              errors.push(`Email error for ${userPref.user_id}: ${emailError.message}`)
            }
          }

          // 2. Envoi push notification si activé
          if (userPref.push_enabled) {
            try {
              pushSent = await sendPronosticReminder(
                userPref.user_id,
                tournament.name,
                tournamentSlug,
                1 // On envoie match par match donc 1
              )
            } catch (pushError: any) {
              errors.push(`Push error for ${userPref.user_id}: ${pushError.message}`)
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
            .eq('user_id', userPref.user_id)
            .eq('notification_type', 'reminder')
            .eq('match_id', match.id)

          if (emailSent || pushSent) {
            processed++
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'CRON exécuté avec succès',
      processed,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
      matchesFound: upcomingMatches.length,
      tournamentsFound: relevantTournaments.length
    })

  } catch (error: any) {
    console.error('CRON error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
