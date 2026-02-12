import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendBadgeUnlockedEmail } from '@/lib/email/send'
import { sendPushNotification } from '@/lib/firebase-admin'
import { getTrophyInfo, TROPHY_TYPE_UUIDS } from '@/lib/trophy-info'
import { NOTIFICATION_CONFIG } from '@/lib/notifications'
import { calculateTrophiesForTournament, type TriggerMatchInfo } from '@/lib/trophy-calculator'

const CRON_ENABLED = process.env.CRON_ENABLED === 'true'

// Adresses email de test à ne pas inclure (économie quota Resend)
const EMAIL_BLACKLIST = new Set([
  'admin@test.fr',
  'joueur1@test.fr',
  'joueur2@test.fr',
])

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.pronohub.club'

export async function GET(request: NextRequest) {
  // Vérifier le secret CRON pour sécuriser l'endpoint
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[CHECK-TROPHIES] CRON_SECRET is not configured')
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!CRON_ENABLED) {
    return NextResponse.json({
      success: true,
      message: 'CRON désactivé (CRON_ENABLED=false)',
      trophiesUnlocked: 0,
      pushSent: 0,
      emailsSent: 0
    })
  }

  try {
    const supabase = createAdminClient()
    const now = new Date()

    console.log('[CHECK-TROPHIES] Starting trophy check at:', now.toISOString())

    // 1. Récupérer les tournois actifs + récemment terminés (48h)
    //    Les tournois terminés sont nécessaires pour tournament_winner, legend, abyssal
    const cutoffDate = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString()

    const { data: activeTournaments } = await supabase
      .from('tournaments')
      .select('*')
      .eq('status', 'active')

    const { data: recentlyFinishedTournaments } = await supabase
      .from('tournaments')
      .select('*')
      .in('status', ['completed', 'finished'])
      .gte('updated_at', cutoffDate)

    const tournaments = [
      ...(activeTournaments || []),
      ...(recentlyFinishedTournaments || [])
    ]

    if (tournaments.length === 0) {
      console.log('[CHECK-TROPHIES] No tournaments to process')
      return NextResponse.json({ success: true, message: 'No tournaments to process', trophiesUnlocked: 0 })
    }

    console.log(`[CHECK-TROPHIES] Processing ${tournaments.length} tournaments (${activeTournaments?.length || 0} active, ${recentlyFinishedTournaments?.length || 0} recently finished)`)

    let totalTrophiesUnlocked = 0
    let totalPushSent = 0
    let totalEmailsSent = 0
    let totalSkipped = 0
    let totalErrors = 0
    const errors: string[] = []

    // 2. Traiter chaque tournoi
    for (const tournament of tournaments) {
      try {
        if (!tournament.starting_matchday || !tournament.ending_matchday) {
          console.log(`[CHECK-TROPHIES] Tournament "${tournament.name}": no matchdays defined, skipping`)
          continue
        }

        // Récupérer les participants avec profils
        const { data: participants } = await supabase
          .from('tournament_participants')
          .select('user_id, profiles(id, username, email, notification_preferences, fcm_token)')
          .eq('tournament_id', tournament.id)

        if (!participants || participants.length === 0) continue

        const participantIds = participants.map((p: any) => p.user_id)

        console.log(`[CHECK-TROPHIES] Tournament "${tournament.name}": ${participantIds.length} participants`)

        // Calculer les trophées
        const trophyResults = await calculateTrophiesForTournament(
          supabase,
          tournament,
          participantIds
        )

        // 3. Traiter les résultats pour chaque participant
        for (const participant of participants) {
          const userId = participant.user_id
          const profile = participant.profiles as any
          const result = trophyResults.get(userId)

          if (!result || result.newTrophies.length === 0) continue

          // Upsert les nouveaux trophées en BDD
          const trophiesToInsert = result.newTrophies.map(type => ({
            user_id: userId,
            trophy_type: type,
            unlocked_at: result.trophyDates[type],
            is_new: true
          }))

          const { error: insertError } = await supabase
            .from('user_trophies')
            .upsert(trophiesToInsert, {
              onConflict: 'user_id,trophy_type',
              ignoreDuplicates: true
            })

          if (insertError) {
            console.error(`[CHECK-TROPHIES] Error inserting trophies for user ${userId}:`, insertError)
            continue
          }

          totalTrophiesUnlocked += result.newTrophies.length
          console.log(`[CHECK-TROPHIES] 🏆 ${profile?.username || userId}: ${result.newTrophies.length} new trophies: ${result.newTrophies.join(', ')}`)

          // Vérifier les préférences de notification
          const prefs = profile?.notification_preferences || {}
          const config = NOTIFICATION_CONFIG.badge_unlocked
          const notifDisabled = prefs[config.prefKey] === false

          if (notifDisabled) {
            totalSkipped += result.newTrophies.length
            continue
          }

          // Envoyer les notifications pour chaque nouveau trophée
          for (const trophyType of result.newTrophies) {
            const trophyInfo = getTrophyInfo(trophyType)
            const trophyUuid = TROPHY_TYPE_UUIDS[trophyType]
            const triggerMatch = result.trophyTriggerMatches[trophyType]

            // Construire l'URL de l'image OG dynamique
            const imageUrl = buildBadgeImageUrl(trophyInfo, triggerMatch)

            // Canal : push si FCM token, sinon email (jamais les deux)
            if (profile?.fcm_token) {
              // --- PUSH (prioritaire si FCM token) ---
              const { data: existingPushLog } = await supabase
                .from('notification_logs')
                .select('id')
                .eq('user_id', userId)
                .eq('notification_type', 'badge_unlocked')
                .eq('match_id', trophyUuid)
                .eq('channel', 'push')
                .eq('status', 'sent')
                .limit(1)

              if (!existingPushLog || existingPushLog.length === 0) {
                try {
                  const title = 'Trophée débloqué ! 🏅'
                  const body = `Une ligne de plus sur ton palmarès ! Badge ${trophyInfo.name} déverrouillé`
                  const data = {
                    type: 'badge_unlocked',
                    clickAction: config.clickAction || '/profile?tab=trophees',
                    trophyType,
                    trophyName: trophyInfo.name
                  }

                  const pushResult = await sendPushNotification(profile.fcm_token, title, body, data, imageUrl)

                  await supabase.from('notification_logs').insert({
                    user_id: userId,
                    notification_type: 'badge_unlocked',
                    match_id: trophyUuid,
                    channel: 'push',
                    status: pushResult ? 'sent' : 'failed',
                    sent_at: pushResult ? new Date().toISOString() : null
                  })

                  if (pushResult) {
                    totalPushSent++
                    console.log(`[CHECK-TROPHIES] ✅ Push sent to ${profile?.username} for "${trophyInfo.name}"`)
                  }
                } catch (pushError: any) {
                  console.error(`[CHECK-TROPHIES] ❌ Push error for ${profile?.username}:`, pushError.message)
                  totalErrors++
                }
              }
            } else {
              // --- EMAIL (seulement si pas de FCM token) ---
              const email = profile?.email
              if (email && !EMAIL_BLACKLIST.has(email.toLowerCase())) {
                const { data: existingEmailLog } = await supabase
                  .from('notification_logs')
                  .select('id')
                  .eq('user_id', userId)
                  .eq('notification_type', 'badge_unlocked')
                  .eq('match_id', trophyUuid)
                  .eq('channel', 'email')
                  .eq('status', 'sent')
                  .limit(1)

                if (!existingEmailLog || existingEmailLog.length === 0) {
                  try {
                    await supabase
                      .from('notification_logs')
                      .delete()
                      .eq('user_id', userId)
                      .eq('notification_type', 'badge_unlocked')
                      .eq('match_id', trophyUuid)
                      .eq('channel', 'email')
                      .eq('status', 'failed')

                    await new Promise(resolve => setTimeout(resolve, 600))

                    const emailResult = await sendBadgeUnlockedEmail(email, {
                      username: profile?.username || 'champion',
                      trophyName: trophyInfo.name,
                      trophyDescription: trophyInfo.description,
                      trophyImageUrl: `${BASE_URL}${trophyInfo.imagePath}`,
                      triggerMatch: triggerMatch ? {
                        homeTeamName: triggerMatch.homeTeamName,
                        awayTeamName: triggerMatch.awayTeamName,
                        homeTeamCrest: triggerMatch.homeTeamCrest || undefined,
                        awayTeamCrest: triggerMatch.awayTeamCrest || undefined,
                        homeScore: triggerMatch.homeScore,
                        awayScore: triggerMatch.awayScore,
                        predictedHomeScore: triggerMatch.predictedHomeScore,
                        predictedAwayScore: triggerMatch.predictedAwayScore,
                        matchDate: triggerMatch.utcDate,
                      } : undefined,
                    })

                    await supabase.from('notification_logs').insert({
                      user_id: userId,
                      notification_type: 'badge_unlocked',
                      match_id: trophyUuid,
                      channel: 'email',
                      status: emailResult.success ? 'sent' : 'failed',
                      sent_at: emailResult.success ? new Date().toISOString() : null,
                      error_message: emailResult.error || null
                    })

                    if (emailResult.success) {
                      totalEmailsSent++
                      console.log(`[CHECK-TROPHIES] ✅ Email sent to ${profile?.username} for "${trophyInfo.name}"`)
                    } else {
                      totalErrors++
                      errors.push(`Email failed for ${profile?.username}: ${emailResult.error}`)
                    }
                  } catch (emailError: any) {
                    totalErrors++
                    errors.push(`Email exception for ${profile?.username}: ${emailError.message}`)
                    console.error(`[CHECK-TROPHIES] ❌ Email error for ${profile?.username}:`, emailError.message)
                  }
              }
            }
          }
        }
      } catch (tournamentError: any) {
        totalErrors++
        errors.push(`Tournament ${tournament.name}: ${tournamentError.message}`)
        console.error(`[CHECK-TROPHIES] Error processing tournament "${tournament.name}":`, tournamentError)
      }
    }

    console.log(`[CHECK-TROPHIES] Process completed: ${totalTrophiesUnlocked} trophies, ${totalPushSent} push, ${totalEmailsSent} emails, ${totalSkipped} skipped, ${totalErrors} errors`)

    return NextResponse.json({
      success: true,
      message: 'Trophy check completed',
      trophiesUnlocked: totalTrophiesUnlocked,
      pushSent: totalPushSent,
      emailsSent: totalEmailsSent,
      skipped: totalSkipped,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: now.toISOString()
    })

  } catch (error: any) {
    console.error('[CHECK-TROPHIES] Fatal error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * Construit l'URL de l'image OG dynamique pour la notification push
 */
function buildBadgeImageUrl(
  trophyInfo: { name: string; description: string; imagePath: string },
  triggerMatch?: TriggerMatchInfo
): string {
  const params = new URLSearchParams({
    badgeName: trophyInfo.name,
    badgeDescription: trophyInfo.description,
    badgeImage: trophyInfo.imagePath,
  })

  if (triggerMatch) {
    params.set('home', triggerMatch.homeTeamName)
    params.set('away', triggerMatch.awayTeamName)
    if (triggerMatch.homeTeamCrest) params.set('homeLogo', triggerMatch.homeTeamCrest)
    if (triggerMatch.awayTeamCrest) params.set('awayLogo', triggerMatch.awayTeamCrest)
    params.set('homeScore', String(triggerMatch.homeScore))
    params.set('awayScore', String(triggerMatch.awayScore))
    params.set('predHome', String(triggerMatch.predictedHomeScore))
    params.set('predAway', String(triggerMatch.predictedAwayScore))
    params.set('matchDate', triggerMatch.utcDate)
  }

  return `${BASE_URL}/api/og/badge-unlocked?${params.toString()}`
}
