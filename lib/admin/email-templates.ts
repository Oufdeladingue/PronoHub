/**
 * Templates d'email prédéfinis pour les communications admin
 * Les templates utilisent [CONTENT] comme placeholder pour le contenu WYSIWYG
 * et [CTA_TEXT]/[CTA_URL] pour le bouton d'action
 */

export interface EmailTemplate {
  id: string
  name: string
  description: string
  subject: string
  previewText: string
  html: string
  defaultContent: string
}

/**
 * Palette de couleurs du thème email
 */
export const EMAIL_COLORS = [
  { color: '#ff9900', label: 'Orange' },
  { color: '#ff6600', label: 'Orange foncé' },
  { color: '#e0e0e0', label: 'Gris clair' },
  { color: '#94a3b8', label: 'Gris bleu' },
  { color: '#64748b', label: 'Gris' },
  { color: '#1a1a2e', label: 'Bleu nuit' },
  { color: '#0f172a', label: 'Bleu foncé' },
  { color: '#0a0a0a', label: 'Noir' },
  { color: '#ffffff', label: 'Blanc' },
  { color: '#000000', label: 'Noir pur' },
]

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: 'blank',
    name: 'Vide',
    description: 'Partir de zéro',
    subject: '',
    previewText: '',
    html: '',
    defaultContent: ''
  },
  {
    id: 'announcement',
    name: 'Annonce',
    description: 'Annonce générale colorée',
    subject: '🎉 Nouvelle annonce PronoHub',
    previewText: 'Découvrez les dernières nouveautés',
    defaultContent: `<p>Salut <strong>[username]</strong> ! 👋</p><p>Nous avons une annonce importante à te partager...</p><p>À bientôt sur PronoHub ! ⚽</p>`,
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
            <td style="padding: 40px; color: #e0e0e0; font-size: 16px; line-height: 1.6;">
              [CONTENT]

              <!-- CTA Button -->
              <div style="text-align: center; margin: 32px 0;">
                <a href="[CTA_URL]" style="display: inline-block; background: linear-gradient(135deg, #ff9900 0%, #ff6600 100%); color: #000; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(255, 153, 0, 0.3);">
                  [CTA_TEXT]
                </a>
              </div>
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
    defaultContent: `<p>Bonjour <strong>[username]</strong>,</p><p>Votre message ici...</p><p>L'équipe PronoHub</p>`,
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
            <td style="padding: 40px; color: #333; font-size: 16px; line-height: 1.6;">
              <img src="https://www.pronohub.club/images/logo.svg" alt="PronoHub" style="width: 60px; height: 60px; display: block; margin: 0 0 24px;">

              [CONTENT]
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
 * Combine un template avec le contenu WYSIWYG et les valeurs CTA
 * pour produire le HTML final de l'email
 */
export function buildEmailHtml(
  templateId: string | null,
  contentHtml: string,
  ctaText?: string,
  ctaUrl?: string
): string {
  const template = EMAIL_TEMPLATES.find(t => t.id === templateId)

  // Template blank ou inconnu → retourner juste le contenu
  if (!template || !template.html) {
    return contentHtml
  }

  let html = template.html
    .replace('[CONTENT]', contentHtml)

  if (ctaText) {
    html = html.replace(/\[CTA_TEXT\]/gi, ctaText)
  }
  if (ctaUrl) {
    html = html.replace(/\[CTA_URL\]/gi, ctaUrl)
  }

  return html
}

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
