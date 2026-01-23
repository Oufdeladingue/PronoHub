import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendPushNotification } from '@/lib/firebase-admin'

/**
 * API pour tester l'envoi d'une notification push à l'utilisateur connecté
 * POST /api/notifications/test
 * Body: { type?: 'test' | 'reminder' | 'tournament_started' | 'day_recap' | 'tournament_end' | 'invite' | 'player_joined' }
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

    // Récupérer le type de notification à tester
    const body = await request.json().catch(() => ({}))
    const type = body.type || 'test'
    const username = profile.username || 'champion'

    // Configurer le message selon le type
    const notifications: Record<string, { title: string; body: string; data?: Record<string, string> }> = {
      test: {
        title: 'Test PronoHub',
        body: `Bravo ${username} ! Les notifications fonctionnent.`,
        data: { type: 'test' }
      },
      reminder: {
        title: 'Pronostics en attente ⚽',
        body: 'Tu n\'as pas encore pronostiqué pour Ligue des Champions. 1 match à pronostiquer avant 20h00 !',
        data: {
          type: 'reminder',
          tournamentSlug: 'ligue-des-champions-2024',
          missingCount: '1'
        }
      },
      tournament_started: {
        title: 'Tournoi lancé ! 🚀',
        body: 'Le tournoi "Ligue des Champions 2024/25" vient de commencer. C\'est parti !',
        data: {
          type: 'tournament_started',
          tournamentSlug: 'ligue-des-champions-2024'
        }
      },
      day_recap: {
        title: 'Récap de la journée 📊',
        body: 'Journée 6 terminée ! Tu as marqué 18 points. Découvre ton classement.',
        data: {
          type: 'day_recap',
          tournamentSlug: 'ligue-des-champions-2024',
          points: '18',
          matchday: '6'
        }
      },
      tournament_end: {
        title: 'Tournoi terminé ! 🏆',
        body: 'Le tournoi "Ligue des Champions 2024/25" est terminé. Découvre le classement final !',
        data: {
          type: 'tournament_end',
          tournamentSlug: 'ligue-des-champions-2024'
        }
      },
      invite: {
        title: 'Invitation à un tournoi 🎯',
        body: 'Alex t\'invite à rejoindre le tournoi "Ligue 1 - Saison 2024/25"',
        data: {
          type: 'invite',
          inviteCode: 'PRONO2024'
        }
      },
      player_joined: {
        title: 'Lucas a rejoint Euro 2024 👋',
        body: 'Un nouveau joueur vient de rejoindre ton tournoi !',
        data: {
          type: 'player_joined',
          tournamentSlug: 'euro-2024',
          playerName: 'Lucas'
        }
      }
    }

    const notif = notifications[type] || notifications.test

    // Envoyer la notification de test
    try {
      const success = await sendPushNotification(
        profile.fcm_token,
        notif.title,
        notif.body,
        { ...notif.data, timestamp: new Date().toISOString() }
      )

      const typeLabels: Record<string, string> = {
        test: 'test général',
        reminder: 'rappel de pronostics',
        tournament_started: 'lancement de tournoi',
        day_recap: 'récap de journée',
        tournament_end: 'fin de tournoi',
        invite: 'invitation',
        player_joined: 'nouveau joueur'
      }

      return NextResponse.json({
        success: true,
        message: `Notification "${typeLabels[type] || type}" envoyée`,
        token: profile.fcm_token.substring(0, 20) + '...'
      })
    } catch (fcmError: any) {
      return NextResponse.json({
        success: false,
        error: 'Échec de l\'envoi de la notification',
        fcmError: {
          code: fcmError.code || 'unknown',
          message: fcmError.message || String(fcmError)
        },
        token: profile.fcm_token.substring(0, 30) + '...',
        hint: fcmError.code === 'messaging/invalid-registration-token'
          ? 'Le token FCM est invalide. Reconnectez-vous sur l\'app Android pour générer un nouveau token.'
          : 'Erreur Firebase Cloud Messaging'
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
