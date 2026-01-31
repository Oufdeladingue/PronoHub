/**
 * Script pour envoyer des emails de test pour les nouvelles notifications
 * Usage: node scripts/send-test-notifications.js
 */

const { Resend } = require('resend')
const dotenv = require('dotenv')
const path = require('path')

dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const resend = new Resend(process.env.RESEND_API_KEY)

const TEST_EMAIL = 'kochroman6@gmail.com'
const TEST_USERNAME = 'TestUser'
const TEST_TOURNAMENT_NAME = 'Ligue des Champions 2024'
const TEST_TOURNAMENT_SLUG = 'ligue-champions-2024'

// Configuration des notifications (copié depuis lib/notifications.ts)
const NOTIFICATION_CONFIG = {
  mention: {
    defaultTitle: 'Mention dans une discussion 💬',
    clickAction: '/dashboard', // Sera remplacé dynamiquement par /{tournamentSlug}/opposition?tab=tchat
  },
  badge_unlocked: {
    defaultTitle: 'Nouveau badge débloqué ! 🏅',
    clickAction: '/profile?tab=trophees',
  },
  new_matches: {
    defaultTitle: 'Nouvelles rencontres ajoutées ⚽',
    clickAction: '/dashboard',
  },
}

// Template HTML de base pour les emails de test
function getTestEmailTemplate(title, body, clickActionUrl, context) {
  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #ff9900 0%, #ff6600 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold;">
                ${title}
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">
                Bonjour <strong>${TEST_USERNAME}</strong>,
              </p>

              <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">
                ${body}
              </p>

              <p style="margin: 0 0 30px 0; color: #666666; font-size: 14px; line-height: 1.6; padding: 15px; background-color: #f8f9fa; border-left: 4px solid #ff9900; border-radius: 4px;">
                <strong>Contexte du test :</strong><br>${context}
              </p>

              <!-- CTA Button -->
              <table role="presentation" style="margin: 0 auto;">
                <tr>
                  <td style="border-radius: 8px; background: linear-gradient(135deg, #ff9900 0%, #ff6600 100%);">
                    <a href="https://pronohub.club${clickActionUrl}"
                       style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-weight: bold; font-size: 16px;">
                      Voir maintenant →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 30px; border-top: 1px solid #e5e7eb; text-align: center;">
              <p style="margin: 0; color: #999999; font-size: 12px;">
                Ceci est un email de test envoyé depuis PronoHub
              </p>
              <p style="margin: 10px 0 0 0; color: #999999; font-size: 12px;">
                <a href="https://pronohub.club" style="color: #ff9900; text-decoration: none;">pronohub.club</a>
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
${title}

Bonjour ${TEST_USERNAME},

${body}

Contexte du test : ${context}

Cliquez ici pour voir : https://pronohub.club${clickActionUrl}

---
Ceci est un email de test envoyé depuis PronoHub
pronohub.club
  `

  return { html, text }
}

async function sendEmail(to, subject, html, text) {
  try {
    const { data, error } = await resend.emails.send({
      from: 'PronoHub <noreply@pronohub.club>',
      to,
      subject,
      html,
      text,
      replyTo: 'contact@pronohub.club',
    })

    if (error) {
      console.error('Resend error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, messageId: data?.id }
  } catch (err) {
    console.error('Email send error:', err)
    return { success: false, error: err.message }
  }
}

async function sendTestEmails() {
  console.log('🚀 Envoi des emails de test...\n')

  // 1. Test : Mention dans une discussion
  console.log('📧 1/3 - Envoi du test "Mention dans une discussion"...')
  const mentionConfig = NOTIFICATION_CONFIG.mention
  const mentionTemplate = getTestEmailTemplate(
    mentionConfig.defaultTitle,
    `@JeanDupont t'a mentionné dans la discussion du tournoi "${TEST_TOURNAMENT_NAME}".`,
    `/${TEST_TOURNAMENT_SLUG}/opposition?tab=tchat`,
    'Cet email simule une notification lorsqu\'un utilisateur mentionne un autre utilisateur (@user) dans le chat d\'un tournoi. Le clic redirige vers le tournoi avec l\'onglet chat actif.'
  )

  const result1 = await sendEmail(
    TEST_EMAIL,
    mentionConfig.defaultTitle,
    mentionTemplate.html,
    mentionTemplate.text
  )
  console.log(result1.success ? '✅ Envoyé avec succès' : `❌ Erreur: ${result1.error}`)
  console.log()

  // 2. Test : Nouveau badge débloqué
  console.log('📧 2/3 - Envoi du test "Nouveau badge débloqué"...')
  const badgeConfig = NOTIFICATION_CONFIG.badge_unlocked
  const badgeTemplate = getTestEmailTemplate(
    badgeConfig.defaultTitle,
    'Tu as débloqué le badge "Le Veinard" ! Continue comme ça pour débloquer encore plus de trophées.',
    '/profile?tab=trophees',
    'Cet email simule une notification lorsqu\'un utilisateur débloque un nouveau badge ou trophée. Le clic redirige vers la page profil avec l\'onglet trophées actif.'
  )

  const result2 = await sendEmail(
    TEST_EMAIL,
    badgeConfig.defaultTitle,
    badgeTemplate.html,
    badgeTemplate.text
  )
  console.log(result2.success ? '✅ Envoyé avec succès' : `❌ Erreur: ${result2.error}`)
  console.log()

  // 3. Test : Nouvelles rencontres ajoutées
  console.log('📧 3/3 - Envoi du test "Nouvelles rencontres ajoutées"...')
  const matchesConfig = NOTIFICATION_CONFIG.new_matches
  const matchesTemplate = getTestEmailTemplate(
    matchesConfig.defaultTitle,
    `3 nouveaux matchs ont été ajoutés au tournoi "${TEST_TOURNAMENT_NAME}". N'oublie pas de saisir tes pronostics avant le coup d'envoi !`,
    '/dashboard',
    'Cet email simule une notification lorsque de nouveaux matchs sont ajoutés à un tournoi (ex: phase à élimination directe en Ligue des Champions, ou nouveaux matchs dans une compétition custom). Le clic redirige vers le dashboard.'
  )

  const result3 = await sendEmail(
    TEST_EMAIL,
    matchesConfig.defaultTitle,
    matchesTemplate.html,
    matchesTemplate.text
  )
  console.log(result3.success ? '✅ Envoyé avec succès' : `❌ Erreur: ${result3.error}`)
  console.log()

  console.log('✨ Tous les emails de test ont été envoyés à', TEST_EMAIL)
  console.log('\n📮 Vérifie ta boîte mail (et le dossier spam si besoin)')
}

// Exécuter le script
sendTestEmails().catch(console.error)
