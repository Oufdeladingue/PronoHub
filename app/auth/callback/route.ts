import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { checkCountryAllowed } from '@/lib/geo'

/**
 * Génère une page HTML qui redirige vers le custom URL scheme pronohub://
 */
function capacitorRedirectPage(deepLinkUrl: string): Response {
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
    window.location.href = "${intentUrl}";
    setTimeout(function() { window.location.href = "${deepLinkUrl}"; }, 500);
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
  const isCapacitor = source === 'capacitor'

  // Origin publique (important derrière un reverse proxy Coolify/Traefik)
  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https'
  const origin = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : (process.env.NEXT_PUBLIC_APP_URL || requestUrl.origin)

  console.log('[OAuth Callback] START', { code: !!code, origin, rawOrigin: requestUrl.origin, isCapacitor, redirectTo })

  if (code) {
    try {
      const cookieStore = await cookies()
      // Collecter les cookies que Supabase veut poser (session tokens)
      const pendingCookies: Array<{ name: string; value: string; options: any }> = []

      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return cookieStore.getAll()
            },
            setAll(cookiesToSet) {
              pendingCookies.push(...cookiesToSet)
              cookiesToSet.forEach(({ name, value, options }) => {
                try { cookieStore.set(name, value, options) } catch {}
              })
            },
          },
        }
      )

      const { data: sessionData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

      console.log('[OAuth Callback] exchangeCodeForSession', {
        success: !!sessionData?.session,
        userId: sessionData?.user?.id || null,
        error: exchangeError?.message || null,
        cookiesCount: pendingCookies.length,
      })

      if (exchangeError) {
        console.error('[OAuth Callback] Exchange FAILED:', exchangeError.message)
        return NextResponse.redirect(
          `${origin}/auth/login?error=${encodeURIComponent(exchangeError.message)}`
        )
      }

      // Vérifier la restriction par pays
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

      // Pour Capacitor
      if (isCapacitor && sessionData?.session) {
        const params = new URLSearchParams({
          access_token: sessionData.session.access_token,
          refresh_token: sessionData.session.refresh_token,
          redirectTo: finalPath,
        })
        return capacitorRedirectPage(`pronohub://auth/callback?${params.toString()}`)
      }

      // Pour le web : redirect avec cookies EXPLICITEMENT ajoutés à la réponse
      // (cookieStore.set() seul ne suffit pas avec NextResponse.redirect() en self-hosted)
      const response = NextResponse.redirect(`${origin}${finalPath}`)
      pendingCookies.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options)
      })

      console.log('[OAuth Callback] Redirecting to:', `${origin}${finalPath}`, 'with', pendingCookies.length, 'cookies')
      return response

    } catch (error: any) {
      // Attraper TOUT crash pour ne pas perdre l'utilisateur
      console.error('[OAuth Callback] CRASH:', error?.message || error)
      return NextResponse.redirect(
        `${origin}/auth/login?error=${encodeURIComponent(error?.message || 'callback_error')}`
      )
    }
  }

  console.log('[OAuth Callback] No code, redirecting to:', redirectTo || '/dashboard')

  const finalRedirect = redirectTo ? decodeURIComponent(redirectTo) : '/dashboard'
  if (isCapacitor) {
    return capacitorRedirectPage(
      `pronohub://auth/callback?redirectTo=${encodeURIComponent(finalRedirect)}`
    )
  }
  return NextResponse.redirect(`${origin}${finalRedirect}`)
}
