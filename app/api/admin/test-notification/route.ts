import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendPushNotification } from '@/lib/firebase-admin'

/**
 * API admin pour tester l'envoi de notification push
 * POST /api/admin/test-notification
 * Body: { username: string }
 *
 * Protégé par CRON_SECRET pour un accès admin uniquement
 */
export async function POST(request: Request) {
  try {
    // Vérifier l'authentification admin via header secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const body = await request.json()
    const { username } = body

    if (!username) {
      return NextResponse.json({ error: 'Username requis' }, { status: 400 })
    }

    // Utiliser le client admin pour accéder à la base
    const supabase = createAdminClient()

    // Récupérer le profil de l'utilisateur
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, username, fcm_token')
      .ilike('username', username)
      .single()

    if (error || !profile) {
      return NextResponse.json({
        error: `Utilisateur "${username}" non trouvé`,
        details: error?.message
      }, { status: 404 })
    }

    if (!profile.fcm_token) {
      return NextResponse.json({
        success: false,
        error: 'Aucun token FCM enregistré pour cet utilisateur',
        user: profile.username,
        hint: 'L\'utilisateur doit accepter les notifications dans l\'app Android'
      }, { status: 400 })
    }

    // Envoyer la notification de test
    try {
      await sendPushNotification(
        profile.fcm_token,
        'Test PronoHub Admin',
        `Salut ${profile.username} ! Cette notification de test fonctionne.`,
        {
          type: 'admin_test',
          timestamp: new Date().toISOString()
        }
      )

      return NextResponse.json({
        success: true,
        message: `Notification envoyée à ${profile.username}`,
        tokenPreview: profile.fcm_token.substring(0, 30) + '...'
      })
    } catch (fcmError: any) {
      return NextResponse.json({
        success: false,
        error: 'Échec de l\'envoi FCM',
        fcmError: {
          code: fcmError.code || 'unknown',
          message: fcmError.message || String(fcmError)
        },
        tokenPreview: profile.fcm_token.substring(0, 30) + '...'
      }, { status: 500 })
    }
  } catch (error: any) {
    console.error('[API Admin Test Notification] Erreur:', error)
    return NextResponse.json({
      error: 'Erreur serveur',
      details: error.message
    }, { status: 500 })
  }
}

/**
 * GET pour vérifier le token FCM d'un utilisateur
 */
export async function GET(request: Request) {
  try {
    // Vérifier l'authentification admin
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const username = searchParams.get('username')

    if (!username) {
      return NextResponse.json({ error: 'Username requis en query param' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, username, fcm_token, notification_preferences')
      .ilike('username', username)
      .single()

    if (error || !profile) {
      return NextResponse.json({
        error: `Utilisateur "${username}" non trouvé`
      }, { status: 404 })
    }

    return NextResponse.json({
      username: profile.username,
      hasToken: !!profile.fcm_token,
      tokenPreview: profile.fcm_token ? profile.fcm_token.substring(0, 30) + '...' : null,
      preferences: profile.notification_preferences
    })
  } catch (error: any) {
    console.error('[API Admin Test Notification] Erreur:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
