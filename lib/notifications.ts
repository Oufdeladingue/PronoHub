/**
 * Service de notifications push et email
 * Gère l'envoi de notifications en fonction des préférences utilisateur
 */

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { sendPushNotification, sendPushNotificationToMany, NotificationType } from '@/lib/firebase-admin'
import { sendMentionEmail } from '@/lib/email/send'
import { getAvatarUrl } from '@/lib/avatars'

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
    defaultTitle: 'Place au jeu, le tournoi démarre ! ⚽',
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
    defaultTitle: 'Alors ? C\'est qui le champion ? 🏆',
    defaultBody: 'Le tournoi {tournamentName} est terminé, c\'est le moment de voir qui est n°1 dans ta team...',
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
      console.error('[NOTIFICATION] Push failed:', error)
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
      console.error('[NOTIFICATION] Email failed:', error)
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
    imageUrl?: string
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

  const result = await sendPushNotificationToMany(tokens, title, body, data, options?.imageUrl)

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

  // Récupérer le premier match du tournoi avec les infos équipes
  const { data: firstMatch } = await supabase
    .from('matches')
    .select('scheduled_at, cached_home_team, cached_away_team, cached_home_logo, cached_away_logo, football_data_match_id')
    .eq('tournament_id', tournamentId)
    .order('scheduled_at', { ascending: true })
    .limit(1)
    .single()

  // Formater la date en français (ex: "samedi 15 mars à 21h00")
  let firstMatchDate = ''
  let matchTime = '21:00'
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
    matchTime = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
  } else {
    firstMatchDate = 'bientôt'
  }

  // Récupérer les logos depuis imported_matches si disponible
  let homeLogo = firstMatch?.cached_home_logo || ''
  let awayLogo = firstMatch?.cached_away_logo || ''
  let competitionLogo = ''

  if (firstMatch?.football_data_match_id) {
    const { data: imported } = await supabase
      .from('imported_matches')
      .select('home_team_crest, away_team_crest, competition_id')
      .eq('football_data_match_id', firstMatch.football_data_match_id)
      .single()

    if (imported) {
      homeLogo = imported.home_team_crest || homeLogo
      awayLogo = imported.away_team_crest || awayLogo

      // Récupérer l'emblème de la compétition
      if (imported.competition_id) {
        const { data: comp } = await supabase
          .from('competitions')
          .select('emblem')
          .eq('id', imported.competition_id)
          .single()
        competitionLogo = comp?.emblem || ''
      }
    }
  }

  // Construire l'imageUrl OG
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.pronohub.club'
  const ogParams = new URLSearchParams({
    tournament: tournamentName,
    home: firstMatch?.cached_home_team || 'Équipe 1',
    away: firstMatch?.cached_away_team || 'Équipe 2',
    homeLogo,
    awayLogo,
    competitionLogo,
    time: matchTime,
  })
  const imageUrl = `${baseUrl}/api/og/tournament-started?${ogParams.toString()}`

  const config = NOTIFICATION_CONFIG.tournament_started
  const body = config.defaultBody
    .replace('{tournamentName}', tournamentName)
    .replace('{firstMatchDate}', firstMatchDate)

  return sendNotificationToTournament(tournamentId, 'tournament_started', {
    body,
    tournamentSlug,
    excludeUserId: captainId,
    imageUrl,
  })
}

/**
 * Notifier la fin d'un tournoi à tous les participants
 * Chaque joueur reçoit une push personnalisée avec son classement final
 * Utilise createAdminClient car appelée depuis un cron
 */
export async function sendTournamentEnd(
  tournamentId: string,
  tournamentName: string,
  tournamentSlug: string
): Promise<{ sent: number; skipped: number }> {
  const supabase = createAdminClient()
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.pronohub.club'

  // Récupérer les participants avec profils
  const { data: participants } = await supabase
    .from('tournament_participants')
    .select('user_id, profiles(username, avatar, fcm_token, notification_preferences)')
    .eq('tournament_id', tournamentId)

  if (!participants || participants.length === 0) {
    return { sent: 0, skipped: 0 }
  }

  // Appeler l'API rankings pour avoir le classement final
  let rankings: any[] = []
  try {
    const rankingsUrl = `${baseUrl}/api/tournaments/${tournamentId}/rankings`
    const res = await fetch(rankingsUrl)
    if (res.ok) {
      const data = await res.json()
      rankings = data.rankings || []
    }
  } catch (e) {
    console.error('[sendTournamentEnd] Error fetching rankings:', e)
  }

  // Map rank par userId
  const rankByUserId = new Map<string, number>()
  for (const r of rankings) {
    rankByUserId.set(r.playerId, r.rank)
  }

  const config = NOTIFICATION_CONFIG.tournament_end
  const totalPlayers = participants.length
  let sent = 0
  let skipped = 0

  for (const participant of participants) {
    const profile = participant.profiles as any
    if (!profile?.fcm_token) {
      skipped++
      continue
    }

    const prefs = profile.notification_preferences || {}
    if (prefs[config.prefKey] === false) {
      skipped++
      continue
    }

    const username = profile.username || 'champion'
    const avatar = profile.avatar || 'avatar1'
    const rank = rankByUserId.get(participant.user_id) || totalPlayers

    // Construire l'URL de l'image OG personnalisée
    const avatarPath = getAvatarUrl(avatar)

    const ogParams = new URLSearchParams({
      tournament: tournamentName,
      username,
      avatar: avatarPath,
      rank: String(rank),
      totalPlayers: String(totalPlayers),
    })
    const imageUrl = `${baseUrl}/api/og/tournament-end?${ogParams.toString()}`

    const title = config.defaultTitle
    const body = config.defaultBody.replace('{tournamentName}', tournamentName)

    try {
      const success = await sendPushNotification(
        profile.fcm_token,
        title,
        body,
        {
          type: 'tournament_end',
          clickAction: `/${tournamentSlug}/opposition?tab=classement`,
        },
        imageUrl
      )
      if (success) sent++
      else skipped++
    } catch (e) {
      console.error(`[sendTournamentEnd] Error sending to ${username}:`, e)
      skipped++
    }
  }

  return { sent, skipped }
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
