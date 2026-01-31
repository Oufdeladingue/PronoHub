import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendPushNotification, sendPushNotificationToMany, NotificationType } from '@/lib/firebase-admin'

/**
 * API pour envoyer des notifications push
 * POST /api/notifications/send
 *
 * Body:
 * - type: NotificationType
 * - userId?: string (pour notification à un seul utilisateur)
 * - userIds?: string[] (pour notification à plusieurs utilisateurs)
 * - tournamentId?: string (pour notifications liées à un tournoi)
 * - title?: string (optionnel, sinon généré selon le type)
 * - body?: string (optionnel, sinon généré selon le type)
 * - data?: Record<string, string> (données supplémentaires)
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Vérifier que l'utilisateur est authentifié
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const body = await request.json()
    const { type, userId, userIds, tournamentId, title, body: notifBody, data } = body

    if (!type) {
      return NextResponse.json({ error: 'Type de notification requis' }, { status: 400 })
    }

    // Déterminer les destinataires
    let targetUserIds: string[] = []

    if (userId) {
      targetUserIds = [userId]
    } else if (userIds && Array.isArray(userIds)) {
      targetUserIds = userIds
    } else if (tournamentId) {
      // Récupérer tous les participants du tournoi
      const { data: participants } = await supabase
        .from('tournament_participants')
        .select('user_id')
        .eq('tournament_id', tournamentId)

      if (participants) {
        targetUserIds = participants.map(p => p.user_id)
      }
    }

    if (targetUserIds.length === 0) {
      return NextResponse.json({ error: 'Aucun destinataire spécifié' }, { status: 400 })
    }

    // Récupérer les tokens FCM et les préférences de notification
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, fcm_token, notification_preferences')
      .in('id', targetUserIds)
      .not('fcm_token', 'is', null)

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Aucun utilisateur avec token FCM',
        sent: 0,
      })
    }

    // Filtrer selon les préférences de notification
    const prefKey = getPreferenceKey(type)
    const eligibleProfiles = profiles.filter(p => {
      // Si pas de préférences définies, envoyer par défaut
      if (!p.notification_preferences) return true
      // Vérifier la préférence pour ce type
      return p.notification_preferences[prefKey] !== false
    })

    if (eligibleProfiles.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Tous les utilisateurs ont désactivé ce type de notification',
        sent: 0,
      })
    }

    // Générer le titre et le corps si non fournis
    const finalTitle = title || getDefaultTitle(type)
    const finalBody = notifBody || getDefaultBody(type)

    // Envoyer les notifications
    const tokens = eligibleProfiles.map(p => p.fcm_token!)

    if (tokens.length === 1) {
      const success = await sendPushNotification(tokens[0], finalTitle, finalBody, data)
      return NextResponse.json({
        success,
        sent: success ? 1 : 0,
        failed: success ? 0 : 1,
      })
    } else {
      const result = await sendPushNotificationToMany(tokens, finalTitle, finalBody, data)
      return NextResponse.json({
        success: true,
        sent: result.success,
        failed: result.failure,
      })
    }
  } catch (error) {
    console.error('[API Notifications] Erreur:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * Obtenir la clé de préférence pour un type de notification
 * Utilise les mêmes préférences que les emails pour être synchronisé
 */
function getPreferenceKey(type: NotificationType): string {
  switch (type) {
    case 'reminder':
      return 'email_reminder'
    case 'tournament_started':
      return 'email_tournament_started'
    case 'day_recap':
      return 'email_day_recap'
    case 'tournament_end':
      return 'email_tournament_end'
    case 'invite':
      return 'email_invite'
    case 'player_joined':
      return 'email_player_joined'
    case 'mention':
      return 'email_mention'
    case 'badge_unlocked':
      return 'email_badge_unlocked'
    case 'new_matches':
      return 'email_new_matches'
    default:
      return 'email_reminder'
  }
}

/**
 * Titre par défaut selon le type
 */
function getDefaultTitle(type: NotificationType): string {
  switch (type) {
    case 'reminder':
      return 'Pronostics en attente'
    case 'tournament_started':
      return 'Tournoi lancé !'
    case 'day_recap':
      return 'Récap de la journée'
    case 'tournament_end':
      return 'Tournoi terminé !'
    case 'invite':
      return 'Invitation à un tournoi'
    case 'player_joined':
      return 'Nouveau joueur !'
    default:
      return 'PronoHub'
  }
}

/**
 * Corps par défaut selon le type
 */
function getDefaultBody(type: NotificationType): string {
  switch (type) {
    case 'reminder':
      return 'N\'oublie pas de renseigner tes pronostics avant le coup d\'envoi !'
    case 'tournament_started':
      return 'Le capitaine a lancé le tournoi. C\'est parti !'
    case 'day_recap':
      return 'Découvre les résultats et ton classement du jour.'
    case 'tournament_end':
      return 'Le tournoi est terminé. Découvre le classement final !'
    case 'invite':
      return 'Tu as été invité à rejoindre un tournoi.'
    case 'player_joined':
      return 'Un nouveau joueur a rejoint ton tournoi.'
    default:
      return ''
  }
}
