// Templates d'emails pour PronoHub

import { emailT, type EmailLocale } from './i18n'

export interface EmailTemplateProps {
  username?: string
  tournamentName?: string
  inviteCode?: string
  matchDate?: string
  competitionName?: string
  actionUrl?: string
  locale?: EmailLocale
}

// Interface pour le rappel de pronostic détaillé
export interface ReminderEmailProps {
  locale?: EmailLocale
  username: string
  tournamentName: string
  tournamentSlug: string
  competitionName: string
  matchdayName: string
  matches: Array<{
    homeTeam: string
    awayTeam: string
    matchDate: string // Format: "Samedi 30 novembre à 21h00"
    deadlineTime: string // Format: "20h00" (30min avant le match)
  }>
  defaultPredictionMaxPoints: number
}

// Interface pour le lancement de tournoi
export interface TournamentStartedEmailProps {
  locale?: EmailLocale
  username: string
  tournamentName: string
  tournamentSlug: string
  competitionName: string
  isCustomCompetition?: boolean // true si compétition personnalisée (Best of Week)
  participants: Array<{
    username: string
    isCaptain: boolean
  }>
  matchdayRange: {
    start: number
    end: number
    totalMatches: number
  }
  firstMatchDate: string // Format: "Samedi 30 novembre à 21h00"
  firstMatchDeadline: string // Format: "20h30" (30min avant le match)
  rules: {
    exactScore: number
    correctResult: number
    correctGoalDiff: number
    bonusMatchEnabled: boolean // Match bonus (double points sur un match aléatoire)
    earlyPredictionBonus: boolean // Prime d'avant-match (+1 si tous pronos avant début journée)
    defaultPredictionMaxPoints: number // Score vierge (max points si 0-0 par défaut)
  }
  userActiveTournaments: number
}

// Interface pour le récap de journée
export interface MatchdayRecapEmailProps {
  locale?: EmailLocale
  username: string
  tournamentName: string
  tournamentSlug: string
  competitionName: string
  matchdayNumber: number
  userPointsGained: number
  matchdayRanking: Array<{
    rank: number
    username: string
    points: number
    isCurrentUser: boolean
  }>
  generalRanking: Array<{
    rank: number
    username: string
    totalPoints: number
    isCurrentUser: boolean
  }>
  userStats: {
    exactScores: number
    correctResults: number
    matchdayRank: number
    generalRank: number
    rankChange: number // +2, -1, 0
  }
  newTrophies?: Array<{
    name: string
    description: string
  }>
  bestMatch?: {
    homeTeam: string
    awayTeam: string
    homeCrest?: string
    awayCrest?: string
    homeScore: number
    awayScore: number
    userPredictionHome: number
    userPredictionAway: number
    points: number
  }
  worstMatch?: {
    homeTeam: string
    awayTeam: string
    homeCrest?: string
    awayCrest?: string
    homeScore: number
    awayScore: number
    userPredictionHome: number
    userPredictionAway: number
    points: number
  }
}

// Interface pour le récap fin de tournoi
export interface TournamentEndEmailProps {
  locale?: EmailLocale
  username: string
  tournamentName: string
  tournamentSlug: string
  competitionName: string
  finalRanking: Array<{
    rank: number
    username: string
    totalPoints: number
    isCurrentUser: boolean
  }>
  userFinalStats: {
    finalRank: number
    totalPoints: number
    exactScores: number
    correctResults: number
    perfectMatchdays: number
  }
  winner: {
    username: string
    totalPoints: number
  }
  newTrophies?: Array<{
    name: string
    description: string
  }>
}

// Interface pour l'invitation tournoi détaillée
export interface TournamentInviteDetailedEmailProps {
  locale?: EmailLocale
  inviterUsername: string
  tournamentName: string
  tournamentSlug: string
  inviteCode: string
  competitionName: string
  participants: Array<{
    username: string
    isCaptain: boolean
  }>
  matchdayRange: {
    start: number
    end: number
    totalMatches: number
  }
  rules: {
    exactScore: number
    correctResult: number
    correctGoalDiff: number
    bonusEnabled: boolean
    bonusPoints?: number
  }
}

// Interface pour nouveau joueur (capitaine)
export interface NewPlayerJoinedEmailProps {
  locale?: EmailLocale
  captainUsername: string
  tournamentName: string
  tournamentSlug: string
  competitionName: string
  newPlayerUsername: string
  currentParticipants: number
  maxParticipants: number
  participants: Array<{
    username: string
    isCaptain: boolean
  }>
  canLaunchTournament: boolean
}

// Interface pour transfert de capitanat
export interface CaptainTransferEmailProps {
  locale?: EmailLocale
  newCaptainUsername: string
  oldCaptainUsername: string
  tournamentName: string
  tournamentSlug: string
  competitionName: string
  tournamentStatus: string // 'pending' | 'warmup' | 'active'
}

// Interface pour l'email de finalisation d'inscription
export interface FinalizeRegistrationEmailProps {
  locale?: EmailLocale
  username: string
  email: string
}

// Interface pour mention dans le chat
export interface MentionEmailProps {
  locale?: EmailLocale
  username: string // Username de la personne mentionnée
  senderUsername: string // Username de celui qui mentionne
  tournamentName: string
  tournamentSlug: string
  competitionName?: string
  message: string // Le message complet (tronqué à 200 chars)
}

// Interface pour rappel multi-tournois (plusieurs tournois dans un seul email)
export interface MultiTournamentReminderEmailProps {
  locale?: EmailLocale
  username: string
  tournaments: Array<{
    name: string
    slug: string
    competitionName: string
    competitionEmblem?: string | null
    matches: Array<{
      homeTeam: string
      awayTeam: string
      homeTeamCrest?: string | null
      awayTeamCrest?: string | null
      matchDate: string
      deadlineTime: string
    }>
  }>
  defaultPredictionMaxPoints: number
  earliestDeadline: string // Format: "20h00"
}

// Template: Email de bienvenue après inscription
export function getWelcomeEmailTemplate({ username, locale }: EmailTemplateProps) {
  const t = emailT(locale)
  const loc = locale === 'en' ? 'en' : 'fr'
  const html = `
<!DOCTYPE html>
<html lang="${loc}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t('welcome.pageTitle')}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #1a1a2e; border-radius: 16px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #ff9900 0%, #ff6600 100%);">
              <table role="presentation" align="center" style="margin-bottom: 16px;"><tr><td style="width: 90px; height: 90px; background-color: #1e293b; border-radius: 50%; text-align: center; vertical-align: middle;">
                <img src="https://www.pronohub.club/images/logo-email.png" alt="PronoHub" style="width: 60px; height: 60px; display: inline-block;">
              </td></tr></table>
              <h1 style="margin: 0; color: #000; font-size: 28px; font-weight: 700;">${t('welcome.title')}</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                ${t('common.hi')}${username ? ` <strong style="color: #ff9900;">${username}</strong>` : ''} ! 👋
              </p>
              <p style="margin: 0 0 20px; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                ${t('welcome.accountActive')}
              </p>

              <div style="background-color: #0f172a; border-radius: 12px; padding: 24px; margin: 24px 0;">
                <h3 style="margin: 0 0 16px; color: #ff9900; font-size: 18px;">🎯 ${t('welcome.startTitle')}</h3>
                <ul style="margin: 0; padding-left: 20px; color: #94a3b8; font-size: 14px; line-height: 1.8;">
                  <li>${t('welcome.step1')}</li>
                  <li>${t('welcome.step2')}</li>
                  <li>${t('welcome.step3')}</li>
                  <li>${t('welcome.step4')}</li>
                </ul>
              </div>

              <div style="text-align: center; margin: 32px 0;">
                <a href="https://www.pronohub.club/vestiaire" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #ff9900 0%, #ff6600 100%); color: #000; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 8px;">
                  ${t('welcome.cta')}
                </a>
              </div>

              <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.6;">
                ${t('welcome.help')}
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #0f172a; border-top: 1px solid #1e293b;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="color: #64748b; font-size: 12px;">
                    ${t('common.footerRights', { year: new Date().getFullYear() })}
                  </td>
                  <td style="text-align: right;">
                    <a href="https://www.pronohub.club/privacy" style="color: #64748b; font-size: 12px; text-decoration: none; margin-left: 16px;">${t('common.footerPrivacy')}</a>
                    <a href="https://www.pronohub.club/cgv" style="color: #64748b; font-size: 12px; text-decoration: none; margin-left: 16px;">${t('common.footerCgu')}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()

  const text = `
${t('welcome.title')}

${t('common.hi')}${username ? ` ${username}` : ''} !

${t('welcome.accountActive')}

${t('welcome.startTitle')}
- ${t('welcome.step1')}
- ${t('welcome.step2')}
- ${t('welcome.step3')}
- ${t('welcome.step4')}

${t('welcome.cta')} : https://www.pronohub.club/vestiaire

${t('welcome.help')}

${t('common.footerRights', { year: new Date().getFullYear() })}
  `.trim()

  return { html, text, subject: t('welcome.subject') }
}

// Template: Invitation à rejoindre un tournoi
export function getTournamentInviteTemplate({
  username,
  tournamentName,
  inviteCode,
  competitionName,
  locale
}: EmailTemplateProps) {
  const t = emailT(locale)
  const loc = locale === 'en' ? 'en' : 'fr'
  const html = `
<!DOCTYPE html>
<html lang="${loc}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t('invite.pageTitle')}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #1a1a2e; border-radius: 16px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #ff9900 0%, #ff6600 100%);">
              <table role="presentation" align="center" style="margin-bottom: 16px;"><tr><td style="width: 90px; height: 90px; background-color: #1e293b; border-radius: 50%; text-align: center; vertical-align: middle;">
                <img src="https://www.pronohub.club/images/logo-email.png" alt="PronoHub" style="width: 60px; height: 60px; display: inline-block;">
              </td></tr></table>
              <h1 style="margin: 0; color: #000; font-size: 24px; font-weight: 700;">${t('invite.title')}</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                ${username ? `<strong style="color: #ff9900;">${username}</strong> ${t('invite.inviteVerb')}` : t('invite.youAreInvited')} ${t('invite.toJoinTournament')}
              </p>

              <div style="background-color: #0f172a; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
                <h2 style="margin: 0 0 8px; color: #fff; font-size: 22px;">${tournamentName || t('invite.defaultTournamentName')}</h2>
                ${competitionName ? `<p style="margin: 0; color: #ff9900; font-size: 14px;">${competitionName}</p>` : ''}
              </div>

              ${inviteCode ? `
              <div style="background-color: #1e293b; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
                <p style="margin: 0 0 8px; color: #94a3b8; font-size: 14px;">${t('common.inviteCodeLabel')}</p>
                <p style="margin: 0; color: #ff9900; font-size: 32px; font-weight: 700; letter-spacing: 4px;">${inviteCode}</p>
              </div>
              ` : ''}

              <div style="text-align: center; margin: 32px 0;">
                <a href="https://www.pronohub.club/join${inviteCode ? `?code=${inviteCode}` : ''}" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #ff9900 0%, #ff6600 100%); color: #000; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 8px;">
                  ${t('common.joinTournament')}
                </a>
              </div>

              <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.6; text-align: center;">
                ${t('common.joinPitch')}
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #0f172a; border-top: 1px solid #1e293b;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="color: #64748b; font-size: 12px;">
                    ${t('common.footerRights', { year: new Date().getFullYear() })}
                  </td>
                  <td style="text-align: right;">
                    <a href="https://www.pronohub.club/privacy" style="color: #64748b; font-size: 12px; text-decoration: none; margin-left: 16px;">${t('common.footerPrivacy')}</a>
                    <a href="https://www.pronohub.club/cgv" style="color: #64748b; font-size: 12px; text-decoration: none; margin-left: 16px;">${t('common.footerCgu')}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()

  const text = `
${t('invite.title')}

${username ? `${username} ${t('invite.inviteVerb')}` : t('invite.youAreInvited')} ${t('invite.toJoinTournament')} ${tournamentName || t('invite.defaultTournamentName')}
${competitionName ? `${t('common.competitionLabel')} : ${competitionName}` : ''}

${inviteCode ? `${t('common.inviteCodeLabel')} : ${inviteCode}` : ''}

${t('common.joinTournament')} : https://www.pronohub.club/join${inviteCode ? `?code=${inviteCode}` : ''}

${t('common.joinPitch')}

${t('common.footerRights', { year: new Date().getFullYear() })}
  `.trim()

  return {
    html,
    text,
    subject: `${username ? `${username} ${t('invite.inviteVerb')}` : t('invite.subjectInvitation')} ${t('invite.subjectToJoin')} ${tournamentName || t('invite.subjectDefaultTournament')} ${t('invite.subjectSuffix')}`
  }
}

// Template: Rappel de pronostics avant un match
export function getMatchReminderTemplate({
  username,
  tournamentName,
  matchDate,
  competitionName,
  actionUrl,
  locale
}: EmailTemplateProps) {
  const t = emailT(locale)
  const loc = locale === 'en' ? 'en' : 'fr'
  const html = `
<!DOCTYPE html>
<html lang="${loc}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t('matchReminder.pageTitle')}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #1a1a2e; border-radius: 16px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #ff9900 0%, #ff6600 100%);">
              <table role="presentation" align="center" style="margin-bottom: 16px;"><tr><td style="width: 90px; height: 90px; background-color: #1e293b; border-radius: 50%; text-align: center; vertical-align: middle;">
                <img src="https://www.pronohub.club/images/logo-email.png" alt="PronoHub" style="width: 60px; height: 60px; display: inline-block;">
              </td></tr></table>
              <h1 style="margin: 0; color: #000; font-size: 24px; font-weight: 700;">⏰ ${t('matchReminder.title')}</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                ${t('common.hi')}${username ? ` <strong style="color: #ff9900;">${username}</strong>` : ''} ! 👋
              </p>
              <p style="margin: 0 0 20px; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                ${t('matchReminder.intro')}
              </p>

              <div style="background-color: #0f172a; border-radius: 12px; padding: 24px; margin: 24px 0;">
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0;">
                      <span style="color: #94a3b8; font-size: 14px;">${t('common.tournamentLabel')}</span><br>
                      <span style="color: #fff; font-size: 16px; font-weight: 600;">${tournamentName || t('common.defaultYourTournament')}</span>
                    </td>
                  </tr>
                  ${competitionName ? `
                  <tr>
                    <td style="padding: 8px 0;">
                      <span style="color: #94a3b8; font-size: 14px;">${t('common.competitionLabel')}</span><br>
                      <span style="color: #ff9900; font-size: 16px;">${competitionName}</span>
                    </td>
                  </tr>
                  ` : ''}
                  ${matchDate ? `
                  <tr>
                    <td style="padding: 8px 0;">
                      <span style="color: #94a3b8; font-size: 14px;">${t('matchReminder.nextMatchLabel')}</span><br>
                      <span style="color: #fff; font-size: 16px;">${matchDate}</span>
                    </td>
                  </tr>
                  ` : ''}
                </table>
              </div>

              <div style="text-align: center; margin: 32px 0;">
                <a href="${actionUrl || 'https://www.pronohub.club/vestiaire'}" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #ff9900 0%, #ff6600 100%); color: #000; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 8px;">
                  ${t('matchReminder.cta')}
                </a>
              </div>

              <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.6; text-align: center;">
                ${t('matchReminder.footer1')}
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #0f172a; border-top: 1px solid #1e293b;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="color: #64748b; font-size: 12px;">
                    ${t('common.footerRights', { year: new Date().getFullYear() })}
                  </td>
                  <td style="text-align: right;">
                    <a href="https://www.pronohub.club/settings" style="color: #64748b; font-size: 12px; text-decoration: none;">${t('common.unsubscribe')}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()

  const text = `
${t('matchReminder.title')}

${t('common.hi')}${username ? ` ${username}` : ''} !

${t('matchReminder.intro')}

${t('common.tournamentLabel')} : ${tournamentName || t('common.defaultYourTournament')}
${competitionName ? `${t('common.competitionLabel')} : ${competitionName}` : ''}
${matchDate ? `${t('matchReminder.nextMatchLabel')} : ${matchDate}` : ''}

${t('matchReminder.cta')} : ${actionUrl || 'https://www.pronohub.club/vestiaire'}

${t('matchReminder.footer1')}

${t('common.footerRights', { year: new Date().getFullYear() })}
  `.trim()

  return {
    html,
    text,
    subject: `⏰ ${t('matchReminder.subjectPrefix')} ${tournamentName || t('matchReminder.subjectDefaultTournament')} !`
  }
}

// Template: Notification de résultats
export function getResultsNotificationTemplate({
  username,
  tournamentName,
  competitionName,
  actionUrl,
  locale
}: EmailTemplateProps) {
  const t = emailT(locale)
  const loc = locale === 'en' ? 'en' : 'fr'
  const html = `
<!DOCTYPE html>
<html lang="${loc}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t('results.pageTitle')}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #1a1a2e; border-radius: 16px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #ff9900 0%, #ff6600 100%);">
              <table role="presentation" align="center" style="margin-bottom: 16px;"><tr><td style="width: 90px; height: 90px; background-color: #1e293b; border-radius: 50%; text-align: center; vertical-align: middle;">
                <img src="https://www.pronohub.club/images/logo-email.png" alt="PronoHub" style="width: 60px; height: 60px; display: inline-block;">
              </td></tr></table>
              <h1 style="margin: 0; color: #000; font-size: 24px; font-weight: 700;">🏆 ${t('results.title')}</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                ${t('common.hi')}${username ? ` <strong style="color: #ff9900;">${username}</strong>` : ''} ! 👋
              </p>
              <p style="margin: 0 0 20px; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                ${t('results.intro')}
              </p>

              <div style="background-color: #0f172a; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
                <h3 style="margin: 0 0 8px; color: #fff; font-size: 20px;">${tournamentName || t('common.defaultYourTournament')}</h3>
                ${competitionName ? `<p style="margin: 0; color: #ff9900; font-size: 14px;">${competitionName}</p>` : ''}
              </div>

              <div style="text-align: center; margin: 32px 0;">
                <a href="${actionUrl || 'https://www.pronohub.club/vestiaire'}" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #ff9900 0%, #ff6600 100%); color: #000; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 8px;">
                  ${t('common.viewRanking')}
                </a>
              </div>

              <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.6; text-align: center;">
                ${t('results.footer1')}
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #0f172a; border-top: 1px solid #1e293b;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="color: #64748b; font-size: 12px;">
                    ${t('common.footerRights', { year: new Date().getFullYear() })}
                  </td>
                  <td style="text-align: right;">
                    <a href="https://www.pronohub.club/settings" style="color: #64748b; font-size: 12px; text-decoration: none;">${t('common.unsubscribe')}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()

  const text = `
${t('results.title')}

${t('common.hi')}${username ? ` ${username}` : ''} !

${t('results.intro')}

${t('common.tournamentLabel')} : ${tournamentName || t('common.defaultYourTournament')}
${competitionName ? `${t('common.competitionLabel')} : ${competitionName}` : ''}

${t('common.viewRanking')} : ${actionUrl || 'https://www.pronohub.club/vestiaire'}

${t('results.footer1')}

${t('common.footerRights', { year: new Date().getFullYear() })}
  `.trim()

  return {
    html,
    text,
    subject: `🏆 ${t('results.subjectPrefix')} ${tournamentName || t('results.subjectDefaultTournament')} !`
  }
}

// Template: Rappel de pronostics détaillé (nouveau template complet)
export function getDetailedReminderTemplate(props: ReminderEmailProps) {
  const {
    username,
    tournamentName,
    tournamentSlug,
    competitionName,
    matchdayName,
    matches,
    defaultPredictionMaxPoints,
    locale
  } = props
  const t = emailT(locale)
  const loc = locale === 'en' ? 'en' : 'fr'

  const actionUrl = `https://www.pronohub.club/${tournamentSlug}/opposition`

  // Générer le HTML des matchs
  const matchesHtml = matches.map(match => `
    <tr>
      <td style="padding: 12px 16px; border-bottom: 1px solid #1e293b;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <span style="color: #fff; font-size: 15px; font-weight: 500;">${match.homeTeam} - ${match.awayTeam}</span>
          </div>
        </div>
        <div style="margin-top: 6px;">
          <span style="color: #94a3b8; font-size: 13px;">📅 ${match.matchDate}</span>
          <span style="color: #ef4444; font-size: 13px; margin-left: 12px;">⏰ ${t('common.limitLabel')} : ${match.deadlineTime}</span>
        </div>
      </td>
    </tr>
  `).join('')

  const html = `
<!DOCTYPE html>
<html lang="${loc}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t('detailedReminder.pageTitle')}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #1a1a2e; border-radius: 16px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #ff9900 0%, #ff6600 100%);">
              <table role="presentation" align="center" style="margin-bottom: 16px;"><tr><td style="width: 90px; height: 90px; background-color: #1e293b; border-radius: 50%; text-align: center; vertical-align: middle;">
                <img src="https://www.pronohub.club/images/logo-email.png" alt="PronoHub" style="width: 60px; height: 60px; display: inline-block;">
              </td></tr></table>
              <h1 style="margin: 0; color: #000; font-size: 24px; font-weight: 700;">⏰ ${t('detailedReminder.title')}</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                ${t('common.hi')} <strong style="color: #ff9900;">${username}</strong> ! 👋
              </p>
              <p style="margin: 0 0 24px; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                ${t('detailedReminder.intro')}
              </p>

              <!-- Infos tournoi -->
              <div style="background-color: #0f172a; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 4px 0;">
                      <span style="color: #94a3b8; font-size: 13px;">${t('common.tournamentLabel')}</span><br>
                      <span style="color: #fff; font-size: 16px; font-weight: 600;">${tournamentName}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 0;">
                      <span style="color: #94a3b8; font-size: 13px;">${t('common.competitionLabel')}</span><br>
                      <span style="color: #ff9900; font-size: 15px;">${competitionName}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 0;">
                      <span style="color: #94a3b8; font-size: 13px;">${t('common.matchdayLabel')}</span><br>
                      <span style="color: #fff; font-size: 15px;">${matchdayName}</span>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Liste des matchs -->
              <div style="background-color: #0f172a; border-radius: 12px; overflow: hidden; margin-bottom: 24px;">
                <div style="padding: 16px; border-bottom: 1px solid #1e293b;">
                  <h3 style="margin: 0; color: #ff9900; font-size: 16px;">🎯 ${t('detailedReminder.matchesTitle')}</h3>
                </div>
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  ${matchesHtml}
                </table>
              </div>

              <!-- Alerte prono par défaut -->
              <div style="background-color: #7f1d1d; border-radius: 12px; padding: 16px; margin-bottom: 24px; border-left: 4px solid #ef4444;">
                <p style="margin: 0; color: #fecaca; font-size: 14px; line-height: 1.5;">
                  <strong>⚠️ ${t('common.warningLabel')} :</strong> ${t('common.defaultWarnL1')}
                  ${t('common.defaultWarnL2pre')} <strong>${defaultPredictionMaxPoints > 1 ? t('common.maxPtsOther', { points: defaultPredictionMaxPoints }) : t('common.maxPtsOne', { points: defaultPredictionMaxPoints })}</strong> ${t('common.defaultWarnL2post')}
                </p>
              </div>

              <div style="text-align: center; margin: 32px 0;">
                <a href="${actionUrl}" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #ff9900 0%, #ff6600 100%); color: #000; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 8px;">
                  ${t('detailedReminder.cta')}
                </a>
              </div>

              <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.6; text-align: center;">
                ${t('common.predictBeforePre')} <strong>${t('common.oneHourBefore')}</strong> ${t('common.predictBeforePost')}
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #0f172a; border-top: 1px solid #1e293b;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="color: #64748b; font-size: 12px;">
                    ${t('common.footerRights', { year: new Date().getFullYear() })}
                  </td>
                  <td style="text-align: right;">
                    <a href="https://www.pronohub.club/profile" style="color: #64748b; font-size: 12px; text-decoration: none;">${t('common.manageNotifications')}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()

  // Version texte
  const matchesText = matches.map(match =>
    `  • ${match.homeTeam} - ${match.awayTeam}\n    📅 ${match.matchDate} | ⏰ ${t('common.limitLabel')} : ${match.deadlineTime}`
  ).join('\n')

  const text = `
⏰ ${t('detailedReminder.title')}

${t('common.hi')} ${username} !

${t('detailedReminder.intro')}

📋 ${t('detailedReminder.textTournamentLabel')} : ${tournamentName}
🏆 ${t('common.competitionLabel')} : ${competitionName}
📅 ${t('common.matchdayLabel')} : ${matchdayName}

🎯 ${t('detailedReminder.matchesTitleText')} :
${matchesText}

⚠️ ${t('common.defaultWarnTextPre')} ${defaultPredictionMaxPoints > 1 ? t('common.maxPtsOther', { points: defaultPredictionMaxPoints }) : t('common.maxPtsOne', { points: defaultPredictionMaxPoints })} ${t('common.defaultWarnTextPost')}

👉 ${t('detailedReminder.textCtaLabel')} : ${actionUrl}

${t('common.predictBeforePre')} ${t('common.oneHourBefore')} ${t('common.predictBeforePost')}

---
${t('common.footerRights', { year: new Date().getFullYear() })}
${t('common.manageNotifications')} : https://www.pronohub.club/profile
  `.trim()

  return {
    html,
    text,
    subject: `⏰ ${matches.length > 1 ? t('detailedReminder.subjectOther', { n: matches.length, tournament: tournamentName }) : t('detailedReminder.subjectOne', { n: matches.length, tournament: tournamentName })} !`
  }
}

// Template: Lancement de tournoi
export function getTournamentStartedTemplate(props: TournamentStartedEmailProps) {
  const {
    username,
    tournamentName,
    tournamentSlug,
    competitionName,
    isCustomCompetition,
    participants,
    matchdayRange,
    firstMatchDate,
    firstMatchDeadline,
    rules,
    userActiveTournaments,
    locale
  } = props
  const t = emailT(locale)
  const loc = locale === 'en' ? 'en' : 'fr'

  const baseUrl = 'https://www.pronohub.club'
  const tournamentUrl = `${baseUrl}/${tournamentSlug}/opposition`

  // Texte de la compétition (custom = explication détaillée)
  const competitionDisplay = isCustomCompetition
    ? t('tournamentStarted.customCompetition')
    : competitionName

  // Liste des participants avec ${t('common.captainAbbr')}
  const participantsHtml = participants.map(p =>
    `<span style="display: inline-block; background-color: #1e293b; padding: 4px 10px; border-radius: 16px; margin: 4px; font-size: 13px; color: #e0e0e0;">${p.username}${p.isCaptain ? ` <span style="color: #ff9900;">${t('common.captainAbbr')}</span>` : ''}</span>`
  ).join('')

  // Règles du tournoi
  const rulesHtml = `
    <tr><td style="padding: 6px 0; color: #94a3b8; font-size: 13px;">${t('common.ruleExactScore')}</td><td style="padding: 6px 0; color: #22c55e; font-size: 13px; text-align: right; font-weight: 600;">+${rules.exactScore} pts</td></tr>
    <tr><td style="padding: 6px 0; color: #94a3b8; font-size: 13px;">${t('common.ruleCorrectResult')}</td><td style="padding: 6px 0; color: #3b82f6; font-size: 13px; text-align: right; font-weight: 600;">+${rules.correctResult} pts</td></tr>
    <tr><td style="padding: 6px 0; color: #94a3b8; font-size: 13px;">${t('common.ruleGoalDiff')}</td><td style="padding: 6px 0; color: #8b5cf6; font-size: 13px; text-align: right; font-weight: 600;">+${rules.correctGoalDiff} pts</td></tr>
    <tr><td style="padding: 6px 0; color: #94a3b8; font-size: 13px;">${t('tournamentStarted.ruleDefaultMax')}</td><td style="padding: 6px 0; color: #ef4444; font-size: 13px; text-align: right; font-weight: 600;">${rules.defaultPredictionMaxPoints} pts max</td></tr>
  `

  // Bonus HTML (explication des règles spéciales activées)
  const hasBonuses = rules.bonusMatchEnabled || rules.earlyPredictionBonus || rules.defaultPredictionMaxPoints < 3

  const bonusHtml = hasBonuses ? `
    <div style="background-color: #0f172a; border-radius: 12px; padding: 20px; margin-bottom: 24px; border-left: 4px solid #ff9900;">
      <h3 style="margin: 0 0 16px; color: #ff9900; font-size: 16px;">⚙️ ${t('tournamentStarted.specialRulesTitle')}</h3>

      ${rules.bonusMatchEnabled ? `
      <div style="margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #1e293b;">
        <p style="margin: 0 0 6px; color: #22c55e; font-size: 14px; font-weight: 600;">⚡ ${t('tournamentStarted.bonusMatchTitle')}</p>
        <p style="margin: 0; color: #94a3b8; font-size: 13px; line-height: 1.5;">
          ${t('tournamentStarted.bonusMatchDesc')}
        </p>
      </div>
      ` : ''}

      ${rules.earlyPredictionBonus ? `
      <div style="margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #1e293b;">
        <p style="margin: 0 0 6px; color: #3b82f6; font-size: 14px; font-weight: 600;">🏃 ${t('tournamentStarted.earlyBonusTitle')}</p>
        <p style="margin: 0; color: #94a3b8; font-size: 13px; line-height: 1.5;">
          ${t('tournamentStarted.earlyBonusDesc')}
        </p>
      </div>
      ` : ''}

      ${rules.defaultPredictionMaxPoints < 3 ? `
      <div style="${rules.bonusMatchEnabled || rules.earlyPredictionBonus ? '' : 'margin-bottom: 0;'}">
        <p style="margin: 0 0 6px; color: #ef4444; font-size: 14px; font-weight: 600;">💤 ${t('tournamentStarted.defaultBonusTitle')}</p>
        <p style="margin: 0; color: #94a3b8; font-size: 13px; line-height: 1.5;">
          ${t('tournamentStarted.defaultBonusDescPre')} <strong style="color: #ef4444;">${rules.defaultPredictionMaxPoints > 1 ? t('tournamentStarted.bestOther', { points: rules.defaultPredictionMaxPoints }) : t('tournamentStarted.bestOne', { points: rules.defaultPredictionMaxPoints })}</strong>.
          ${rules.defaultPredictionMaxPoints === 0 ? ` <span style="color: #ef4444;">${t('tournamentStarted.noPointPossible')}</span>` : ''}
        </p>
      </div>
      ` : ''}
    </div>
  ` : ''

  const html = `
<!DOCTYPE html>
<html lang="${loc}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t('tournamentStarted.pageTitle', { tournament: tournamentName })}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #1a1a2e; border-radius: 16px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);">
              <table role="presentation" align="center" style="margin-bottom: 16px;"><tr><td style="width: 90px; height: 90px; background-color: #1e293b; border-radius: 50%; text-align: center; vertical-align: middle;">
                <img src="https://www.pronohub.club/images/logo-email.png" alt="PronoHub" style="width: 60px; height: 60px; display: inline-block;">
              </td></tr></table>
              <h1 style="margin: 0; color: #000; font-size: 24px; font-weight: 700;">🚀 ${t('tournamentStarted.headerTitle')}</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                ${t('common.hi')} <strong style="color: #ff9900;">${username}</strong> ! 👋
              </p>
              <p style="margin: 0 0 24px; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                ${t('tournamentStarted.launchedPre')} <strong style="color: #22c55e;">${tournamentName}</strong> ${t('tournamentStarted.launchedPost')}
              </p>

              <!-- Infos tournoi -->
              <div style="background-color: #0f172a; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <h3 style="margin: 0 0 16px; color: #ff9900; font-size: 16px;">📋 ${t('tournamentStarted.infoTitle')}</h3>
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  ${isCustomCompetition ? `
                  <tr>
                    <td colspan="2" style="padding: 6px 0;">
                      <span style="color: #94a3b8; font-size: 13px;">${t('common.competitionLabel')}</span><br>
                      <span style="color: #ff9900; font-size: 12px; line-height: 1.4; display: block; margin-top: 4px;">${competitionDisplay}</span>
                    </td>
                  </tr>
                  ` : `
                  <tr>
                    <td style="padding: 6px 0; color: #94a3b8; font-size: 13px;">${t('common.competitionLabel')}</td>
                    <td style="padding: 6px 0; color: #ff9900; font-size: 13px; text-align: right; font-weight: 600;">${competitionName}</td>
                  </tr>
                  `}
                  <tr>
                    <td style="padding: 6px 0; color: #94a3b8; font-size: 13px;">${t('tournamentStarted.matchdaysLabel')}</td>
                    <td style="padding: 6px 0; color: #fff; font-size: 13px; text-align: right;">J${matchdayRange.start} → J${matchdayRange.end}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #94a3b8; font-size: 13px;">${t('tournamentStarted.matchesToPredictLabel')}</td>
                    <td style="padding: 6px 0; color: #fff; font-size: 13px; text-align: right; font-weight: 600;">${matchdayRange.totalMatches} ${t('common.matchesWord')}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #94a3b8; font-size: 13px;">${t('tournamentStarted.firstMatchLabel')}</td>
                    <td style="padding: 6px 0; color: #22c55e; font-size: 13px; text-align: right;">${firstMatchDate}</td>
                  </tr>
                </table>
              </div>

              <!-- Participants -->
              <div style="background-color: #0f172a; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <h3 style="margin: 0 0 12px; color: #ff9900; font-size: 16px;">👥 ${t('common.participantsLabel')} (${participants.length})</h3>
                <div style="line-height: 2;">
                  ${participantsHtml}
                </div>
              </div>

              <!-- Règles -->
              <div style="background-color: #0f172a; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <h3 style="margin: 0 0 12px; color: #ff9900; font-size: 16px;">📜 ${t('common.rulesTitle')}</h3>
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  ${rulesHtml}
                </table>
              </div>

              <!-- Bonus (si activé) -->
              ${bonusHtml}

              <!-- Important : deadline -->
              <div style="background-color: #1e3a5f; border-radius: 12px; padding: 20px; margin-bottom: 24px; border-left: 4px solid #3b82f6;">
                <h3 style="margin: 0 0 12px; color: #3b82f6; font-size: 16px;">⏰ ${t('tournamentStarted.importantTitle')}</h3>
                <p style="margin: 0 0 8px; color: #e0e0e0; font-size: 13px; line-height: 1.5;">
                  ${t('tournamentStarted.deadlineRule')}
                </p>
                <p style="margin: 0; color: #94a3b8; font-size: 13px;">
                  📅 ${t('tournamentStarted.firstMatchLabel')} : <strong style="color: #22c55e;">${firstMatchDate}</strong><br>
                  ⏱️ ${t('tournamentStarted.deadlineToPredict')} : <strong style="color: #ff9900;">${firstMatchDeadline || t('tournamentStarted.seeApp')}</strong>
                </p>
              </div>

              <!-- Alertes -->
              <div style="background-color: #0f172a; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <h3 style="margin: 0 0 12px; color: #ff9900; font-size: 16px;">🔔 ${t('tournamentStarted.alertsTitle')}</h3>
                <p style="margin: 0 0 12px; color: #e0e0e0; font-size: 13px; line-height: 1.5;">
                  ${t('tournamentStarted.alertsIntro')}
                </p>
                <ul style="margin: 0; padding-left: 20px; color: #94a3b8; font-size: 13px; line-height: 1.8;">
                  <li>📧 <strong>Emails</strong> : ${t('tournamentStarted.alertsEmailDesc')}</li>
                  <li>📱 <strong>${t('tournamentStarted.pushLabel')}</strong> : ${t('tournamentStarted.pushDesc')}</li>
                </ul>
                <p style="margin: 12px 0 0; color: #64748b; font-size: 12px;">
                  👉 <a href="https://www.pronohub.club/profile" style="color: #ff9900; text-decoration: none;">${t('tournamentStarted.manageAlertsProfile')}</a>
                </p>
              </div>

              <!-- Boutons d'action -->
              <div style="text-align: center; margin: 32px 0;">
                <a href="${tournamentUrl}" style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #ff9900 0%, #ff6600 100%); color: #000; text-decoration: none; font-weight: 600; font-size: 15px; border-radius: 8px; margin: 6px;">
                  🎯 ${t('tournamentStarted.btnPredict')}
                </a>
                <a href="${tournamentUrl}?tab=classement" style="display: inline-block; padding: 14px 28px; background-color: #1e293b; color: #fff; text-decoration: none; font-weight: 600; font-size: 15px; border-radius: 8px; margin: 6px;">
                  🏆 ${t('common.ranking')}
                </a>
              </div>

              <!-- Liens rapides -->
              <div style="background-color: #0f172a; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0;"><a href="${tournamentUrl}?tab=tchat" style="color: #94a3b8; text-decoration: none; font-size: 13px;">💬 ${t('tournamentStarted.chatLink')}</a></td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;"><a href="${baseUrl}/profile" style="color: #94a3b8; text-decoration: none; font-size: 13px;">⚙️ ${t('tournamentStarted.manageAlerts')}</a></td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;"><a href="${baseUrl}/pricing" style="color: #ff9900; text-decoration: none; font-size: 13px;">⭐ ${t('common.goPremium')}</a></td>
                  </tr>
                </table>
              </div>

              <p style="margin: 0; color: #64748b; font-size: 13px; line-height: 1.6; text-align: center;">
                ${t('tournamentStarted.activeTournamentsPre')} <strong>${userActiveTournaments}</strong> ${userActiveTournaments > 1 ? t('tournamentStarted.activeOther') : t('tournamentStarted.activeOne')}.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #0f172a; border-top: 1px solid #1e293b;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="color: #64748b; font-size: 12px;">
                    ${t('common.footerRights', { year: new Date().getFullYear() })}
                  </td>
                  <td style="text-align: right;">
                    <a href="${baseUrl}/profile" style="color: #64748b; font-size: 12px; text-decoration: none;">${t('common.manageNotifications')}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()

  const participantsText = participants.map(p => `  • ${p.username}${p.isCaptain ? ` ${t('common.captainAbbr')}` : ''}`).join('\n')

  // Génère le texte des règles spéciales
  const hasBonusesText = rules.bonusMatchEnabled || rules.earlyPredictionBonus || rules.defaultPredictionMaxPoints < 3
  const bonusTextParts: string[] = []
  if (rules.bonusMatchEnabled) {
    bonusTextParts.push(`⚡ ${t('tournamentStarted.textBonusMatch')}`)
  }
  if (rules.earlyPredictionBonus) {
    bonusTextParts.push(`🏃 ${t('tournamentStarted.textEarlyBonus')}`)
  }
  if (rules.defaultPredictionMaxPoints < 3) {
    bonusTextParts.push(`💤 ${t('tournamentStarted.textDefaultBonusPre')} ${rules.defaultPredictionMaxPoints > 1 ? t('tournamentStarted.bestOther', { points: rules.defaultPredictionMaxPoints }) : t('tournamentStarted.bestOne', { points: rules.defaultPredictionMaxPoints })}.`)
  }
  const bonusText = hasBonusesText ? `
⚙️ ${t('tournamentStarted.textSpecialRulesTitle')}
${bonusTextParts.join('\n')}
` : ''

  const text = `
🚀 ${t('tournamentStarted.textHeader', { tournament: tournamentName })}

${t('common.hi')} ${username} !

${t('tournamentStarted.textPrepare')} 👑

📋 ${t('tournamentStarted.textInfoTitle')}
- ${t('common.competitionLabel')} : ${competitionDisplay}
- ${t('tournamentStarted.matchdaysLabel')} : J${matchdayRange.start} → J${matchdayRange.end}
- ${t('tournamentStarted.matchesToPredictLabel')} : ${matchdayRange.totalMatches} ${t('common.matchesWord')}
- ${t('tournamentStarted.firstMatchLabel')} : ${firstMatchDate}

👥 ${t('tournamentStarted.textParticipantsTitle')} (${participants.length})
${participantsText}

📜 ${t('tournamentStarted.textRulesTitle')}
- ${t('common.ruleExactScore')} : +${rules.exactScore} pts
- ${t('common.ruleCorrectResult')} : +${rules.correctResult} pts
- ${t('common.ruleGoalDiff')} : +${rules.correctGoalDiff} pts
- ${t('tournamentStarted.textRuleDefault')} : ${rules.defaultPredictionMaxPoints} pts max
${bonusText}
⏰ ${t('tournamentStarted.textImportantTitle')}
${t('tournamentStarted.textDeadlineRule')}
- ${t('tournamentStarted.firstMatchLabel')} : ${firstMatchDate}
- ${t('tournamentStarted.deadlineToPredict')} : ${firstMatchDeadline || t('tournamentStarted.seeApp')}

🔔 ${t('tournamentStarted.textAlertsTitle')}
${t('tournamentStarted.textAlertsIntro')}
- 📧 Emails : ${t('tournamentStarted.alertsEmailDesc')}
- 📱 ${t('tournamentStarted.pushLabel')} : ${t('tournamentStarted.pushDesc')}
👉 ${t('tournamentStarted.manageAlerts')} : ${baseUrl}/profile

🎯 ${t('tournamentStarted.btnPredict')} : ${tournamentUrl}
🏆 ${t('common.ranking')} : ${tournamentUrl}?tab=classement
💬 ${t('tournamentStarted.textChatLabel')} : ${tournamentUrl}?tab=tchat
⭐ ${t('common.goPremium')} : ${baseUrl}/pricing

${t('tournamentStarted.textActivePre')} ${userActiveTournaments} ${userActiveTournaments > 1 ? t('tournamentStarted.activeOther') : t('tournamentStarted.activeOne')}.

---
${t('common.footerRights', { year: new Date().getFullYear() })}
  `.trim()

  return {
    html,
    text,
    subject: `🚀 ${t('tournamentStarted.subject', { tournament: tournamentName })}`
  }
}

// Template: Récap de journée
export function getMatchdayRecapTemplate(props: MatchdayRecapEmailProps) {
  const {
    username,
    tournamentName,
    tournamentSlug,
    competitionName,
    matchdayNumber,
    userPointsGained,
    matchdayRanking,
    generalRanking,
    userStats,
    newTrophies,
    bestMatch,
    worstMatch,
    locale
  } = props
  const t = emailT(locale)
  const loc = locale === 'en' ? 'en' : 'fr'

  const baseUrl = 'https://www.pronohub.club'
  const tournamentUrl = `${baseUrl}/${tournamentSlug}/opposition`

  // Classement de la journée HTML
  const matchdayRankingHtml = matchdayRanking.slice(0, 10).map(p => `
    <tr style="${p.isCurrentUser ? 'background-color: #1e3a5f;' : ''}">
      <td style="padding: 8px 12px; color: ${p.rank <= 3 ? '#ff9900' : '#94a3b8'}; font-size: 13px; font-weight: ${p.rank <= 3 ? '600' : '400'};">${p.rank}</td>
      <td style="padding: 8px 12px; color: ${p.isCurrentUser ? '#ff9900' : '#fff'}; font-size: 13px; font-weight: ${p.isCurrentUser ? '600' : '400'};">${p.username}${p.isCurrentUser ? ` ${t('common.you')}` : ''}</td>
      <td style="padding: 8px 12px; color: #22c55e; font-size: 13px; text-align: right; font-weight: 600;">+${p.points}</td>
    </tr>
  `).join('')

  // Classement général HTML
  const generalRankingHtml = generalRanking.slice(0, 10).map(p => `
    <tr style="${p.isCurrentUser ? 'background-color: #1e3a5f;' : ''}">
      <td style="padding: 8px 12px; color: ${p.rank <= 3 ? '#ff9900' : '#94a3b8'}; font-size: 13px; font-weight: ${p.rank <= 3 ? '600' : '400'};">${p.rank}</td>
      <td style="padding: 8px 12px; color: ${p.isCurrentUser ? '#ff9900' : '#fff'}; font-size: 13px; font-weight: ${p.isCurrentUser ? '600' : '400'};">${p.username}${p.isCurrentUser ? ` ${t('common.you')}` : ''}</td>
      <td style="padding: 8px 12px; color: #3b82f6; font-size: 13px; text-align: right; font-weight: 600;">${p.totalPoints} pts</td>
    </tr>
  `).join('')

  // Progression
  const rankChangeText = userStats.rankChange > 0 ? `+${userStats.rankChange}` : userStats.rankChange < 0 ? `${userStats.rankChange}` : '='
  const rankChangeColor = userStats.rankChange > 0 ? '#22c55e' : userStats.rankChange < 0 ? '#ef4444' : '#94a3b8'
  const rankChangeIcon = userStats.rankChange > 0 ? '📈' : userStats.rankChange < 0 ? '📉' : '➡️'

  // Trophées HTML
  const trophiesHtml = newTrophies && newTrophies.length > 0 ? `
    <div style="background-color: #422006; border-radius: 12px; padding: 20px; margin-bottom: 24px; border-left: 4px solid #f59e0b;">
      <h3 style="margin: 0 0 12px; color: #fbbf24; font-size: 16px;">🏆 ${newTrophies.length > 1 ? t('common.trophyUnlockedOther') : t('common.trophyUnlockedOne')}</h3>
      ${newTrophies.map(tr => `
        <div style="margin-bottom: 8px;">
          <span style="color: #fbbf24; font-size: 14px; font-weight: 600;">${tr.name}</span><br>
          <span style="color: #fcd34d; font-size: 12px;">${tr.description}</span>
        </div>
      `).join('')}
    </div>
  ` : ''

  // Citation selon le nombre de points
  let quoteText = ''
  if (userPointsGained <= 5) {
    quoteText = t('matchdayRecap.quote1')
  } else if (userPointsGained >= 6 && userPointsGained <= 10) {
    quoteText = t('matchdayRecap.quote2')
  } else if (userPointsGained >= 11 && userPointsGained <= 15) {
    quoteText = t('matchdayRecap.quote3')
  } else if (userPointsGained >= 16 && userPointsGained <= 24) {
    quoteText = t('matchdayRecap.quote4')
  } else {
    quoteText = t('matchdayRecap.quote5')
  }

  const html = `
<!DOCTYPE html>
<html lang="${loc}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t('matchdayRecap.pageTitle', { n: matchdayNumber, tournament: tournamentName })}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #1a1a2e; border-radius: 16px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 24px; text-align: center; background: linear-gradient(135deg, #ff9900 0%, #ff6600 100%);">
              <img src="https://www.pronohub.club/images/logo-email.png" alt="PronoHub" style="width: 90px; height: 90px; display: block; margin: 0 auto 20px; border-radius: 50%; box-shadow: 0 8px 16px rgba(0,0,0,0.3);">
              <h1 style="margin: 0 0 8px; color: #000; font-size: 22px; font-weight: 700; text-shadow: 0 2px 4px rgba(0,0,0,0.2);"><img src="https://img.icons8.com/?size=100&id=qzvnT8sOLSmm&format=png&color=000000" alt="" style="width: 24px; height: 24px; display: inline-block; vertical-align: middle; margin-right: 8px;"> ${t('matchdayRecap.headerTitle')}</h1>
              <p style="margin: 0; color: #1a1a2e; font-size: 15px; opacity: 0.95;">${t('matchdayRecap.headerSub')}</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                ${t('common.hi')} <strong style="color: #ff9900;">${username}</strong> ! 👋
              </p>
              <p style="margin: 0 0 24px; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                ${t('matchdayRecap.recapIntroPre')} ${matchdayNumber}${t('matchdayRecap.recapIntroMid')} <strong>${tournamentName}</strong>
              </p>

              <!-- Points gagnés et Stats côte à côte -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
                <tr>
                  <td style="width: 48%; vertical-align: top;">
                    <!-- Points gagnés -->
                    <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-radius: 12px; padding: 16px; text-align: center;">
                      <p style="margin: 0 0 8px; color: #94a3b8; font-size: 13px;">${t('matchdayRecap.youWon')}</p>
                      <p style="margin: 0; color: #22c55e; font-size: 42px; font-weight: 700; line-height: 1;">+${userPointsGained}</p>
                      <p style="margin: 4px 0 12px; color: #94a3b8; font-size: 12px;">${t('matchdayRecap.pointsThisMatchday')}</p>
                      <p style="margin: 0; color: #64748b; font-size: 11px; font-style: italic; border-left: 3px solid #475569; padding-left: 8px; text-align: left;">"${quoteText}"</p>
                    </div>
                  </td>
                  <td style="width: 4%;"></td>
                  <td style="width: 48%; vertical-align: top;">
                    <!-- Stats de la journée -->
                    <div style="background-color: #0f172a; border-radius: 12px; padding: 16px;">
                      <h3 style="margin: 0 0 12px; color: #ff9900; font-size: 14px;"><img src="https://img.icons8.com/?size=100&id=65239&format=png&color=000000" alt="" style="width: 16px; height: 16px; display: inline-block; vertical-align: middle; margin-right: 6px; filter: brightness(0) saturate(100%) invert(62%) sepia(77%) saturate(3574%) hue-rotate(359deg) brightness(101%) contrast(104%);">${t('matchdayRecap.yourStats')}</h3>
                      <table role="presentation" style="width: 100%; border-collapse: collapse;">
                        <tr>
                          <td style="padding: 4px 0; color: #94a3b8; font-size: 12px;">${t('common.exactScoresLabel')}</td>
                          <td style="padding: 4px 0; color: #22c55e; font-size: 12px; text-align: right; font-weight: 600;">${userStats.exactScores}</td>
                        </tr>
                        <tr>
                          <td style="padding: 4px 0; color: #94a3b8; font-size: 12px;">${t('common.correctResultsLabel')}</td>
                          <td style="padding: 4px 0; color: #3b82f6; font-size: 12px; text-align: right; font-weight: 600;">${userStats.correctResults}</td>
                        </tr>
                        <tr>
                          <td style="padding: 4px 0; color: #94a3b8; font-size: 12px;">${t('matchdayRecap.matchdayRankLabel')}</td>
                          <td style="padding: 4px 0; color: #fff; font-size: 12px; text-align: right; font-weight: 600;">${userStats.matchdayRank}${userStats.matchdayRank === 1 ? t('common.ordFirst') : t('common.ordOther')}</td>
                        </tr>
                        <tr>
                          <td style="padding: 4px 0; color: #94a3b8; font-size: 12px;">${t('common.generalRankLabel')}</td>
                          <td style="padding: 4px 0; color: #fff; font-size: 12px; text-align: right;">
                            <span style="font-weight: 600;">${userStats.generalRank}${userStats.generalRank === 1 ? t('common.ordFirst') : t('common.ordOther')}</span>
                            <span style="color: ${rankChangeColor}; margin-left: 4px; font-size: 11px;">${rankChangeIcon} ${rankChangeText}</span>
                          </td>
                        </tr>
                      </table>
                    </div>
                  </td>
                </tr>
              </table>

              ${trophiesHtml && newTrophies && newTrophies.length > 0 ? `
              <!-- Badges débloqués -->
              <div style="background-color: #422006; border-radius: 12px; padding: 16px; margin-bottom: 16px; border-left: 4px solid #f59e0b;">
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="width: 32px; vertical-align: middle;">
                      <span style="font-size: 24px;">🏆</span>
                    </td>
                    <td style="vertical-align: middle;">
                      <span style="color: #fbbf24; font-size: 14px; font-weight: 600; display: block;">${newTrophies[0].name}</span>
                      <span style="color: #fcd34d; font-size: 11px;">${newTrophies[0].description}</span>
                    </td>
                    ${newTrophies.length > 1 ? `<td style="text-align: right; vertical-align: middle;">
                      <span style="color: #94a3b8; font-size: 11px;">${newTrophies.length - 1 > 1 ? t('matchdayRecap.otherBadgesOther', { n: newTrophies.length - 1 }) : t('matchdayRecap.otherBadgesOne', { n: newTrophies.length - 1 })}</span>
                    </td>` : ''}
                  </tr>
                </table>
              </div>
              ` : ''}

              ${bestMatch || worstMatch ? `
              <!-- Coup d'éclat et Coup de mou côte à côte -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
                <tr>
                  ${bestMatch && bestMatch.points > 0 ? `
                  <td style="width: ${worstMatch ? '48%' : '100%'}; vertical-align: top;">
                    <!-- Coup d'éclat -->
                    <div style="background-color: #0f172a; border-radius: 12px; padding: 16px; border-left: 3px solid #22c55e;">
                      <h3 style="margin: 0 0 12px; color: #22c55e; font-size: 13px;">⚡ ${t('matchdayRecap.bestMatchTitle')}</h3>
                      <table role="presentation" style="width: 100%; border-collapse: collapse;">
                        <tr>
                          <td style="text-align: center; padding: 8px 0;">
                            <div style="font-size: 11px; color: #94a3b8; margin-bottom: 4px;">${bestMatch.homeTeam}</div>
                            ${bestMatch.homeCrest ? `<img src="${bestMatch.homeCrest}" alt="${bestMatch.homeTeam}" width="32" height="32" style="display: block; margin: 0 auto;" />` : `<div style="width: 32px; height: 32px; margin: 0 auto; background-color: #1e293b; border-radius: 50%; display: flex; align-items: center; justify-content: center;"><span style="font-size: 16px;">⚽</span></div>`}
                          </td>
                          <td style="text-align: center; vertical-align: middle; padding: 8px;">
                            <div style="font-size: 16px; font-weight: 700; color: #22c55e;">${bestMatch.homeScore} - ${bestMatch.awayScore}</div>
                            <div style="font-size: 10px; color: #64748b; margin-top: 2px;">${t('common.yourPredictionShort')} ${bestMatch.userPredictionHome}-${bestMatch.userPredictionAway}</div>
                            <div style="font-size: 11px; color: #22c55e; margin-top: 4px; font-weight: 600;">+${bestMatch.points} pts</div>
                          </td>
                          <td style="text-align: center; padding: 8px 0;">
                            <div style="font-size: 11px; color: #94a3b8; margin-bottom: 4px;">${bestMatch.awayTeam}</div>
                            ${bestMatch.awayCrest ? `<img src="${bestMatch.awayCrest}" alt="${bestMatch.awayTeam}" width="32" height="32" style="display: block; margin: 0 auto;" />` : `<div style="width: 32px; height: 32px; margin: 0 auto; background-color: #1e293b; border-radius: 50%; display: flex; align-items: center; justify-content: center;"><span style="font-size: 16px;">⚽</span></div>`}
                          </td>
                        </tr>
                      </table>
                    </div>
                  </td>
                  ` : ''}
                  ${bestMatch && worstMatch && bestMatch.points > 0 ? '<td style="width: 4%;"></td>' : ''}
                  ${worstMatch ? `
                  <td style="width: ${bestMatch && bestMatch.points > 0 ? '48%' : '100%'}; vertical-align: top;">
                    <!-- Coup de mou -->
                    <div style="background-color: #0f172a; border-radius: 12px; padding: 16px; border-left: 3px solid #ef4444;">
                      <h3 style="margin: 0 0 12px; color: #ef4444; font-size: 13px;">😅 ${t('matchdayRecap.worstMatchTitle')}</h3>
                      <table role="presentation" style="width: 100%; border-collapse: collapse;">
                        <tr>
                          <td style="text-align: center; padding: 8px 0;">
                            <div style="font-size: 11px; color: #94a3b8; margin-bottom: 4px;">${worstMatch.homeTeam}</div>
                            ${worstMatch.homeCrest ? `<img src="${worstMatch.homeCrest}" alt="${worstMatch.homeTeam}" width="32" height="32" style="display: block; margin: 0 auto;" />` : `<div style="width: 32px; height: 32px; margin: 0 auto; background-color: #1e293b; border-radius: 50%; display: flex; align-items: center; justify-content: center;"><span style="font-size: 16px;">⚽</span></div>`}
                          </td>
                          <td style="text-align: center; vertical-align: middle; padding: 8px;">
                            <div style="font-size: 16px; font-weight: 700; color: #ef4444;">${worstMatch.homeScore} - ${worstMatch.awayScore}</div>
                            <div style="font-size: 10px; color: #64748b; margin-top: 2px;">${t('common.yourPredictionShort')} ${worstMatch.userPredictionHome}-${worstMatch.userPredictionAway}</div>
                            <div style="font-size: 11px; color: #ef4444; margin-top: 4px; font-weight: 600;">${worstMatch.points} pts</div>
                          </td>
                          <td style="text-align: center; padding: 8px 0;">
                            <div style="font-size: 11px; color: #94a3b8; margin-bottom: 4px;">${worstMatch.awayTeam}</div>
                            ${worstMatch.awayCrest ? `<img src="${worstMatch.awayCrest}" alt="${worstMatch.awayTeam}" width="32" height="32" style="display: block; margin: 0 auto;" />` : `<div style="width: 32px; height: 32px; margin: 0 auto; background-color: #1e293b; border-radius: 50%; display: flex; align-items: center; justify-content: center;"><span style="font-size: 16px;">⚽</span></div>`}
                          </td>
                        </tr>
                      </table>
                    </div>
                  </td>
                  ` : ''}
                </tr>
              </table>
              ` : ''}

              <!-- Classements côte à côte -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
                <tr>
                  <td style="width: 48%; vertical-align: top;">
                    <!-- Classement de la journée -->
                    <div style="background-color: #0f172a; border-radius: 12px; overflow: hidden;">
                      <div style="padding: 12px; border-bottom: 1px solid #1e293b;">
                        <h3 style="margin: 0; color: #3b82f6; font-size: 14px;">🏅 ${t('matchdayRecap.matchdayRankLabel')}</h3>
                      </div>
                      <table role="presentation" style="width: 100%; border-collapse: collapse;">
                        ${matchdayRanking.slice(0, 5).map(p => `
                        <tr style="${p.isCurrentUser ? 'background-color: #1e3a5f;' : ''}">
                          <td style="padding: 6px 10px; color: ${p.rank <= 3 ? '#ff9900' : '#94a3b8'}; font-size: 12px; font-weight: ${p.rank <= 3 ? '600' : '400'};">${p.rank}</td>
                          <td style="padding: 6px 10px; color: ${p.isCurrentUser ? '#ff9900' : p.rank <= 3 ? '#fff' : '#94a3b8'}; font-size: 12px; font-weight: ${p.isCurrentUser ? '600' : '400'};">${p.username}${p.isCurrentUser ? ` ${t('common.you')}` : ''}</td>
                          <td style="padding: 6px 10px; color: #22c55e; font-size: 12px; text-align: right; font-weight: 600;">+${p.points}</td>
                        </tr>
                        `).join('')}
                      </table>
                    </div>
                  </td>
                  <td style="width: 4%;"></td>
                  <td style="width: 48%; vertical-align: top;">
                    <!-- Classement général -->
                    <div style="background-color: #0f172a; border-radius: 12px; overflow: hidden;">
                      <div style="padding: 12px; border-bottom: 1px solid #1e293b;">
                        <h3 style="margin: 0; color: #ff9900; font-size: 14px;">🏆 ${t('common.generalRankLabel')}</h3>
                      </div>
                      <table role="presentation" style="width: 100%; border-collapse: collapse;">
                        ${generalRanking.slice(0, 5).map(p => `
                        <tr style="${p.isCurrentUser ? 'background-color: #1e3a5f;' : ''}">
                          <td style="padding: 6px 10px; color: ${p.rank === 1 ? '#fbbf24' : p.rank <= 3 ? '#ff9900' : '#94a3b8'}; font-size: 12px; font-weight: ${p.rank === 1 ? '700' : p.rank <= 3 ? '600' : '400'};">${p.rank === 1 ? '👑' : p.rank}</td>
                          <td style="padding: 6px 10px; color: ${p.isCurrentUser ? '#ff9900' : p.rank <= 3 ? '#fff' : '#94a3b8'}; font-size: 12px; font-weight: ${p.isCurrentUser ? '600' : '400'};">${p.username}${p.isCurrentUser ? ` ${t('common.you')}` : ''}</td>
                          <td style="padding: 6px 10px; color: #22c55e; font-size: 12px; text-align: right; font-weight: 600;">${p.totalPoints}</td>
                        </tr>
                        `).join('')}
                      </table>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Boutons d'action -->
              <div style="text-align: center; margin: 32px 0;">
                <a href="${tournamentUrl}?tab=classement" style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #ff9900 0%, #ff6600 100%); color: #000; text-decoration: none; font-weight: 600; font-size: 15px; border-radius: 8px;">
                  ${t('matchdayRecap.viewFullRanking')}
                </a>
                <br>
                <a href="${tournamentUrl}?tab=classement&share=1" style="display: inline-block; margin-top: 12px; padding: 12px 24px; background: #1e293b; border: 1px solid #ff9900; color: #ff9900; text-decoration: none; font-weight: 600; font-size: 14px; border-radius: 8px;">
                  📲 ${t('matchdayRecap.shareRanking')}
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #0f172a; border-top: 1px solid #1e293b;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="color: #64748b; font-size: 12px;">
                    ${t('common.footerRights', { year: new Date().getFullYear() })}
                  </td>
                  <td style="text-align: right;">
                    <a href="${baseUrl}/profile" style="color: #64748b; font-size: 12px; text-decoration: none;">${t('common.manageNotifications')}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()

  const matchdayRankingText = matchdayRanking.slice(0, 10).map(p => `  ${p.rank}. ${p.username}${p.isCurrentUser ? ` ${t('common.you')}` : ''} - +${p.points} pts`).join('\n')
  const generalRankingText = generalRanking.slice(0, 10).map(p => `  ${p.rank}. ${p.username}${p.isCurrentUser ? ` ${t('common.you')}` : ''} - ${p.totalPoints} pts`).join('\n')
  const trophiesText = newTrophies && newTrophies.length > 0 ? `\n🏆 ${newTrophies.length > 1 ? t('common.trophyTextOther') : t('common.trophyTextOne')}\n${newTrophies.map(tr => `  • ${tr.name} : ${tr.description}`).join('\n')}\n` : ''

  const text = `
📊 ${t('matchdayRecap.textHeader', { n: matchdayNumber, tournament: tournamentName })}

${t('common.hi')} ${username} !

${t('matchdayRecap.textIntro', { n: matchdayNumber, tournament: tournamentName })}

💰 ${t('matchdayRecap.textYouWonLabel')} : +${userPointsGained} points
${trophiesText}
📈 ${t('matchdayRecap.textStatsTitle')}
- ${t('common.exactScoresLabel')} : ${userStats.exactScores}
- ${t('common.correctResultsLabel')} : ${userStats.correctResults}
- ${t('matchdayRecap.matchdayRankLabel')} : ${userStats.matchdayRank}${userStats.matchdayRank === 1 ? t('common.ordFirst') : t('common.ordOther')}
- ${t('common.generalRankLabel')} : ${userStats.generalRank}${userStats.generalRank === 1 ? t('common.ordFirst') : t('common.ordOther')} (${rankChangeText})

🏅 ${t('matchdayRecap.textMatchdayRankTitle')}
${matchdayRankingText}

🏆 ${t('matchdayRecap.textGeneralRankTitle')}
${generalRankingText}

👉 ${t('matchdayRecap.viewFullRanking')} : ${tournamentUrl}?tab=classement

---
${t('common.footerRights', { year: new Date().getFullYear() })}
  `.trim()

  return {
    html,
    text,
    subject: t('matchdayRecap.subject', { n: matchdayNumber, tournament: tournamentName })
  }
}

// Template: Récap fin de tournoi
export function getTournamentEndTemplate(props: TournamentEndEmailProps) {
  const {
    username,
    tournamentName,
    tournamentSlug,
    competitionName,
    finalRanking,
    userFinalStats,
    winner,
    newTrophies,
    locale
  } = props
  const t = emailT(locale)
  const loc = locale === 'en' ? 'en' : 'fr'

  const baseUrl = 'https://www.pronohub.club'
  const tournamentUrl = `${baseUrl}/${tournamentSlug}/opposition`

  const isWinner = winner.username === username
  const headerGradient = isWinner ? 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)' : 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)'
  const headerTitle = isWinner ? `👑 ${t('tournamentEnd.headerWon')}` : `🏁 ${t('tournamentEnd.headerEnded')}`

  // Classement final HTML
  const finalRankingHtml = finalRanking.map(p => `
    <tr style="${p.isCurrentUser ? 'background-color: #1e3a5f;' : ''}">
      <td style="padding: 10px 12px; color: ${p.rank === 1 ? '#fbbf24' : p.rank <= 3 ? '#ff9900' : '#94a3b8'}; font-size: 14px; font-weight: ${p.rank <= 3 ? '700' : '400'};">
        ${p.rank === 1 ? '👑' : p.rank === 2 ? '🥈' : p.rank === 3 ? '🥉' : p.rank}
      </td>
      <td style="padding: 10px 12px; color: ${p.isCurrentUser ? '#ff9900' : '#fff'}; font-size: 14px; font-weight: ${p.isCurrentUser ? '600' : '400'};">${p.username}${p.isCurrentUser ? ` ${t('common.you')}` : ''}</td>
      <td style="padding: 10px 12px; color: #22c55e; font-size: 14px; text-align: right; font-weight: 600;">${p.totalPoints} pts</td>
    </tr>
  `).join('')

  // Trophées HTML
  const trophiesHtml = newTrophies && newTrophies.length > 0 ? `
    <div style="background-color: #422006; border-radius: 12px; padding: 20px; margin-bottom: 24px; border-left: 4px solid #f59e0b;">
      <h3 style="margin: 0 0 12px; color: #fbbf24; font-size: 16px;">🏆 ${newTrophies.length > 1 ? t('common.trophyUnlockedOther') : t('common.trophyUnlockedOne')}</h3>
      ${newTrophies.map(tr => `
        <div style="margin-bottom: 8px;">
          <span style="color: #fbbf24; font-size: 14px; font-weight: 600;">${tr.name}</span><br>
          <span style="color: #fcd34d; font-size: 12px;">${tr.description}</span>
        </div>
      `).join('')}
    </div>
  ` : ''

  const html = `
<!DOCTYPE html>
<html lang="${loc}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t('tournamentEnd.pageTitle', { tournament: tournamentName })}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #1a1a2e; border-radius: 16px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: ${headerGradient};">
              <table role="presentation" align="center" style="margin-bottom: 16px;"><tr><td style="width: 90px; height: 90px; background-color: #1e293b; border-radius: 50%; text-align: center; vertical-align: middle;">
                <img src="https://www.pronohub.club/images/logo-email.png" alt="PronoHub" style="width: 60px; height: 60px; display: inline-block;">
              </td></tr></table>
              <h1 style="margin: 0; color: ${isWinner ? '#000' : '#fff'}; font-size: 24px; font-weight: 700;">${headerTitle}</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                ${isWinner ? t('tournamentEnd.congrats') : t('common.hi')} <strong style="color: #ff9900;">${username}</strong> ! ${isWinner ? '🎉' : '👋'}
              </p>
              <p style="margin: 0 0 24px; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                ${t('tournamentEnd.endedPre')} <strong>${tournamentName}</strong> ${t('tournamentEnd.endedPost')}
                ${isWinner ? t('tournamentEnd.winnerYou') : `${t('tournamentEnd.winnerOtherPre')} <strong style="color: #fbbf24;">${winner.username}</strong> ${t('tournamentEnd.winnerOtherPost', { points: winner.totalPoints })}`}
              </p>

              <!-- Classement final -->
              <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-radius: 12px; padding: 24px; margin-bottom: 24px; text-align: center;">
                <p style="margin: 0 0 8px; color: #94a3b8; font-size: 14px;">${t('tournamentEnd.yourFinalRank')}</p>
                <p style="margin: 0; color: ${userFinalStats.finalRank === 1 ? '#fbbf24' : userFinalStats.finalRank <= 3 ? '#ff9900' : '#fff'}; font-size: 56px; font-weight: 700;">
                  ${userFinalStats.finalRank === 1 ? '👑' : userFinalStats.finalRank}${userFinalStats.finalRank > 1 ? (userFinalStats.finalRank === 2 ? t('common.ordOther') : t('common.ordOther')) : ''}
                </p>
                <p style="margin: 4px 0 0; color: #22c55e; font-size: 18px; font-weight: 600;">${userFinalStats.totalPoints} points</p>
              </div>

              ${trophiesHtml}

              <!-- Stats finales -->
              <div style="background-color: #0f172a; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <h3 style="margin: 0 0 16px; color: #ff9900; font-size: 16px;">📊 ${t('tournamentEnd.statsTitle')}</h3>
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 6px 0; color: #94a3b8; font-size: 13px;">${t('tournamentEnd.totalPointsLabel')}</td>
                    <td style="padding: 6px 0; color: #22c55e; font-size: 13px; text-align: right; font-weight: 600;">${userFinalStats.totalPoints} pts</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #94a3b8; font-size: 13px;">${t('common.exactScoresLabel')}</td>
                    <td style="padding: 6px 0; color: #22c55e; font-size: 13px; text-align: right; font-weight: 600;">${userFinalStats.exactScores}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #94a3b8; font-size: 13px;">${t('common.correctResultsLabel')}</td>
                    <td style="padding: 6px 0; color: #3b82f6; font-size: 13px; text-align: right; font-weight: 600;">${userFinalStats.correctResults}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #94a3b8; font-size: 13px;">${t('tournamentEnd.perfectMatchdaysLabel')}</td>
                    <td style="padding: 6px 0; color: #fbbf24; font-size: 13px; text-align: right; font-weight: 600;">${userFinalStats.perfectMatchdays}</td>
                  </tr>
                </table>
              </div>

              <!-- Classement complet -->
              <div style="background-color: #0f172a; border-radius: 12px; overflow: hidden; margin-bottom: 24px;">
                <div style="padding: 16px; border-bottom: 1px solid #1e293b;">
                  <h3 style="margin: 0; color: #fbbf24; font-size: 16px;">🏆 ${t('tournamentEnd.finalRankTitle')}</h3>
                </div>
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  ${finalRankingHtml}
                </table>
              </div>

              <!-- Boutons d'action -->
              <div style="text-align: center; margin: 32px 0;">
                <a href="${tournamentUrl}?tab=classement" style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #ff9900 0%, #ff6600 100%); color: #000; text-decoration: none; font-weight: 600; font-size: 15px; border-radius: 8px; margin: 6px;">
                  ${t('tournamentEnd.viewDetails')}
                </a>
                <a href="${baseUrl}/vestiaire/create" style="display: inline-block; padding: 14px 28px; background-color: #22c55e; color: #000; text-decoration: none; font-weight: 600; font-size: 15px; border-radius: 8px; margin: 6px;">
                  ${t('tournamentEnd.createTournament')}
                </a>
              </div>

              <p style="margin: 0; color: #64748b; font-size: 13px; line-height: 1.6; text-align: center;">
                ${t('tournamentEnd.thanks')} 🎯
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #0f172a; border-top: 1px solid #1e293b;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="color: #64748b; font-size: 12px;">
                    ${t('common.footerRights', { year: new Date().getFullYear() })}
                  </td>
                  <td style="text-align: right;">
                    <a href="${baseUrl}/profile" style="color: #64748b; font-size: 12px; text-decoration: none;">${t('common.manageNotifications')}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()

  const finalRankingText = finalRanking.map(p => `  ${p.rank}. ${p.username}${p.isCurrentUser ? ` ${t('common.you')}` : ''} - ${p.totalPoints} pts`).join('\n')
  const trophiesText = newTrophies && newTrophies.length > 0 ? `\n🏆 ${newTrophies.length > 1 ? t('common.trophyTextOther') : t('common.trophyTextOne')}\n${newTrophies.map(tr => `  • ${tr.name} : ${tr.description}`).join('\n')}\n` : ''

  const text = `
${isWinner ? `👑 ${t('tournamentEnd.headerWon')}` : `🏁 ${t('tournamentEnd.headerEnded')}`} - ${tournamentName}

${isWinner ? t('tournamentEnd.congrats') : t('common.hi')} ${username} !

${t('tournamentEnd.endedPre')} ${tournamentName} ${t('tournamentEnd.endedPost')}
${isWinner ? t('tournamentEnd.winnerYou') : `${t('tournamentEnd.winnerOtherPre')} ${winner.username} ${t('tournamentEnd.winnerOtherPost', { points: winner.totalPoints })}`}

🏅 ${t('tournamentEnd.textFinalRankPre')} ${userFinalStats.finalRank}${userFinalStats.finalRank === 1 ? t('common.ordFirst') : t('common.ordOther')} ${t('tournamentEnd.textFinalRankWith', { points: userFinalStats.totalPoints })}
${trophiesText}
📊 ${t('tournamentEnd.textStatsTitle')}
- ${t('tournamentEnd.totalPointsLabel')} : ${userFinalStats.totalPoints} pts
- ${t('common.exactScoresLabel')} : ${userFinalStats.exactScores}
- ${t('common.correctResultsLabel')} : ${userFinalStats.correctResults}
- ${t('tournamentEnd.perfectMatchdaysLabel')} : ${userFinalStats.perfectMatchdays}

🏆 ${t('tournamentEnd.textFinalRankTitle')}
${finalRankingText}

👉 ${t('tournamentEnd.viewDetails')} : ${tournamentUrl}?tab=classement
🎯 ${t('tournamentEnd.createNewTournament')} : ${baseUrl}/vestiaire/create

${t('tournamentEnd.textThanks')}

---
${t('common.footerRights', { year: new Date().getFullYear() })}
  `.trim()

  return {
    html,
    text,
    subject: isWinner ? `👑 ${t('tournamentEnd.subjectWon', { tournament: tournamentName })}` : `🏁 ${t('tournamentEnd.subjectEndedPre', { tournament: tournamentName })} ${userFinalStats.finalRank}${userFinalStats.finalRank === 1 ? t('common.ordFirst') : t('common.ordOther')} !`
  }
}

// Template: Invitation tournoi détaillée
export function getTournamentInviteDetailedTemplate(props: TournamentInviteDetailedEmailProps) {
  const {
    inviterUsername,
    tournamentName,
    tournamentSlug,
    inviteCode,
    competitionName,
    participants,
    matchdayRange,
    rules,
    locale
  } = props
  const t = emailT(locale)
  const loc = locale === 'en' ? 'en' : 'fr'

  const baseUrl = 'https://www.pronohub.club'
  const joinUrl = `${baseUrl}/join?code=${inviteCode}`

  // Liste des participants
  const participantsHtml = participants.map(p =>
    `<span style="display: inline-block; background-color: #1e293b; padding: 4px 10px; border-radius: 16px; margin: 4px; font-size: 13px; color: #e0e0e0;">${p.username}${p.isCaptain ? ` <span style="color: #ff9900;">${t('common.captainAbbr')}</span>` : ''}</span>`
  ).join('')

  const html = `
<!DOCTYPE html>
<html lang="${loc}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t('inviteDetailed.pageTitle', { tournament: tournamentName })}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #1a1a2e; border-radius: 16px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #ff9900 0%, #ff6600 100%);">
              <table role="presentation" align="center" style="margin-bottom: 16px;"><tr><td style="width: 90px; height: 90px; background-color: #1e293b; border-radius: 50%; text-align: center; vertical-align: middle;">
                <img src="https://www.pronohub.club/images/logo-email.png" alt="PronoHub" style="width: 60px; height: 60px; display: inline-block;">
              </td></tr></table>
              <h1 style="margin: 0; color: #000; font-size: 22px; font-weight: 700;">🎯 ${t('inviteDetailed.title')}</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 24px; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                <strong style="color: #ff9900;">${inviterUsername}</strong> ${t('inviteDetailed.inviteText')}
              </p>

              <!-- Code d'invitation -->
              <div style="background-color: #0f172a; border-radius: 12px; padding: 24px; margin-bottom: 24px; text-align: center;">
                <p style="margin: 0 0 8px; color: #94a3b8; font-size: 14px;">${t('common.inviteCodeLabel')}</p>
                <p style="margin: 0; color: #ff9900; font-size: 36px; font-weight: 700; letter-spacing: 6px;">${inviteCode}</p>
              </div>

              <!-- Infos tournoi -->
              <div style="background-color: #0f172a; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <h3 style="margin: 0 0 16px; color: #ff9900; font-size: 16px;">📋 ${tournamentName}</h3>
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 6px 0; color: #94a3b8; font-size: 13px;">${t('common.competitionLabel')}</td>
                    <td style="padding: 6px 0; color: #ff9900; font-size: 13px; text-align: right; font-weight: 600;">${competitionName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #94a3b8; font-size: 13px;">${t('inviteDetailed.matchdaysLabel')}</td>
                    <td style="padding: 6px 0; color: #fff; font-size: 13px; text-align: right;">J${matchdayRange.start} → J${matchdayRange.end}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #94a3b8; font-size: 13px;">${t('inviteDetailed.matchesToPredictLabel')}</td>
                    <td style="padding: 6px 0; color: #fff; font-size: 13px; text-align: right; font-weight: 600;">${matchdayRange.totalMatches} ${t('common.matchesWord')}</td>
                  </tr>
                </table>
              </div>

              <!-- Participants -->
              <div style="background-color: #0f172a; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <h3 style="margin: 0 0 12px; color: #ff9900; font-size: 16px;">👥 ${t('inviteDetailed.alreadyJoined')} (${participants.length})</h3>
                <div style="line-height: 2;">
                  ${participantsHtml}
                </div>
              </div>

              <!-- Règles -->
              <div style="background-color: #0f172a; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <h3 style="margin: 0 0 12px; color: #ff9900; font-size: 16px;">📜 ${t('common.rulesTitle')}</h3>
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr><td style="padding: 6px 0; color: #94a3b8; font-size: 13px;">${t('common.ruleExactScore')}</td><td style="padding: 6px 0; color: #22c55e; font-size: 13px; text-align: right; font-weight: 600;">+${rules.exactScore} pts</td></tr>
                  <tr><td style="padding: 6px 0; color: #94a3b8; font-size: 13px;">${t('common.ruleCorrectResult')}</td><td style="padding: 6px 0; color: #3b82f6; font-size: 13px; text-align: right; font-weight: 600;">+${rules.correctResult} pts</td></tr>
                  <tr><td style="padding: 6px 0; color: #94a3b8; font-size: 13px;">${t('common.ruleGoalDiff')}</td><td style="padding: 6px 0; color: #8b5cf6; font-size: 13px; text-align: right; font-weight: 600;">+${rules.correctGoalDiff} pts</td></tr>
                  ${rules.bonusEnabled ? `<tr><td style="padding: 6px 0; color: #94a3b8; font-size: 13px;">${t('inviteDetailed.bonusEnabledLabel')}</td><td style="padding: 6px 0; color: #ff9900; font-size: 13px; text-align: right; font-weight: 600;">+${rules.bonusPoints || 0} pts</td></tr>` : ''}
                </table>
              </div>

              <!-- Bouton d'action -->
              <div style="text-align: center; margin: 32px 0;">
                <a href="${joinUrl}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #ff9900 0%, #ff6600 100%); color: #000; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 8px;">
                  ${t('common.joinTournament')}
                </a>
              </div>

              <p style="margin: 0; color: #64748b; font-size: 13px; line-height: 1.6; text-align: center;">
                ${t('common.joinPitch')} 🏆
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #0f172a; border-top: 1px solid #1e293b;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="color: #64748b; font-size: 12px;">
                    ${t('common.footerRights', { year: new Date().getFullYear() })}
                  </td>
                  <td style="text-align: right;">
                    <a href="${baseUrl}/privacy" style="color: #64748b; font-size: 12px; text-decoration: none; margin-left: 16px;">${t('common.footerPrivacy')}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()

  const participantsText = participants.map(p => `  • ${p.username}${p.isCaptain ? ` ${t('common.captainAbbr')}` : ''}`).join('\n')

  const text = `
🎯 ${t('inviteDetailed.textTitle')}

${inviterUsername} ${t('inviteDetailed.inviteText')}

📋 ${t('inviteDetailed.textInviteCodeLabel')} : ${inviteCode}

📋 ${tournamentName}
- ${t('common.competitionLabel')} : ${competitionName}
- ${t('inviteDetailed.matchdaysLabel')} : J${matchdayRange.start} → J${matchdayRange.end}
- ${t('inviteDetailed.textMatchesLabel')} : ${matchdayRange.totalMatches} ${t('common.matchesWord')}

👥 ${t('inviteDetailed.textAlreadyJoined')} (${participants.length})
${participantsText}

📜 ${t('inviteDetailed.textRulesTitle')}
- ${t('common.ruleExactScore')} : +${rules.exactScore} pts
- ${t('common.ruleCorrectResult')} : +${rules.correctResult} pts
- ${t('common.ruleGoalDiff')} : +${rules.correctGoalDiff} pts
${rules.bonusEnabled ? `- ${t('inviteDetailed.textBonusLabel')} : +${rules.bonusPoints || 0} pts` : ''}

👉 ${t('common.joinTournament')} : ${joinUrl}

${t('common.joinPitch')} 🏆

---
${t('common.footerRights', { year: new Date().getFullYear() })}
  `.trim()

  return {
    html,
    text,
    subject: `🎯 ${inviterUsername} ${t('inviteDetailed.subjectInvite')} ${tournamentName} !`
  }
}

// Template: Nouveau joueur inscrit (pour le capitaine)
export function getNewPlayerJoinedTemplate(props: NewPlayerJoinedEmailProps) {
  const {
    captainUsername,
    tournamentName,
    tournamentSlug,
    competitionName,
    newPlayerUsername,
    currentParticipants,
    maxParticipants,
    participants,
    canLaunchTournament,
    locale
  } = props
  const t = emailT(locale)
  const loc = locale === 'en' ? 'en' : 'fr'

  const baseUrl = 'https://www.pronohub.club'
  const tournamentUrl = `${baseUrl}/${tournamentSlug}/opposition`
  const spotsLeft = maxParticipants - currentParticipants
  const isFull = spotsLeft <= 0

  // Liste des participants
  const participantsHtml = participants.map(p =>
    `<span style="display: inline-block; background-color: ${p.username === newPlayerUsername ? '#22543d' : '#1e293b'}; padding: 4px 10px; border-radius: 16px; margin: 4px; font-size: 13px; color: #e0e0e0;">${p.username}${p.isCaptain ? ` <span style="color: #ff9900;">${t('common.captainAbbr')}</span>` : ''}${p.username === newPlayerUsername ? ` <span style="color: #22c55e;">✨ ${t('newPlayerJoined.newLabel')}</span>` : ''}</span>`
  ).join('')

  const html = `
<!DOCTYPE html>
<html lang="${loc}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t('newPlayerJoined.pageTitle', { tournament: tournamentName })}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #1a1a2e; border-radius: 16px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);">
              <table role="presentation" align="center" style="margin-bottom: 16px;"><tr><td style="width: 90px; height: 90px; background-color: #1e293b; border-radius: 50%; text-align: center; vertical-align: middle;">
                <img src="https://www.pronohub.club/images/logo-email.png" alt="PronoHub" style="width: 60px; height: 60px; display: inline-block;">
              </td></tr></table>
              <h1 style="margin: 0; color: #000; font-size: 22px; font-weight: 700;">👋 ${t('newPlayerJoined.title')}</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                ${t('common.hi')} <strong style="color: #ff9900;">${captainUsername}</strong> ${t('newPlayerJoined.captainParenthetical')} ! 👋
              </p>
              <p style="margin: 0 0 24px; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                <strong style="color: #22c55e;">${newPlayerUsername}</strong> ${t('newPlayerJoined.joinedText')} <strong>${tournamentName}</strong> ! 🎉
              </p>

              <!-- Stats -->
              <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-radius: 12px; padding: 24px; margin-bottom: 24px; text-align: center;">
                <p style="margin: 0 0 8px; color: #94a3b8; font-size: 14px;">${t('common.participantsLabel')}</p>
                <p style="margin: 0; color: #fff; font-size: 36px; font-weight: 700;">${currentParticipants} <span style="color: #64748b; font-size: 20px;">/ ${maxParticipants}</span></p>
                <p style="margin: 8px 0 0; color: ${isFull ? '#ef4444' : '#22c55e'}; font-size: 14px;">
                  ${isFull ? `🔴 ${t('newPlayerJoined.tournamentFull')}` : `🟢 ${spotsLeft > 1 ? t('newPlayerJoined.spotsOther', { n: spotsLeft }) : t('newPlayerJoined.spotsOne', { n: spotsLeft })}`}
                </p>
              </div>

              <!-- Participants -->
              <div style="background-color: #0f172a; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <h3 style="margin: 0 0 12px; color: #ff9900; font-size: 16px;">👥 ${t('common.participantsLabel')} (${currentParticipants})</h3>
                <div style="line-height: 2;">
                  ${participantsHtml}
                </div>
              </div>

              ${isFull ? `
              <!-- Alerte complet -->
              <div style="background-color: #422006; border-radius: 12px; padding: 16px; margin-bottom: 24px; border-left: 4px solid #f59e0b;">
                <p style="margin: 0; color: #fcd34d; font-size: 14px; line-height: 1.5;">
                  <strong>🎯 ${t('newPlayerJoined.fullAlertTitle')}</strong><br>
                  ${t('newPlayerJoined.fullAlertText')}
                </p>
              </div>
              ` : canLaunchTournament ? `
              <!-- Option lancer avant -->
              <div style="background-color: #0f172a; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
                <p style="margin: 0; color: #94a3b8; font-size: 14px; line-height: 1.5;">
                  💡 ${t('newPlayerJoined.launchTip')}
                </p>
              </div>
              ` : ''}

              <!-- Boutons d'action -->
              <div style="text-align: center; margin: 32px 0;">
                ${isFull || canLaunchTournament ? `
                <a href="${tournamentUrl}" style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: #000; text-decoration: none; font-weight: 600; font-size: 15px; border-radius: 8px; margin: 6px;">
                  🚀 ${t('newPlayerJoined.launchBtn')}
                </a>
                ` : ''}
                <a href="${tournamentUrl}" style="display: inline-block; padding: 14px 28px; background-color: #1e293b; color: #fff; text-decoration: none; font-weight: 600; font-size: 15px; border-radius: 8px; margin: 6px;">
                  ${t('common.viewTournament')}
                </a>
              </div>

              <!-- Premium -->
              <div style="background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); border-radius: 12px; padding: 16px; margin-bottom: 24px; text-align: center;">
                <p style="margin: 0 0 8px; color: #c4b5fd; font-size: 14px;">
                  ⭐ ${t('newPlayerJoined.premiumQuestion')}
                </p>
                <a href="${baseUrl}/pricing" style="color: #fbbf24; font-size: 14px; font-weight: 600; text-decoration: none;">
                  ${t('newPlayerJoined.premiumCta')}
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #0f172a; border-top: 1px solid #1e293b;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="color: #64748b; font-size: 12px;">
                    ${t('common.footerRights', { year: new Date().getFullYear() })}
                  </td>
                  <td style="text-align: right;">
                    <a href="${baseUrl}/profile" style="color: #64748b; font-size: 12px; text-decoration: none;">${t('common.manageNotifications')}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()

  const participantsText = participants.map(p => `  • ${p.username}${p.isCaptain ? ` ${t('common.captainAbbr')}` : ''}${p.username === newPlayerUsername ? ` ✨ ${t('newPlayerJoined.newLabel')}` : ''}`).join('\n')

  const text = `
👋 ${t('newPlayerJoined.textHeader', { tournament: tournamentName })}

${t('common.hi')} ${captainUsername} ${t('newPlayerJoined.captainParenthetical')} !

${newPlayerUsername} ${t('newPlayerJoined.joinedText')} ${tournamentName} ! 🎉

📊 ${t('newPlayerJoined.textParticipantsLabel')} : ${currentParticipants} / ${maxParticipants}
${isFull ? `🔴 ${t('newPlayerJoined.tournamentFull')}` : `🟢 ${spotsLeft > 1 ? t('newPlayerJoined.spotsOther', { n: spotsLeft }) : t('newPlayerJoined.spotsOne', { n: spotsLeft })}`}

👥 ${t('newPlayerJoined.textParticipantsList')}
${participantsText}

${isFull ? `🎯 ${t('newPlayerJoined.textFullMsg')}` : canLaunchTournament ? `💡 ${t('newPlayerJoined.textLaunchTip')}` : ''}

${isFull || canLaunchTournament ? `🚀 ${t('newPlayerJoined.launchBtn')} : ${tournamentUrl}` : ''}
👉 ${t('common.viewTournament')} : ${tournamentUrl}
⭐ ${t('common.goPremium')} : ${baseUrl}/pricing

---
${t('common.footerRights', { year: new Date().getFullYear() })}
  `.trim()

  return {
    html,
    text,
    subject: `👋 ${t('newPlayerJoined.subject', { player: newPlayerUsername, tournament: tournamentName, current: currentParticipants, max: maxParticipants })}`
  }
}

// Template: Email de transfert de capitanat
export function getCaptainTransferTemplate(props: CaptainTransferEmailProps) {
  const {
    newCaptainUsername,
    oldCaptainUsername,
    tournamentName,
    tournamentSlug,
    competitionName,
    tournamentStatus,
    locale
  } = props
  const t = emailT(locale)
  const loc = locale === 'en' ? 'en' : 'fr'

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.pronohub.club'
  const tournamentUrl = `${baseUrl}/vestiaire/${tournamentSlug}/echauffement`

  const statusMessage = tournamentStatus === 'pending' || tournamentStatus === 'warmup'
    ? t('captainTransfer.statusMsgPending')
    : t('captainTransfer.statusMsgActive')

  const statusBadge = tournamentStatus === 'pending' || tournamentStatus === 'warmup'
    ? `<span style="display: inline-block; background-color: #fef3c7; color: #92400e; padding: 4px 12px; border-radius: 16px; font-size: 12px; font-weight: 600;">${t('captainTransfer.badgePending')}</span>`
    : `<span style="display: inline-block; background-color: #dcfce7; color: #166534; padding: 4px 12px; border-radius: 16px; font-size: 12px; font-weight: 600;">${t('captainTransfer.badgeActive')}</span>`

  const html = `
<!DOCTYPE html>
<html lang="${loc}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t('captainTransfer.title')}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #1a1a2e; border-radius: 16px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #ff9900 0%, #ff6600 100%);">
              <table role="presentation" align="center" style="margin-bottom: 16px;"><tr><td style="width: 90px; height: 90px; background-color: #1e293b; border-radius: 50%; text-align: center; vertical-align: middle;">
                <span style="font-size: 48px;">👑</span>
              </td></tr></table>
              <h1 style="margin: 0; color: #000; font-size: 28px; font-weight: 700;">${t('captainTransfer.title')}</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                ${t('common.hi')} <strong style="color: #ff9900;">${newCaptainUsername}</strong> ! 👋
              </p>
              <p style="margin: 0 0 20px; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                <strong style="color: #94a3b8;">${oldCaptainUsername}</strong> ${t('captainTransfer.transferredText')} <strong style="color: #ff9900;">${tournamentName}</strong>.
              </p>

              <!-- Tournament Card -->
              <div style="background-color: #0f172a; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid #ff9900;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                  <h3 style="margin: 0; color: #ff9900; font-size: 20px;">${tournamentName}</h3>
                  ${statusBadge}
                </div>
                <p style="margin: 0 0 8px; color: #94a3b8; font-size: 14px;">
                  ⚽ <strong>${competitionName}</strong>
                </p>
              </div>

              <p style="margin: 0 0 24px; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                ${statusMessage}
              </p>

              <!-- Responsibilities -->
              <div style="background-color: #0f172a; border-radius: 12px; padding: 24px; margin: 24px 0;">
                <h3 style="margin: 0 0 16px; color: #ff9900; font-size: 18px;">👑 ${t('captainTransfer.responsibilitiesTitle')}</h3>
                <ul style="margin: 0; padding-left: 20px; color: #94a3b8; font-size: 14px; line-height: 1.8;">
                  ${tournamentStatus === 'pending' || tournamentStatus === 'warmup' ? `<li>${t('captainTransfer.respLaunch')}</li>` : ''}
                  <li>${t('captainTransfer.respShare')}</li>
                  <li>${t('captainTransfer.respManage')}</li>
                  <li>${t('captainTransfer.respTransfer')}</li>
                </ul>
              </div>

              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; margin: 32px 0;">
                <tr>
                  <td align="center">
                    <a href="${tournamentUrl}" style="display: inline-block; background: linear-gradient(135deg, #ff9900 0%, #ff6600 100%); color: #000; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                      ${t('common.viewTournament')}
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; color: #64748b; font-size: 14px; text-align: center;">
                ${t('captainTransfer.goodLuck')} ⚽
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #0f172a; text-align: center;">
              <p style="margin: 0 0 8px; color: #64748b; font-size: 12px;">
                ${t('common.footerRights', { year: new Date().getFullYear() })}
              </p>
              <p style="margin: 0; color: #475569; font-size: 11px;">
                <a href="${baseUrl}/settings/notifications" style="color: #475569; text-decoration: underline;">${t('common.manageNotifications')}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()

  const text = `
👑 ${t('captainTransfer.textTitle')}

${t('common.hi')} ${newCaptainUsername} !

${oldCaptainUsername} ${t('captainTransfer.transferredText')} "${tournamentName}".

📋 ${t('captainTransfer.textDetailsTitle')}
---
${t('common.tournamentLabel')} : ${tournamentName}
${t('common.competitionLabel')} : ${competitionName}
${t('captainTransfer.statusLabel')} : ${tournamentStatus === 'pending' || tournamentStatus === 'warmup' ? t('captainTransfer.badgePending') : t('captainTransfer.badgeActive')}

${tournamentStatus === 'pending' || tournamentStatus === 'warmup' ? `⚠️ ${t('captainTransfer.textStatusPending')}` : ''}

👑 ${t('captainTransfer.textResponsibilitiesTitle')}
${tournamentStatus === 'pending' || tournamentStatus === 'warmup' ? `• ${t('captainTransfer.respLaunch')}\n` : ''}• ${t('captainTransfer.respShare')}
• ${t('captainTransfer.respManage')}
• ${t('captainTransfer.respTransfer')}

👉 ${t('common.viewTournament')} : ${tournamentUrl}

${t('captainTransfer.goodLuck')} ⚽

---
${t('common.footerRights', { year: new Date().getFullYear() })}
  `.trim()

  return {
    html,
    text,
    subject: `👑 ${t('captainTransfer.subject', { tournament: tournamentName })}`
  }
}

// Template: Mention dans le chat
export function getMentionTemplate(props: MentionEmailProps) {
  const {
    username,
    senderUsername,
    tournamentName,
    tournamentSlug,
    competitionName,
    message,
    locale
  } = props
  const t = emailT(locale)
  const loc = locale === 'en' ? 'en' : 'fr'

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.pronohub.club'
  const chatUrl = `${baseUrl}/${tournamentSlug}/opposition?tab=tchat`

  // Tronquer le message si trop long (afficher 200 premiers caractères)
  const displayMessage = message.length > 200 ? message.substring(0, 200) + '...' : message

  const html = `
<!DOCTYPE html>
<html lang="${loc}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t('mention.pageTitle')}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #1a1a2e; border-radius: 16px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #ff9900 0%, #ff6600 100%);">
              <table role="presentation" align="center" style="margin-bottom: 16px;"><tr><td style="width: 90px; height: 90px; background-color: #1e293b; border-radius: 50%; text-align: center; vertical-align: middle;">
                <span style="font-size: 48px;">💬</span>
              </td></tr></table>
              <h1 style="margin: 0; color: #000; font-size: 28px; font-weight: 700;">${t('mention.title')}</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                ${t('common.hi')} <strong style="color: #ff9900;">${username}</strong> ! 👋
              </p>
              <p style="margin: 0 0 20px; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                <strong style="color: #94a3b8;">${senderUsername}</strong> ${t('mention.mentionedText')} <strong style="color: #ff9900;">${tournamentName}</strong>.
              </p>

              <!-- Tournament Info -->
              ${competitionName ? `
              <div style="background-color: #0f172a; border-radius: 12px; padding: 16px; margin: 20px 0;">
                <p style="margin: 0; color: #94a3b8; font-size: 14px;">
                  ⚽ <strong>${competitionName}</strong>
                </p>
              </div>
              ` : ''}

              <!-- Message Preview -->
              <div style="background-color: #0f172a; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid #ff9900;">
                <h3 style="margin: 0 0 12px; color: #ff9900; font-size: 16px;">${t('mention.messageLabel')}</h3>
                <p style="margin: 0; color: #e0e0e0; font-size: 15px; line-height: 1.6; font-style: italic;">
                  "${displayMessage}"
                </p>
              </div>

              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; margin: 32px 0;">
                <tr>
                  <td align="center">
                    <a href="${chatUrl}" style="display: inline-block; background: linear-gradient(135deg, #ff9900 0%, #ff6600 100%); color: #000; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                      ${t('mention.viewMessage')}
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; color: #64748b; font-size: 14px; text-align: center;">
                ${t('mention.footer1')} 💬
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #0f172a; text-align: center;">
              <p style="margin: 0 0 8px; color: #64748b; font-size: 12px;">
                ${t('common.footerRights', { year: new Date().getFullYear() })}
              </p>
              <p style="margin: 0; color: #475569; font-size: 11px;">
                <a href="${baseUrl}/settings/notifications" style="color: #475569; text-decoration: underline;">${t('common.manageNotifications')}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()

  const text = `
💬 ${t('mention.textTitle')}

${t('common.hi')} ${username} !

${senderUsername} ${t('mention.mentionedText')} "${tournamentName}".

${competitionName ? `⚽ ${competitionName}\n` : ''}
📝 ${t('mention.textMessageTitle')}
---
"${displayMessage}"

👉 ${t('mention.viewMessage')} : ${chatUrl}

${t('mention.footer1')} 💬

---
${t('common.footerRights', { year: new Date().getFullYear() })}
  `.trim()

  return {
    html,
    text,
    subject: `💬 ${senderUsername} ${t('mention.subjectMentioned')} ${tournamentName}`
  }
}

// Template: Rappel multi-tournois (un email pour tous les tournois)
export function getMultiTournamentReminderTemplate(props: MultiTournamentReminderEmailProps) {
  const {
    username,
    tournaments,
    defaultPredictionMaxPoints,
    earliestDeadline,
    locale
  } = props
  const t = emailT(locale)
  const loc = locale === 'en' ? 'en' : 'fr'

  const totalMatches = tournaments.reduce((sum, tt) => sum + tt.matches.length, 0)
  const actionUrl = 'https://www.pronohub.club/dashboard'

  // Générer le HTML pour chaque tournoi
  const tournamentsHtml = tournaments.map(tournament => {
    const matchesHtml = tournament.matches.map(match => {
      // Logos des équipes (24x24px)
      const homeCrest = match.homeTeamCrest
        ? `<img src="${match.homeTeamCrest}" alt="" style="width: 24px; height: 24px; vertical-align: middle; margin-right: 6px; border-radius: 4px;">`
        : ''
      const awayCrest = match.awayTeamCrest
        ? `<img src="${match.awayTeamCrest}" alt="" style="width: 24px; height: 24px; vertical-align: middle; margin-left: 6px; border-radius: 4px;">`
        : ''

      return `
      <tr>
        <td style="padding: 12px 16px; border-bottom: 1px solid #1e293b;">
          <div style="display: flex; align-items: center; justify-content: center;">
            <table role="presentation" style="border-collapse: collapse;">
              <tr>
                <td style="text-align: right; padding-right: 8px;">
                  ${homeCrest}
                  <span style="color: #fff; font-size: 14px; font-weight: 500;">${match.homeTeam}</span>
                </td>
                <td style="padding: 0 8px;">
                  <span style="color: #94a3b8; font-size: 14px;">-</span>
                </td>
                <td style="text-align: left; padding-left: 8px;">
                  <span style="color: #fff; font-size: 14px; font-weight: 500;">${match.awayTeam}</span>
                  ${awayCrest}
                </td>
              </tr>
            </table>
          </div>
          <div style="margin-top: 6px; text-align: center;">
            <span style="color: #94a3b8; font-size: 12px;">📅 ${match.matchDate}</span>
            <span style="color: #ef4444; font-size: 12px; margin-left: 10px;">⏰ ${match.deadlineTime}</span>
          </div>
        </td>
      </tr>
    `}).join('')

    // Logo de la compétition (20x20px)
    const competitionLogo = tournament.competitionEmblem
      ? `<img src="${tournament.competitionEmblem}" alt="" style="width: 20px; height: 20px; vertical-align: middle; margin-right: 8px; border-radius: 4px;">`
      : '🏆 '

    return `
      <div style="background-color: #0f172a; border-radius: 12px; overflow: hidden; margin-bottom: 20px;">
        <div style="padding: 14px 16px; border-bottom: 1px solid #1e293b; background-color: #1e293b;">
          <h3 style="margin: 0; color: #ff9900; font-size: 15px;">${competitionLogo}${tournament.name}</h3>
          <p style="margin: 4px 0 0; color: #94a3b8; font-size: 12px;">${tournament.competitionName} • ${tournament.matches.length} ${tournament.matches.length > 1 ? t('common.matchWordOther') : t('common.matchWordOne')}</p>
        </div>
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          ${matchesHtml}
        </table>
        <div style="padding: 12px 16px; text-align: center;">
          <a href="https://www.pronohub.club/${tournament.slug}/opposition" style="color: #ff9900; font-size: 13px; text-decoration: none;">
            ${t('multiTournamentReminder.predictArrow')}
          </a>
        </div>
      </div>
    `
  }).join('')

  const html = `
<!DOCTYPE html>
<html lang="${loc}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t('multiTournamentReminder.pageTitle', { n: totalMatches })}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #1a1a2e; border-radius: 16px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #ff9900 0%, #ff6600 100%);">
              <table role="presentation" align="center" style="margin-bottom: 16px;"><tr><td style="width: 90px; height: 90px; background-color: #1e293b; border-radius: 50%; text-align: center; vertical-align: middle;">
                <img src="https://www.pronohub.club/images/logo-email.png" alt="PronoHub" style="width: 60px; height: 60px; display: inline-block;">
              </td></tr></table>
              <h1 style="margin: 0; color: #000; font-size: 24px; font-weight: 700;">⏰ ${totalMatches} ${totalMatches > 1 ? t('common.matchWordOther') : t('common.matchWordOne')} ${t('multiTournamentReminder.toPredictExcl')}</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                ${t('common.hi')} <strong style="color: #ff9900;">${username}</strong> ! 👋
              </p>
              <p style="margin: 0 0 24px; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                ${t('multiTournamentReminder.pendingPre')} <strong>${tournaments.length} ${tournaments.length > 1 ? t('common.tournamentWordOther') : t('common.tournamentWordOne')}</strong>. ${t('multiTournamentReminder.pendingPost')}
              </p>

              <!-- Résumé -->
              <div style="background-color: #0f172a; border-radius: 12px; padding: 16px; margin-bottom: 24px; text-align: center;">
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px; text-align: center;">
                      <span style="display: block; color: #ff9900; font-size: 28px; font-weight: 700;">${totalMatches}</span>
                      <span style="color: #94a3b8; font-size: 12px;">${totalMatches > 1 ? t('common.matchWordOther') : t('common.matchWordOne')}</span>
                    </td>
                    <td style="padding: 8px; text-align: center;">
                      <span style="display: block; color: #22c55e; font-size: 28px; font-weight: 700;">${tournaments.length}</span>
                      <span style="color: #94a3b8; font-size: 12px;">${tournaments.length > 1 ? t('common.tournamentWordOther') : t('common.tournamentWordOne')}</span>
                    </td>
                    <td style="padding: 8px; text-align: center;">
                      <span style="display: block; color: #ef4444; font-size: 28px; font-weight: 700;">${earliestDeadline}</span>
                      <span style="color: #94a3b8; font-size: 12px;">${t('multiTournamentReminder.deadlineLabel')}</span>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Liste des tournois avec matchs -->
              ${tournamentsHtml}

              <!-- Alerte prono par défaut -->
              <div style="background-color: #7f1d1d; border-radius: 12px; padding: 16px; margin-bottom: 24px; border-left: 4px solid #ef4444;">
                <p style="margin: 0; color: #fecaca; font-size: 14px; line-height: 1.5;">
                  <strong>⚠️ ${t('common.warningLabel')} :</strong> ${t('common.defaultWarnL1')}
                  ${t('common.defaultWarnL2pre')} <strong>${defaultPredictionMaxPoints > 1 ? t('common.maxPtsOther', { points: defaultPredictionMaxPoints }) : t('common.maxPtsOne', { points: defaultPredictionMaxPoints })}</strong> ${t('common.defaultWarnL2post')}
                </p>
              </div>

              <div style="text-align: center; margin: 32px 0;">
                <a href="${actionUrl}" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #ff9900 0%, #ff6600 100%); color: #000; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 8px;">
                  ${t('multiTournamentReminder.viewAllTournaments')}
                </a>
              </div>

              <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.6; text-align: center;">
                ${t('common.predictBeforePre')} <strong>${t('common.oneHourBefore')}</strong> ${t('common.predictBeforePost')}
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #0f172a; border-top: 1px solid #1e293b;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="color: #64748b; font-size: 12px;">
                    ${t('common.footerRights', { year: new Date().getFullYear() })}
                  </td>
                  <td style="text-align: right;">
                    <a href="https://www.pronohub.club/profile" style="color: #64748b; font-size: 12px; text-decoration: none;">${t('common.manageNotifications')}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()

  // Version texte
  const tournamentsText = tournaments.map(tournament => {
    const matchesText = tournament.matches.map(match =>
      `    • ${match.homeTeam} - ${match.awayTeam}\n      📅 ${match.matchDate} | ⏰ ${t('common.limitLabel')} : ${match.deadlineTime}`
    ).join('\n')

    return `🏆 ${tournament.name} (${tournament.competitionName})
${tournament.matches.length} ${tournament.matches.length > 1 ? t('common.matchWordOther') : t('common.matchWordOne')} ${t('multiTournamentReminder.toPredictColon')}
${matchesText}
👉 ${t('multiTournamentReminder.predictLabel')} : https://www.pronohub.club/${tournament.slug}/opposition`
  }).join('\n\n')

  const text = `
⏰ ${totalMatches} ${totalMatches > 1 ? t('common.matchWordOther') : t('common.matchWordOne')} ${t('multiTournamentReminder.toPredictExcl')}

${t('common.hi')} ${username} !

${t('multiTournamentReminder.pendingPre')} ${tournaments.length} ${tournaments.length > 1 ? t('common.tournamentWordOther') : t('common.tournamentWordOne')}.

📊 ${t('multiTournamentReminder.textSummaryTitle')}
---
${totalMatches} ${totalMatches > 1 ? t('common.matchWordOther') : t('common.matchWordOne')} • ${tournaments.length} ${tournaments.length > 1 ? t('common.tournamentWordOther') : t('common.tournamentWordOne')} • ${t('multiTournamentReminder.deadlineLabel')} : ${earliestDeadline}

${tournamentsText}

⚠️ ${t('common.defaultWarnTextPre')} ${defaultPredictionMaxPoints > 1 ? t('common.maxPtsOther', { points: defaultPredictionMaxPoints }) : t('common.maxPtsOne', { points: defaultPredictionMaxPoints })} ${t('common.defaultWarnTextPost')}

👉 ${t('multiTournamentReminder.viewAllTournaments')} : ${actionUrl}

${t('common.predictBeforePre')} ${t('common.oneHourBefore')} ${t('common.predictBeforePost')}

---
${t('common.footerRights', { year: new Date().getFullYear() })}
${t('common.manageNotifications')} : https://www.pronohub.club/profile
  `.trim()

  // Sujet dynamique selon le nombre de tournois
  let subject: string
  if (tournaments.length === 1) {
    subject = `⏰ ${totalMatches > 1 ? t('multiTournamentReminder.subjectSingleOther', { n: totalMatches, tournament: tournaments[0].name }) : t('multiTournamentReminder.subjectSingleOne', { n: totalMatches, tournament: tournaments[0].name })} !`
  } else {
    subject = `⏰ ${t('multiTournamentReminder.subjectMulti', { n: totalMatches, count: tournaments.length })} !`
  }

  return {
    html,
    text,
    subject
  }
}

// Interface pour l'email de relance utilisateur inactif (10 jours sans tournoi)
export interface InactiveUserReminderEmailProps {
  locale?: EmailLocale
  username: string
}

// Template: Relance utilisateur inactif après 10 jours sans tournoi
export function getInactiveUserReminderTemplate(props: InactiveUserReminderEmailProps) {
  const { username, locale } = props
  const t = emailT(locale)
  const loc = locale === 'en' ? 'en' : 'fr'

  const html = `
<!DOCTYPE html>
<html lang="${loc}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t('inactiveUserReminder.pageTitle')}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #1a1a2e; border-radius: 16px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #ff9900 0%, #ff6600 100%);">
              <table role="presentation" align="center" style="margin-bottom: 16px;"><tr><td style="width: 90px; height: 90px; background-color: #1e293b; border-radius: 50%; text-align: center; vertical-align: middle;">
                <img src="https://www.pronohub.club/images/logo-email.png" alt="PronoHub" style="width: 60px; height: 60px; display: inline-block;">
              </td></tr></table>
              <h1 style="margin: 0; color: #000; font-size: 24px; font-weight: 700;">🏥 ${t('inactiveUserReminder.title')}</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #e0e0e0; font-size: 18px; line-height: 1.6;">
                ${t('inactiveUserReminder.hiChampion')}${username ? ` <strong style="color: #ff9900;">${username}</strong>` : ''} 🏆
              </p>

              <p style="margin: 0 0 20px; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                ${t('inactiveUserReminder.line1a')}<br>
                ${t('inactiveUserReminder.line1b')}
              </p>

              <p style="margin: 0 0 20px; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                ${t('inactiveUserReminder.line2a')}<br>
                👉 <strong style="color: #ff9900;">${t('inactiveUserReminder.line2b')}</strong><br>
                ${t('inactiveUserReminder.line2c')}
              </p>

              <div style="background-color: #0f172a; border-radius: 12px; padding: 24px; margin: 24px 0;">
                <p style="margin: 0 0 8px; color: #ff9900; font-size: 16px; font-weight: 600;">${t('inactiveUserReminder.meanwhile')}</p>
                <ul style="margin: 0; padding-left: 20px; color: #94a3b8; font-size: 15px; line-height: 2;">
                  <li>⚽ ${t('inactiveUserReminder.li1')}</li>
                  <li>📊 ${t('inactiveUserReminder.li2')}</li>
                  <li>🗣️ ${t('inactiveUserReminder.li3')}</li>
                </ul>
              </div>

              <p style="margin: 0 0 20px; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                ${t('inactiveUserReminder.createIntro')}
              </p>

              <div style="background-color: #1e293b; border-radius: 12px; padding: 24px; margin: 24px 0;">
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #e0e0e0; font-size: 15px;">
                      <span style="display: inline-block; width: 28px; height: 28px; background-color: #ff9900; color: #000; border-radius: 50%; text-align: center; line-height: 28px; font-weight: bold; margin-right: 12px;">1</span>
                      ${t('inactiveUserReminder.step1')}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #e0e0e0; font-size: 15px;">
                      <span style="display: inline-block; width: 28px; height: 28px; background-color: #ff9900; color: #000; border-radius: 50%; text-align: center; line-height: 28px; font-weight: bold; margin-right: 12px;">2</span>
                      ${t('inactiveUserReminder.step2')}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #e0e0e0; font-size: 15px;">
                      <span style="display: inline-block; width: 28px; height: 28px; background-color: #ff9900; color: #000; border-radius: 50%; text-align: center; line-height: 28px; font-weight: bold; margin-right: 12px;">3</span>
                      ${t('inactiveUserReminder.step3')}
                    </td>
                  </tr>
                </table>
              </div>

              <p style="margin: 0 0 8px; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                <strong style="color: #ff9900;">${t('inactiveUserReminder.nowOrNever')}</strong>
              </p>
              <p style="margin: 0 0 24px; color: #94a3b8; font-size: 15px; line-height: 1.6;">
                ${t('inactiveUserReminder.elseA')}<br>
                ${t('inactiveUserReminder.elseB')}
              </p>

              <div style="text-align: center; margin: 32px 0;">
                <a href="https://www.pronohub.club/vestiaire" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #ff9900 0%, #ff6600 100%); color: #000; text-decoration: none; font-weight: 700; font-size: 16px; border-radius: 8px;">
                  👉 ${t('inactiveUserReminder.cta')}
                </a>
              </div>

              <p style="margin: 0 0 24px; color: #e0e0e0; font-size: 15px; line-height: 1.6; text-align: center;">
                ${t('inactiveUserReminder.showOff')}
              </p>

              <p style="margin: 0; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                ${t('inactiveUserReminder.seeYou')} ⚽<br>
                <strong style="color: #ff9900;">${t('inactiveUserReminder.teamSignature')}</strong>
              </p>

              <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #1e293b;">
                <p style="margin: 0; color: #64748b; font-size: 13px; font-style: italic;">
                  ${t('inactiveUserReminder.psA')}<br>
                  ${t('inactiveUserReminder.psB')} 😬
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #0f172a; border-top: 1px solid #1e293b;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="color: #64748b; font-size: 12px;">
                    ${t('common.footerRights', { year: new Date().getFullYear() })}
                  </td>
                  <td style="text-align: right;">
                    <a href="https://www.pronohub.club/privacy" style="color: #64748b; font-size: 12px; text-decoration: none; margin-left: 16px;">${t('common.footerPrivacy')}</a>
                    <a href="https://www.pronohub.club/cgv" style="color: #64748b; font-size: 12px; text-decoration: none; margin-left: 16px;">${t('common.footerCgu')}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()

  const text = `
🏥 ${t('inactiveUserReminder.title')}

${t('inactiveUserReminder.hiChampion')}${username ? ` ${username}` : ''} 🏆

${t('inactiveUserReminder.line1a')}
${t('inactiveUserReminder.line1b')}

${t('inactiveUserReminder.line2a')}
👉 ${t('inactiveUserReminder.line2b')}
${t('inactiveUserReminder.line2c')}

${t('inactiveUserReminder.meanwhile')}
⚽ ${t('inactiveUserReminder.li1')}
📊 ${t('inactiveUserReminder.li2')}
🗣️ ${t('inactiveUserReminder.li3')}

${t('inactiveUserReminder.createIntro')}

1. ${t('inactiveUserReminder.step1')}
2. ${t('inactiveUserReminder.step2')}
3. ${t('inactiveUserReminder.step3')}

${t('inactiveUserReminder.nowOrNever')}
${t('inactiveUserReminder.elseA')}
${t('inactiveUserReminder.elseB')}

👉 ${t('inactiveUserReminder.cta')} : https://www.pronohub.club/vestiaire

${t('inactiveUserReminder.showOff')}

${t('inactiveUserReminder.seeYou')} ⚽
${t('inactiveUserReminder.teamSignature')}

${t('inactiveUserReminder.psA')}
${t('inactiveUserReminder.psB')} 😬

${t('common.footerRights', { year: new Date().getFullYear() })}
  `.trim()

  const subject = `🏥 ${t('inactiveUserReminder.title')}`

  return {
    html,
    text,
    subject
  }
}

// Interface pour l'email de modification de matchs (journées custom)
export interface MatchdayChangesEmailProps {
  locale?: EmailLocale
  username: string
  tournamentName: string
  tournamentSlug: string
  competitionName: string
  matchdayNumber: number
  changes: Array<{
    type: 'add' | 'remove'
    homeTeam: string
    awayTeam: string
    homeTeamCrest?: string
    awayTeamCrest?: string
    matchDate: string // Format: "Samedi 8 février à 21h00"
  }>
  totalMatchesInMatchday: number
}

// Template: Notification de modifications sur une journée
export function getMatchdayChangesTemplate(props: MatchdayChangesEmailProps) {
  const {
    username,
    tournamentName,
    tournamentSlug,
    competitionName,
    matchdayNumber,
    changes,
    totalMatchesInMatchday,
    locale
  } = props
  const t = emailT(locale)
  const loc = locale === 'en' ? 'en' : 'fr'

  const baseUrl = 'https://www.pronohub.club'
  const tournamentUrl = `${baseUrl}/${tournamentSlug}/opposition`

  const addedMatches = changes.filter(c => c.type === 'add')
  const removedMatches = changes.filter(c => c.type === 'remove')

  // Générer le HTML pour les matchs ajoutés (avec logos)
  const addedMatchesHtml = addedMatches.length > 0 ? `
              <div style="background-color: #0f172a; border-radius: 12px; overflow: hidden; margin-bottom: 24px;">
                <div style="padding: 16px; border-bottom: 1px solid #1e293b;">
                  <h3 style="margin: 0; color: #22c55e; font-size: 16px;">⚽ ${addedMatches.length > 1 ? t('matchdayChanges.addedTitleOther') : t('matchdayChanges.addedTitleOne')} (${addedMatches.length})</h3>
                  <p style="margin: 4px 0 0; color: #94a3b8; font-size: 13px;">${t('matchdayChanges.toPredict')}</p>
                </div>
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  ${addedMatches.map(match => `
                  <tr>
                    <td style="padding: 16px; border-bottom: 1px solid #1e293b;">
                      <table role="presentation" style="width: 100%; border-collapse: collapse;">
                        <tr>
                          <td style="width: 40%; text-align: right; vertical-align: middle; padding-right: 8px;">
                            ${match.homeTeamCrest ? `<img src="${match.homeTeamCrest}" alt="" width="28" height="28" style="width: 28px; height: 28px; object-fit: contain; vertical-align: middle; margin-right: 8px;">` : ''}
                            <span style="color: #fff; font-size: 14px; font-weight: 600;">${match.homeTeam}</span>
                          </td>
                          <td style="width: 20%; text-align: center; vertical-align: middle;">
                            <span style="color: #ff9900; font-size: 13px; font-weight: 700;">VS</span>
                          </td>
                          <td style="width: 40%; text-align: left; vertical-align: middle; padding-left: 8px;">
                            ${match.awayTeamCrest ? `<img src="${match.awayTeamCrest}" alt="" width="28" height="28" style="width: 28px; height: 28px; object-fit: contain; vertical-align: middle; margin-right: 8px;">` : ''}
                            <span style="color: #fff; font-size: 14px; font-weight: 600;">${match.awayTeam}</span>
                          </td>
                        </tr>
                      </table>
                      <p style="margin: 8px 0 0; color: #94a3b8; font-size: 13px; text-align: center;">
                        📅 ${match.matchDate}
                      </p>
                    </td>
                  </tr>
                  `).join('')}
                </table>
              </div>
  ` : ''

  // Générer le HTML pour les matchs retirés (sans logos, simplifié)
  const removedMatchesHtml = removedMatches.length > 0 ? `
              <div style="background-color: #0f172a; border-radius: 12px; overflow: hidden; margin-bottom: 24px;">
                <div style="padding: 16px; border-bottom: 1px solid #1e293b;">
                  <h3 style="margin: 0; color: #ef4444; font-size: 16px;">❌ ${removedMatches.length > 1 ? t('matchdayChanges.removedTitleOther') : t('matchdayChanges.removedTitleOne')} (${removedMatches.length})</h3>
                </div>
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  ${removedMatches.map(match => `
                  <tr>
                    <td style="padding: 12px 16px; border-bottom: 1px solid #1e293b;">
                      <span style="color: #94a3b8; font-size: 14px; text-decoration: line-through;">${match.homeTeam} - ${match.awayTeam}</span>
                      <span style="color: #64748b; font-size: 12px; margin-left: 8px;">${match.matchDate}</span>
                    </td>
                  </tr>
                  `).join('')}
                </table>
              </div>
  ` : ''

  const html = `
<!DOCTYPE html>
<html lang="${loc}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t('matchdayChanges.pageTitle')}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #1a1a2e; border-radius: 16px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #ff9900 0%, #ff6600 100%);">
              <table role="presentation" align="center" style="margin-bottom: 16px;"><tr><td style="width: 90px; height: 90px; background-color: #1e293b; border-radius: 50%; text-align: center; vertical-align: middle;">
                <img src="https://www.pronohub.club/images/logo-email.png" alt="PronoHub" style="width: 60px; height: 60px; display: inline-block;">
              </td></tr></table>
              <h1 style="margin: 0; color: #000; font-size: 24px; font-weight: 700;">⚽ ${t('matchdayChanges.title')}</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                ${t('common.hi')} <strong style="color: #ff9900;">${username}</strong> ! 👋
              </p>
              <p style="margin: 0 0 24px; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                ${t('matchdayChanges.updatedPre')} <strong style="color: #ff9900;">${t('matchdayChanges.matchdayWord')} ${matchdayNumber}</strong> ${t('matchdayChanges.updatedMid')} <strong style="color: #ff9900;">${tournamentName}</strong> ${t('matchdayChanges.updatedPost')}
              </p>

              <!-- Infos tournoi -->
              <div style="background-color: #0f172a; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 4px 0;">
                      <span style="color: #94a3b8; font-size: 13px;">${t('common.tournamentLabel')}</span><br>
                      <span style="color: #fff; font-size: 16px; font-weight: 600;">${tournamentName}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 0;">
                      <span style="color: #94a3b8; font-size: 13px;">${t('common.competitionLabel')}</span><br>
                      <span style="color: #ff9900; font-size: 15px;">${competitionName}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 0;">
                      <span style="color: #94a3b8; font-size: 13px;">${t('common.matchdayLabel')}</span><br>
                      <span style="color: #fff; font-size: 15px;">J${matchdayNumber} — ${totalMatchesInMatchday} ${t('matchdayChanges.matchesTotal')}</span>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Matchs ajoutés -->
              ${addedMatchesHtml}

              <!-- Matchs retirés -->
              ${removedMatchesHtml}

              <!-- Rappel -->
              ${addedMatches.length > 0 ? `
              <div style="background-color: #1e3a5f; border-radius: 12px; padding: 16px; margin-bottom: 24px; border-left: 4px solid #ff9900;">
                <p style="margin: 0; color: #fbbf24; font-size: 14px; line-height: 1.5;">
                  <strong>🎯 ${t('matchdayChanges.reminderLabel')} :</strong> ${t('matchdayChanges.reminderText')}
                </p>
              </div>
              ` : ''}

              <div style="text-align: center; margin: 32px 0;">
                <a href="${tournamentUrl}" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #ff9900 0%, #ff6600 100%); color: #000; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 8px;">
                  ${t('matchdayChanges.cta')}
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #0f172a; border-top: 1px solid #1e293b;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="color: #64748b; font-size: 12px;">
                    ${t('common.footerRights', { year: new Date().getFullYear() })}
                  </td>
                  <td style="text-align: right;">
                    <a href="${baseUrl}/profile" style="color: #64748b; font-size: 12px; text-decoration: none;">${t('common.manageNotifications')}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()

  // Version texte
  const addedMatchesText = addedMatches.length > 0 ? `
⚽ ${addedMatches.length > 1 ? t('matchdayChanges.textAddedOther') : t('matchdayChanges.textAddedOne')} (${addedMatches.length})
${addedMatches.map(m => `  + ${m.homeTeam} vs ${m.awayTeam}\n    📅 ${m.matchDate}`).join('\n')}
` : ''

  const removedMatchesText = removedMatches.length > 0 ? `
❌ ${removedMatches.length > 1 ? t('matchdayChanges.textRemovedOther') : t('matchdayChanges.textRemovedOne')} (${removedMatches.length})
${removedMatches.map(m => `  - ${m.homeTeam} - ${m.awayTeam} (${m.matchDate})`).join('\n')}
` : ''

  const text = `
⚽ ${t('matchdayChanges.title')}

${t('common.hi')} ${username} !

${t('matchdayChanges.updatedPre')} ${t('matchdayChanges.matchdayWord')} ${matchdayNumber} ${t('matchdayChanges.updatedMid')} "${tournamentName}" ${t('matchdayChanges.updatedPost')}

${t('common.tournamentLabel')} : ${tournamentName}
${t('common.competitionLabel')} : ${competitionName}
${t('common.matchdayLabel')} : J${matchdayNumber} — ${totalMatchesInMatchday} ${t('matchdayChanges.matchesTotal')}
${addedMatchesText}${removedMatchesText}
${addedMatches.length > 0 ? `🎯 ${t('matchdayChanges.textAddedNote')}` : t('matchdayChanges.textRemovedNote')}

👉 ${t('matchdayChanges.predictLabel')} : ${tournamentUrl}

---
${t('common.footerRights', { year: new Date().getFullYear() })}
${t('common.manageNotifications')} : ${baseUrl}/profile
  `.trim()

  // Sujet dynamique
  let subject: string
  if (addedMatches.length > 0 && removedMatches.length === 0) {
    subject = `⚽ ${addedMatches.length > 1 ? t('matchdayChanges.subjectAddedOther', { n: addedMatches.length, tournament: tournamentName, md: matchdayNumber }) : t('matchdayChanges.subjectAddedOne', { n: addedMatches.length, tournament: tournamentName, md: matchdayNumber })}`
  } else if (removedMatches.length > 0 && addedMatches.length === 0) {
    subject = `🔄 ${removedMatches.length > 1 ? t('matchdayChanges.subjectRemovedOther', { n: removedMatches.length, tournament: tournamentName, md: matchdayNumber }) : t('matchdayChanges.subjectRemovedOne', { n: removedMatches.length, tournament: tournamentName, md: matchdayNumber })}`
  } else {
    const addedWord = addedMatches.length > 1 ? t('matchdayChanges.addedWordOther') : t('matchdayChanges.addedWordOne')
    const removedWord = removedMatches.length > 1 ? t('matchdayChanges.removedWordOther') : t('matchdayChanges.removedWordOne')
    subject = `⚽ ${t('matchdayChanges.subjectMixed', { md: matchdayNumber, added: addedMatches.length, addedWord, removed: removedMatches.length, removedWord, tournament: tournamentName })}`
  }

  return {
    html,
    text,
    subject
  }
}

// Interface pour badge débloqué
export interface BadgeUnlockedEmailProps {
  locale?: EmailLocale
  username: string
  trophyName: string
  trophyDescription: string
  trophyImageUrl: string // URL complète : https://www.pronohub.club/trophy/xxx.png
  triggerMatch?: {
    homeTeamName: string
    awayTeamName: string
    homeTeamCrest?: string
    awayTeamCrest?: string
    homeScore: number
    awayScore: number
    predictedHomeScore: number
    predictedAwayScore: number
    matchDate: string
  }
}

export function getBadgeUnlockedTemplate(props: BadgeUnlockedEmailProps) {
  const { username, trophyName, trophyDescription, trophyImageUrl, triggerMatch, locale } = props
  const t = emailT(locale)
  const loc = locale === 'en' ? 'en' : 'fr'
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.pronohub.club'
  const trophiesUrl = `${baseUrl}/profile?tab=trophees`

  // Formater la date du match
  let formattedMatchDate = ''
  if (triggerMatch?.matchDate) {
    try {
      const d = new Date(triggerMatch.matchDate)
      formattedMatchDate = d.toLocaleDateString(loc === 'en' ? 'en-GB' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' })
    } catch { formattedMatchDate = '' }
  }

  // Section match déclencheur HTML
  const matchSectionHtml = triggerMatch ? `
                  <!-- Match déclencheur -->
                  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #0f172a; border-radius: 12px; overflow: hidden; margin-top: 16px;">
                    <tr>
                      <td style="padding: 8px 24px 4px; text-align: center;">
                        <p style="margin: 0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">${t('badgeUnlocked.triggerMatchLabel')}</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 12px 24px 16px; text-align: center;">
                        <table role="presentation" style="width: 100%; border-collapse: collapse;">
                          <tr>
                            <!-- Équipe domicile -->
                            <td style="width: 35%; text-align: center; vertical-align: middle;">
                              ${triggerMatch.homeTeamCrest ? `<img src="${triggerMatch.homeTeamCrest}" alt="" width="40" height="40" style="display: block; margin: 0 auto 6px; width: 40px; height: 40px; object-fit: contain;" />` : ''}
                              <p style="margin: 0; color: #ffffff; font-size: 13px; font-weight: 600;">${triggerMatch.homeTeamName}</p>
                            </td>
                            <!-- Score -->
                            <td style="width: 30%; text-align: center; vertical-align: middle;">
                              <p style="margin: 0 0 4px; color: #ffffff; font-size: 28px; font-weight: 900;">${triggerMatch.homeScore} - ${triggerMatch.awayScore}</p>
                              <p style="margin: 0; color: #94a3b8; font-size: 12px;">${t('badgeUnlocked.predictionLabel')} <span style="color: #f5b800; font-weight: 700;">${triggerMatch.predictedHomeScore} - ${triggerMatch.predictedAwayScore}</span></p>
                              ${formattedMatchDate ? `<p style="margin: 4px 0 0; color: #475569; font-size: 11px;">${formattedMatchDate}</p>` : ''}
                            </td>
                            <!-- Équipe extérieur -->
                            <td style="width: 35%; text-align: center; vertical-align: middle;">
                              ${triggerMatch.awayTeamCrest ? `<img src="${triggerMatch.awayTeamCrest}" alt="" width="40" height="40" style="display: block; margin: 0 auto 6px; width: 40px; height: 40px; object-fit: contain;" />` : ''}
                              <p style="margin: 0; color: #ffffff; font-size: 13px; font-weight: 600;">${triggerMatch.awayTeamName}</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>` : ''

  // Section match pour le texte brut
  const matchSectionText = triggerMatch
    ? `\n${t('badgeUnlocked.textMatchLabel')} : ${triggerMatch.homeTeamName} ${triggerMatch.homeScore} - ${triggerMatch.awayScore} ${triggerMatch.awayTeamName}\n${t('badgeUnlocked.textYourPrediction')} : ${triggerMatch.predictedHomeScore} - ${triggerMatch.predictedAwayScore}${formattedMatchDate ? `\n${t('badgeUnlocked.textDateLabel')} : ${formattedMatchDate}` : ''}\n`
    : ''

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 40px 20px;">
            <table role="presentation" style="max-width: 600px; margin: 0 auto; width: 100%; border-collapse: collapse; background-color: #1a1a2e; border-radius: 16px; overflow: hidden;">

              <!-- Header -->
              <tr>
                <td style="padding: 32px 40px; background: linear-gradient(135deg, #f5b800 0%, #ff9900 100%); text-align: center;">
                  <p style="margin: 0; font-size: 40px; line-height: 1;">🏅</p>
                  <h1 style="margin: 12px 0 0; font-size: 24px; font-weight: 700; color: #000;">
                    ${t('badgeUnlocked.title')}
                  </h1>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="padding: 40px;">
                  <p style="margin: 0 0 24px; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                    ${t('common.hi')} <strong style="color: #ffffff;">${username}</strong> !
                  </p>
                  <p style="margin: 0 0 32px; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                    ${t('badgeUnlocked.congrats')}
                  </p>

                  <!-- Trophy Card -->
                  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #0f172a; border-radius: 12px; overflow: hidden;">
                    <tr>
                      <td style="padding: 32px; text-align: center;">
                        <img src="${trophyImageUrl}" alt="${trophyName}" width="120" height="120" style="display: block; margin: 0 auto 16px; width: 120px; height: 120px; object-fit: contain;" />
                        <p style="margin: 0 0 8px; color: #f5b800; font-size: 20px; font-weight: 700;">
                          ${trophyName}
                        </p>
                        <p style="margin: 0; color: #94a3b8; font-size: 14px;">
                          ${trophyDescription}
                        </p>
                      </td>
                    </tr>
                  </table>
${matchSectionHtml}

                  <!-- CTA Button -->
                  <table role="presentation" style="width: 100%; border-collapse: collapse; margin-top: 32px;">
                    <tr>
                      <td style="text-align: center;">
                        <a href="${trophiesUrl}" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #f5b800 0%, #ff9900 100%); color: #000; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 8px;">
                          ${t('badgeUnlocked.viewTrophies')}
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding: 24px 40px; background-color: #0f172a; border-top: 1px solid #1e293b; text-align: center;">
                  <p style="margin: 0 0 8px; color: #64748b; font-size: 12px;">
                    ${t('common.footerRights', { year: new Date().getFullYear() })}
                  </p>
                  <p style="margin: 0; color: #475569; font-size: 11px;">
                    <a href="${baseUrl}/profile" style="color: #475569; text-decoration: underline;">
                      ${t('common.manageNotifications')}
                    </a>
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `

  const text = `${t('badgeUnlocked.title')} 🏅

${t('common.hi')} ${username} !

${t('badgeUnlocked.textCongratsPre')} "${trophyName}" ${t('badgeUnlocked.textUnlocked')} ${trophyDescription}
${matchSectionText}
${t('badgeUnlocked.textViewTrophies')} : ${trophiesUrl}

---
${t('common.footerShort', { year: new Date().getFullYear() })}`

  return {
    html,
    text,
    subject: `🏅 ${t('badgeUnlocked.subjectPre')} ${trophyName} !`
  }
}

// Template: Email de finalisation d'inscription (pour users OAuth avec pseudo auto-généré)
export function getFinalizeRegistrationTemplate({ username, email, locale }: FinalizeRegistrationEmailProps) {
  const t = emailT(locale)
  const loc = locale === 'en' ? 'en' : 'fr'
  const html = `
<!DOCTYPE html>
<html lang="${loc}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t('finalizeRegistration.pageTitle')}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #1a1a2e; border-radius: 16px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #ff9900 0%, #ff6600 100%);">
              <table role="presentation" align="center" style="margin-bottom: 16px;"><tr><td style="width: 90px; height: 90px; background-color: #1e293b; border-radius: 50%; text-align: center; vertical-align: middle;">
                <img src="https://www.pronohub.club/images/logo-email.png" alt="PronoHub" style="width: 60px; height: 60px; display: inline-block;">
              </td></tr></table>
              <h1 style="margin: 0; color: #000; font-size: 26px; font-weight: 700;">${t('finalizeRegistration.title')}</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                ${t('common.hi')} <strong style="color: #ff9900;">${username}</strong> ! 👋
              </p>
              <p style="margin: 0 0 20px; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                ${t('finalizeRegistration.line1pre')} <strong style="color: #ffffff;">${t('finalizeRegistration.customUsername')}</strong>.
              </p>
              <p style="margin: 0 0 20px; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                ${t('finalizeRegistration.line2pre')} <strong style="color: #94a3b8;">"${username}"</strong> ${t('finalizeRegistration.line2post')}
              </p>

              <div style="background-color: #0f172a; border-radius: 12px; padding: 24px; margin: 24px 0;">
                <h3 style="margin: 0 0 16px; color: #ff9900; font-size: 18px;">⚡ ${t('finalizeRegistration.quickTitle')}</h3>
                <ul style="margin: 0; padding-left: 20px; color: #94a3b8; font-size: 14px; line-height: 1.8;">
                  <li>${t('finalizeRegistration.step1')}</li>
                  <li>${t('finalizeRegistration.step2')}</li>
                  <li>${t('finalizeRegistration.step3')}</li>
                </ul>
              </div>

              <div style="text-align: center; margin: 32px 0;">
                <a href="https://www.pronohub.club/auth/login" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #ff9900 0%, #ff6600 100%); color: #000; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 8px;">
                  ${t('finalizeRegistration.cta')}
                </a>
              </div>

              <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.6;">
                ${t('finalizeRegistration.afterLogin')}
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #0f172a; border-top: 1px solid #1e293b;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="color: #64748b; font-size: 12px;">
                    ${t('common.footerRights', { year: new Date().getFullYear() })}
                  </td>
                  <td style="text-align: right;">
                    <a href="https://www.pronohub.club/privacy" style="color: #64748b; font-size: 12px; text-decoration: none; margin-left: 16px;">${t('common.footerPrivacy')}</a>
                    <a href="https://www.pronohub.club/cgv" style="color: #64748b; font-size: 12px; text-decoration: none; margin-left: 16px;">${t('common.footerCgu')}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()

  const text = `
${t('finalizeRegistration.title')}

${t('common.hi')} ${username} !

${t('finalizeRegistration.line1pre')} ${t('finalizeRegistration.customUsername')}.

${t('finalizeRegistration.line2pre')} "${username}" ${t('finalizeRegistration.line2post')}

${t('finalizeRegistration.quickTitle')} :
- ${t('finalizeRegistration.step1')}
- ${t('finalizeRegistration.step2')}
- ${t('finalizeRegistration.step3')}

${t('finalizeRegistration.cta')} : https://www.pronohub.club/auth/login

${t('finalizeRegistration.afterLogin')}

${t('common.footerRights', { year: new Date().getFullYear() })}
  `.trim()

  return { html, text, subject: t('finalizeRegistration.subject') }
}
