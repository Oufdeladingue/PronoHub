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
    deadlineTime: string // Format: "20h00" (1h avant le match)
  }>
  defaultPredictionMaxPoints: number
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

  const actionUrl = `https://www.pronohub.club/vestiaire/${tournamentSlug}/opposition`

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
