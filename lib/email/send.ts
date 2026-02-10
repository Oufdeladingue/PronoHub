import resend, { EMAIL_CONFIG } from './resend'
import {
  ADMIN_EMAIL,
  getTournamentStartedAlertTemplate,
  TournamentStartedAlertProps
} from './admin-templates'
import {
  getWelcomeEmailTemplate,
  getTournamentInviteTemplate,
  getMatchReminderTemplate,
  getResultsNotificationTemplate,
  getDetailedReminderTemplate,
  getTournamentStartedTemplate,
  getMatchdayRecapTemplate,
  getTournamentEndTemplate,
  getTournamentInviteDetailedTemplate,
  getNewPlayerJoinedTemplate,
  getMentionTemplate,
  getMultiTournamentReminderTemplate,
  getInactiveUserReminderTemplate,
  getMatchdayChangesTemplate,
  getBadgeUnlockedTemplate,
  EmailTemplateProps,
  ReminderEmailProps,
  TournamentStartedEmailProps,
  MatchdayRecapEmailProps,
  TournamentEndEmailProps,
  TournamentInviteDetailedEmailProps,
  NewPlayerJoinedEmailProps,
  MentionEmailProps,
  MultiTournamentReminderEmailProps,
  InactiveUserReminderEmailProps,
  MatchdayChangesEmailProps,
  BadgeUnlockedEmailProps
} from './templates'

interface SendEmailResult {
  success: boolean
  messageId?: string
  error?: string
}

// Envoi d'email générique
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text?: string
): Promise<SendEmailResult> {
  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_CONFIG.from,
      to,
      subject,
      html,
      text,
      replyTo: EMAIL_CONFIG.replyTo,
    })

    if (error) {
      console.error('Resend error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, messageId: data?.id }
  } catch (err: any) {
    console.error('Email send error:', err)
    return { success: false, error: err.message }
  }
}

// Email de bienvenue après inscription
export async function sendWelcomeEmail(
  to: string,
  props: Pick<EmailTemplateProps, 'username'>
): Promise<SendEmailResult> {
  const { html, text, subject } = getWelcomeEmailTemplate(props)
  return sendEmail(to, subject, html, text)
}

// Email d'invitation à un tournoi
export async function sendTournamentInviteEmail(
  to: string,
  props: Pick<EmailTemplateProps, 'username' | 'tournamentName' | 'inviteCode' | 'competitionName'>
): Promise<SendEmailResult> {
  const { html, text, subject } = getTournamentInviteTemplate(props)
  return sendEmail(to, subject, html, text)
}

// Email de rappel de pronostics
export async function sendMatchReminderEmail(
  to: string,
  props: Pick<EmailTemplateProps, 'username' | 'tournamentName' | 'matchDate' | 'competitionName' | 'actionUrl'>
): Promise<SendEmailResult> {
  const { html, text, subject } = getMatchReminderTemplate(props)
  return sendEmail(to, subject, html, text)
}

// Email de notification de résultats
export async function sendResultsNotificationEmail(
  to: string,
  props: Pick<EmailTemplateProps, 'username' | 'tournamentName' | 'competitionName' | 'actionUrl'>
): Promise<SendEmailResult> {
  const { html, text, subject } = getResultsNotificationTemplate(props)
  return sendEmail(to, subject, html, text)
}

// Email de rappel de pronostics détaillé
export async function sendDetailedReminderEmail(
  to: string,
  props: ReminderEmailProps
): Promise<SendEmailResult> {
  const { html, text, subject } = getDetailedReminderTemplate(props)
  return sendEmail(to, subject, html, text)
}

// Email de lancement de tournoi
export async function sendTournamentStartedEmail(
  to: string,
  props: TournamentStartedEmailProps
): Promise<SendEmailResult> {
  const { html, text, subject } = getTournamentStartedTemplate(props)
  return sendEmail(to, subject, html, text)
}

// Email de récap de journée
export async function sendMatchdayRecapEmail(
  to: string,
  props: MatchdayRecapEmailProps
): Promise<SendEmailResult> {
  const { html, text, subject } = getMatchdayRecapTemplate(props)
  return sendEmail(to, subject, html, text)
}

// Email de récap fin de tournoi
export async function sendTournamentEndEmail(
  to: string,
  props: TournamentEndEmailProps
): Promise<SendEmailResult> {
  const { html, text, subject } = getTournamentEndTemplate(props)
  return sendEmail(to, subject, html, text)
}

// Email d'invitation tournoi détaillée
export async function sendTournamentInviteDetailedEmail(
  to: string,
  props: TournamentInviteDetailedEmailProps
): Promise<SendEmailResult> {
  const { html, text, subject } = getTournamentInviteDetailedTemplate(props)
  return sendEmail(to, subject, html, text)
}

// Email nouveau joueur dans le tournoi (pour le capitaine)
export async function sendNewPlayerJoinedEmail(
  to: string,
  props: NewPlayerJoinedEmailProps
): Promise<SendEmailResult> {
  const { html, text, subject } = getNewPlayerJoinedTemplate(props)
  return sendEmail(to, subject, html, text)
}

// Email mention dans le tchat
export async function sendMentionEmail(
  to: string,
  props: MentionEmailProps
): Promise<SendEmailResult> {
  const { html, text, subject } = getMentionTemplate(props)
  return sendEmail(to, subject, html, text)
}

// Email rappel multi-tournois (un seul email pour tous les tournois)
export async function sendMultiTournamentReminderEmail(
  to: string,
  props: MultiTournamentReminderEmailProps
): Promise<SendEmailResult> {
  const { html, text, subject } = getMultiTournamentReminderTemplate(props)
  return sendEmail(to, subject, html, text)
}

// Email relance utilisateur inactif (10 jours sans tournoi)
export async function sendInactiveUserReminderEmail(
  to: string,
  props: InactiveUserReminderEmailProps
): Promise<SendEmailResult> {
  const { html, text, subject } = getInactiveUserReminderTemplate(props)
  return sendEmail(to, subject, html, text)
}

// Envoi en masse (avec rate limiting intégré par Resend)
export async function sendBulkEmails(
  emails: Array<{
    to: string
    subject: string
    html: string
    text?: string
  }>
): Promise<{ sent: number; failed: number; errors: string[] }> {
  const results = {
    sent: 0,
    failed: 0,
    errors: [] as string[]
  }

  // Resend gère automatiquement le rate limiting
  // Mais on peut aussi utiliser resend.batch.send() pour les envois en masse
  for (const email of emails) {
    const result = await sendEmail(email.to, email.subject, email.html, email.text)
    if (result.success) {
      results.sent++
    } else {
      results.failed++
      results.errors.push(`${email.to}: ${result.error}`)
    }
  }

  return results
}

// Email alerte admin : tournoi lancé
export async function sendTournamentStartedAdminAlert(
  props: TournamentStartedAlertProps
): Promise<SendEmailResult> {
  const { html, text, subject } = getTournamentStartedAlertTemplate(props)
  return sendEmail(ADMIN_EMAIL, subject, html, text)
}

// Email badge/trophée débloqué
export async function sendBadgeUnlockedEmail(
  to: string,
  props: BadgeUnlockedEmailProps
): Promise<SendEmailResult> {
  const { html, text, subject } = getBadgeUnlockedTemplate(props)
  return sendEmail(to, subject, html, text)
}

// Email notification de modifications de journée (compétitions custom)
export async function sendMatchdayChangesEmail(
  to: string,
  props: MatchdayChangesEmailProps
): Promise<SendEmailResult> {
  const { html, text, subject } = getMatchdayChangesTemplate(props)
  return sendEmail(to, subject, html, text)
}
