import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendPushNotification } from '@/lib/firebase-admin'

// Test endpoint pour vérifier les notifications avec image
// Usage: GET /api/test-push-image?email=kochroman6@gmail.com
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')

  if (!email) {
    return NextResponse.json({ error: 'Email requis' }, { status: 400 })
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

  // Test 1: Image statique connue (logo Firebase)
  const staticImageUrl = 'https://www.gstatic.com/devrel-devsite/prod/v0e0f589edd85502a40d78d7d0825db8ea5ef3b99ab4070381ee86977c9168730/firebase/images/touchicon-180.png'

  // Test 2: Notre image OG dynamique
  const dynamicImageUrl = 'https://pronohub.club/api/og/reminder?home=PSG&away=Lyon&time=21:00&deadline=20:30&otherCount=2'

  // Choisir laquelle tester (modifier ici)
  const testImageUrl = dynamicImageUrl

  console.log('[Test Push] Envoi à:', profile.username)
  console.log('[Test Push] Image URL:', testImageUrl)

  try {
    const success = await sendPushNotification(
      profile.fcm_token,
      '🧪 Test Image Notification',
      'Cette notification devrait avoir une image !',
      { type: 'test' },
      testImageUrl
    )

    return NextResponse.json({
      success,
      username: profile.username,
      imageUrl: testImageUrl
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
