import { createAdminClient } from '@/lib/supabase/server'
import { verifyUnsubscribeToken } from '@/lib/email/unsubscribe'
import { NextResponse } from 'next/server'

/**
 * POST: One-click unsubscribe (RFC 8058)
 * Appelé automatiquement par Gmail/Yahoo quand l'utilisateur clique "Se désinscrire"
 * Désactive TOUTES les notifications email pour cet utilisateur
 */
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')
  const token = searchParams.get('token')

  if (!email || !token) {
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
  }

  if (!verifyUnsubscribeToken(email, token)) {
    return NextResponse.json({ error: 'Token invalide' }, { status: 403 })
  }

  try {
    const supabase = createAdminClient()

    // Trouver l'utilisateur par email
    const { data: user } = await supabase
      .from('profiles')
      .select('id, notification_preferences')
      .eq('email', email)
      .single()

    if (!user) {
      // Chercher dans auth.users si le profil n'a pas d'email direct
      const { data: authData } = await supabase.auth.admin.listUsers()
      const authUser = authData?.users?.find(u => u.email === email)

      if (!authUser) {
        return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 })
      }

      // Mettre à jour via l'id auth
      const prefs = {
        email_reminder: false,
        email_tournament_started: false,
        email_day_recap: false,
        email_tournament_end: false,
        email_invite: false,
        email_player_joined: false,
        email_mention: false,
        email_badge_unlocked: false,
        email_new_matches: false,
      }

      await supabase
        .from('profiles')
        .update({ notification_preferences: prefs })
        .eq('id', authUser.id)

      return NextResponse.json({ success: true })
    }

    // Désactiver toutes les notifications email
    const currentPrefs = (user.notification_preferences as Record<string, boolean>) || {}
    const updatedPrefs = {
      ...currentPrefs,
      email_reminder: false,
      email_tournament_started: false,
      email_day_recap: false,
      email_tournament_end: false,
      email_invite: false,
      email_player_joined: false,
      email_mention: false,
      email_badge_unlocked: false,
      email_new_matches: false,
    }

    await supabase
      .from('profiles')
      .update({ notification_preferences: updatedPrefs })
      .eq('id', user.id)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[Unsubscribe] Erreur:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * GET: Lien cliqué depuis le navigateur
 * Affiche une page de confirmation et redirige vers les paramètres du profil
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')
  const token = searchParams.get('token')

  if (!email || !token || !verifyUnsubscribeToken(email, token)) {
    return new Response(page('Lien invalide', 'Ce lien de désabonnement est invalide ou a expiré.', false), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  // Désabonner directement (même logique que POST)
  try {
    const supabase = createAdminClient()

    // Chercher le user
    const { data: authData } = await supabase.auth.admin.listUsers()
    const authUser = authData?.users?.find(u => u.email === email)

    if (authUser) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('notification_preferences')
        .eq('id', authUser.id)
        .single()

      const currentPrefs = (profile?.notification_preferences as Record<string, boolean>) || {}
      const updatedPrefs = {
        ...currentPrefs,
        email_reminder: false,
        email_tournament_started: false,
        email_day_recap: false,
        email_tournament_end: false,
        email_invite: false,
        email_player_joined: false,
        email_mention: false,
        email_badge_unlocked: false,
        email_new_matches: false,
      }

      await supabase
        .from('profiles')
        .update({ notification_preferences: updatedPrefs })
        .eq('id', authUser.id)
    }
  } catch (err) {
    console.error('[Unsubscribe GET] Erreur:', err)
  }

  return new Response(
    page(
      'Désabonnement confirmé',
      'Tu ne recevras plus d\'emails de notification de PronoHub. Tu peux réactiver les notifications depuis ton profil.',
      true
    ),
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )
}

function page(title: string, message: string, success: boolean): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} - PronoHub</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;">
  <div style="text-align:center;padding:40px 20px;max-width:480px;">
    <img src="https://www.pronohub.club/images/logo.svg" alt="PronoHub" style="width:80px;margin-bottom:24px;" onerror="this.style.display='none'">
    <div style="font-size:48px;margin-bottom:16px;">${success ? '&#9989;' : '&#10060;'}</div>
    <h1 style="font-size:24px;font-weight:700;margin:0 0 12px;color:${success ? '#22c55e' : '#ef4444'};">${title}</h1>
    <p style="font-size:16px;color:#94a3b8;line-height:1.6;margin:0 0 32px;">${message}</p>
    <a href="https://www.pronohub.club/profile" style="display:inline-block;padding:12px 32px;background:#ff9900;color:#000;font-weight:600;border-radius:12px;text-decoration:none;font-size:14px;">Gérer mes préférences</a>
  </div>
</body>
</html>`
}
