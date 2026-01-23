/**
 * Service de notifications push
 * Gère l'envoi de notifications en fonction des préférences utilisateur
 */

import { createClient } from '@/lib/supabase/server'
import { sendPushNotification, sendPushNotificationToMany, NotificationType } from '@/lib/firebase-admin'

// Types de notifications avec leurs configurations
// Utilise les mêmes préférences que les emails pour être synchronisé
export const NOTIFICATION_CONFIG: Record<NotificationType, {
  prefKey: string
  defaultTitle: string
  defaultBody: string
  // URL à ouvrir au clic (relative)
  clickAction?: string
}> = {
  reminder: {
    prefKey: 'email_reminder', // Même préférence pour email et push
    defaultTitle: 'Pronostics en attente ⚽',
    defaultBody: 'N\'oublie pas de renseigner tes pronostics avant le coup d\'envoi !',
    clickAction: '/dashboard',
  },
  tournament_started: {
    prefKey: 'email_tournament_started',
    defaultTitle: 'Tournoi lancé ! 🚀',
    defaultBody: 'Le capitaine a lancé le tournoi. C\'est parti !',
    clickAction: '/dashboard',
  },
  day_recap: {
    prefKey: 'email_day_recap',
    defaultTitle: 'Récap de la journée 📊',
    defaultBody: 'Découvre les résultats et ton classement du jour.',
    clickAction: '/dashboard',
  },
  tournament_end: {
    prefKey: 'email_tournament_end',
    defaultTitle: 'Tournoi terminé ! 🏆',
    defaultBody: 'Le tournoi est terminé. Découvre le classement final !',
    clickAction: '/dashboard',
  },
  invite: {
    prefKey: 'email_invite',
    defaultTitle: 'Invitation à un tournoi 🎯',
    defaultBody: 'Tu as été invité à rejoindre un tournoi.',
    clickAction: '/vestiaire/rejoindre',
  },
  player_joined: {
    prefKey: 'email_player_joined',
    defaultTitle: 'Nouveau joueur ! 👋',
    defaultBody: 'Un nouveau joueur a rejoint ton tournoi.',
    clickAction: '/dashboard',
  },
}

/**
 * Envoyer une notification à un utilisateur
 * Vérifie les préférences avant d'envoyer
 */
export async function sendNotificationToUser(
  userId: string,
  type: NotificationType,
  options?: {
    title?: string
    body?: string
    data?: Record<string, string>
    tournamentSlug?: string
  }
): Promise<boolean> {
  const supabase = await createClient()

  // Récupérer le profil avec token et préférences
  const { data: profile } = await supabase
    .from('profiles')
    .select('fcm_token, notification_preferences, username')
    .eq('id', userId)
    .single()

  if (!profile?.fcm_token) {
    console.log(`[Notifications] Pas de token FCM pour user ${userId}`)
    return false
  }

  // Vérifier les préférences
  const config = NOTIFICATION_CONFIG[type]
  const prefs = profile.notification_preferences || {}

  // Si la préférence est explicitement désactivée, ne pas envoyer
  if (prefs[config.prefKey] === false) {
    console.log(`[Notifications] Notification ${type} désactivée pour user ${userId}`)
    return false
  }

  // Construire le titre et le body
  const title = options?.title || config.defaultTitle
  let body = options?.body || config.defaultBody

  // Personnaliser avec le username si disponible
  body = body.replace('{username}', profile.username || 'champion')

  // Données pour le clic
  const data: Record<string, string> = {
    type,
    clickAction: options?.tournamentSlug
      ? `/${options.tournamentSlug}/opposition`
      : config.clickAction || '/dashboard',
    ...(options?.data || {}),
  }

  return sendPushNotification(profile.fcm_token, title, body, data)
}

/**
 * Envoyer une notification à tous les participants d'un tournoi
 */
export async function sendNotificationToTournament(
  tournamentId: string,
  type: NotificationType,
  options?: {
    title?: string
    body?: string
    data?: Record<string, string>
    tournamentSlug?: string
    excludeUserId?: string // Exclure un utilisateur (ex: le capitaine qui lance)
  }
): Promise<{ sent: number; skipped: number }> {
  const supabase = await createClient()

  // Récupérer tous les participants
  const { data: participants } = await supabase
    .from('tournament_participants')
    .select('user_id')
    .eq('tournament_id', tournamentId)

  if (!participants || participants.length === 0) {
    return { sent: 0, skipped: 0 }
  }

  const userIds = participants
    .map(p => p.user_id)
    .filter(id => id !== options?.excludeUserId)

  // Récupérer les profils avec tokens et préférences
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, fcm_token, notification_preferences, username')
    .in('id', userIds)

  if (!profiles || profiles.length === 0) {
    return { sent: 0, skipped: userIds.length }
  }

  const config = NOTIFICATION_CONFIG[type]
  const title = options?.title || config.defaultTitle
  const baseBody = options?.body || config.defaultBody

  // Filtrer les utilisateurs qui ont activé ce type de notification et ont un token
  const eligibleProfiles = profiles.filter(p => {
    if (!p.fcm_token) return false
    const prefs = p.notification_preferences || {}
    return prefs[config.prefKey] !== false
  })

  if (eligibleProfiles.length === 0) {
    return { sent: 0, skipped: profiles.length }
  }

  const tokens = eligibleProfiles.map(p => p.fcm_token!)
  const body = baseBody // On pourrait personnaliser par user si besoin

  const data: Record<string, string> = {
    type,
    clickAction: options?.tournamentSlug
      ? `/${options.tournamentSlug}/opposition`
      : config.clickAction || '/dashboard',
    ...(options?.data || {}),
  }

  const result = await sendPushNotificationToMany(tokens, title, body, data)

  return {
    sent: result.success,
    skipped: profiles.length - eligibleProfiles.length + result.failure,
  }
}

/**
 * Envoyer un rappel de pronostics à un utilisateur
 */
export async function sendPronosticReminder(
  userId: string,
  tournamentName: string,
  tournamentSlug: string,
  matchCount: number
): Promise<boolean> {
  return sendNotificationToUser(userId, 'reminder', {
    title: `${matchCount} match${matchCount > 1 ? 's' : ''} à pronostiquer`,
    body: `N'oublie pas tes pronostics pour ${tournamentName} avant le coup d'envoi !`,
    tournamentSlug,
    data: { tournamentName, matchCount: String(matchCount) },
  })
}

/**
 * Notifier qu'un tournoi a été lancé
 */
export async function sendTournamentStarted(
  tournamentId: string,
  tournamentName: string,
  tournamentSlug: string,
  captainId: string
): Promise<{ sent: number; skipped: number }> {
  return sendNotificationToTournament(tournamentId, 'tournament_started', {
    title: `${tournamentName} a commencé ! 🚀`,
    body: 'Le capitaine a lancé le tournoi. À toi de jouer !',
    tournamentSlug,
    excludeUserId: captainId,
  })
}

/**
 * Notifier qu'un joueur a rejoint un tournoi (au capitaine)
 */
export async function sendPlayerJoined(
  captainId: string,
  playerName: string,
  tournamentName: string,
  tournamentSlug: string
): Promise<boolean> {
  return sendNotificationToUser(captainId, 'player_joined', {
    title: `${playerName} a rejoint ${tournamentName}`,
    body: 'Un nouveau joueur vient de rejoindre ton tournoi !',
    tournamentSlug,
    data: { playerName, tournamentName },
  })
}
