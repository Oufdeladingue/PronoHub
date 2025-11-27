import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
// import { sendEmail } from '@/lib/email/send'
// import { getDetailedReminderTemplate } from '@/lib/email/templates'

// Configuration
const BATCH_SIZE = 50 // Nombre d'emails à traiter par exécution

// IMPORTANT: Cette route est désactivée pour ne pas consommer le quota Resend
// Mettre CRON_ENABLED=true dans les variables d'environnement pour activer
const CRON_ENABLED = process.env.CRON_ENABLED === 'true'

export async function GET(request: NextRequest) {
  // Vérifier le secret CRON pour sécuriser l'endpoint
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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
    const { data: upcomingMatches, error: matchesError } = await supabase
      .from('imported_matches')
      .select('id, competition_id, matchday, home_team_name, away_team_name, utc_date')
      .gte('utc_date', now.toISOString())
      .lte('utc_date', endOfDay.toISOString())
      .eq('status', 'SCHEDULED')

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

      // Récupérer les préférences de notification
      const { data: preferences } = await supabase
        .from('user_notification_preferences')
        .select('user_id, reminder_enabled, reminder_hours_before, quiet_hours_start, quiet_hours_end')
        .in('user_id', userIds)
        .eq('reminder_enabled', true)

      if (!preferences || preferences.length === 0) continue

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

          // TODO: Décommenter pour activer l'envoi réel d'emails
          /*
          try {
            const tournamentSlug = `${tournament.name.toLowerCase().replace(/\s+/g, '-')}_${tournament.slug}`
            const matchDate = new Date(match.utc_date)
            const formattedDate = matchDate.toLocaleDateString('fr-FR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              hour: '2-digit',
              minute: '2-digit'
            })

            const emailHtml = getPredictionReminderTemplate({
              username: userProfile?.username || 'Joueur',
              tournamentName: tournament.name,
              tournamentSlug,
              competitionName: tournament.competition_name,
              matchdayName: `Journée ${match.matchday}`,
              matches: [{
                homeTeam: match.home_team_name,
                awayTeam: match.away_team_name,
                matchDate: formattedDate,
                deadlineTime: new Date(matchDate.getTime() - 60 * 60 * 1000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
              }],
              defaultPredictionMaxPoints: 1
            })

            await sendEmail({
              to: userEmail,
              subject: `⚽ Rappel: ${match.home_team_name} vs ${match.away_team_name} - ${tournament.name}`,
              html: emailHtml
            })

            // Mettre à jour le log
            await supabase
              .from('notification_logs')
              .update({ status: 'sent', sent_at: new Date().toISOString() })
              .eq('user_id', userPref.user_id)
              .eq('notification_type', 'reminder')
              .eq('match_id', match.id)

            processed++
          } catch (emailError: any) {
            await supabase
              .from('notification_logs')
              .update({ status: 'failed', error_message: emailError.message })
              .eq('user_id', userPref.user_id)
              .eq('notification_type', 'reminder')
              .eq('match_id', match.id)

            errors.push(`Email error for ${userPref.user_id}: ${emailError.message}`)
          }
          */

          // Pour l'instant, on marque comme "skipped" car l'envoi est désactivé
          await supabase
            .from('notification_logs')
            .update({ status: 'skipped', error_message: 'Email sending disabled' })
            .eq('user_id', userPref.user_id)
            .eq('notification_type', 'reminder')
            .eq('match_id', match.id)

          processed++
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
