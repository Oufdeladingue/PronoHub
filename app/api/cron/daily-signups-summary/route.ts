import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'
import { ADMIN_EMAIL } from '@/lib/email/admin-templates'

// Cron job qui s'exécute à 12h et 20h pour récapituler les nouvelles inscriptions
// Vérifie les inscriptions depuis la dernière exécution (ou depuis 8h si première exécution du jour)

export async function GET(request: NextRequest) {
  try {
    // Vérifier l'autorisation (seulement depuis Vercel Cron ou en dev)
    const authHeader = request.headers.get('authorization')
    if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Déterminer la période à scanner
    // Si on est entre 12h et 20h, scanner depuis 00h00
    // Si on est après 20h, scanner depuis 12h
    const now = new Date()
    const hour = now.getHours()

    let startTime: Date
    if (hour >= 12 && hour < 20) {
      // Cron de 12h : scanner depuis 00h00 aujourd'hui
      startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
    } else {
      // Cron de 20h : scanner depuis 12h aujourd'hui
      startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0)
    }

    console.log('[Daily Signups] Scanning signups since:', startTime.toISOString())

    // Récupérer les nouveaux inscrits depuis startTime
    const { data: newUsers, error } = await supabase
      .from('profiles')
      .select('id, username, email, created_at')
      .gte('created_at', startTime.toISOString())
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[Daily Signups] Error fetching new users:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('[Daily Signups] New users found:', newUsers.length)

    // Si aucun nouvel inscrit, ne rien envoyer
    if (!newUsers || newUsers.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No new signups',
        count: 0
      })
    }

    // Récupérer les informations d'authentification pour chaque utilisateur
    const usersWithAuth = await Promise.all(
      newUsers.map(async (profile) => {
        const { data: authUser } = await supabase.auth.admin.getUserById(profile.id)
        return {
          ...profile,
          provider: authUser?.user?.app_metadata?.provider || 'unknown'
        }
      })
    )

    // Générer l'email récapitulatif
    const timeRange = hour >= 12 && hour < 20
      ? 'depuis ce matin (00h00)'
      : 'depuis midi (12h00)'

    const html = generateDailySignupEmail(usersWithAuth, timeRange)
    const text = generateDailySignupEmailText(usersWithAuth, timeRange)
    const subject = `📊 ${newUsers.length} nouvelle${newUsers.length > 1 ? 's' : ''} inscription${newUsers.length > 1 ? 's' : ''} PronoHub ${timeRange}`

    // Envoyer l'email
    await sendEmail(ADMIN_EMAIL, subject, html, text)

    console.log('[Daily Signups] Summary email sent to admin')

    return NextResponse.json({
      success: true,
      message: 'Daily signup summary sent',
      count: newUsers.length,
      timeRange
    })
  } catch (error: any) {
    console.error('[Daily Signups] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal error' },
      { status: 500 }
    )
  }
}

function generateDailySignupEmail(users: any[], timeRange: string) {
  const userRows = users.map(user => {
    const createdDate = new Date(user.created_at).toLocaleString('fr-FR', {
      timeZone: 'Europe/Paris',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })

    const providerEmoji = user.provider === 'google' ? '🔵' : '📧'
    const providerLabel = user.provider === 'google' ? 'Google OAuth' : 'Email/Password'

    return `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #2d2d3d;">
          <span style="color: #fff; font-size: 15px; font-weight: 600;">${user.username}</span>
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #2d2d3d;">
          <span style="color: #888; font-size: 14px;">${user.email}</span>
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #2d2d3d;">
          <span style="color: #ff9900; font-size: 14px;">${providerEmoji} ${providerLabel}</span>
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #2d2d3d;">
          <span style="color: #888; font-size: 13px;">${createdDate}</span>
        </td>
      </tr>
    `
  }).join('')

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Récapitulatif inscriptions PronoHub</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 700px; width: 100%; border-collapse: collapse; background-color: #1a1a2e; border-radius: 16px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 30px; text-align: center; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);">
              <h1 style="margin: 0; color: #fff; font-size: 24px; font-weight: 700;">
                📊 Récapitulatif inscriptions
              </h1>
              <p style="margin: 10px 0 0; color: #dcfce7; font-size: 16px;">
                ${users.length} nouvelle${users.length > 1 ? 's' : ''} inscription${users.length > 1 ? 's' : ''} ${timeRange}
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 30px;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background-color: #0f0f1a;">
                    <th style="padding: 12px; text-align: left; color: #888; font-size: 12px; font-weight: 600; text-transform: uppercase;">Username</th>
                    <th style="padding: 12px; text-align: left; color: #888; font-size: 12px; font-weight: 600; text-transform: uppercase;">Email</th>
                    <th style="padding: 12px; text-align: left; color: #888; font-size: 12px; font-weight: 600; text-transform: uppercase;">Méthode</th>
                    <th style="padding: 12px; text-align: left; color: #888; font-size: 12px; font-weight: 600; text-transform: uppercase;">Date</th>
                  </tr>
                </thead>
                <tbody>
                  ${userRows}
                </tbody>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 30px; background-color: #0f0f1a; text-align: center;">
              <p style="margin: 0; color: #666; font-size: 12px;">
                Récapitulatif automatique PronoHub
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
}

function generateDailySignupEmailText(users: any[], timeRange: string) {
  const userList = users.map(user => {
    const createdDate = new Date(user.created_at).toLocaleString('fr-FR', {
      timeZone: 'Europe/Paris'
    })
    const provider = user.provider === 'google' ? 'Google OAuth' : 'Email/Password'
    return `  • ${user.username} (${user.email}) - ${provider} - ${createdDate}`
  }).join('\n')

  return `
📊 Récapitulatif inscriptions PronoHub

${users.length} nouvelle${users.length > 1 ? 's' : ''} inscription${users.length > 1 ? 's' : ''} ${timeRange}

${userList}

---
Récapitulatif automatique PronoHub
  `
}
