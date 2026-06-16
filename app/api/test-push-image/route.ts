import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { createAdminClient } from '@/lib/supabase/server'
import { sendPushNotification } from '@/lib/firebase-admin'
import { sendBadgeUnlockedEmail } from '@/lib/email/send'
import { getTrophyInfo } from '@/lib/trophy-info'
import { getAvatarUrl } from '@/lib/avatars'

// Comparaison à temps constant (évite l'oracle de timing sur le secret)
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

// Test endpoint pour vérifier les notifications avec images (push + email)
// Usage: GET /api/test-push-image?secret=CRON_SECRET&email=ton@email.com
// Optionnel: &trophy=king_of_day (par défaut: exact_score)
// Optionnel: &mode=push|email|both (par défaut: push)
// Optionnel: &type=badge_unlocked|new_matches|tournament_started|tournament_end|player_joined (par défaut: badge_unlocked)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  // Protection : envoie des push/emails réels → réservé au porteur du secret.
  // (Secret en query-param pour rester testable via navigateur, cf. workflow de test.)
  const secret = searchParams.get('secret')
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return NextResponse.json({ error: 'CRON_SECRET non configuré' }, { status: 500 })
  }
  if (!secret || !safeEqual(secret, expected)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const email = searchParams.get('email')
  const trophyType = searchParams.get('trophy') || 'exact_score'
  const mode = searchParams.get('mode') || 'push' // push, email, both
  const notifType = searchParams.get('type') || 'badge_unlocked'

  if (!email) {
    return NextResponse.json({ error: 'Email requis (?email=ton@email.com)' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Récupérer le FCM token de l'utilisateur
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, username, email, fcm_token, avatar')
    .eq('email', email)
    .single()

  if (profileError || !profile) {
    return NextResponse.json({
      error: `Profil non trouvé pour l'email "${email}"`,
      hint: 'Vérifie que l\'email correspond exactement à celui de ton compte PronoHub',
      dbError: profileError?.message
    }, { status: 404 })
  }

  if (mode !== 'email' && !profile.fcm_token) {
    return NextResponse.json({
      error: `Profil trouvé (${profile.username}) mais pas de FCM token`,
      hint: 'Ouvre l\'app PronoHub sur ton Android, ou utilise &mode=email pour tester l\'email'
    }, { status: 404 })
  }

  const trophyInfo = getTrophyInfo(trophyType)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.pronohub.club'

  // Match fictif pour le test
  const fakeMatch = {
    homeTeamName: 'Paris Saint-Germain',
    awayTeamName: 'Olympique de Marseille',
    homeTeamCrest: 'https://crests.football-data.org/524.png',
    awayTeamCrest: 'https://crests.football-data.org/516.png',
    homeScore: 3,
    awayScore: 1,
    predictedHomeScore: 3,
    predictedAwayScore: 1,
    matchDate: new Date().toISOString(),
  }

  console.log(`[Test Badge] Envoi à: ${profile.username}, mode: ${mode}, trophy: ${trophyType}`)

  const results: Record<string, any> = {
    username: profile.username,
    trophyType,
    trophyName: trophyInfo.name,
    mode,
  }

  try {
    if (notifType === 'tournament_started') {
      // --- TEST TOURNAMENT STARTED ---
      if ((mode === 'push' || mode === 'both') && profile.fcm_token) {
        const imageParams = new URLSearchParams({
          tournament: 'PronoHub League',
          home: fakeMatch.homeTeamName,
          away: fakeMatch.awayTeamName,
          homeLogo: fakeMatch.homeTeamCrest,
          awayLogo: fakeMatch.awayTeamCrest,
          competitionLogo: 'https://crests.football-data.org/FL1.png',
          time: '21:00',
        })
        const imageUrl = `${baseUrl}/api/og/tournament-started?${imageParams.toString()}`

        results.pushSuccess = await sendPushNotification(
          profile.fcm_token,
          'Place au jeu, le tournoi démarre ! ⚽',
          `PronoHub League vient de démarrer ! Premier match : ${fakeMatch.homeTeamName} vs ${fakeMatch.awayTeamName}. Valide tes pronos !`,
          { type: 'tournament_started', clickAction: '/dashboard' },
          imageUrl
        )
        results.imageUrl = imageUrl
      }
    } else if (notifType === 'tournament_end') {
      // --- TEST TOURNAMENT END ---
      if ((mode === 'push' || mode === 'both') && profile.fcm_token) {
        const avatarPath = getAvatarUrl((profile as any).avatar || 'avatar1')
        const imageParams = new URLSearchParams({
          tournament: 'PronoHub League',
          username: profile.username || 'champion',
          avatar: avatarPath,
          rank: '2',
          totalPlayers: '8',
        })
        const imageUrl = `${baseUrl}/api/og/tournament-end?${imageParams.toString()}`

        results.pushSuccess = await sendPushNotification(
          profile.fcm_token,
          'Alors ? C\'est qui le champion ? 🏆',
          'Le tournoi PronoHub League est terminé, c\'est le moment de voir qui est n°1 dans ta team...',
          { type: 'tournament_end', clickAction: '/dashboard' },
          imageUrl
        )
        results.imageUrl = imageUrl
      }
    } else if (notifType === 'player_joined') {
      // --- TEST PLAYER JOINED ---
      if ((mode === 'push' || mode === 'both') && profile.fcm_token) {
        const avatarPath = getAvatarUrl((profile as any).avatar || 'avatar1')
        const imageParams = new URLSearchParams({
          tournament: 'PronoHub League',
          username: profile.username || 'champion',
          avatar: avatarPath,
        })
        const imageUrl = `${baseUrl}/api/og/player-joined?${imageParams.toString()}`

        results.pushSuccess = await sendPushNotification(
          profile.fcm_token,
          'Un nouveau joueur dans le vestiaire ! 👋',
          `${profile.username || 'Un joueur'} vient de rejoindre PronoHub League. La concurrence s'intensifie.`,
          { type: 'player_joined', clickAction: '/dashboard' },
          imageUrl
        )
        results.imageUrl = imageUrl
      }
    } else if (notifType === 'new_matches') {
      // --- TEST NEW MATCHES ---
      if ((mode === 'push' || mode === 'both') && profile.fcm_token) {
        const imageParams = new URLSearchParams({
          tournament: 'PronoHub League',
          home: fakeMatch.homeTeamName,
          away: fakeMatch.awayTeamName,
          homeLogo: fakeMatch.homeTeamCrest,
          awayLogo: fakeMatch.awayTeamCrest,
          competitionLogo: 'https://crests.football-data.org/FL1.png',
          time: '21:00',
          otherCount: '2',
        })
        const imageUrl = `${baseUrl}/api/og/new-matches?${imageParams.toString()}`

        results.pushSuccess = await sendPushNotification(
          profile.fcm_token,
          'Nouvelles rencontres à pronostiquer ! ⚽',
          `Le juge de ligne a levé son drapeau : il signale 3 nouveaux matchs ajoutés dans PronoHub League. N'oublie pas de les renseigner...`,
          { type: 'new_matches', clickAction: '/dashboard' },
          imageUrl
        )
        results.imageUrl = imageUrl
      }
    } else {
      // --- TEST BADGE UNLOCKED (default) ---
      if ((mode === 'push' || mode === 'both') && profile.fcm_token) {
        const imageParams = new URLSearchParams({
          badgeName: trophyInfo.name,
          badgeDescription: trophyInfo.description,
          badgeImage: trophyInfo.imagePath,
          home: fakeMatch.homeTeamName,
          away: fakeMatch.awayTeamName,
          homeLogo: fakeMatch.homeTeamCrest,
          awayLogo: fakeMatch.awayTeamCrest,
          homeScore: String(fakeMatch.homeScore),
          awayScore: String(fakeMatch.awayScore),
          predHome: String(fakeMatch.predictedHomeScore),
          predAway: String(fakeMatch.predictedAwayScore),
          matchDate: fakeMatch.matchDate,
        })
        const imageUrl = `${baseUrl}/api/og/badge-unlocked?${imageParams.toString()}`

        results.pushSuccess = await sendPushNotification(
          profile.fcm_token,
          'Trophée débloqué ! 🏅',
          `Une ligne de plus sur ton palmarès ! Badge ${trophyInfo.name} déverrouillé`,
          { type: 'badge_unlocked', clickAction: '/profile?tab=trophees', trophyType, trophyName: trophyInfo.name },
          imageUrl
        )
        results.imageUrl = imageUrl
      }
    }

    // --- EMAIL (badge_unlocked uniquement pour l'instant) ---
    if ((mode === 'email' || mode === 'both') && notifType !== 'new_matches') {
      const emailResult = await sendBadgeUnlockedEmail(email, {
        username: profile.username || 'champion',
        trophyName: trophyInfo.name,
        trophyDescription: trophyInfo.description,
        trophyImageUrl: `${baseUrl}${trophyInfo.imagePath}`,
        triggerMatch: fakeMatch,
      })
      results.emailSuccess = emailResult.success
      results.emailError = emailResult.error || undefined
    }

    return NextResponse.json(results)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
