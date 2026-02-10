import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendPushNotification } from '@/lib/firebase-admin'
import { sendBadgeUnlockedEmail } from '@/lib/email/send'
import { getTrophyInfo } from '@/lib/trophy-info'

// Test endpoint pour vérifier les notifications badge_unlocked (push + email)
// Usage: GET /api/test-push-image?email=ton@email.com
// Optionnel: &trophy=king_of_day (par défaut: exact_score)
// Optionnel: &mode=push|email|both (par défaut: push)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')
  const trophyType = searchParams.get('trophy') || 'exact_score'
  const mode = searchParams.get('mode') || 'push' // push, email, both

  if (!email) {
    return NextResponse.json({ error: 'Email requis (?email=ton@email.com)' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Récupérer le FCM token de l'utilisateur
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, username, email, fcm_token')
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
    // --- PUSH ---
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

    // --- EMAIL ---
    if (mode === 'email' || mode === 'both') {
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
