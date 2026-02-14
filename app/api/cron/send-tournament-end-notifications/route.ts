import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendPushNotification } from '@/lib/firebase-admin'
import { sendTournamentEndEmail } from '@/lib/email/send'
import { getAvatarUrl } from '@/lib/avatars'
import { NOTIFICATION_CONFIG } from '@/lib/notifications'

// Adresses email de test à ne pas inclure (économie quota Resend)
const EMAIL_BLACKLIST = new Set([
  'admin@test.fr',
  'joueur1@test.fr',
  'joueur2@test.fr',
])

/**
 * Cron d'envoi des notifications de fin de tournoi (push + email)
 *
 * S'exécute à 8h du matin (Paris) pour envoyer les notifications
 * aux participants des tournois finalisés récemment.
 *
 * - Push : image OG personnalisée avec le classement du joueur
 * - Email : récap complet avec classement, stats, trophées
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.pronohub.club'
    const now = new Date()

    console.log('[TOURNAMENT-END-NOTIF] Starting at:', now.toISOString())

    // Chercher les tournois finalisés dans les dernières 48h
    const cutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString()
    const { data: tournaments, error: fetchError } = await supabase
      .from('tournaments')
      .select('id, name, slug, competition_id, custom_competition_id')
      .eq('status', 'completed')
      .gte('updated_at', cutoff)

    if (fetchError) {
      console.error('[TOURNAMENT-END-NOTIF] Error fetching tournaments:', fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    if (!tournaments || tournaments.length === 0) {
      console.log('[TOURNAMENT-END-NOTIF] No recently completed tournaments')
      return NextResponse.json({ success: true, message: 'No tournaments to notify', processed: 0 })
    }

    console.log(`[TOURNAMENT-END-NOTIF] Found ${tournaments.length} tournament(s) to process`)

    const results = {
      processed: 0,
      pushSent: 0,
      emailsSent: 0,
      skipped: 0,
      errors: [] as string[],
    }

    for (const tournament of tournaments) {
      results.processed++
      console.log(`[TOURNAMENT-END-NOTIF] Processing: ${tournament.name}`)

      // Récupérer les participants avec profils
      const { data: participants } = await supabase
        .from('tournament_participants')
        .select('user_id, profiles(id, username, avatar, email, fcm_token, notification_preferences)')
        .eq('tournament_id', tournament.id)

      if (!participants || participants.length === 0) {
        continue
      }

      // Récupérer le classement final via l'API
      let rankings: any[] = []
      try {
        const res = await fetch(`${baseUrl}/api/tournaments/${tournament.id}/rankings`)
        if (res.ok) {
          const data = await res.json()
          rankings = data.rankings || []
        }
      } catch (e) {
        console.error(`[TOURNAMENT-END-NOTIF] Error fetching rankings for ${tournament.name}:`, e)
      }

      // Map rank par userId
      const rankByUserId = new Map<string, any>()
      for (const r of rankings) {
        rankByUserId.set(r.playerId, r)
      }

      // Récupérer le nom de la compétition
      let competitionName = ''
      if (tournament.competition_id) {
        const { data: comp } = await supabase
          .from('competitions')
          .select('name')
          .eq('id', tournament.competition_id)
          .single()
        competitionName = comp?.name || ''
      } else if (tournament.custom_competition_id) {
        const { data: cc } = await supabase
          .from('custom_competitions')
          .select('name')
          .eq('id', tournament.custom_competition_id)
          .single()
        competitionName = cc?.name || ''
      }

      // Préparer le classement complet pour les emails
      const winner = rankings.length > 0
        ? { username: rankings[0].playerName, totalPoints: rankings[0].totalPoints }
        : { username: 'Inconnu', totalPoints: 0 }

      const finalRankingForEmail = rankings.map((r: any) => ({
        rank: r.rank,
        username: r.playerName,
        totalPoints: r.totalPoints,
        isCurrentUser: false, // sera mis à true par joueur
      }))

      const config = NOTIFICATION_CONFIG.tournament_end
      const totalPlayers = participants.length

      for (const participant of participants) {
        const profile = participant.profiles as any
        if (!profile) continue

        const userId = participant.user_id
        const username = profile.username || 'champion'
        const email = profile.email
        const prefs = profile.notification_preferences || {}

        // Vérifier les préférences
        if (prefs[config.prefKey] === false) {
          results.skipped++
          continue
        }

        const playerRankData = rankByUserId.get(userId)
        const rank = playerRankData?.rank || totalPlayers

        // ========== PUSH ==========
        if (profile.fcm_token) {
          // Vérifier si push déjà envoyé
          const { data: pushLog } = await supabase
            .from('notification_logs')
            .select('id')
            .eq('user_id', userId)
            .eq('notification_type', 'tournament_end')
            .eq('tournament_id', tournament.id)
            .eq('channel', 'push')
            .eq('status', 'sent')
            .limit(1)

          if (!pushLog || pushLog.length === 0) {
            const avatarPath = getAvatarUrl(profile.avatar || 'avatar1')
            const ogParams = new URLSearchParams({
              tournament: tournament.name,
              username,
              avatar: avatarPath,
              rank: String(rank),
              totalPlayers: String(totalPlayers),
            })
            const imageUrl = `${baseUrl}/api/og/tournament-end?${ogParams.toString()}`

            const title = config.defaultTitle
            const body = config.defaultBody.replace('{tournamentName}', tournament.name)

            try {
              const success = await sendPushNotification(
                profile.fcm_token,
                title,
                body,
                {
                  type: 'tournament_end',
                  clickAction: `/${tournament.slug}/opposition?tab=classement`,
                },
                imageUrl
              )

              await supabase.from('notification_logs').insert({
                user_id: userId,
                notification_type: 'tournament_end',
                tournament_id: tournament.id,
                channel: 'push',
                status: success ? 'sent' : 'failed',
                sent_at: success ? new Date().toISOString() : null,
              })

              if (success) results.pushSent++
            } catch (e: any) {
              console.error(`[TOURNAMENT-END-NOTIF] Push error for ${username}:`, e)
              results.errors.push(`Push ${username}: ${e.message}`)
            }
          }
        }

        // ========== EMAIL ==========
        if (email && !EMAIL_BLACKLIST.has(email)) {
          // Vérifier si email déjà envoyé
          const { data: emailLog } = await supabase
            .from('notification_logs')
            .select('id')
            .eq('user_id', userId)
            .eq('notification_type', 'tournament_end')
            .eq('tournament_id', tournament.id)
            .eq('channel', 'email')
            .eq('status', 'sent')
            .limit(1)

          if (!emailLog || emailLog.length === 0) {
            // Personnaliser le classement pour ce joueur
            const personalizedRanking = finalRankingForEmail.map(r => ({
              ...r,
              isCurrentUser: r.username === username,
            }))

            const userStats = playerRankData || {
              totalPoints: 0,
              exactScores: 0,
              correctResults: 0,
            }

            try {
              const emailResult = await sendTournamentEndEmail(email, {
                username,
                tournamentName: tournament.name,
                tournamentSlug: tournament.slug,
                competitionName,
                finalRanking: personalizedRanking,
                userFinalStats: {
                  finalRank: rank,
                  totalPoints: userStats.totalPoints || 0,
                  exactScores: userStats.exactScores || 0,
                  correctResults: userStats.correctResults || 0,
                  perfectMatchdays: 0,
                },
                winner,
              })

              await supabase.from('notification_logs').insert({
                user_id: userId,
                notification_type: 'tournament_end',
                tournament_id: tournament.id,
                channel: 'email',
                status: emailResult.success ? 'sent' : 'failed',
                sent_at: emailResult.success ? new Date().toISOString() : null,
                error_message: emailResult.error || null,
              })

              if (emailResult.success) {
                results.emailsSent++
                console.log(`[TOURNAMENT-END-NOTIF] ✅ Email sent to ${username}`)
              }
            } catch (e: any) {
              console.error(`[TOURNAMENT-END-NOTIF] Email error for ${username}:`, e)
              results.errors.push(`Email ${username}: ${e.message}`)
            }
          }
        }
      }
    }

    console.log('[TOURNAMENT-END-NOTIF] Completed:', results)

    return NextResponse.json({
      success: true,
      ...results,
      timestamp: now.toISOString(),
    })
  } catch (error: any) {
    console.error('[TOURNAMENT-END-NOTIF] Fatal error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
