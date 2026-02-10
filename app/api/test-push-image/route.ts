import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendPushNotification } from '@/lib/firebase-admin'
import { getTrophyInfo } from '@/lib/trophy-info'

// Test endpoint pour vérifier les notifications badge_unlocked avec image OG
// Usage: GET /api/test-push-image?email=ton@email.com
// Optionnel: &trophy=king_of_day (par défaut: exact_score)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')
  const trophyType = searchParams.get('trophy') || 'exact_score'

  if (!email) {
    return NextResponse.json({ error: 'Email requis (?email=ton@email.com)' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Récupérer le FCM token de l'utilisateur
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, fcm_token')
    .eq('email', email)
    .single()

  if (!profile?.fcm_token) {
    return NextResponse.json({ error: 'Utilisateur non trouvé ou pas de FCM token' }, { status: 404 })
  }

  const trophyInfo = getTrophyInfo(trophyType)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.pronohub.club'

  // Construire l'URL de l'image OG badge-unlocked avec un match fictif
  const imageParams = new URLSearchParams({
    badgeName: trophyInfo.name,
    badgeDescription: trophyInfo.description,
    badgeImage: trophyInfo.imagePath,
    home: 'Paris Saint-Germain',
    away: 'Olympique de Marseille',
    homeLogo: 'https://crests.football-data.org/524.png',
    awayLogo: 'https://crests.football-data.org/516.png',
    homeScore: '3',
    awayScore: '1',
    predHome: '3',
    predAway: '1',
    matchDate: new Date().toISOString(),
  })
  const imageUrl = `${baseUrl}/api/og/badge-unlocked?${imageParams.toString()}`

  console.log('[Test Push Badge] Envoi à:', profile.username)
  console.log('[Test Push Badge] Trophy:', trophyType, '-', trophyInfo.name)
  console.log('[Test Push Badge] Image URL:', imageUrl)

  try {
    const success = await sendPushNotification(
      profile.fcm_token,
      'Trophée débloqué ! 🏅',
      `Une ligne de plus sur ton palmarès ! Badge ${trophyInfo.name} déverrouillé`,
      {
        type: 'badge_unlocked',
        clickAction: '/profile?tab=trophees',
        trophyType,
        trophyName: trophyInfo.name
      },
      imageUrl
    )

    return NextResponse.json({
      success,
      username: profile.username,
      trophyType,
      trophyName: trophyInfo.name,
      imageUrl
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
