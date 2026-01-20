// Templates d'emails pour alertes administrateur

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
                    <span style="color: #fff; font-size: 16px; font-weight: 600;">${email}</span>
                  </td>
                </tr>
                ${username ? `
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #2d2d3d;">
                    <span style="color: #888; font-size: 14px;">Username</span><br>
                    <span style="color: #fff; font-size: 16px; font-weight: 600;">${username}</span>
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
                    <span style="color: #fff; font-size: 16px; font-weight: 600;">${userEmail}</span>
                    ${username ? `<br><span style="color: #ff9900; font-size: 14px;">@${username}</span>` : ''}
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
