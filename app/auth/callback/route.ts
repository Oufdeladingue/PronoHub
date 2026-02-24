import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { checkCountryAllowed } from '@/lib/geo'

/**
 * Génère une page HTML qui redirige vers le custom URL scheme pronohub://
 * Chrome Android bloque les HTTP redirects (302) vers des schémas custom,
 * mais autorise les navigations via JavaScript ou intent://
 */
function capacitorRedirectPage(deepLinkUrl: string): Response {
  // Intent URL Android (plus fiable que le custom scheme direct)
  const url = new URL(deepLinkUrl)
  const intentUrl = `intent://${url.host}${url.pathname}?${url.searchParams.toString()}#Intent;scheme=pronohub;package=club.pronohub.app;end`

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Retour à PronoHub</title>
</head>
<body style="background:#0a0a0a;color:#fff;font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
  <div style="text-align:center;padding:20px;">
    <img src="https://www.pronohub.club/images/logo-white.svg" alt="PronoHub" style="width:120px;margin-bottom:24px;" onerror="this.style.display='none'">
    <p style="font-size:16px;margin-bottom:16px;">Redirection vers PronoHub...</p>
    <p id="fallback" style="display:none;margin-top:20px;">
      <a href="${deepLinkUrl}" style="color:#ff9900;text-decoration:underline;font-size:14px;">Appuyer ici pour revenir à l'app</a>
    </p>
  </div>
  <script>
    // Tenter via intent Android (plus fiable)
    window.location.href = "${intentUrl}";
    // Fallback: tenter le custom scheme direct après 500ms
    setTimeout(function() { window.location.href = "${deepLinkUrl}"; }, 500);
    // Afficher le lien manuel après 2s si rien n'a fonctionné
    setTimeout(function() { document.getElementById('fallback').style.display = 'block'; }, 2000);
  </script>
</body>
</html>`

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const redirectTo = requestUrl.searchParams.get('redirectTo')
  const source = requestUrl.searchParams.get('source')
  const origin = requestUrl.origin
  const isCapacitor = source === 'capacitor'

  if (code) {
    // createClient() utilise cookieStore.set() en interne, que Next.js
    // fusionne automatiquement dans la réponse HTTP (y compris les redirects)
    const supabase = await createClient()
    const { data: sessionData } = await supabase.auth.exchangeCodeForSession(code)

    // Vérifier la restriction par pays (via Cloudflare cf-ipcountry)
    const countryCheck = await checkCountryAllowed(request)
    if (!countryCheck.allowed) {
      await supabase.auth.signOut()
      const msg = countryCheck.message || "PronoHub n'est pas encore disponible dans votre pays."
      if (isCapacitor) {
        return capacitorRedirectPage(
          `pronohub://auth/callback?error=${encodeURIComponent(msg)}`
        )
      }
      return NextResponse.redirect(
        `${origin}/auth/signup?error=${encodeURIComponent(msg)}`
      )
    }

    // Déterminer la page de redirection
    let finalPath = redirectTo ? decodeURIComponent(redirectTo) : '/dashboard'

    if (sessionData?.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('has_chosen_username')
        .eq('id', sessionData.user.id)
        .single()

      if (profile && profile.has_chosen_username !== true) {
        finalPath = redirectTo
          ? `/auth/choose-username?redirectTo=${encodeURIComponent(redirectTo)}`
          : '/auth/choose-username'
      }
    }

    // Pour Capacitor : page HTML qui redirige via JavaScript/intent vers l'app
    if (isCapacitor && sessionData?.session) {
      const params = new URLSearchParams({
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
        redirectTo: finalPath,
      })
      return capacitorRedirectPage(`pronohub://auth/callback?${params.toString()}`)
    }

    // Pour le web : rediriger vers la page login avec oauthDone=1
    // La page login affichera le loader immédiatement, vérifiera la session
    // (cookies posés par createClient/cookieStore.set), puis naviguera en client-side
    // vers le dashboard → pas de flash de la landing page.
    const loginUrl = `${origin}/auth/login?oauthDone=1&continue=${encodeURIComponent(finalPath)}`
    return NextResponse.redirect(loginUrl)
  }

  const finalRedirect = redirectTo ? decodeURIComponent(redirectTo) : '/dashboard'
  if (isCapacitor) {
    return capacitorRedirectPage(
      `pronohub://auth/callback?redirectTo=${encodeURIComponent(finalRedirect)}`
    )
  }
  return NextResponse.redirect(`${origin}${finalRedirect}`)
}
