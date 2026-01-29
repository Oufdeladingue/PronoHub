// Templates d'emails pour PronoHub

export interface EmailTemplateProps {
  username?: string
  tournamentName?: string
  inviteCode?: string
  matchDate?: string
  competitionName?: string
  actionUrl?: string
}

// Interface pour le rappel de pronostic détaillé
export interface ReminderEmailProps {
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
  username: string
  tournamentName: string
  tournamentSlug: string
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
  firstMatchDate: string // Format: "Samedi 30 novembre à 21h00"
  firstMatchDeadline: string // Format: "20h30" (30min avant le match)
  rules: {
    exactScore: number
    correctResult: number
    correctGoalDiff: number
    bonusEnabled: boolean
    bonusPoints?: number
    defaultPredictionMaxPoints: number
  }
  userActiveTournaments: number
}

// Interface pour le récap de journée
export interface MatchdayRecapEmailProps {
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
}

// Interface pour le récap fin de tournoi
export interface TournamentEndEmailProps {
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
  newCaptainUsername: string
  oldCaptainUsername: string
  tournamentName: string
  tournamentSlug: string
  competitionName: string
  tournamentStatus: string // 'pending' | 'warmup' | 'active'
}

// Interface pour rappel multi-tournois (plusieurs tournois dans un seul email)
export interface MultiTournamentReminderEmailProps {
  username: string
  tournaments: Array<{
    name: string
    slug: string
    competitionName: string
    matches: Array<{
      homeTeam: string
      awayTeam: string
      matchDate: string
      deadlineTime: string
    }>
  }>
  defaultPredictionMaxPoints: number
  earliestDeadline: string // Format: "20h00"
}

// Template: Email de bienvenue après inscription
export function getWelcomeEmailTemplate({ username }: EmailTemplateProps) {
  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bienvenue sur PronoHub</title>
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
                <img src="https://www.pronohub.club/images/logo.png" alt="PronoHub" style="width: 60px; height: 60px; display: inline-block;">
              </td></tr></table>
              <h1 style="margin: 0; color: #000; font-size: 28px; font-weight: 700;">Bienvenue sur PronoHub !</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                Salut${username ? ` <strong style="color: #ff9900;">${username}</strong>` : ''} ! 👋
              </p>
              <p style="margin: 0 0 20px; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                Ton compte PronoHub est maintenant actif. Tu peux désormais créer des tournois de pronostics et défier tes amis !
              </p>

              <div style="background-color: #0f172a; border-radius: 12px; padding: 24px; margin: 24px 0;">
                <h3 style="margin: 0 0 16px; color: #ff9900; font-size: 18px;">🎯 Par où commencer ?</h3>
                <ul style="margin: 0; padding-left: 20px; color: #94a3b8; font-size: 14px; line-height: 1.8;">
                  <li>Crée ton premier tournoi en 2 clics</li>
                  <li>Invite tes amis avec un code unique</li>
                  <li>Pronostique les matchs de tes compétitions préférées</li>
                  <li>Grimpe dans le classement et deviens le champion !</li>
                </ul>
              </div>

              <div style="text-align: center; margin: 32px 0;">
                <a href="https://www.pronohub.club/vestiaire" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #ff9900 0%, #ff6600 100%); color: #000; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 8px;">
                  Créer mon premier tournoi
                </a>
              </div>

              <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.6;">
                Si tu as des questions, n'hésite pas à nous contacter via la page Contact.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #0f172a; border-top: 1px solid #1e293b;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="color: #64748b; font-size: 12px;">
                    © ${new Date().getFullYear()} PronoHub. Tous droits réservés.
                  </td>
                  <td style="text-align: right;">
                    <a href="https://www.pronohub.club/privacy" style="color: #64748b; font-size: 12px; text-decoration: none; margin-left: 16px;">Confidentialité</a>
                    <a href="https://www.pronohub.club/cgv" style="color: #64748b; font-size: 12px; text-decoration: none; margin-left: 16px;">CGU</a>
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
Bienvenue sur PronoHub !

Salut${username ? ` ${username}` : ''} !

Ton compte PronoHub est maintenant actif. Tu peux désormais créer des tournois de pronostics et défier tes amis !

Par où commencer ?
- Crée ton premier tournoi en 2 clics
- Invite tes amis avec un code unique
- Pronostique les matchs de tes compétitions préférées
- Grimpe dans le classement et deviens le champion !

Créer mon premier tournoi : https://www.pronohub.club/vestiaire

Si tu as des questions, n'hésite pas à nous contacter via la page Contact.

© ${new Date().getFullYear()} PronoHub. Tous droits réservés.
  `.trim()

  return { html, text, subject: 'Bienvenue sur PronoHub ! 🎯' }
}

// Template: Invitation à rejoindre un tournoi
export function getTournamentInviteTemplate({
  username,
  tournamentName,
  inviteCode,
  competitionName
}: EmailTemplateProps) {
  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invitation à un tournoi</title>
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
                <img src="https://www.pronohub.club/images/logo.png" alt="PronoHub" style="width: 60px; height: 60px; display: inline-block;">
              </td></tr></table>
              <h1 style="margin: 0; color: #000; font-size: 24px; font-weight: 700;">Tu es invité à rejoindre un tournoi !</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                ${username ? `<strong style="color: #ff9900;">${username}</strong> t'invite` : 'Tu es invité'} à rejoindre le tournoi :
              </p>

              <div style="background-color: #0f172a; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
                <h2 style="margin: 0 0 8px; color: #fff; font-size: 22px;">${tournamentName || 'Tournoi PronoHub'}</h2>
                ${competitionName ? `<p style="margin: 0; color: #ff9900; font-size: 14px;">${competitionName}</p>` : ''}
              </div>

              ${inviteCode ? `
              <div style="background-color: #1e293b; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
                <p style="margin: 0 0 8px; color: #94a3b8; font-size: 14px;">Code d'invitation</p>
                <p style="margin: 0; color: #ff9900; font-size: 32px; font-weight: 700; letter-spacing: 4px;">${inviteCode}</p>
              </div>
              ` : ''}

              <div style="text-align: center; margin: 32px 0;">
                <a href="https://www.pronohub.club/join${inviteCode ? `?code=${inviteCode}` : ''}" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #ff9900 0%, #ff6600 100%); color: #000; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 8px;">
                  Rejoindre le tournoi
                </a>
              </div>

              <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.6; text-align: center;">
                Lance-toi dans la compétition et prouve que tu es le meilleur pronostiqueur !
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #0f172a; border-top: 1px solid #1e293b;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="color: #64748b; font-size: 12px;">
                    © ${new Date().getFullYear()} PronoHub. Tous droits réservés.
                  </td>
                  <td style="text-align: right;">
                    <a href="https://www.pronohub.club/privacy" style="color: #64748b; font-size: 12px; text-decoration: none; margin-left: 16px;">Confidentialité</a>
                    <a href="https://www.pronohub.club/cgv" style="color: #64748b; font-size: 12px; text-decoration: none; margin-left: 16px;">CGU</a>
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
Tu es invité à rejoindre un tournoi !

${username ? `${username} t'invite` : 'Tu es invité'} à rejoindre le tournoi : ${tournamentName || 'Tournoi PronoHub'}
${competitionName ? `Compétition : ${competitionName}` : ''}

${inviteCode ? `Code d'invitation : ${inviteCode}` : ''}

Rejoindre le tournoi : https://www.pronohub.club/join${inviteCode ? `?code=${inviteCode}` : ''}

Lance-toi dans la compétition et prouve que tu es le meilleur pronostiqueur !

© ${new Date().getFullYear()} PronoHub. Tous droits réservés.
  `.trim()

  return {
    html,
    text,
    subject: `${username ? `${username} t'invite` : 'Invitation'} à rejoindre ${tournamentName || 'un tournoi'} sur PronoHub ! ⚽`
  }
}

// Template: Rappel de pronostics avant un match
export function getMatchReminderTemplate({
  username,
  tournamentName,
  matchDate,
  competitionName,
  actionUrl
}: EmailTemplateProps) {
  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rappel : N'oublie pas tes pronostics !</title>
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
                <img src="https://www.pronohub.club/images/logo.png" alt="PronoHub" style="width: 60px; height: 60px; display: inline-block;">
              </td></tr></table>
              <h1 style="margin: 0; color: #000; font-size: 24px; font-weight: 700;">⏰ N'oublie pas tes pronostics !</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                Salut${username ? ` <strong style="color: #ff9900;">${username}</strong>` : ''} ! 👋
              </p>
              <p style="margin: 0 0 20px; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                Des matchs approchent et tu n'as pas encore fait tous tes pronostics !
              </p>

              <div style="background-color: #0f172a; border-radius: 12px; padding: 24px; margin: 24px 0;">
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0;">
                      <span style="color: #94a3b8; font-size: 14px;">Tournoi</span><br>
                      <span style="color: #fff; font-size: 16px; font-weight: 600;">${tournamentName || 'Ton tournoi'}</span>
                    </td>
                  </tr>
                  ${competitionName ? `
                  <tr>
                    <td style="padding: 8px 0;">
                      <span style="color: #94a3b8; font-size: 14px;">Compétition</span><br>
                      <span style="color: #ff9900; font-size: 16px;">${competitionName}</span>
                    </td>
                  </tr>
                  ` : ''}
                  ${matchDate ? `
                  <tr>
                    <td style="padding: 8px 0;">
                      <span style="color: #94a3b8; font-size: 14px;">Prochain match</span><br>
                      <span style="color: #fff; font-size: 16px;">${matchDate}</span>
                    </td>
                  </tr>
                  ` : ''}
                </table>
              </div>

              <div style="text-align: center; margin: 32px 0;">
                <a href="${actionUrl || 'https://www.pronohub.club/vestiaire'}" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #ff9900 0%, #ff6600 100%); color: #000; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 8px;">
                  Faire mes pronostics
                </a>
              </div>

              <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.6; text-align: center;">
                Ne laisse pas passer ta chance de marquer des points !
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #0f172a; border-top: 1px solid #1e293b;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="color: #64748b; font-size: 12px;">
                    © ${new Date().getFullYear()} PronoHub. Tous droits réservés.
                  </td>
                  <td style="text-align: right;">
                    <a href="https://www.pronohub.club/settings" style="color: #64748b; font-size: 12px; text-decoration: none;">Se désabonner</a>
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
N'oublie pas tes pronostics !

Salut${username ? ` ${username}` : ''} !

Des matchs approchent et tu n'as pas encore fait tous tes pronostics !

Tournoi : ${tournamentName || 'Ton tournoi'}
${competitionName ? `Compétition : ${competitionName}` : ''}
${matchDate ? `Prochain match : ${matchDate}` : ''}

Faire mes pronostics : ${actionUrl || 'https://www.pronohub.club/vestiaire'}

Ne laisse pas passer ta chance de marquer des points !

© ${new Date().getFullYear()} PronoHub. Tous droits réservés.
  `.trim()

  return {
    html,
    text,
    subject: `⏰ Rappel : Des matchs approchent dans ${tournamentName || 'ton tournoi'} !`
  }
}

// Template: Notification de résultats
export function getResultsNotificationTemplate({
  username,
  tournamentName,
  competitionName,
  actionUrl
}: EmailTemplateProps) {
  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Résultats disponibles !</title>
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
                <img src="https://www.pronohub.club/images/logo.png" alt="PronoHub" style="width: 60px; height: 60px; display: inline-block;">
              </td></tr></table>
              <h1 style="margin: 0; color: #000; font-size: 24px; font-weight: 700;">🏆 Les résultats sont tombés !</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                Salut${username ? ` <strong style="color: #ff9900;">${username}</strong>` : ''} ! 👋
              </p>
              <p style="margin: 0 0 20px; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                Les matchs sont terminés et les points ont été calculés. Viens découvrir ta progression dans le classement !
              </p>

              <div style="background-color: #0f172a; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
                <h3 style="margin: 0 0 8px; color: #fff; font-size: 20px;">${tournamentName || 'Ton tournoi'}</h3>
                ${competitionName ? `<p style="margin: 0; color: #ff9900; font-size: 14px;">${competitionName}</p>` : ''}
              </div>

              <div style="text-align: center; margin: 32px 0;">
                <a href="${actionUrl || 'https://www.pronohub.club/vestiaire'}" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #ff9900 0%, #ff6600 100%); color: #000; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 8px;">
                  Voir le classement
                </a>
              </div>

              <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.6; text-align: center;">
                As-tu gagné des places ? Découvre-le maintenant !
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #0f172a; border-top: 1px solid #1e293b;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="color: #64748b; font-size: 12px;">
                    © ${new Date().getFullYear()} PronoHub. Tous droits réservés.
                  </td>
                  <td style="text-align: right;">
                    <a href="https://www.pronohub.club/settings" style="color: #64748b; font-size: 12px; text-decoration: none;">Se désabonner</a>
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
Les résultats sont tombés !

Salut${username ? ` ${username}` : ''} !

Les matchs sont terminés et les points ont été calculés. Viens découvrir ta progression dans le classement !

Tournoi : ${tournamentName || 'Ton tournoi'}
${competitionName ? `Compétition : ${competitionName}` : ''}

Voir le classement : ${actionUrl || 'https://www.pronohub.club/vestiaire'}

As-tu gagné des places ? Découvre-le maintenant !

© ${new Date().getFullYear()} PronoHub. Tous droits réservés.
  `.trim()

  return {
    html,
    text,
    subject: `🏆 Résultats disponibles dans ${tournamentName || 'ton tournoi'} !`
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
    defaultPredictionMaxPoints
  } = props

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
          <span style="color: #ef4444; font-size: 13px; margin-left: 12px;">⏰ Limite : ${match.deadlineTime}</span>
        </div>
      </td>
    </tr>
  `).join('')

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rappel : N'oublie pas tes pronostics !</title>
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
                <img src="https://www.pronohub.club/images/logo.png" alt="PronoHub" style="width: 60px; height: 60px; display: inline-block;">
              </td></tr></table>
              <h1 style="margin: 0; color: #000; font-size: 24px; font-weight: 700;">⏰ N'oublie pas tes pronostics !</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                Salut <strong style="color: #ff9900;">${username}</strong> ! 👋
              </p>
              <p style="margin: 0 0 24px; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                Tu n'as pas encore pronostiqué certains matchs à venir. Ne rate pas l'occasion de marquer des points !
              </p>

              <!-- Infos tournoi -->
              <div style="background-color: #0f172a; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 4px 0;">
                      <span style="color: #94a3b8; font-size: 13px;">Tournoi</span><br>
                      <span style="color: #fff; font-size: 16px; font-weight: 600;">${tournamentName}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 0;">
                      <span style="color: #94a3b8; font-size: 13px;">Compétition</span><br>
                      <span style="color: #ff9900; font-size: 15px;">${competitionName}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 0;">
                      <span style="color: #94a3b8; font-size: 13px;">Journée</span><br>
                      <span style="color: #fff; font-size: 15px;">${matchdayName}</span>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Liste des matchs -->
              <div style="background-color: #0f172a; border-radius: 12px; overflow: hidden; margin-bottom: 24px;">
                <div style="padding: 16px; border-bottom: 1px solid #1e293b;">
                  <h3 style="margin: 0; color: #ff9900; font-size: 16px;">🎯 Matchs à pronostiquer</h3>
                </div>
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  ${matchesHtml}
                </table>
              </div>

              <!-- Alerte prono par défaut -->
              <div style="background-color: #7f1d1d; border-radius: 12px; padding: 16px; margin-bottom: 24px; border-left: 4px solid #ef4444;">
                <p style="margin: 0; color: #fecaca; font-size: 14px; line-height: 1.5;">
                  <strong>⚠️ Attention :</strong> Si tu ne pronostiques pas avant la limite, un pronostic par défaut sera appliqué.
                  Dans ce cas, tu ne pourras gagner que <strong>${defaultPredictionMaxPoints} point${defaultPredictionMaxPoints > 1 ? 's' : ''} maximum</strong> par match, même en cas de score exact !
                </p>
              </div>

              <div style="text-align: center; margin: 32px 0;">
                <a href="${actionUrl}" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #ff9900 0%, #ff6600 100%); color: #000; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 8px;">
                  Faire mes pronostics maintenant
                </a>
              </div>

              <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.6; text-align: center;">
                Les pronostics doivent être faits <strong>1 heure avant</strong> le début de chaque match.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #0f172a; border-top: 1px solid #1e293b;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="color: #64748b; font-size: 12px;">
                    © ${new Date().getFullYear()} PronoHub. Tous droits réservés.
                  </td>
                  <td style="text-align: right;">
                    <a href="https://www.pronohub.club/profile" style="color: #64748b; font-size: 12px; text-decoration: none;">Gérer mes notifications</a>
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
    `  • ${match.homeTeam} - ${match.awayTeam}\n    📅 ${match.matchDate} | ⏰ Limite : ${match.deadlineTime}`
  ).join('\n')

  const text = `
⏰ N'oublie pas tes pronostics !

Salut ${username} !

Tu n'as pas encore pronostiqué certains matchs à venir. Ne rate pas l'occasion de marquer des points !

📋 TOURNOI : ${tournamentName}
🏆 Compétition : ${competitionName}
📅 Journée : ${matchdayName}

🎯 MATCHS À PRONOSTIQUER :
${matchesText}

⚠️ ATTENTION : Si tu ne pronostiques pas avant la limite, un pronostic par défaut sera appliqué. Tu ne pourras gagner que ${defaultPredictionMaxPoints} point${defaultPredictionMaxPoints > 1 ? 's' : ''} maximum par match !

👉 Faire mes pronostics : ${actionUrl}

Les pronostics doivent être faits 1 heure avant le début de chaque match.

---
© ${new Date().getFullYear()} PronoHub. Tous droits réservés.
Gérer mes notifications : https://www.pronohub.club/profile
  `.trim()

  return {
    html,
    text,
    subject: `⏰ ${matches.length} match${matches.length > 1 ? 's' : ''} à pronostiquer dans ${tournamentName} !`
  }
}

// Template: Lancement de tournoi
export function getTournamentStartedTemplate(props: TournamentStartedEmailProps) {
  const {
    username,
    tournamentName,
    tournamentSlug,
    competitionName,
    participants,
    matchdayRange,
    firstMatchDate,
    firstMatchDeadline,
    rules,
    userActiveTournaments
  } = props

  const baseUrl = 'https://www.pronohub.club'
  const tournamentUrl = `${baseUrl}/vestiaire/${tournamentSlug}`

  // Liste des participants avec (cap.)
  const participantsHtml = participants.map(p =>
    `<span style="display: inline-block; background-color: #1e293b; padding: 4px 10px; border-radius: 16px; margin: 4px; font-size: 13px; color: #e0e0e0;">${p.username}${p.isCaptain ? ' <span style="color: #ff9900;">(cap.)</span>' : ''}</span>`
  ).join('')

  // Règles du tournoi
  const rulesHtml = `
    <tr><td style="padding: 6px 0; color: #94a3b8; font-size: 13px;">Score exact</td><td style="padding: 6px 0; color: #22c55e; font-size: 13px; text-align: right; font-weight: 600;">+${rules.exactScore} pts</td></tr>
    <tr><td style="padding: 6px 0; color: #94a3b8; font-size: 13px;">Bon résultat (1N2)</td><td style="padding: 6px 0; color: #3b82f6; font-size: 13px; text-align: right; font-weight: 600;">+${rules.correctResult} pts</td></tr>
    <tr><td style="padding: 6px 0; color: #94a3b8; font-size: 13px;">Bonne différence de buts</td><td style="padding: 6px 0; color: #8b5cf6; font-size: 13px; text-align: right; font-weight: 600;">+${rules.correctGoalDiff} pts</td></tr>
    <tr><td style="padding: 6px 0; color: #94a3b8; font-size: 13px;">Prono par défaut (max)</td><td style="padding: 6px 0; color: #ef4444; font-size: 13px; text-align: right; font-weight: 600;">${rules.defaultPredictionMaxPoints} pts max</td></tr>
  `

  // Bonus HTML (explication détaillée)
  const bonusHtml = rules.bonusEnabled ? `
    <div style="background-color: #0f172a; border-radius: 12px; padding: 20px; margin-bottom: 24px; border-left: 4px solid #ff9900;">
      <h3 style="margin: 0 0 12px; color: #ff9900; font-size: 16px;">🎰 Bonus "Double ou Quitté"</h3>
      <p style="margin: 0 0 8px; color: #e0e0e0; font-size: 13px; line-height: 1.5;">
        Ce tournoi a le <strong style="color: #ff9900;">bonus activé</strong> ! Sur chaque journée, tu peux miser sur UN match de ton choix :
      </p>
      <ul style="margin: 8px 0; padding-left: 20px; color: #94a3b8; font-size: 13px; line-height: 1.8;">
        <li>✅ Si ton prono est <strong style="color: #22c55e;">correct</strong> : tu gagnes <strong style="color: #ff9900;">+${rules.bonusPoints || 0} points bonus</strong></li>
        <li>❌ Si ton prono est <strong style="color: #ef4444;">faux</strong> : tu perds <strong style="color: #ef4444;">${rules.bonusPoints || 0} points</strong></li>
      </ul>
      <p style="margin: 0; color: #64748b; font-size: 12px;">
        💡 Stratégie : choisis un match dont tu es sûr du résultat !
      </p>
    </div>
  ` : ''

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Le tournoi ${tournamentName} est lancé !</title>
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
                <img src="https://www.pronohub.club/images/logo.png" alt="PronoHub" style="width: 60px; height: 60px; display: inline-block;">
              </td></tr></table>
              <h1 style="margin: 0; color: #000; font-size: 24px; font-weight: 700;">🚀 C'est parti !</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                Salut <strong style="color: #ff9900;">${username}</strong> ! 👋
              </p>
              <p style="margin: 0 0 24px; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                Le tournoi <strong style="color: #22c55e;">${tournamentName}</strong> vient d'être lancé ! Prépare-toi à devenir le roi du prono ! 👑
              </p>

              <!-- Infos tournoi -->
              <div style="background-color: #0f172a; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <h3 style="margin: 0 0 16px; color: #ff9900; font-size: 16px;">📋 Infos du tournoi</h3>
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 6px 0; color: #94a3b8; font-size: 13px;">Compétition</td>
                    <td style="padding: 6px 0; color: #ff9900; font-size: 13px; text-align: right; font-weight: 600;">${competitionName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #94a3b8; font-size: 13px;">Journées</td>
                    <td style="padding: 6px 0; color: #fff; font-size: 13px; text-align: right;">J${matchdayRange.start} → J${matchdayRange.end}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #94a3b8; font-size: 13px;">Matchs à pronostiquer</td>
                    <td style="padding: 6px 0; color: #fff; font-size: 13px; text-align: right; font-weight: 600;">${matchdayRange.totalMatches} matchs</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #94a3b8; font-size: 13px;">Premier match</td>
                    <td style="padding: 6px 0; color: #22c55e; font-size: 13px; text-align: right;">${firstMatchDate}</td>
                  </tr>
                </table>
              </div>

              <!-- Participants -->
              <div style="background-color: #0f172a; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <h3 style="margin: 0 0 12px; color: #ff9900; font-size: 16px;">👥 Participants (${participants.length})</h3>
                <div style="line-height: 2;">
                  ${participantsHtml}
                </div>
              </div>

              <!-- Règles -->
              <div style="background-color: #0f172a; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <h3 style="margin: 0 0 12px; color: #ff9900; font-size: 16px;">📜 Règles de points</h3>
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  ${rulesHtml}
                </table>
              </div>

              <!-- Bonus (si activé) -->
              ${bonusHtml}

              <!-- Important : deadline -->
              <div style="background-color: #1e3a5f; border-radius: 12px; padding: 20px; margin-bottom: 24px; border-left: 4px solid #3b82f6;">
                <h3 style="margin: 0 0 12px; color: #3b82f6; font-size: 16px;">⏰ Important</h3>
                <p style="margin: 0 0 8px; color: #e0e0e0; font-size: 13px; line-height: 1.5;">
                  Les pronostics doivent être validés <strong style="color: #ff9900;">30 minutes avant le coup d'envoi</strong> de chaque match.
                </p>
                <p style="margin: 0; color: #94a3b8; font-size: 13px;">
                  📅 Premier match : <strong style="color: #22c55e;">${firstMatchDate}</strong><br>
                  ⏱️ Limite pour pronostiquer : <strong style="color: #ff9900;">${firstMatchDeadline || 'Voir app'}</strong>
                </p>
              </div>

              <!-- Alertes -->
              <div style="background-color: #0f172a; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <h3 style="margin: 0 0 12px; color: #ff9900; font-size: 16px;">🔔 Ne rate aucun match !</h3>
                <p style="margin: 0 0 12px; color: #e0e0e0; font-size: 13px; line-height: 1.5;">
                  Configure tes alertes pour recevoir des rappels avant chaque journée :
                </p>
                <ul style="margin: 0; padding-left: 20px; color: #94a3b8; font-size: 13px; line-height: 1.8;">
                  <li>📧 <strong>Emails</strong> : rappels de pronostics, récaps de journée</li>
                  <li>📱 <strong>Notifications push</strong> : alertes instantanées sur ton mobile</li>
                </ul>
                <p style="margin: 12px 0 0; color: #64748b; font-size: 12px;">
                  👉 <a href="https://www.pronohub.club/profile" style="color: #ff9900; text-decoration: none;">Gérer mes alertes dans mon profil</a>
                </p>
              </div>

              <!-- Boutons d'action -->
              <div style="text-align: center; margin: 32px 0;">
                <a href="${tournamentUrl}/opposition" style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #ff9900 0%, #ff6600 100%); color: #000; text-decoration: none; font-weight: 600; font-size: 15px; border-radius: 8px; margin: 6px;">
                  🎯 Pronostiquer
                </a>
                <a href="${tournamentUrl}/classement" style="display: inline-block; padding: 14px 28px; background-color: #1e293b; color: #fff; text-decoration: none; font-weight: 600; font-size: 15px; border-radius: 8px; margin: 6px;">
                  🏆 Classement
                </a>
              </div>

              <!-- Liens rapides -->
              <div style="background-color: #0f172a; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0;"><a href="${tournamentUrl}/tchat" style="color: #94a3b8; text-decoration: none; font-size: 13px;">💬 Tchat du tournoi</a></td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;"><a href="${baseUrl}/profile" style="color: #94a3b8; text-decoration: none; font-size: 13px;">⚙️ Gérer mes alertes</a></td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;"><a href="${baseUrl}/premium" style="color: #ff9900; text-decoration: none; font-size: 13px;">⭐ Passer Premium</a></td>
                  </tr>
                </table>
              </div>

              <p style="margin: 0; color: #64748b; font-size: 13px; line-height: 1.6; text-align: center;">
                Tu participes actuellement à <strong>${userActiveTournaments}</strong> tournoi${userActiveTournaments > 1 ? 's' : ''} actif${userActiveTournaments > 1 ? 's' : ''}.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #0f172a; border-top: 1px solid #1e293b;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="color: #64748b; font-size: 12px;">
                    © ${new Date().getFullYear()} PronoHub. Tous droits réservés.
                  </td>
                  <td style="text-align: right;">
                    <a href="${baseUrl}/profile" style="color: #64748b; font-size: 12px; text-decoration: none;">Gérer mes notifications</a>
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

  const participantsText = participants.map(p => `  • ${p.username}${p.isCaptain ? ' (cap.)' : ''}`).join('\n')

  const bonusText = rules.bonusEnabled ? `
🎰 BONUS "DOUBLE OU QUITTÉ"
Ce tournoi a le bonus activé ! Sur chaque journée, tu peux miser sur UN match :
- ✅ Prono correct : +${rules.bonusPoints || 0} points bonus
- ❌ Prono faux : -${rules.bonusPoints || 0} points
Stratégie : choisis un match dont tu es sûr du résultat !
` : ''

  const text = `
🚀 C'est parti ! Le tournoi ${tournamentName} est lancé !

Salut ${username} !

Prépare-toi à devenir le roi du prono ! 👑

📋 INFOS DU TOURNOI
- Compétition : ${competitionName}
- Journées : J${matchdayRange.start} → J${matchdayRange.end}
- Matchs à pronostiquer : ${matchdayRange.totalMatches} matchs
- Premier match : ${firstMatchDate}

👥 PARTICIPANTS (${participants.length})
${participantsText}

📜 RÈGLES DE POINTS
- Score exact : +${rules.exactScore} pts
- Bon résultat (1N2) : +${rules.correctResult} pts
- Bonne différence de buts : +${rules.correctGoalDiff} pts
- Prono par défaut : ${rules.defaultPredictionMaxPoints} pts max
${bonusText}
⏰ IMPORTANT
Les pronostics doivent être validés 30 MINUTES AVANT le coup d'envoi de chaque match.
- Premier match : ${firstMatchDate}
- Limite pour pronostiquer : ${firstMatchDeadline || 'Voir app'}

🔔 NE RATE AUCUN MATCH !
Configure tes alertes pour recevoir des rappels :
- 📧 Emails : rappels de pronostics, récaps de journée
- 📱 Notifications push : alertes instantanées sur ton mobile
👉 Gérer mes alertes : ${baseUrl}/profile

🎯 Pronostiquer : ${tournamentUrl}/opposition
🏆 Classement : ${tournamentUrl}/classement
💬 Tchat : ${tournamentUrl}/tchat
⭐ Passer Premium : ${baseUrl}/premium

Tu participes à ${userActiveTournaments} tournoi${userActiveTournaments > 1 ? 's' : ''} actif${userActiveTournaments > 1 ? 's' : ''}.

---
© ${new Date().getFullYear()} PronoHub. Tous droits réservés.
  `.trim()

  return {
    html,
    text,
    subject: `🚀 ${tournamentName} est lancé ! À toi de jouer !`
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
    newTrophies
  } = props

  const baseUrl = 'https://www.pronohub.club'
  const tournamentUrl = `${baseUrl}/vestiaire/${tournamentSlug}`

  // Classement de la journée HTML
  const matchdayRankingHtml = matchdayRanking.slice(0, 10).map(p => `
    <tr style="${p.isCurrentUser ? 'background-color: #1e3a5f;' : ''}">
      <td style="padding: 8px 12px; color: ${p.rank <= 3 ? '#ff9900' : '#94a3b8'}; font-size: 13px; font-weight: ${p.rank <= 3 ? '600' : '400'};">${p.rank}</td>
      <td style="padding: 8px 12px; color: ${p.isCurrentUser ? '#ff9900' : '#fff'}; font-size: 13px; font-weight: ${p.isCurrentUser ? '600' : '400'};">${p.username}${p.isCurrentUser ? ' (toi)' : ''}</td>
      <td style="padding: 8px 12px; color: #22c55e; font-size: 13px; text-align: right; font-weight: 600;">+${p.points}</td>
    </tr>
  `).join('')

  // Classement général HTML
  const generalRankingHtml = generalRanking.slice(0, 10).map(p => `
    <tr style="${p.isCurrentUser ? 'background-color: #1e3a5f;' : ''}">
      <td style="padding: 8px 12px; color: ${p.rank <= 3 ? '#ff9900' : '#94a3b8'}; font-size: 13px; font-weight: ${p.rank <= 3 ? '600' : '400'};">${p.rank}</td>
      <td style="padding: 8px 12px; color: ${p.isCurrentUser ? '#ff9900' : '#fff'}; font-size: 13px; font-weight: ${p.isCurrentUser ? '600' : '400'};">${p.username}${p.isCurrentUser ? ' (toi)' : ''}</td>
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
      <h3 style="margin: 0 0 12px; color: #fbbf24; font-size: 16px;">🏆 Nouveau${newTrophies.length > 1 ? 'x' : ''} trophée${newTrophies.length > 1 ? 's' : ''} débloqué${newTrophies.length > 1 ? 's' : ''} !</h3>
      ${newTrophies.map(t => `
        <div style="margin-bottom: 8px;">
          <span style="color: #fbbf24; font-size: 14px; font-weight: 600;">${t.name}</span><br>
          <span style="color: #fcd34d; font-size: 12px;">${t.description}</span>
        </div>
      `).join('')}
    </div>
  ` : ''

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Journée ${matchdayNumber} terminée - ${tournamentName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #1a1a2e; border-radius: 16px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);">
              <table role="presentation" align="center" style="margin-bottom: 16px;"><tr><td style="width: 90px; height: 90px; background-color: #1e293b; border-radius: 50%; text-align: center; vertical-align: middle;">
                <img src="https://www.pronohub.club/images/logo.png" alt="PronoHub" style="width: 60px; height: 60px; display: inline-block;">
              </td></tr></table>
              <h1 style="margin: 0; color: #fff; font-size: 22px; font-weight: 700;">📊 Journée ${matchdayNumber} terminée !</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                Salut <strong style="color: #ff9900;">${username}</strong> ! 👋
              </p>
              <p style="margin: 0 0 24px; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                La journée ${matchdayNumber} de <strong>${tournamentName}</strong> est terminée. Voici ton récap !
              </p>

              <!-- Points gagnés -->
              <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-radius: 12px; padding: 24px; margin-bottom: 24px; text-align: center;">
                <p style="margin: 0 0 8px; color: #94a3b8; font-size: 14px;">Tu as gagné</p>
                <p style="margin: 0; color: #22c55e; font-size: 48px; font-weight: 700;">+${userPointsGained}</p>
                <p style="margin: 4px 0 0; color: #94a3b8; font-size: 14px;">points sur cette journée</p>
              </div>

              ${trophiesHtml}

              <!-- Stats de la journée -->
              <div style="background-color: #0f172a; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <h3 style="margin: 0 0 16px; color: #ff9900; font-size: 16px;">📈 Tes stats sur la journée</h3>
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 6px 0; color: #94a3b8; font-size: 13px;">Scores exacts</td>
                    <td style="padding: 6px 0; color: #22c55e; font-size: 13px; text-align: right; font-weight: 600;">${userStats.exactScores}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #94a3b8; font-size: 13px;">Bons résultats</td>
                    <td style="padding: 6px 0; color: #3b82f6; font-size: 13px; text-align: right; font-weight: 600;">${userStats.correctResults}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #94a3b8; font-size: 13px;">Classement journée</td>
                    <td style="padding: 6px 0; color: #fff; font-size: 13px; text-align: right; font-weight: 600;">${userStats.matchdayRank}${userStats.matchdayRank === 1 ? 'er' : 'ème'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #94a3b8; font-size: 13px;">Classement général</td>
                    <td style="padding: 6px 0; color: #fff; font-size: 13px; text-align: right;">
                      <span style="font-weight: 600;">${userStats.generalRank}${userStats.generalRank === 1 ? 'er' : 'ème'}</span>
                      <span style="color: ${rankChangeColor}; margin-left: 8px;">${rankChangeIcon} ${rankChangeText}</span>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Classement de la journée -->
              <div style="background-color: #0f172a; border-radius: 12px; overflow: hidden; margin-bottom: 24px;">
                <div style="padding: 16px; border-bottom: 1px solid #1e293b;">
                  <h3 style="margin: 0; color: #3b82f6; font-size: 16px;">🏅 Classement de la journée</h3>
                </div>
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  ${matchdayRankingHtml}
                </table>
              </div>

              <!-- Classement général -->
              <div style="background-color: #0f172a; border-radius: 12px; overflow: hidden; margin-bottom: 24px;">
                <div style="padding: 16px; border-bottom: 1px solid #1e293b;">
                  <h3 style="margin: 0; color: #ff9900; font-size: 16px;">🏆 Classement général</h3>
                </div>
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  ${generalRankingHtml}
                </table>
              </div>

              <!-- Boutons d'action -->
              <div style="text-align: center; margin: 32px 0;">
                <a href="${tournamentUrl}/classement" style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #ff9900 0%, #ff6600 100%); color: #000; text-decoration: none; font-weight: 600; font-size: 15px; border-radius: 8px;">
                  Voir le classement complet
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
                    © ${new Date().getFullYear()} PronoHub. Tous droits réservés.
                  </td>
                  <td style="text-align: right;">
                    <a href="${baseUrl}/profile" style="color: #64748b; font-size: 12px; text-decoration: none;">Gérer mes notifications</a>
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

  const matchdayRankingText = matchdayRanking.slice(0, 10).map(p => `  ${p.rank}. ${p.username}${p.isCurrentUser ? ' (toi)' : ''} - +${p.points} pts`).join('\n')
  const generalRankingText = generalRanking.slice(0, 10).map(p => `  ${p.rank}. ${p.username}${p.isCurrentUser ? ' (toi)' : ''} - ${p.totalPoints} pts`).join('\n')
  const trophiesText = newTrophies && newTrophies.length > 0 ? `\n🏆 NOUVEAU${newTrophies.length > 1 ? 'X' : ''} TROPHÉE${newTrophies.length > 1 ? 'S' : ''} !\n${newTrophies.map(t => `  • ${t.name} : ${t.description}`).join('\n')}\n` : ''

  const text = `
📊 Journée ${matchdayNumber} terminée - ${tournamentName}

Salut ${username} !

La journée ${matchdayNumber} de ${tournamentName} est terminée.

💰 TU AS GAGNÉ : +${userPointsGained} points
${trophiesText}
📈 TES STATS
- Scores exacts : ${userStats.exactScores}
- Bons résultats : ${userStats.correctResults}
- Classement journée : ${userStats.matchdayRank}${userStats.matchdayRank === 1 ? 'er' : 'ème'}
- Classement général : ${userStats.generalRank}${userStats.generalRank === 1 ? 'er' : 'ème'} (${rankChangeText})

🏅 CLASSEMENT DE LA JOURNÉE
${matchdayRankingText}

🏆 CLASSEMENT GÉNÉRAL
${generalRankingText}

👉 Voir le classement complet : ${tournamentUrl}/classement

---
© ${new Date().getFullYear()} PronoHub. Tous droits réservés.
  `.trim()

  return {
    html,
    text,
    subject: `📊 J${matchdayNumber} terminée : +${userPointsGained} pts dans ${tournamentName}`
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
    newTrophies
  } = props

  const baseUrl = 'https://www.pronohub.club'
  const tournamentUrl = `${baseUrl}/vestiaire/${tournamentSlug}`

  const isWinner = winner.username === username
  const headerGradient = isWinner ? 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)' : 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)'
  const headerTitle = isWinner ? '👑 Tu as gagné !' : '🏁 Tournoi terminé !'

  // Classement final HTML
  const finalRankingHtml = finalRanking.map(p => `
    <tr style="${p.isCurrentUser ? 'background-color: #1e3a5f;' : ''}">
      <td style="padding: 10px 12px; color: ${p.rank === 1 ? '#fbbf24' : p.rank <= 3 ? '#ff9900' : '#94a3b8'}; font-size: 14px; font-weight: ${p.rank <= 3 ? '700' : '400'};">
        ${p.rank === 1 ? '👑' : p.rank === 2 ? '🥈' : p.rank === 3 ? '🥉' : p.rank}
      </td>
      <td style="padding: 10px 12px; color: ${p.isCurrentUser ? '#ff9900' : '#fff'}; font-size: 14px; font-weight: ${p.isCurrentUser ? '600' : '400'};">${p.username}${p.isCurrentUser ? ' (toi)' : ''}</td>
      <td style="padding: 10px 12px; color: #22c55e; font-size: 14px; text-align: right; font-weight: 600;">${p.totalPoints} pts</td>
    </tr>
  `).join('')

  // Trophées HTML
  const trophiesHtml = newTrophies && newTrophies.length > 0 ? `
    <div style="background-color: #422006; border-radius: 12px; padding: 20px; margin-bottom: 24px; border-left: 4px solid #f59e0b;">
      <h3 style="margin: 0 0 12px; color: #fbbf24; font-size: 16px;">🏆 Nouveau${newTrophies.length > 1 ? 'x' : ''} trophée${newTrophies.length > 1 ? 's' : ''} débloqué${newTrophies.length > 1 ? 's' : ''} !</h3>
      ${newTrophies.map(t => `
        <div style="margin-bottom: 8px;">
          <span style="color: #fbbf24; font-size: 14px; font-weight: 600;">${t.name}</span><br>
          <span style="color: #fcd34d; font-size: 12px;">${t.description}</span>
        </div>
      `).join('')}
    </div>
  ` : ''

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${tournamentName} - Tournoi terminé !</title>
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
                <img src="https://www.pronohub.club/images/logo.png" alt="PronoHub" style="width: 60px; height: 60px; display: inline-block;">
              </td></tr></table>
              <h1 style="margin: 0; color: ${isWinner ? '#000' : '#fff'}; font-size: 24px; font-weight: 700;">${headerTitle}</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                ${isWinner ? 'Félicitations' : 'Salut'} <strong style="color: #ff9900;">${username}</strong> ! ${isWinner ? '🎉' : '👋'}
              </p>
              <p style="margin: 0 0 24px; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                Le tournoi <strong>${tournamentName}</strong> est terminé !
                ${isWinner ? 'Tu es le champion incontesté ! 👑' : `Le vainqueur est <strong style="color: #fbbf24;">${winner.username}</strong> avec ${winner.totalPoints} points.`}
              </p>

              <!-- Classement final -->
              <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-radius: 12px; padding: 24px; margin-bottom: 24px; text-align: center;">
                <p style="margin: 0 0 8px; color: #94a3b8; font-size: 14px;">Ta place finale</p>
                <p style="margin: 0; color: ${userFinalStats.finalRank === 1 ? '#fbbf24' : userFinalStats.finalRank <= 3 ? '#ff9900' : '#fff'}; font-size: 56px; font-weight: 700;">
                  ${userFinalStats.finalRank === 1 ? '👑' : userFinalStats.finalRank}${userFinalStats.finalRank > 1 ? (userFinalStats.finalRank === 2 ? 'ème' : 'ème') : ''}
                </p>
                <p style="margin: 4px 0 0; color: #22c55e; font-size: 18px; font-weight: 600;">${userFinalStats.totalPoints} points</p>
              </div>

              ${trophiesHtml}

              <!-- Stats finales -->
              <div style="background-color: #0f172a; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <h3 style="margin: 0 0 16px; color: #ff9900; font-size: 16px;">📊 Tes stats sur le tournoi</h3>
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 6px 0; color: #94a3b8; font-size: 13px;">Total points</td>
                    <td style="padding: 6px 0; color: #22c55e; font-size: 13px; text-align: right; font-weight: 600;">${userFinalStats.totalPoints} pts</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #94a3b8; font-size: 13px;">Scores exacts</td>
                    <td style="padding: 6px 0; color: #22c55e; font-size: 13px; text-align: right; font-weight: 600;">${userFinalStats.exactScores}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #94a3b8; font-size: 13px;">Bons résultats</td>
                    <td style="padding: 6px 0; color: #3b82f6; font-size: 13px; text-align: right; font-weight: 600;">${userFinalStats.correctResults}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #94a3b8; font-size: 13px;">Journées parfaites</td>
                    <td style="padding: 6px 0; color: #fbbf24; font-size: 13px; text-align: right; font-weight: 600;">${userFinalStats.perfectMatchdays}</td>
                  </tr>
                </table>
              </div>

              <!-- Classement complet -->
              <div style="background-color: #0f172a; border-radius: 12px; overflow: hidden; margin-bottom: 24px;">
                <div style="padding: 16px; border-bottom: 1px solid #1e293b;">
                  <h3 style="margin: 0; color: #fbbf24; font-size: 16px;">🏆 Classement final</h3>
                </div>
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  ${finalRankingHtml}
                </table>
              </div>

              <!-- Boutons d'action -->
              <div style="text-align: center; margin: 32px 0;">
                <a href="${tournamentUrl}/classement" style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #ff9900 0%, #ff6600 100%); color: #000; text-decoration: none; font-weight: 600; font-size: 15px; border-radius: 8px; margin: 6px;">
                  Voir les détails
                </a>
                <a href="${baseUrl}/vestiaire/create" style="display: inline-block; padding: 14px 28px; background-color: #22c55e; color: #000; text-decoration: none; font-weight: 600; font-size: 15px; border-radius: 8px; margin: 6px;">
                  Créer un tournoi
                </a>
              </div>

              <p style="margin: 0; color: #64748b; font-size: 13px; line-height: 1.6; text-align: center;">
                Merci d'avoir participé ! À bientôt pour de nouvelles compétitions ! 🎯
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #0f172a; border-top: 1px solid #1e293b;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="color: #64748b; font-size: 12px;">
                    © ${new Date().getFullYear()} PronoHub. Tous droits réservés.
                  </td>
                  <td style="text-align: right;">
                    <a href="${baseUrl}/profile" style="color: #64748b; font-size: 12px; text-decoration: none;">Gérer mes notifications</a>
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

  const finalRankingText = finalRanking.map(p => `  ${p.rank}. ${p.username}${p.isCurrentUser ? ' (toi)' : ''} - ${p.totalPoints} pts`).join('\n')
  const trophiesText = newTrophies && newTrophies.length > 0 ? `\n🏆 NOUVEAU${newTrophies.length > 1 ? 'X' : ''} TROPHÉE${newTrophies.length > 1 ? 'S' : ''} !\n${newTrophies.map(t => `  • ${t.name} : ${t.description}`).join('\n')}\n` : ''

  const text = `
${isWinner ? '👑 Tu as gagné !' : '🏁 Tournoi terminé !'} - ${tournamentName}

${isWinner ? 'Félicitations' : 'Salut'} ${username} !

Le tournoi ${tournamentName} est terminé !
${isWinner ? 'Tu es le champion incontesté ! 👑' : `Le vainqueur est ${winner.username} avec ${winner.totalPoints} points.`}

🏅 TA PLACE FINALE : ${userFinalStats.finalRank}${userFinalStats.finalRank === 1 ? 'er' : 'ème'} avec ${userFinalStats.totalPoints} points
${trophiesText}
📊 TES STATS SUR LE TOURNOI
- Total points : ${userFinalStats.totalPoints} pts
- Scores exacts : ${userFinalStats.exactScores}
- Bons résultats : ${userFinalStats.correctResults}
- Journées parfaites : ${userFinalStats.perfectMatchdays}

🏆 CLASSEMENT FINAL
${finalRankingText}

👉 Voir les détails : ${tournamentUrl}/classement
🎯 Créer un nouveau tournoi : ${baseUrl}/vestiaire/create

Merci d'avoir participé ! À bientôt !

---
© ${new Date().getFullYear()} PronoHub. Tous droits réservés.
  `.trim()

  return {
    html,
    text,
    subject: isWinner ? `👑 Tu as gagné ${tournamentName} !` : `🏁 ${tournamentName} terminé - Tu finis ${userFinalStats.finalRank}${userFinalStats.finalRank === 1 ? 'er' : 'ème'} !`
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
    rules
  } = props

  const baseUrl = 'https://www.pronohub.club'
  const joinUrl = `${baseUrl}/join?code=${inviteCode}`

  // Liste des participants
  const participantsHtml = participants.map(p =>
    `<span style="display: inline-block; background-color: #1e293b; padding: 4px 10px; border-radius: 16px; margin: 4px; font-size: 13px; color: #e0e0e0;">${p.username}${p.isCaptain ? ' <span style="color: #ff9900;">(cap.)</span>' : ''}</span>`
  ).join('')

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invitation à rejoindre ${tournamentName}</title>
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
                <img src="https://www.pronohub.club/images/logo.png" alt="PronoHub" style="width: 60px; height: 60px; display: inline-block;">
              </td></tr></table>
              <h1 style="margin: 0; color: #000; font-size: 22px; font-weight: 700;">🎯 Tu es invité !</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 24px; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                <strong style="color: #ff9900;">${inviterUsername}</strong> t'invite à rejoindre son tournoi de pronostics !
              </p>

              <!-- Code d'invitation -->
              <div style="background-color: #0f172a; border-radius: 12px; padding: 24px; margin-bottom: 24px; text-align: center;">
                <p style="margin: 0 0 8px; color: #94a3b8; font-size: 14px;">Code d'invitation</p>
                <p style="margin: 0; color: #ff9900; font-size: 36px; font-weight: 700; letter-spacing: 6px;">${inviteCode}</p>
              </div>

              <!-- Infos tournoi -->
              <div style="background-color: #0f172a; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <h3 style="margin: 0 0 16px; color: #ff9900; font-size: 16px;">📋 ${tournamentName}</h3>
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 6px 0; color: #94a3b8; font-size: 13px;">Compétition</td>
                    <td style="padding: 6px 0; color: #ff9900; font-size: 13px; text-align: right; font-weight: 600;">${competitionName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #94a3b8; font-size: 13px;">Journées</td>
                    <td style="padding: 6px 0; color: #fff; font-size: 13px; text-align: right;">J${matchdayRange.start} → J${matchdayRange.end}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #94a3b8; font-size: 13px;">Matchs à pronostiquer</td>
                    <td style="padding: 6px 0; color: #fff; font-size: 13px; text-align: right; font-weight: 600;">${matchdayRange.totalMatches} matchs</td>
                  </tr>
                </table>
              </div>

              <!-- Participants -->
              <div style="background-color: #0f172a; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <h3 style="margin: 0 0 12px; color: #ff9900; font-size: 16px;">👥 Déjà inscrits (${participants.length})</h3>
                <div style="line-height: 2;">
                  ${participantsHtml}
                </div>
              </div>

              <!-- Règles -->
              <div style="background-color: #0f172a; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <h3 style="margin: 0 0 12px; color: #ff9900; font-size: 16px;">📜 Règles de points</h3>
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr><td style="padding: 6px 0; color: #94a3b8; font-size: 13px;">Score exact</td><td style="padding: 6px 0; color: #22c55e; font-size: 13px; text-align: right; font-weight: 600;">+${rules.exactScore} pts</td></tr>
                  <tr><td style="padding: 6px 0; color: #94a3b8; font-size: 13px;">Bon résultat (1N2)</td><td style="padding: 6px 0; color: #3b82f6; font-size: 13px; text-align: right; font-weight: 600;">+${rules.correctResult} pts</td></tr>
                  <tr><td style="padding: 6px 0; color: #94a3b8; font-size: 13px;">Bonne différence de buts</td><td style="padding: 6px 0; color: #8b5cf6; font-size: 13px; text-align: right; font-weight: 600;">+${rules.correctGoalDiff} pts</td></tr>
                  ${rules.bonusEnabled ? `<tr><td style="padding: 6px 0; color: #94a3b8; font-size: 13px;">Bonus activé</td><td style="padding: 6px 0; color: #ff9900; font-size: 13px; text-align: right; font-weight: 600;">+${rules.bonusPoints || 0} pts</td></tr>` : ''}
                </table>
              </div>

              <!-- Bouton d'action -->
              <div style="text-align: center; margin: 32px 0;">
                <a href="${joinUrl}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #ff9900 0%, #ff6600 100%); color: #000; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 8px;">
                  Rejoindre le tournoi
                </a>
              </div>

              <p style="margin: 0; color: #64748b; font-size: 13px; line-height: 1.6; text-align: center;">
                Lance-toi dans la compétition et prouve que tu es le meilleur pronostiqueur ! 🏆
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #0f172a; border-top: 1px solid #1e293b;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="color: #64748b; font-size: 12px;">
                    © ${new Date().getFullYear()} PronoHub. Tous droits réservés.
                  </td>
                  <td style="text-align: right;">
                    <a href="${baseUrl}/privacy" style="color: #64748b; font-size: 12px; text-decoration: none; margin-left: 16px;">Confidentialité</a>
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

  const participantsText = participants.map(p => `  • ${p.username}${p.isCaptain ? ' (cap.)' : ''}`).join('\n')

  const text = `
🎯 Tu es invité à rejoindre un tournoi !

${inviterUsername} t'invite à rejoindre son tournoi de pronostics !

📋 CODE D'INVITATION : ${inviteCode}

📋 ${tournamentName}
- Compétition : ${competitionName}
- Journées : J${matchdayRange.start} → J${matchdayRange.end}
- Matchs : ${matchdayRange.totalMatches} matchs

👥 DÉJÀ INSCRITS (${participants.length})
${participantsText}

📜 RÈGLES DE POINTS
- Score exact : +${rules.exactScore} pts
- Bon résultat (1N2) : +${rules.correctResult} pts
- Bonne différence de buts : +${rules.correctGoalDiff} pts
${rules.bonusEnabled ? `- Bonus : +${rules.bonusPoints || 0} pts` : ''}

👉 Rejoindre le tournoi : ${joinUrl}

Lance-toi dans la compétition et prouve que tu es le meilleur pronostiqueur ! 🏆

---
© ${new Date().getFullYear()} PronoHub. Tous droits réservés.
  `.trim()

  return {
    html,
    text,
    subject: `🎯 ${inviterUsername} t'invite à rejoindre ${tournamentName} !`
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
    canLaunchTournament
  } = props

  const baseUrl = 'https://www.pronohub.club'
  const tournamentUrl = `${baseUrl}/vestiaire/${tournamentSlug}`
  const spotsLeft = maxParticipants - currentParticipants
  const isFull = spotsLeft <= 0

  // Liste des participants
  const participantsHtml = participants.map(p =>
    `<span style="display: inline-block; background-color: ${p.username === newPlayerUsername ? '#22543d' : '#1e293b'}; padding: 4px 10px; border-radius: 16px; margin: 4px; font-size: 13px; color: #e0e0e0;">${p.username}${p.isCaptain ? ' <span style="color: #ff9900;">(cap.)</span>' : ''}${p.username === newPlayerUsername ? ' <span style="color: #22c55e;">✨ nouveau</span>' : ''}</span>`
  ).join('')

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nouveau joueur dans ${tournamentName}</title>
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
                <img src="https://www.pronohub.club/images/logo.png" alt="PronoHub" style="width: 60px; height: 60px; display: inline-block;">
              </td></tr></table>
              <h1 style="margin: 0; color: #000; font-size: 22px; font-weight: 700;">👋 Nouveau joueur !</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                Salut <strong style="color: #ff9900;">${captainUsername}</strong> (capitaine) ! 👋
              </p>
              <p style="margin: 0 0 24px; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                <strong style="color: #22c55e;">${newPlayerUsername}</strong> vient de rejoindre ton tournoi <strong>${tournamentName}</strong> ! 🎉
              </p>

              <!-- Stats -->
              <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-radius: 12px; padding: 24px; margin-bottom: 24px; text-align: center;">
                <p style="margin: 0 0 8px; color: #94a3b8; font-size: 14px;">Participants</p>
                <p style="margin: 0; color: #fff; font-size: 36px; font-weight: 700;">${currentParticipants} <span style="color: #64748b; font-size: 20px;">/ ${maxParticipants}</span></p>
                <p style="margin: 8px 0 0; color: ${isFull ? '#ef4444' : '#22c55e'}; font-size: 14px;">
                  ${isFull ? '🔴 Tournoi complet !' : `🟢 ${spotsLeft} place${spotsLeft > 1 ? 's' : ''} restante${spotsLeft > 1 ? 's' : ''}`}
                </p>
              </div>

              <!-- Participants -->
              <div style="background-color: #0f172a; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <h3 style="margin: 0 0 12px; color: #ff9900; font-size: 16px;">👥 Participants (${currentParticipants})</h3>
                <div style="line-height: 2;">
                  ${participantsHtml}
                </div>
              </div>

              ${isFull ? `
              <!-- Alerte complet -->
              <div style="background-color: #422006; border-radius: 12px; padding: 16px; margin-bottom: 24px; border-left: 4px solid #f59e0b;">
                <p style="margin: 0; color: #fcd34d; font-size: 14px; line-height: 1.5;">
                  <strong>🎯 Ton tournoi est complet !</strong><br>
                  Tu peux maintenant le lancer quand tu veux.
                </p>
              </div>
              ` : canLaunchTournament ? `
              <!-- Option lancer avant -->
              <div style="background-color: #0f172a; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
                <p style="margin: 0; color: #94a3b8; font-size: 14px; line-height: 1.5;">
                  💡 Tu peux aussi lancer le tournoi avant que toutes les places soient prises si tu veux commencer plus tôt !
                </p>
              </div>
              ` : ''}

              <!-- Boutons d'action -->
              <div style="text-align: center; margin: 32px 0;">
                ${isFull || canLaunchTournament ? `
                <a href="${tournamentUrl}/settings" style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: #000; text-decoration: none; font-weight: 600; font-size: 15px; border-radius: 8px; margin: 6px;">
                  🚀 Lancer le tournoi
                </a>
                ` : ''}
                <a href="${tournamentUrl}" style="display: inline-block; padding: 14px 28px; background-color: #1e293b; color: #fff; text-decoration: none; font-weight: 600; font-size: 15px; border-radius: 8px; margin: 6px;">
                  Voir le tournoi
                </a>
              </div>

              <!-- Premium -->
              <div style="background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); border-radius: 12px; padding: 16px; margin-bottom: 24px; text-align: center;">
                <p style="margin: 0 0 8px; color: #c4b5fd; font-size: 14px;">
                  ⭐ Besoin de plus de places ?
                </p>
                <a href="${baseUrl}/premium" style="color: #fbbf24; font-size: 14px; font-weight: 600; text-decoration: none;">
                  Passe Premium pour élargir ton tournoi →
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
                    © ${new Date().getFullYear()} PronoHub. Tous droits réservés.
                  </td>
                  <td style="text-align: right;">
                    <a href="${baseUrl}/profile" style="color: #64748b; font-size: 12px; text-decoration: none;">Gérer mes notifications</a>
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

  const participantsText = participants.map(p => `  • ${p.username}${p.isCaptain ? ' (cap.)' : ''}${p.username === newPlayerUsername ? ' ✨ nouveau' : ''}`).join('\n')

  const text = `
👋 Nouveau joueur dans ${tournamentName} !

Salut ${captainUsername} (capitaine) !

${newPlayerUsername} vient de rejoindre ton tournoi ${tournamentName} ! 🎉

📊 PARTICIPANTS : ${currentParticipants} / ${maxParticipants}
${isFull ? '🔴 Tournoi complet !' : `🟢 ${spotsLeft} place${spotsLeft > 1 ? 's' : ''} restante${spotsLeft > 1 ? 's' : ''}`}

👥 LISTE DES PARTICIPANTS
${participantsText}

${isFull ? '🎯 Ton tournoi est complet ! Tu peux maintenant le lancer.' : canLaunchTournament ? '💡 Tu peux lancer le tournoi avant que toutes les places soient prises.' : ''}

${isFull || canLaunchTournament ? `🚀 Lancer le tournoi : ${tournamentUrl}/settings` : ''}
👉 Voir le tournoi : ${tournamentUrl}
⭐ Passer Premium : ${baseUrl}/premium

---
© ${new Date().getFullYear()} PronoHub. Tous droits réservés.
  `.trim()

  return {
    html,
    text,
    subject: `👋 ${newPlayerUsername} a rejoint ${tournamentName} (${currentParticipants}/${maxParticipants})`
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
    tournamentStatus
  } = props

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.pronohub.club'
  const tournamentUrl = `${baseUrl}/vestiaire/${tournamentSlug}/echauffement`

  const statusMessage = tournamentStatus === 'pending' || tournamentStatus === 'warmup'
    ? `En tant que capitaine, c'est toi qui devras <strong style="color: #ff9900;">lancer le tournoi</strong> quand tous les participants seront prêts.`
    : `Le tournoi est déjà en cours. Tu gères désormais les paramètres du tournoi.`

  const statusBadge = tournamentStatus === 'pending' || tournamentStatus === 'warmup'
    ? `<span style="display: inline-block; background-color: #fef3c7; color: #92400e; padding: 4px 12px; border-radius: 16px; font-size: 12px; font-weight: 600;">En attente de lancement</span>`
    : `<span style="display: inline-block; background-color: #dcfce7; color: #166534; padding: 4px 12px; border-radius: 16px; font-size: 12px; font-weight: 600;">En cours</span>`

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tu es le nouveau capitaine !</title>
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
              <h1 style="margin: 0; color: #000; font-size: 28px; font-weight: 700;">Tu es le nouveau capitaine !</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                Salut <strong style="color: #ff9900;">${newCaptainUsername}</strong> ! 👋
              </p>
              <p style="margin: 0 0 20px; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                <strong style="color: #94a3b8;">${oldCaptainUsername}</strong> t'a transféré le capitanat du tournoi <strong style="color: #ff9900;">${tournamentName}</strong>.
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
                <h3 style="margin: 0 0 16px; color: #ff9900; font-size: 18px;">👑 Tes responsabilités de capitaine</h3>
                <ul style="margin: 0; padding-left: 20px; color: #94a3b8; font-size: 14px; line-height: 1.8;">
                  ${tournamentStatus === 'pending' || tournamentStatus === 'warmup' ? '<li>Lancer le tournoi quand les participants sont prêts</li>' : ''}
                  <li>Partager le code d'invitation avec de nouveaux joueurs</li>
                  <li>Gérer les paramètres du tournoi</li>
                  <li>Transférer le capitanat si nécessaire</li>
                </ul>
              </div>

              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; margin: 32px 0;">
                <tr>
                  <td align="center">
                    <a href="${tournamentUrl}" style="display: inline-block; background: linear-gradient(135deg, #ff9900 0%, #ff6600 100%); color: #000; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                      Voir le tournoi
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; color: #64748b; font-size: 14px; text-align: center;">
                Bonne chance capitaine ! ⚽
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #0f172a; text-align: center;">
              <p style="margin: 0 0 8px; color: #64748b; font-size: 12px;">
                © ${new Date().getFullYear()} PronoHub. Tous droits réservés.
              </p>
              <p style="margin: 0; color: #475569; font-size: 11px;">
                <a href="${baseUrl}/settings/notifications" style="color: #475569; text-decoration: underline;">Gérer mes notifications</a>
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
👑 TU ES LE NOUVEAU CAPITAINE !

Salut ${newCaptainUsername} !

${oldCaptainUsername} t'a transféré le capitanat du tournoi "${tournamentName}".

📋 DÉTAILS DU TOURNOI
---
Tournoi : ${tournamentName}
Compétition : ${competitionName}
Statut : ${tournamentStatus === 'pending' || tournamentStatus === 'warmup' ? 'En attente de lancement' : 'En cours'}

${tournamentStatus === 'pending' || tournamentStatus === 'warmup' ? '⚠️ En tant que capitaine, c\'est toi qui devras lancer le tournoi quand tous les participants seront prêts.' : ''}

👑 TES RESPONSABILITÉS DE CAPITAINE
${tournamentStatus === 'pending' || tournamentStatus === 'warmup' ? '• Lancer le tournoi quand les participants sont prêts\n' : ''}• Partager le code d'invitation avec de nouveaux joueurs
• Gérer les paramètres du tournoi
• Transférer le capitanat si nécessaire

👉 Voir le tournoi : ${tournamentUrl}

Bonne chance capitaine ! ⚽

---
© ${new Date().getFullYear()} PronoHub. Tous droits réservés.
  `.trim()

  return {
    html,
    text,
    subject: `👑 Tu es le nouveau capitaine de ${tournamentName}`
  }
}

// Template: Rappel multi-tournois (un email pour tous les tournois)
export function getMultiTournamentReminderTemplate(props: MultiTournamentReminderEmailProps) {
  const {
    username,
    tournaments,
    defaultPredictionMaxPoints,
    earliestDeadline
  } = props

  const totalMatches = tournaments.reduce((sum, t) => sum + t.matches.length, 0)
  const actionUrl = 'https://www.pronohub.club/dashboard'

  // Générer le HTML pour chaque tournoi
  const tournamentsHtml = tournaments.map(tournament => {
    const matchesHtml = tournament.matches.map(match => `
      <tr>
        <td style="padding: 10px 16px; border-bottom: 1px solid #1e293b;">
          <div>
            <span style="color: #fff; font-size: 14px; font-weight: 500;">${match.homeTeam} - ${match.awayTeam}</span>
          </div>
          <div style="margin-top: 4px;">
            <span style="color: #94a3b8; font-size: 12px;">📅 ${match.matchDate}</span>
            <span style="color: #ef4444; font-size: 12px; margin-left: 10px;">⏰ ${match.deadlineTime}</span>
          </div>
        </td>
      </tr>
    `).join('')

    return `
      <div style="background-color: #0f172a; border-radius: 12px; overflow: hidden; margin-bottom: 20px;">
        <div style="padding: 14px 16px; border-bottom: 1px solid #1e293b; background-color: #1e293b;">
          <h3 style="margin: 0; color: #ff9900; font-size: 15px;">🏆 ${tournament.name}</h3>
          <p style="margin: 4px 0 0; color: #94a3b8; font-size: 12px;">${tournament.competitionName} • ${tournament.matches.length} match${tournament.matches.length > 1 ? 's' : ''}</p>
        </div>
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          ${matchesHtml}
        </table>
        <div style="padding: 12px 16px; text-align: center;">
          <a href="https://www.pronohub.club/${tournament.slug}/opposition" style="color: #ff9900; font-size: 13px; text-decoration: none;">
            Pronostiquer →
          </a>
        </div>
      </div>
    `
  }).join('')

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rappel : ${totalMatches} matchs à pronostiquer !</title>
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
                <img src="https://www.pronohub.club/images/logo.png" alt="PronoHub" style="width: 60px; height: 60px; display: inline-block;">
              </td></tr></table>
              <h1 style="margin: 0; color: #000; font-size: 24px; font-weight: 700;">⏰ ${totalMatches} match${totalMatches > 1 ? 's' : ''} à pronostiquer !</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                Salut <strong style="color: #ff9900;">${username}</strong> ! 👋
              </p>
              <p style="margin: 0 0 24px; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                Tu as des pronostics en attente dans <strong>${tournaments.length} tournoi${tournaments.length > 1 ? 's' : ''}</strong>. Ne rate pas l'occasion de marquer des points !
              </p>

              <!-- Résumé -->
              <div style="background-color: #0f172a; border-radius: 12px; padding: 16px; margin-bottom: 24px; text-align: center;">
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px; text-align: center;">
                      <span style="display: block; color: #ff9900; font-size: 28px; font-weight: 700;">${totalMatches}</span>
                      <span style="color: #94a3b8; font-size: 12px;">match${totalMatches > 1 ? 's' : ''}</span>
                    </td>
                    <td style="padding: 8px; text-align: center;">
                      <span style="display: block; color: #22c55e; font-size: 28px; font-weight: 700;">${tournaments.length}</span>
                      <span style="color: #94a3b8; font-size: 12px;">tournoi${tournaments.length > 1 ? 's' : ''}</span>
                    </td>
                    <td style="padding: 8px; text-align: center;">
                      <span style="display: block; color: #ef4444; font-size: 28px; font-weight: 700;">${earliestDeadline}</span>
                      <span style="color: #94a3b8; font-size: 12px;">heure limite</span>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Liste des tournois avec matchs -->
              ${tournamentsHtml}

              <!-- Alerte prono par défaut -->
              <div style="background-color: #7f1d1d; border-radius: 12px; padding: 16px; margin-bottom: 24px; border-left: 4px solid #ef4444;">
                <p style="margin: 0; color: #fecaca; font-size: 14px; line-height: 1.5;">
                  <strong>⚠️ Attention :</strong> Si tu ne pronostiques pas avant la limite, un pronostic par défaut sera appliqué.
                  Dans ce cas, tu ne pourras gagner que <strong>${defaultPredictionMaxPoints} point${defaultPredictionMaxPoints > 1 ? 's' : ''} maximum</strong> par match, même en cas de score exact !
                </p>
              </div>

              <div style="text-align: center; margin: 32px 0;">
                <a href="${actionUrl}" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #ff9900 0%, #ff6600 100%); color: #000; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 8px;">
                  Voir tous mes tournois
                </a>
              </div>

              <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.6; text-align: center;">
                Les pronostics doivent être faits <strong>1 heure avant</strong> le début de chaque match.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #0f172a; border-top: 1px solid #1e293b;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="color: #64748b; font-size: 12px;">
                    © ${new Date().getFullYear()} PronoHub. Tous droits réservés.
                  </td>
                  <td style="text-align: right;">
                    <a href="https://www.pronohub.club/profile" style="color: #64748b; font-size: 12px; text-decoration: none;">Gérer mes notifications</a>
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
      `    • ${match.homeTeam} - ${match.awayTeam}\n      📅 ${match.matchDate} | ⏰ Limite : ${match.deadlineTime}`
    ).join('\n')

    return `🏆 ${tournament.name} (${tournament.competitionName})
${tournament.matches.length} match${tournament.matches.length > 1 ? 's' : ''} à pronostiquer :
${matchesText}
👉 Pronostiquer : https://www.pronohub.club/${tournament.slug}/opposition`
  }).join('\n\n')

  const text = `
⏰ ${totalMatches} match${totalMatches > 1 ? 's' : ''} à pronostiquer !

Salut ${username} !

Tu as des pronostics en attente dans ${tournaments.length} tournoi${tournaments.length > 1 ? 's' : ''}.

📊 RÉSUMÉ
---
${totalMatches} match${totalMatches > 1 ? 's' : ''} • ${tournaments.length} tournoi${tournaments.length > 1 ? 's' : ''} • heure limite : ${earliestDeadline}

${tournamentsText}

⚠️ ATTENTION : Si tu ne pronostiques pas avant la limite, un pronostic par défaut sera appliqué. Tu ne pourras gagner que ${defaultPredictionMaxPoints} point${defaultPredictionMaxPoints > 1 ? 's' : ''} maximum par match !

👉 Voir tous mes tournois : ${actionUrl}

Les pronostics doivent être faits 1 heure avant le début de chaque match.

---
© ${new Date().getFullYear()} PronoHub. Tous droits réservés.
Gérer mes notifications : https://www.pronohub.club/profile
  `.trim()

  // Sujet dynamique selon le nombre de tournois
  let subject: string
  if (tournaments.length === 1) {
    subject = `⏰ ${totalMatches} match${totalMatches > 1 ? 's' : ''} à pronostiquer dans ${tournaments[0].name} !`
  } else {
    subject = `⏰ ${totalMatches} matchs à pronostiquer dans ${tournaments.length} tournois !`
  }

  return {
    html,
    text,
    subject
  }
}

// Interface pour l'email de relance utilisateur inactif (10 jours sans tournoi)
export interface InactiveUserReminderEmailProps {
  username: string
}

// Template: Relance utilisateur inactif après 10 jours sans tournoi
export function getInactiveUserReminderTemplate(props: InactiveUserReminderEmailProps) {
  const { username } = props

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ton tournoi s'est rompu les croisés ?</title>
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
                <img src="https://www.pronohub.club/images/logo.png" alt="PronoHub" style="width: 60px; height: 60px; display: inline-block;">
              </td></tr></table>
              <h1 style="margin: 0; color: #000; font-size: 24px; font-weight: 700;">🏥 Ton tournoi s'est rompu les croisés ?</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #e0e0e0; font-size: 18px; line-height: 1.6;">
                Salut champion${username ? ` <strong style="color: #ff9900;">${username}</strong>` : ''} 🏆
              </p>

              <p style="margin: 0 0 20px; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                Bon.<br>
                On va être francs deux secondes.
              </p>

              <p style="margin: 0 0 20px; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                Tu t'es inscrit sur PronoHub…<br>
                👉 <strong style="color: #ff9900;">mais aucun tournoi lancé.</strong><br>
                Rien. Le néant. Le niveau Ligue 2 un lundi soir sous la pluie.
              </p>

              <div style="background-color: #0f172a; border-radius: 12px; padding: 24px; margin: 24px 0;">
                <p style="margin: 0 0 8px; color: #ff9900; font-size: 16px; font-weight: 600;">Pendant ce temps :</p>
                <ul style="margin: 0; padding-left: 20px; color: #94a3b8; font-size: 15px; line-height: 2;">
                  <li>⚽ Les matchs de foot s'enchaînent</li>
                  <li>📊 Les vrais savent déjà qui va choke à la 90e</li>
                  <li>🗣️ Et tes potes attendent toujours de voir si tu parles mieux que tu pronostiques</li>
                </ul>
              </div>

              <p style="margin: 0 0 20px; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                Créer un tournoi sur PronoHub, c'est moins compliqué que d'expliquer la règle du hors-jeu à ton fils :
              </p>

              <div style="background-color: #1e293b; border-radius: 12px; padding: 24px; margin: 24px 0;">
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #e0e0e0; font-size: 15px;">
                      <span style="display: inline-block; width: 28px; height: 28px; background-color: #ff9900; color: #000; border-radius: 50%; text-align: center; line-height: 28px; font-weight: bold; margin-right: 12px;">1</span>
                      Tu lances le tournoi
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #e0e0e0; font-size: 15px;">
                      <span style="display: inline-block; width: 28px; height: 28px; background-color: #ff9900; color: #000; border-radius: 50%; text-align: center; line-height: 28px; font-weight: bold; margin-right: 12px;">2</span>
                      Tu invites des potes
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #e0e0e0; font-size: 15px;">
                      <span style="display: inline-block; width: 28px; height: 28px; background-color: #ff9900; color: #000; border-radius: 50%; text-align: center; line-height: 28px; font-weight: bold; margin-right: 12px;">3</span>
                      Tu assumes publiquement tes pronos douteux
                    </td>
                  </tr>
                </table>
              </div>

              <p style="margin: 0 0 8px; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                <strong style="color: #ff9900;">C'est maintenant que ça se joue.</strong>
              </p>
              <p style="margin: 0 0 24px; color: #94a3b8; font-size: 15px; line-height: 1.6;">
                Sinon, quelqu'un d'autre prendra le rôle du "génie du foot" du collectif…<br>
                (et on sait tous que ce sera insupportable).
              </p>

              <div style="text-align: center; margin: 32px 0;">
                <a href="https://www.pronohub.club/vestiaire" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #ff9900 0%, #ff6600 100%); color: #000; text-decoration: none; font-weight: 700; font-size: 16px; border-radius: 8px;">
                  👉 Lance ton tournoi sur PronoHub
                </a>
              </div>

              <p style="margin: 0 0 24px; color: #e0e0e0; font-size: 15px; line-height: 1.6; text-align: center;">
                Montre que t'es pas juste fort en débats WhatsApp.
              </p>

              <p style="margin: 0; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                À tout de suite sur PronoHub ⚽<br>
                <strong style="color: #ff9900;">L'équipe PronoHub</strong>
              </p>

              <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #1e293b;">
                <p style="margin: 0; color: #64748b; font-size: 13px; font-style: italic;">
                  PS : Toujours aucun tournoi ?<br>
                  On commence à penser que tu regardes le foot sans vraiment le comprendre… 😬
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
                    © ${new Date().getFullYear()} PronoHub. Tous droits réservés.
                  </td>
                  <td style="text-align: right;">
                    <a href="https://www.pronohub.club/privacy" style="color: #64748b; font-size: 12px; text-decoration: none; margin-left: 16px;">Confidentialité</a>
                    <a href="https://www.pronohub.club/cgv" style="color: #64748b; font-size: 12px; text-decoration: none; margin-left: 16px;">CGU</a>
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
🏥 Ton tournoi s'est rompu les croisés ?

Salut champion${username ? ` ${username}` : ''} 🏆

Bon.
On va être francs deux secondes.

Tu t'es inscrit sur PronoHub…
👉 mais aucun tournoi lancé.
Rien. Le néant. Le niveau Ligue 2 un lundi soir sous la pluie.

Pendant ce temps :
⚽ Les matchs de foot s'enchaînent
📊 Les vrais savent déjà qui va choke à la 90e
🗣️ Et tes potes attendent toujours de voir si tu parles mieux que tu pronostiques

Créer un tournoi sur PronoHub, c'est moins compliqué que d'expliquer la règle du hors-jeu à ton fils :

1. Tu lances le tournoi
2. Tu invites des potes
3. Tu assumes publiquement tes pronos douteux

C'est maintenant que ça se joue.
Sinon, quelqu'un d'autre prendra le rôle du "génie du foot" du collectif…
(et on sait tous que ce sera insupportable).

👉 Lance ton tournoi sur PronoHub : https://www.pronohub.club/vestiaire

Montre que t'es pas juste fort en débats WhatsApp.

À tout de suite sur PronoHub ⚽
L'équipe PronoHub

PS : Toujours aucun tournoi ?
On commence à penser que tu regardes le foot sans vraiment le comprendre… 😬

© ${new Date().getFullYear()} PronoHub. Tous droits réservés.
  `.trim()

  const subject = '🏥 Ton tournoi s\'est rompu les croisés ?'

  return {
    html,
    text,
    subject
  }
}
