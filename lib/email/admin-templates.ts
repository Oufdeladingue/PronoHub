// Templates d'emails pour alertes administrateur
import { escapeHtml } from './escape'

const ADMIN_EMAIL = 'kochroman6@gmail.com'

export { ADMIN_EMAIL }

// Interface pour alerte nouvel utilisateur
export interface NewUserAlertProps {
  email: string
  username?: string
  provider?: 'email' | 'google'
  createdAt: string
}

// Interface pour alerte transaction
export interface TransactionAlertProps {
  userEmail: string
  username?: string
  purchaseType: string
  amount: number
  currency: string
  stripeSessionId: string
  tournamentName?: string
  createdAt: string
}

// Template: Alerte nouvel utilisateur
export function getNewUserAlertTemplate(props: NewUserAlertProps) {
  const { email, username, provider = 'email', createdAt } = props

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nouvel utilisateur PronoHub</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 500px; width: 100%; border-collapse: collapse; background-color: #1a1a2e; border-radius: 16px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 30px; text-align: center; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);">
              <h1 style="margin: 0; color: #fff; font-size: 24px; font-weight: 700;">
                🎉 Nouvel utilisateur !
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 30px;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #2d2d3d;">
                    <span style="color: #888; font-size: 14px;">Email</span><br>
                    <span style="color: #fff; font-size: 16px; font-weight: 600;">${escapeHtml(email)}</span>
                  </td>
                </tr>
                ${username ? `
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #2d2d3d;">
                    <span style="color: #888; font-size: 14px;">Username</span><br>
                    <span style="color: #fff; font-size: 16px; font-weight: 600;">${escapeHtml(username)}</span>
                  </td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #2d2d3d;">
                    <span style="color: #888; font-size: 14px;">Méthode d'inscription</span><br>
                    <span style="color: #ff9900; font-size: 16px; font-weight: 600;">
                      ${provider === 'google' ? '🔵 Google OAuth' : '📧 Email/Password'}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0;">
                    <span style="color: #888; font-size: 14px;">Date d'inscription</span><br>
                    <span style="color: #fff; font-size: 16px;">${createdAt}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 30px; background-color: #0f0f1a; text-align: center;">
              <p style="margin: 0; color: #666; font-size: 12px;">
                Alerte automatique PronoHub
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

  const text = `
Nouvel utilisateur PronoHub !

Email: ${email}
${username ? `Username: ${username}` : ''}
Méthode: ${provider === 'google' ? 'Google OAuth' : 'Email/Password'}
Date: ${createdAt}
`

  return {
    html,
    text,
    subject: `🎉 Nouvel utilisateur : ${email}`
  }
}

// Interface pour alerte création tournoi
export interface NewTournamentAlertProps {
  tournamentName: string
  tournamentType: string
  competitionName: string
  creatorUsername: string
  creatorEmail: string
  maxPlayers: number
  numMatchdays: number | string
  allMatchdays: boolean
  bonusMatch: boolean
  earlyPredictionBonus: boolean
  bonusQualified: boolean
  isEvent: boolean
  createdAt: string
}

// Template: Alerte création tournoi
export function getNewTournamentAlertTemplate(props: NewTournamentAlertProps) {
  const {
    tournamentName,
    tournamentType,
    competitionName,
    creatorUsername,
    creatorEmail,
    maxPlayers,
    numMatchdays,
    allMatchdays,
    bonusMatch,
    earlyPredictionBonus,
    isEvent,
    createdAt
  } = props

  const typeLabels: Record<string, string> = {
    'free': '🟢 Free-Kick (Gratuit)',
    'oneshot': '🔵 One-Shot (4,99€)',
    'elite': '🟠 Elite Team (9,99€)',
    'platinium': '🟡 Platinium (6,99€/pers)',
    'event': '🏆 Événement',
  }

  const typeLabel = typeLabels[tournamentType] || tournamentType

  const options = [
    bonusMatch ? '⚡ Match bonus' : null,
    earlyPredictionBonus ? '🎯 Prime avant-match' : null,
    isEvent ? '🏆 Événement' : null,
  ].filter(Boolean)

  const durationText = allMatchdays ? 'Toute la saison' : `${numMatchdays} journée${Number(numMatchdays) > 1 ? 's' : ''}`

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nouveau tournoi PronoHub</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 500px; width: 100%; border-collapse: collapse; background-color: #1a1a2e; border-radius: 16px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 30px; text-align: center; background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%);">
              <h1 style="margin: 0; color: #fff; font-size: 24px; font-weight: 700;">
                ⚽ Nouveau tournoi créé !
              </h1>
              <p style="margin: 10px 0 0; color: #e0d4ff; font-size: 18px; font-weight: 600;">
                ${tournamentName}
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 30px;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #2d2d3d;">
                    <span style="color: #888; font-size: 14px;">Type</span><br>
                    <span style="color: #ff9900; font-size: 16px; font-weight: 600;">${typeLabel}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #2d2d3d;">
                    <span style="color: #888; font-size: 14px;">Compétition</span><br>
                    <span style="color: #fff; font-size: 16px; font-weight: 600;">${competitionName}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #2d2d3d;">
                    <span style="color: #888; font-size: 14px;">Créateur</span><br>
                    <span style="color: #fff; font-size: 16px; font-weight: 600;">${escapeHtml(creatorUsername)}</span>
                    <br><span style="color: #888; font-size: 13px;">${escapeHtml(creatorEmail)}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #2d2d3d;">
                    <span style="color: #888; font-size: 14px;">Joueurs max</span><br>
                    <span style="color: #fff; font-size: 16px; font-weight: 600;">${maxPlayers}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #2d2d3d;">
                    <span style="color: #888; font-size: 14px;">Durée</span><br>
                    <span style="color: #fff; font-size: 16px; font-weight: 600;">${durationText}</span>
                  </td>
                </tr>
                ${options.length > 0 ? `
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #2d2d3d;">
                    <span style="color: #888; font-size: 14px;">Options</span><br>
                    <span style="color: #fff; font-size: 16px;">${options.join(' · ')}</span>
                  </td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 10px 0;">
                    <span style="color: #888; font-size: 14px;">Date de création</span><br>
                    <span style="color: #fff; font-size: 16px;">${createdAt}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 30px; background-color: #0f0f1a; text-align: center;">
              <p style="margin: 0; color: #666; font-size: 12px;">
                Alerte automatique PronoHub
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

  const text = `
Nouveau tournoi PronoHub !

Nom: ${tournamentName}
Type: ${typeLabel}
Compétition: ${competitionName}
Créateur: ${creatorUsername} (${creatorEmail})
Joueurs max: ${maxPlayers}
Durée: ${durationText}
${options.length > 0 ? `Options: ${options.join(', ')}` : ''}
Date: ${createdAt}
`

  return {
    html,
    text,
    subject: `⚽ Nouveau tournoi : ${tournamentName} (${typeLabel})`
  }
}

// Template: Alerte transaction
export function getTransactionAlertTemplate(props: TransactionAlertProps) {
  const {
    userEmail,
    username,
    purchaseType,
    amount,
    currency,
    stripeSessionId,
    tournamentName,
    createdAt
  } = props

  // Mapper les types d'achat vers des libellés lisibles
  const purchaseTypeLabels: Record<string, string> = {
    'tournament_creation_oneshot': '🟢 Création One-Shot (4,99€)',
    'tournament_creation_elite': '🟠 Création Elite Team (9,99€)',
    'platinium_participation': '🟡 Participation Platinium (6,99€)',
    'platinium_group_11': '🟡 Platinium Groupe 11 places (69,20€)',
    'slot_invite': '🔵 Slot Invite (0,99€)',
    'duration_extension': '⏱️ Extension durée (3,99€)',
    'player_extension': '👥 Extension joueurs +5 (1,99€)',
  }

  const purchaseLabel = purchaseTypeLabels[purchaseType] || purchaseType

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Transaction PronoHub</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 500px; width: 100%; border-collapse: collapse; background-color: #1a1a2e; border-radius: 16px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 30px; text-align: center; background: linear-gradient(135deg, #ff9900 0%, #ff6600 100%);">
              <h1 style="margin: 0; color: #000; font-size: 24px; font-weight: 700;">
                💰 Nouvelle transaction !
              </h1>
              <p style="margin: 10px 0 0; color: #000; font-size: 32px; font-weight: 700;">
                ${(amount / 100).toFixed(2)} ${currency.toUpperCase()}
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 30px;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #2d2d3d;">
                    <span style="color: #888; font-size: 14px;">Utilisateur</span><br>
                    <span style="color: #fff; font-size: 16px; font-weight: 600;">${escapeHtml(userEmail)}</span>
                    ${username ? `<br><span style="color: #ff9900; font-size: 14px;">@${escapeHtml(username)}</span>` : ''}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #2d2d3d;">
                    <span style="color: #888; font-size: 14px;">Type d'achat</span><br>
                    <span style="color: #fff; font-size: 16px; font-weight: 600;">${purchaseLabel}</span>
                  </td>
                </tr>
                ${tournamentName ? `
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #2d2d3d;">
                    <span style="color: #888; font-size: 14px;">Tournoi</span><br>
                    <span style="color: #fff; font-size: 16px;">${tournamentName}</span>
                  </td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #2d2d3d;">
                    <span style="color: #888; font-size: 14px;">Session Stripe</span><br>
                    <span style="color: #666; font-size: 12px; word-break: break-all;">${stripeSessionId}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0;">
                    <span style="color: #888; font-size: 14px;">Date</span><br>
                    <span style="color: #fff; font-size: 16px;">${createdAt}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 30px; background-color: #0f0f1a; text-align: center;">
              <a href="https://dashboard.stripe.com/payments" style="display: inline-block; padding: 10px 20px; background-color: #635bff; color: #fff; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600;">
                Voir sur Stripe
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`

  const text = `
Nouvelle transaction PronoHub !

Montant: ${(amount / 100).toFixed(2)} ${currency.toUpperCase()}
Utilisateur: ${userEmail}${username ? ` (@${username})` : ''}
Type: ${purchaseLabel}
${tournamentName ? `Tournoi: ${tournamentName}` : ''}
Date: ${createdAt}
Session: ${stripeSessionId}
`

  return {
    html,
    text,
    subject: `💰 Transaction : ${(amount / 100).toFixed(2)}€ - ${purchaseLabel}`
  }
}

// Interface pour alerte lancement tournoi
export interface TournamentStartedAlertProps {
  tournamentName: string
  tournamentType: string
  competitionName: string
  captainUsername: string
  captainEmail: string
  participantsCount: number
  participants: Array<{ username: string; isCaptain: boolean }>
  matchdayRange: { start: number; end: number; totalMatches: number }
  firstMatchDate: string
  bonusEnabled: boolean
  startedAt: string
}

// Template: Alerte lancement tournoi (admin)
export function getTournamentStartedAlertTemplate(props: TournamentStartedAlertProps) {
  const {
    tournamentName,
    tournamentType,
    competitionName,
    captainUsername,
    captainEmail,
    participantsCount,
    participants,
    matchdayRange,
    firstMatchDate,
    bonusEnabled,
    startedAt
  } = props

  const typeLabels: Record<string, string> = {
    'free': '🟢 Free-Kick',
    'oneshot': '🔵 One-Shot',
    'elite': '🟠 Elite Team',
    'platinium': '🟡 Platinium',
    'event': '🏆 Événement',
  }

  const typeLabel = typeLabels[tournamentType] || tournamentType

  const participantsHtml = participants.map(p =>
    `<span style="display: inline-block; background-color: ${p.isCaptain ? '#ff9900' : '#1e293b'}; color: ${p.isCaptain ? '#000' : '#e0e0e0'}; padding: 4px 10px; border-radius: 16px; margin: 3px; font-size: 12px;">${escapeHtml(p.username)}${p.isCaptain ? ' (cap.)' : ''}</span>`
  ).join('')

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tournoi lancé - PronoHub</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 500px; width: 100%; border-collapse: collapse; background-color: #1a1a2e; border-radius: 16px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 30px; text-align: center; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);">
              <h1 style="margin: 0; color: #fff; font-size: 24px; font-weight: 700;">
                🚀 Tournoi lancé !
              </h1>
              <p style="margin: 10px 0 0; color: #dcfce7; font-size: 18px; font-weight: 600;">
                ${tournamentName}
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 30px;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #2d2d3d;">
                    <span style="color: #888; font-size: 14px;">Type</span><br>
                    <span style="color: #ff9900; font-size: 16px; font-weight: 600;">${typeLabel}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #2d2d3d;">
                    <span style="color: #888; font-size: 14px;">Compétition</span><br>
                    <span style="color: #fff; font-size: 16px; font-weight: 600;">${competitionName}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #2d2d3d;">
                    <span style="color: #888; font-size: 14px;">Capitaine</span><br>
                    <span style="color: #fff; font-size: 16px; font-weight: 600;">${escapeHtml(captainUsername)}</span>
                    <br><span style="color: #888; font-size: 13px;">${escapeHtml(captainEmail)}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #2d2d3d;">
                    <span style="color: #888; font-size: 14px;">Journées</span><br>
                    <span style="color: #fff; font-size: 16px; font-weight: 600;">J${matchdayRange.start} → J${matchdayRange.end} (${matchdayRange.totalMatches} matchs)</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #2d2d3d;">
                    <span style="color: #888; font-size: 14px;">Premier match</span><br>
                    <span style="color: #22c55e; font-size: 16px; font-weight: 600;">${firstMatchDate}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #2d2d3d;">
                    <span style="color: #888; font-size: 14px;">Bonus</span><br>
                    <span style="color: ${bonusEnabled ? '#22c55e' : '#ef4444'}; font-size: 16px; font-weight: 600;">${bonusEnabled ? '✅ Activé' : '❌ Désactivé'}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0;">
                    <span style="color: #888; font-size: 14px;">Participants (${participantsCount})</span><br>
                    <div style="margin-top: 8px; line-height: 2;">
                      ${participantsHtml}
                    </div>
                  </td>
                </tr>
              </table>

              <p style="margin: 20px 0 0; color: #64748b; font-size: 12px; text-align: center;">
                Lancé le ${startedAt}
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 30px; background-color: #0f0f1a; text-align: center;">
              <p style="margin: 0; color: #666; font-size: 12px;">
                Alerte automatique PronoHub
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

  const participantsText = participants.map(p => `  • ${p.username}${p.isCaptain ? ' (cap.)' : ''}`).join('\n')

  const text = `
🚀 Tournoi lancé sur PronoHub !

Nom: ${tournamentName}
Type: ${typeLabel}
Compétition: ${competitionName}
Capitaine: ${captainUsername} (${captainEmail})
Journées: J${matchdayRange.start} → J${matchdayRange.end} (${matchdayRange.totalMatches} matchs)
Premier match: ${firstMatchDate}
Bonus: ${bonusEnabled ? 'Activé' : 'Désactivé'}

Participants (${participantsCount}):
${participantsText}

Lancé le: ${startedAt}
`

  return {
    html,
    text,
    subject: `🚀 Tournoi lancé : ${tournamentName} (${participantsCount} joueurs)`
  }
}
