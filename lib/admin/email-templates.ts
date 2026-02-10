/**
 * Templates d'email prédéfinis pour les communications admin
 */

export interface EmailTemplate {
  id: string
  name: string
  description: string
  subject: string
  previewText: string
  html: string
}

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: 'blank',
    name: 'Vide',
    description: 'Partir de zéro',
    subject: '',
    previewText: '',
    html: ''
  },
  {
    id: 'announcement',
    name: 'Annonce',
    description: 'Annonce générale colorée',
    subject: '🎉 Nouvelle annonce PronoHub',
    previewText: 'Découvrez les dernières nouveautés',
    html: `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #1a1a2e; border-radius: 16px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 24px; text-align: center; background: linear-gradient(135deg, #ff9900 0%, #ff6600 100%);">
              <div style="width: 90px; height: 90px; margin: 0 auto 20px; background-color: #1e293b; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 16px rgba(0,0,0,0.3);">
                <img src="https://www.pronohub.club/images/logo.svg" alt="PronoHub" style="width: 70px; height: 70px; display: block; margin: auto;">
              </div>
              <h1 style="margin: 0 0 8px; color: #000; font-size: 24px; font-weight: 700;">Nouvelle annonce</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                Salut <strong style="color: #ff9900;">[username]</strong> ! 👋
              </p>

              <p style="margin: 0 0 24px; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                Nous avons une annonce importante à te partager...
              </p>

              <div style="background-color: #0f172a; border-radius: 12px; padding: 24px; margin-bottom: 24px; border-left: 4px solid #ff9900;">
                <p style="margin: 0; color: #e0e0e0; font-size: 15px; line-height: 1.6;">
                  [Ton contenu ici]
                </p>
              </div>

              <!-- CTA Button -->
              <div style="text-align: center; margin: 32px 0;">
                <a href="[CTA_URL]" style="display: inline-block; background: linear-gradient(135deg, #ff9900 0%, #ff6600 100%); color: #000; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(255, 153, 0, 0.3);">
                  [CTA_TEXT]
                </a>
              </div>

              <p style="margin: 24px 0 0; color: #94a3b8; font-size: 14px; line-height: 1.6;">
                À bientôt sur PronoHub ! ⚽
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #0f172a; text-align: center;">
              <p style="margin: 0; color: #64748b; font-size: 12px;">
                PronoHub - Tournois de pronostics entre amis
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
  },
  {
    id: 'simple',
    name: 'Simple',
    description: 'Message simple et épuré',
    subject: 'Message de l\'équipe PronoHub',
    previewText: 'Un message important pour toi',
    html: `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px;">
              <img src="https://www.pronohub.club/images/logo.svg" alt="PronoHub" style="width: 60px; height: 60px; display: block; margin: 0 0 24px;">

              <p style="margin: 0 0 16px; color: #333; font-size: 16px; line-height: 1.6;">
                Bonjour <strong>[username]</strong>,
              </p>

              <p style="margin: 0 0 16px; color: #333; font-size: 16px; line-height: 1.6;">
                [Ton message ici]
              </p>

              <p style="margin: 24px 0 0; color: #666; font-size: 14px; line-height: 1.6;">
                L'équipe PronoHub
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
  }
]

/**
 * Ciblage des utilisateurs pour les communications
 */
export interface TargetingFilters {
  // Tournois
  hasActiveTournament?: boolean
  hasNoActiveTournament?: boolean
  tournamentTypes?: ('FREE_KICK' | 'ONE_SHOT' | 'PLATINUM' | 'TEAM_ELITE')[]

  // Activité
  inactiveDays?: number // Users inactifs depuis X jours
  activeDays?: number // Users actifs dans les X derniers jours

  // Notifications
  hasFcmToken?: boolean // A un token FCM (Android)
  hasNoFcmToken?: boolean

  // Engagement
  minPredictions?: number
  minTournaments?: number
  hasTrophies?: boolean

  // Dates
  registeredAfter?: string
  registeredBefore?: string

  // Spécifique
  userIds?: string[] // Liste d'IDs spécifiques
  excludeUserIds?: string[] // Exclure des IDs
}

export const TARGETING_PRESETS = [
  {
    id: 'all',
    name: 'Tous les utilisateurs',
    description: 'Envoyer à tous les utilisateurs avec email',
    filters: {}
  },
  {
    id: 'active_players',
    name: 'Joueurs actifs',
    description: 'Utilisateurs avec un tournoi actif',
    filters: { hasActiveTournament: true }
  },
  {
    id: 'inactive_7days',
    name: 'Inactifs 7 jours',
    description: 'Utilisateurs inactifs depuis 7 jours',
    filters: { inactiveDays: 7 }
  },
  {
    id: 'inactive_30days',
    name: 'Inactifs 30 jours',
    description: 'Utilisateurs inactifs depuis 30 jours',
    filters: { inactiveDays: 30 }
  },
  {
    id: 'android_only',
    name: 'Android uniquement',
    description: 'Utilisateurs avec l\'app Android (FCM token)',
    filters: { hasFcmToken: true }
  },
  {
    id: 'no_active_tournament',
    name: 'Sans tournoi actif',
    description: 'Utilisateurs sans tournoi en cours',
    filters: { hasNoActiveTournament: true }
  }
]
