/**
 * Service de notifications push et email
 * Gère l'envoi de notifications en fonction des préférences utilisateur
 */

import { createClient } from '@/lib/supabase/server'
import { sendPushNotification, sendPushNotificationToMany, NotificationType } from '@/lib/firebase-admin'
import { sendMentionEmail } from '@/lib/email/send'

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
    defaultTitle: 'C\'est maintenant ou jamais !',
    defaultBody: 'Des matchs sont à pronostiquer dans {tournamentName}, un oubli et c\'est toute ta prépa qui tombe à l\'eau...',
    clickAction: '/dashboard',
  },
  tournament_started: {
    prefKey: 'email_tournament_started',
    defaultTitle: 'Le coup d\'envoi est lancé ! ⚽',
    defaultBody: 'Le tournoi {tournamentName} démarre {firstMatchDate}. En piste champion !',
    clickAction: '/dashboard',
  },
  day_recap: {
    prefKey: 'email_day_recap',
    defaultTitle: 'Bilan du jour : qui l\'emporte ? 📊',
    defaultBody: 'Les résultats de la journée sont tombés. Découvre ton classement et prépare ta revanche.',
    clickAction: '/dashboard',
  },
  tournament_end: {
    prefKey: 'email_tournament_end',
    defaultTitle: 'Rideau ! Le champion est couronné 🏆',
    defaultBody: '{tournamentName} touche à sa fin. Découvre le podium et les meilleurs buteurs virtuels.',
    clickAction: '/dashboard',
  },
  invite: {
    prefKey: 'email_invite',
    defaultTitle: 'On a besoin de toi dans l\'équipe ! 🎯',
    defaultBody: '{captainName} t\'invite à rejoindre {tournamentName}. Tu es partant ?',
    clickAction: '/vestiaire/rejoindre',
  },
  player_joined: {
    prefKey: 'email_player_joined',
    defaultTitle: 'Un nouveau joueur dans le vestiaire ! 👋',
    defaultBody: '{playerName} vient de rejoindre {tournamentName}. La concurrence s\'intensifie.',
    clickAction: '/dashboard',
  },
  mention: {
    prefKey: 'email_mention',
    defaultTitle: 'On parle de toi dans le vestiaire ! 💬',
    defaultBody: '{username} t\'a mentionné dans {tournamentName}. Va voir ce qu\'il se dit.',
    clickAction: '/dashboard', // Sera remplacé dynamiquement par /{tournamentSlug}/opposition?tab=tchat
  },
  badge_unlocked: {
    prefKey: 'email_badge_unlocked',
    defaultTitle: 'Trophée débloqué ! 🏅',
    defaultBody: 'GG {username} ! Tu viens de décrocher le badge "{badgeName}". Continue sur ta lancée.',
    clickAction: '/profile?tab=trophees',
  },
  new_matches: {
    prefKey: 'email_new_matches',
    defaultTitle: 'Nouvelles rencontres à pronostiquer ! ⚽',
    defaultBody: "Le juge de ligne a levé son drapeau : il signale {matchCount} nouveau{plural} match{plural} ajouté{plural} dans {tournamentName}. N'oublie pas de les renseigner...",
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
    imageUrl?: string
  }
): Promise<boolean> {
  const supabase = await createClient()

  // Récupérer le profil avec token, préférences ET email
  const { data: profile } = await supabase
    .from('profiles')
    .select('fcm_token, notification_preferences, username, email')
    .eq('id', userId)
    .single()

  // Vérifier les préférences
  const config = NOTIFICATION_CONFIG[type]
  const prefs = profile?.notification_preferences || {}

  // Si la préférence est explicitement désactivée, ne pas envoyer
  if (prefs[config.prefKey] === false) {
    return false
  }

  // Construire le titre et le body
  const title = options?.title || config.defaultTitle
  let body = options?.body || config.defaultBody

  // Personnaliser avec le username si disponible
  body = body.replace('{username}', profile?.username || 'champion')

  // Données pour le clic
  const data: Record<string, string> = {
    type,
    clickAction: options?.tournamentSlug
      ? `/${options.tournamentSlug}/opposition`
      : config.clickAction || '/dashboard',
    ...(options?.data || {}),
  }

  let pushResult = false
  let emailResult = false

  // 1. Envoyer la notification push si token FCM disponible
  if (profile?.fcm_token) {
    try {
      pushResult = await sendPushNotification(profile.fcm_token, title, body, data, options?.imageUrl)
    } catch (error) {
      console.error('[NOTIFICATION DEBUG] Push notification failed:', error)
    }
  }

  // 2. Envoyer un email si c'est une mention et que l'email est disponible
  if (type === 'mention' && profile?.email) {
    try {
      const emailProps = {
        username: profile.username || 'champion',
        senderUsername: options?.data?.username || 'Un joueur',
        tournamentName: options?.data?.tournamentName || 'le tournoi',
        tournamentSlug: options?.tournamentSlug || '',
        competitionName: options?.data?.competitionName,
        message: options?.data?.message || ''
      }

      const emailSendResult = await sendMentionEmail(profile.email, emailProps)
      emailResult = emailSendResult.success
    } catch (error) {
      console.error('[NOTIFICATION DEBUG] Email send failed:', error)
    }
  }

  // Retourner true si au moins une notification a été envoyée avec succès
  return pushResult || emailResult
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
  const config = NOTIFICATION_CONFIG.reminder
  const body = config.defaultBody.replace('{tournamentName}', tournamentName)

  return sendNotificationToUser(userId, 'reminder', {
    body,
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
  const supabase = await createClient()

  // Récupérer le premier match du tournoi (celui avec la date la plus proche)
  const { data: firstMatch } = await supabase
    .from('matches')
    .select('scheduled_at')
    .eq('tournament_id', tournamentId)
    .order('scheduled_at', { ascending: true })
    .limit(1)
    .single()

  // Formater la date en français (ex: "samedi 15 mars à 21h00")
  let firstMatchDate = ''
  if (firstMatch?.scheduled_at) {
    const date = new Date(firstMatch.scheduled_at)
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Paris',
    }
    const formatted = new Intl.DateTimeFormat('fr-FR', options).format(date)
    // Format: "samedi 15 mars à 21h00"
    firstMatchDate = formatted.replace(' à ', ' à ').replace(':', 'h')
  } else {
    firstMatchDate = 'bientôt'
  }

  const config = NOTIFICATION_CONFIG.tournament_started
  const body = config.defaultBody
    .replace('{tournamentName}', tournamentName)
    .replace('{firstMatchDate}', firstMatchDate)

  return sendNotificationToTournament(tournamentId, 'tournament_started', {
    body,
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
  const config = NOTIFICATION_CONFIG.player_joined
  const body = config.defaultBody
    .replace('{playerName}', playerName)
    .replace('{tournamentName}', tournamentName)

  return sendNotificationToUser(captainId, 'player_joined', {
    body,
    tournamentSlug,
    data: { playerName, tournamentName },
  })
}
