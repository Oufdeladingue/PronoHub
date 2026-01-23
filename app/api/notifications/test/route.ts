import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendPushNotification } from '@/lib/firebase-admin'

/**
 * API pour tester l'envoi d'une notification push à l'utilisateur connecté
 * POST /api/notifications/test
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Vérifier que l'utilisateur est authentifié
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // Récupérer le token FCM de l'utilisateur
    const { data: profile } = await supabase
      .from('profiles')
      .select('fcm_token, username')
      .eq('id', user.id)
      .single()

    if (!profile?.fcm_token) {
      return NextResponse.json({
        success: false,
        error: 'Aucun token FCM enregistré pour cet utilisateur',
        hint: 'Assurez-vous d\'avoir accepté les notifications dans l\'app'
      }, { status: 400 })
    }

    // Envoyer la notification de test
    const success = await sendPushNotification(
      profile.fcm_token,
      'Test PronoHub',
      `Bravo ${profile.username || 'champion'} ! Les notifications fonctionnent.`,
      { type: 'test', timestamp: new Date().toISOString() }
    )

    if (success) {
      return NextResponse.json({
        success: true,
        message: 'Notification de test envoyée',
        token: profile.fcm_token.substring(0, 20) + '...'
      })
    } else {
      return NextResponse.json({
        success: false,
        error: 'Échec de l\'envoi de la notification',
        hint: 'Vérifiez la configuration Firebase Admin (FIREBASE_SERVICE_ACCOUNT_KEY)'
      }, { status: 500 })
    }
  } catch (error) {
    console.error('[API Notifications Test] Erreur:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * GET pour vérifier le statut du token FCM
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('fcm_token, notification_preferences')
      .eq('id', user.id)
      .single()

    return NextResponse.json({
      hasToken: !!profile?.fcm_token,
      tokenPreview: profile?.fcm_token ? profile.fcm_token.substring(0, 30) + '...' : null,
      preferences: profile?.notification_preferences || null
    })
  } catch (error) {
    console.error('[API Notifications Test] Erreur:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
