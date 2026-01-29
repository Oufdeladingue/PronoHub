import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendMatchdayChangesEmail } from '@/lib/email/send'
import { sendPushNotification } from '@/lib/firebase-admin'

// Configuration
const DELAY_HOURS = 1 // Délai avant notification (1 heure)
const WINDOW_DAYS = 14 // Fenêtre de matchs à notifier (14 jours)

// Mettre CRON_ENABLED=true dans les variables d'environnement pour activer
const CRON_ENABLED = process.env.CRON_ENABLED === 'true'

// Formater une date en français
function formatMatchDate(dateStr: string): string {
  const date = new Date(dateStr)
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit'
  }
  const formatted = date.toLocaleDateString('fr-FR', options)
  // Capitaliser la première lettre
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
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
      processed: 0
    })
  }

  try {
    const supabase = createAdminClient()
    const now = new Date()

    // Calculer la date limite (changements datant de plus d'1 heure)
    const delayDate = new Date(now)
    delayDate.setHours(delayDate.getHours() - DELAY_HOURS)

    // Calculer la fenêtre de 14 jours pour les matchs
    const windowDate = new Date(now)
    windowDate.setDate(windowDate.getDate() + WINDOW_DAYS)

    console.log(`[CUSTOM-CHANGES] Recherche des changements avant ${delayDate.toISOString()}`)
    console.log(`[CUSTOM-CHANGES] Fenêtre de matchs: jusqu'au ${windowDate.toISOString()}`)

    // 1. Récupérer les changements non notifiés datant de plus d'1 heure
    //    dont le match est dans les 14 prochains jours
    const { data: changes, error: changesError } = await supabase
      .from('custom_matchday_changes')
      .select(`
        id,
        matchday_id,
        custom_competition_id,
        change_type,
        cached_home_team,
        cached_away_team,
        cached_utc_date,
        cached_competition_name,
        created_at
      `)
      .is('notified_at', null)
      .lt('created_at', delayDate.toISOString())
      .lt('cached_utc_date', windowDate.toISOString())
      .gt('cached_utc_date', now.toISOString())
      .order('matchday_id')
      .order('created_at')

    if (changesError) {
      console.error('[CUSTOM-CHANGES] Error fetching changes:', changesError)
      return NextResponse.json({ error: 'Erreur récupération changements' }, { status: 500 })
    }

    if (!changes || changes.length === 0) {
      console.log('[CUSTOM-CHANGES] Aucun changement à notifier')
      return NextResponse.json({
        success: true,
        message: 'Aucun changement à notifier',
        processed: 0
      })
    }

    console.log(`[CUSTOM-CHANGES] ${changes.length} changements trouvés`)

    // 2. Regrouper les changements par matchday_id
    const changesByMatchday: Record<string, typeof changes> = {}
    for (const change of changes) {
      if (!changesByMatchday[change.matchday_id]) {
        changesByMatchday[change.matchday_id] = []
      }
      changesByMatchday[change.matchday_id].push(change)
    }

    const matchdayIds = Object.keys(changesByMatchday)
    console.log(`[CUSTOM-CHANGES] ${matchdayIds.length} journées concernées`)

    // 3. Récupérer les infos des journées
    const { data: matchdays, error: matchdaysError } = await supabase
      .from('custom_competition_matchdays')
      .select('id, matchday_number, custom_competition_id')
      .in('id', matchdayIds)

    if (matchdaysError) {
      console.error('[CUSTOM-CHANGES] Error fetching matchdays:', matchdaysError)
      return NextResponse.json({ error: 'Erreur récupération journées' }, { status: 500 })
    }

    const matchdayMap: Record<string, { number: number; competitionId: string }> = {}
    for (const md of matchdays || []) {
      matchdayMap[md.id] = { number: md.matchday_number, competitionId: md.custom_competition_id }
    }

    // 4. Récupérer les compétitions custom
    const competitionIds = [...new Set(changes.map(c => c.custom_competition_id))]
    const { data: competitions } = await supabase
      .from('custom_competitions')
      .select('id, name')
      .in('id', competitionIds)

    const competitionMap: Record<string, string> = {}
    for (const comp of competitions || []) {
      competitionMap[comp.id] = comp.name
    }

    // 5. Trouver les tournois concernés par ces compétitions custom
    //    et les participants de chaque tournoi
    const { data: tournaments, error: tournamentsError } = await supabase
      .from('tournaments')
      .select(`
        id,
        name,
        slug,
        custom_competition_id,
        starting_matchday,
        ending_matchday,
        tournament_participants (
          user_id,
          profiles (
            id,
            email,
            username,
            fcm_token
          )
        )
      `)
      .in('custom_competition_id', competitionIds)
      .in('status', ['warmup', 'active'])

    if (tournamentsError) {
      console.error('[CUSTOM-CHANGES] Error fetching tournaments:', tournamentsError)
      return NextResponse.json({ error: 'Erreur récupération tournois' }, { status: 500 })
    }

    if (!tournaments || tournaments.length === 0) {
      console.log('[CUSTOM-CHANGES] Aucun tournoi actif concerné')
      // Marquer les changements comme notifiés quand même
      await supabase
        .from('custom_matchday_changes')
        .update({ notified_at: now.toISOString() })
        .in('id', changes.map(c => c.id))

      return NextResponse.json({
        success: true,
        message: 'Aucun tournoi actif concerné',
        processed: changes.length,
        notifications: 0
      })
    }

    // 6. Pour chaque journée modifiée, notifier les participants des tournois concernés
    let emailsSent = 0
    let emailsFailed = 0
    let pushSent = 0
    let pushFailed = 0
    const errors: string[] = []

    // Récupérer le nombre de matchs par journée pour l'email
    const { data: matchCounts } = await supabase
      .from('custom_competition_matches')
      .select('custom_matchday_id')
      .in('custom_matchday_id', matchdayIds)

    const matchCountByMatchday: Record<string, number> = {}
    for (const m of matchCounts || []) {
      matchCountByMatchday[m.custom_matchday_id] = (matchCountByMatchday[m.custom_matchday_id] || 0) + 1
    }

    // Grouper les envois par (tournament, user)
    const notificationsToSend: Array<{
      tournament: typeof tournaments[0]
      user: { id: string; email: string | null; username: string | null; fcm_token: string | null }
      matchdayId: string
      matchdayNumber: number
      competitionName: string
      changes: typeof changes
    }> = []

    for (const matchdayId of matchdayIds) {
      const matchdayInfo = matchdayMap[matchdayId]
      if (!matchdayInfo) continue

      const matchdayChanges = changesByMatchday[matchdayId]
      const competitionId = matchdayInfo.competitionId
      const competitionName = competitionMap[competitionId] || 'Best of Week'

      // Trouver les tournois qui couvrent cette journée
      for (const tournament of tournaments) {
        if (tournament.custom_competition_id !== competitionId) continue

        // Vérifier que la journée est dans la plage du tournoi
        const startingMatchday = tournament.starting_matchday || 1
        const endingMatchday = tournament.ending_matchday || 999
        if (matchdayInfo.number < startingMatchday || matchdayInfo.number > endingMatchday) {
          continue
        }

        // Ajouter chaque participant
        for (const participant of tournament.tournament_participants || []) {
          const profile = participant.profiles as any
          if (!profile) continue

          notificationsToSend.push({
            tournament,
            user: {
              id: profile.id,
              email: profile.email,
              username: profile.username,
              fcm_token: profile.fcm_token
            },
            matchdayId,
            matchdayNumber: matchdayInfo.number,
            competitionName,
            changes: matchdayChanges
          })
        }
      }
    }

    console.log(`[CUSTOM-CHANGES] ${notificationsToSend.length} notifications à envoyer`)

    // Envoyer les notifications
    for (const notification of notificationsToSend) {
      const {
        tournament,
        user,
        matchdayId,
        matchdayNumber,
        competitionName,
        changes: matchdayChanges
      } = notification

      // Préparer les données pour l'email
      const changesForEmail = matchdayChanges.map(change => ({
        type: change.change_type as 'add' | 'remove',
        homeTeam: change.cached_home_team || 'Équipe A',
        awayTeam: change.cached_away_team || 'Équipe B',
        matchDate: change.cached_utc_date ? formatMatchDate(change.cached_utc_date) : 'Date à déterminer'
      }))

      // Envoyer l'email
      if (user.email) {
        try {
          const result = await sendMatchdayChangesEmail(user.email, {
            username: user.username || 'Joueur',
            tournamentName: tournament.name,
            tournamentSlug: tournament.slug,
            competitionName,
            matchdayNumber,
            changes: changesForEmail,
            totalMatchesInMatchday: matchCountByMatchday[matchdayId] || changesForEmail.length
          })

          if (result.success) {
            emailsSent++
            console.log(`[CUSTOM-CHANGES] Email envoyé à ${user.email} pour J${matchdayNumber}`)
          } else {
            emailsFailed++
            errors.push(`Email ${user.email}: ${result.error}`)
          }
        } catch (err) {
          emailsFailed++
          const errorMsg = err instanceof Error ? err.message : 'Unknown error'
          errors.push(`Email ${user.email}: ${errorMsg}`)
        }
      }

      // Envoyer la notification push
      if (user.fcm_token) {
        try {
          const addedCount = matchdayChanges.filter(c => c.change_type === 'add').length
          const removedCount = matchdayChanges.filter(c => c.change_type === 'remove').length

          let pushBody = ''
          if (addedCount > 0 && removedCount === 0) {
            pushBody = `${addedCount} match${addedCount > 1 ? 's' : ''} ajouté${addedCount > 1 ? 's' : ''} à la J${matchdayNumber}`
          } else if (removedCount > 0 && addedCount === 0) {
            pushBody = `${removedCount} match${removedCount > 1 ? 's' : ''} retiré${removedCount > 1 ? 's' : ''} de la J${matchdayNumber}`
          } else {
            pushBody = `J${matchdayNumber} mise à jour: ${addedCount} ajouté${addedCount > 1 ? 's' : ''}, ${removedCount} retiré${removedCount > 1 ? 's' : ''}`
          }

          const pushResult = await sendPushNotification(
            user.fcm_token,
            `🔄 ${tournament.name}`,
            pushBody,
            {
              type: 'matchday_changes',
              tournamentSlug: tournament.slug,
              url: `/${tournament.slug}/opposition`
            }
          )

          if (pushResult) {
            pushSent++
          } else {
            pushFailed++
          }
        } catch (err) {
          pushFailed++
        }
      }
    }

    // 7. Marquer tous les changements comme notifiés
    const changeIds = changes.map(c => c.id)
    await supabase
      .from('custom_matchday_changes')
      .update({ notified_at: now.toISOString() })
      .in('id', changeIds)

    console.log(`[CUSTOM-CHANGES] Terminé: ${emailsSent} emails, ${pushSent} push envoyés`)

    return NextResponse.json({
      success: true,
      message: 'Notifications envoyées',
      changes: changes.length,
      matchdays: matchdayIds.length,
      tournaments: tournaments.length,
      emails: { sent: emailsSent, failed: emailsFailed },
      push: { sent: pushSent, failed: pushFailed },
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined
    })

  } catch (error) {
    console.error('[CUSTOM-CHANGES] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Erreur serveur', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}
