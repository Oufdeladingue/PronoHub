import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email/send'
import { NOTIFICATION_CONFIG } from '@/lib/notifications'

const TEST_EMAIL = 'kochroman6@gmail.com'
const TEST_USERNAME = 'TestUser'
const TEST_TOURNAMENT_NAME = 'Ligue des Champions 2024'
const TEST_TOURNAMENT_SLUG = 'ligue-champions-2024'

// Template HTML de base pour les emails de test
function getTestEmailTemplate(
  title: string,
  body: string,
  clickActionUrl: string,
  context: string
): { html: string; text: string } {
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
          <tr>
            <td style="background: linear-gradient(135deg, #ff9900 0%, #ff6600 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold;">
                ${title}
              </h1>
            </td>
          </tr>
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

// Template spécial pour badge avec image
function getBadgeEmailTemplate(
  title: string,
  body: string,
  clickActionUrl: string,
  context: string,
  badgeName: string,
  badgeImageUrl: string
): { html: string; text: string } {
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
          <tr>
            <td style="background: linear-gradient(135deg, #ff9900 0%, #ff6600 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold;">
                ${title}
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">
                Bonjour <strong>${TEST_USERNAME}</strong>,
              </p>
              <p style="margin: 0 0 30px 0; color: #333333; font-size: 16px; line-height: 1.6;">
                ${body}
              </p>

              <!-- Badge Image -->
              <table role="presentation" style="margin: 0 auto 30px; text-align: center;">
                <tr>
                  <td style="padding: 20px; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 16px; box-shadow: 0 8px 24px rgba(0,0,0,0.2);">
                    <img src="${badgeImageUrl}" alt="${badgeName}" style="width: 120px; height: 120px; display: block; margin: 0 auto 15px;" />
                    <p style="margin: 0; color: #f5b800; font-size: 18px; font-weight: bold;">${badgeName}</p>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 30px 0; color: #666666; font-size: 14px; line-height: 1.6; padding: 15px; background-color: #f8f9fa; border-left: 4px solid #ff9900; border-radius: 4px;">
                <strong>Contexte du test :</strong><br>${context}
              </p>
              <table role="presentation" style="margin: 0 auto;">
                <tr>
                  <td style="border-radius: 8px; background: linear-gradient(135deg, #ff9900 0%, #ff6600 100%);">
                    <a href="https://pronohub.club${clickActionUrl}"
                       style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-weight: bold; font-size: 16px;">
                      Voir mes trophées →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
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

Badge débloqué: ${badgeName}

Contexte du test : ${context}

Cliquez ici pour voir : https://pronohub.club${clickActionUrl}

---
Ceci est un email de test envoyé depuis PronoHub
pronohub.club
  `

  return { html, text }
}

export async function GET(request: NextRequest) {
  try {
    const results = []

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
    results.push({
      type: 'mention',
      success: result1.success,
      error: result1.error,
      messageId: result1.messageId
    })

    // 2. Test : Nouveau badge débloqué (avec image)
    console.log('📧 2/3 - Envoi du test "Nouveau badge débloqué"...')
    const badgeConfig = NOTIFICATION_CONFIG.badge_unlocked
    const badgeTemplate = getBadgeEmailTemplate(
      badgeConfig.defaultTitle,
      'Tu as débloqué le badge "Le Veinard" ! Continue comme ça pour débloquer encore plus de trophées.',
      '/profile?tab=trophees',
      'Cet email simule une notification lorsqu\'un utilisateur débloque un nouveau badge ou trophée. Le clic redirige vers la page profil avec l\'onglet trophées actif.',
      'Le Veinard',
      'https://www.pronohub.club/trophy/bon-resultat.png'
    )

    const result2 = await sendEmail(
      TEST_EMAIL,
      badgeConfig.defaultTitle,
      badgeTemplate.html,
      badgeTemplate.text
    )
    results.push({
      type: 'badge_unlocked',
      success: result2.success,
      error: result2.error,
      messageId: result2.messageId
    })

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
    results.push({
      type: 'new_matches',
      success: result3.success,
      error: result3.error,
      messageId: result3.messageId
    })

    const allSuccess = results.every(r => r.success)
    const sentCount = results.filter(r => r.success).length

    return NextResponse.json({
      success: allSuccess,
      message: `${sentCount}/3 emails envoyés à ${TEST_EMAIL}`,
      results
    })
  } catch (error: any) {
    console.error('Error sending test emails:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
