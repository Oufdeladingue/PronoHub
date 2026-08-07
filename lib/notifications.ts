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
  // Variantes anglaises (bilinguisme push). FR = défaut, EN utilisé si profiles.locale === 'en'.
  defaultTitleEn: string
  defaultBodyEn: string
  // URL à ouvrir au clic (relative)
  clickAction?: string
}> = {
  reminder: {
    prefKey: 'email_reminder', // Même préférence pour email et push
    defaultTitle: 'C\'est maintenant ou jamais !',
    defaultBody: 'Des matchs sont à pronostiquer dans {tournamentName}, un oubli et c\'est toute ta prépa qui tombe à l\'eau...',
    defaultTitleEn: 'Now or never!',
    defaultBodyEn: 'There are matches to predict in {tournamentName} — forget them and all your prep goes down the drain...',
    clickAction: '/dashboard',
  },
  tournament_started: {
    prefKey: 'email_tournament_started',
    defaultTitle: 'Place au jeu, le tournoi démarre ! ⚽',
    defaultBody: 'Le tournoi {tournamentName} démarre {firstMatchDate}. En piste champion !',
    defaultTitleEn: 'Game on, the tournament is kicking off! ⚽',
    defaultBodyEn: 'The {tournamentName} tournament starts {firstMatchDate}. Get out there, champ!',
    clickAction: '/dashboard',
  },
  day_recap: {
    prefKey: 'email_day_recap',
    defaultTitle: 'Bilan du jour : qui l\'emporte ? 📊',
    defaultBody: 'Les résultats de la journée sont tombés. Découvre ton classement et prépare ta revanche.',
    defaultTitleEn: 'Today\'s recap: who comes out on top? 📊',
    defaultBodyEn: 'The matchday results are in. Check your ranking and plan your comeback.',
    clickAction: '/dashboard',
  },
  tournament_end: {
    prefKey: 'email_tournament_end',
    defaultTitle: 'Alors ? C\'est qui le champion ? 🏆',
    defaultBody: 'Le tournoi {tournamentName} est terminé, c\'est le moment de voir qui est n°1 dans ta team...',
    defaultTitleEn: 'So… who\'s the champion? 🏆',
    defaultBodyEn: 'The {tournamentName} tournament is over — time to see who\'s no. 1 in your crew...',
    clickAction: '/dashboard',
  },
  invite: {
    prefKey: 'email_invite',
    defaultTitle: 'On a besoin de toi dans l\'équipe ! 🎯',
    defaultBody: '{captainName} t\'invite à rejoindre {tournamentName}. Tu es partant ?',
    defaultTitleEn: 'We need you on the team! 🎯',
    defaultBodyEn: '{captainName} is inviting you to join {tournamentName}. Are you in?',
    clickAction: '/vestiaire/rejoindre',
  },
  player_joined: {
    prefKey: 'email_player_joined',
    defaultTitle: 'Un nouveau joueur dans le vestiaire ! 👋',
    defaultBody: '{playerName} vient de rejoindre {tournamentName}. La concurrence s\'intensifie.',
    defaultTitleEn: 'A new player in the locker room! 👋',
    defaultBodyEn: '{playerName} just joined {tournamentName}. The competition is heating up.',
    clickAction: '/dashboard',
  },
  mention: {
    prefKey: 'email_mention',
    defaultTitle: 'On parle de toi dans le vestiaire ! 💬',
    defaultBody: '{senderName} t\'a mentionné dans {tournamentName}. Va voir ce qu\'il se dit.',
    defaultTitleEn: 'People are talking about you in the locker room! 💬',
    defaultBodyEn: '{senderName} mentioned you in {tournamentName}. Go see what\'s being said.',
    clickAction: '/dashboard', // Sera remplacé dynamiquement par /{tournamentSlug}/opposition?tab=tchat
  },
  badge_unlocked: {
    prefKey: 'email_badge_unlocked',
    defaultTitle: 'Trophée débloqué ! 🏅',
    defaultBody: 'GG {username} ! Tu viens de décrocher le badge "{badgeName}". Continue sur ta lancée.',
    defaultTitleEn: 'Trophy unlocked! 🏅',
    defaultBodyEn: 'GG {username}! You just earned the "{badgeName}" badge. Keep it up.',
    clickAction: '/profile?tab=trophees',
  },
  new_matches: {
    prefKey: 'email_new_matches',
    defaultTitle: 'Nouvelles rencontres à pronostiquer ! ⚽',
    defaultBody: "Le juge de ligne a levé son drapeau : il signale {matchCount} nouveau{plural} match{plural} ajouté{plural} dans {tournamentName}. N'oublie pas de les renseigner...",
    defaultTitleEn: 'New fixtures to predict! ⚽',
    defaultBodyEn: "The linesman raised his flag: {matchCount} new match{plural} added in {tournamentName}. Don't forget to fill them in...",
    clickAction: '/dashboard',
  },
}

// ---- Bilinguisme push : helpers de localisation (défaut FR) ----
export type NotifLocale = 'fr' | 'en'
// Une valeur de paramètre peut être une string (identique FR/EN) ou un couple {fr,en}
type LocalizedValue = string | { fr: string; en: string }
type LocalizedParams = Record<string, LocalizedValue>

function pickNotifLocale(locale?: string | null): NotifLocale {
  return locale === 'en' ? 'en' : 'fr'
}

function notifStrings(type: NotificationType, locale: NotifLocale): { title: string; body: string } {
  const c = NOTIFICATION_CONFIG[type]
  return locale === 'en'
    ? { title: c.defaultTitleEn, body: c.defaultBodyEn }
    : { title: c.defaultTitle, body: c.defaultBody }
}

function applyNotifParams(str: string, params: LocalizedParams | undefined, locale: NotifLocale): string {
  if (!params) return str
  let out = str
  for (const [k, v] of Object.entries(params)) {
    const val = typeof v === 'string' ? v : (locale === 'en' ? v.en : v.fr)
    out = out.split(`{${k}}`).join(val)
  }
  return out
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
    // Paramètres d'interpolation localisés (préféré à un body pré-rendu → permet l'EN par destinataire)
    bodyParams?: LocalizedParams
    data?: Record<string, string>
    tournamentSlug?: string
    imageUrl?: string
  }
): Promise<boolean> {
  const supabase = await createClient()

  // Récupérer le profil avec token, préférences, email ET locale
  const { data: profile } = await supabase
    .from('profiles')
    .select('fcm_token, notification_preferences, username, email, locale')
    .eq('id', userId)
    .single()

  // Vérifier les préférences
  const config = NOTIFICATION_CONFIG[type]
  const prefs = profile?.notification_preferences || {}

  // Si la préférence est explicitement désactivée, ne pas envoyer
  if (prefs[config.prefKey] === false) {
    return false
  }

  // Langue du destinataire (défaut FR)
  const loc = pickNotifLocale((profile as any)?.locale)
  const strings = notifStrings(type, loc)

  // Construire le titre et le body (un title/body explicite prime ; sinon défaut localisé)
  const title = options?.title || strings.title
  let body = options?.body || strings.body

  // Interpolation des paramètres localisés, puis du username
  body = applyNotifParams(body, options?.bodyParams, loc)
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
        message: options?.data?.message || '',
        locale: loc,
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
    // Paramètres d'interpolation localisés (préféré à un body pré-rendu)
    bodyParams?: LocalizedParams
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

  // Récupérer les profils avec tokens, préférences ET locale
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, fcm_token, notification_preferences, username, locale')
    .in('id', userIds)

  if (!profiles || profiles.length === 0) {
    return { sent: 0, skipped: userIds.length }
  }

  const config = NOTIFICATION_CONFIG[type]

  // Filtrer les utilisateurs qui ont activé ce type de notification et ont un token
  const eligibleProfiles = profiles.filter(p => {
    if (!p.fcm_token) return false
    const prefs = p.notification_preferences || {}
    return prefs[config.prefKey] !== false
  })

  if (eligibleProfiles.length === 0) {
    return { sent: 0, skipped: profiles.length }
  }

  const data: Record<string, string> = {
    type,
    clickAction: options?.tournamentSlug
      ? `/${options.tournamentSlug}/opposition`
      : config.clickAction || '/dashboard',
    ...(options?.data || {}),
  }

  // Grouper par langue pour envoyer le bon texte à chaque destinataire (un title/body explicite
  // reste appliqué tel quel pour rétrocompat ; sinon défaut localisé + interpolation par langue).
  const byLocale = new Map<NotifLocale, string[]>()
  for (const p of eligibleProfiles) {
    const loc = pickNotifLocale((p as any).locale)
    const arr = byLocale.get(loc) || []
    arr.push(p.fcm_token!)
    byLocale.set(loc, arr)
  }

  let sent = 0
  let failure = 0
  for (const [loc, tokens] of byLocale) {
    const strings = notifStrings(type, loc)
    const title = options?.title || strings.title
    const body = applyNotifParams(options?.body || strings.body, options?.bodyParams, loc)
    const result = await sendPushNotificationToMany(tokens, title, body, data, options?.imageUrl)
    sent += result.success
    failure += result.failure
  }

  return {
    sent,
    skipped: profiles.length - eligibleProfiles.length + failure,
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
    bodyParams: { tournamentName },
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

  // Formater la date par langue (FR: "samedi 15 mars à 21h00" ; EN: "Saturday 15 March at 21:00")
  let firstMatchDateFr = ''
  let firstMatchDateEn = ''
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
    // FR: "samedi 15 mars à 21h00"
    firstMatchDateFr = new Intl.DateTimeFormat('fr-FR', options).format(date).replace(':', 'h')
    // EN: on retire l'éventuelle virgule après le jour de semaine pour rester lisible
    firstMatchDateEn = new Intl.DateTimeFormat('en-GB', options).format(date).replace(/^(\w+),/, '$1')
    matchTime = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
  } else {
    firstMatchDateFr = 'bientôt'
    firstMatchDateEn = 'soon'
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
  // OG image reste en fr (broadcast multi-langue : une seule image pour tous les destinataires)
  const imageUrl = `${baseUrl}/api/og/tournament-started?${ogParams.toString()}`

  return sendNotificationToTournament(tournamentId, 'tournament_started', {
    bodyParams: {
      tournamentName,
      firstMatchDate: { fr: firstMatchDateFr, en: firstMatchDateEn },
    },
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
    .select('user_id, profiles(username, avatar, fcm_token, notification_preferences, locale)')
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

    const loc = pickNotifLocale(profile.locale)
    const ogParams = new URLSearchParams({
      tournament: tournamentName,
      username,
      avatar: avatarPath,
      rank: String(rank),
      totalPlayers: String(totalPlayers),
      locale: loc,
    })
    const imageUrl = `${baseUrl}/api/og/tournament-end?${ogParams.toString()}`

    const strings = notifStrings('tournament_end', loc)
    const title = strings.title
    const body = applyNotifParams(strings.body, { tournamentName }, loc)

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
  return sendNotificationToUser(captainId, 'player_joined', {
    bodyParams: { playerName, tournamentName },
    tournamentSlug,
    data: { playerName, tournamentName },
  })
}
