import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { routing } from '@/i18n/routing'

/**
 * Rafraîchit la session Supabase et applique les gardes d'accès (pseudo, admin,
 * redirection landing→dashboard), PAR-DESSUS la réponse produite par le routing
 * i18n (next-intl). La réponse i18n (rewrite de préfixe + cookie NEXT_LOCALE) est
 * conservée : on ne recrée jamais la réponse, on mute juste ses cookies.
 *
 * Locale-aware : les gardes raisonnent sur le chemin SANS préfixe de langue
 * (`/en/dashboard` → `/dashboard`), et les redirections re-préfixent la locale
 * courante pour ne pas éjecter l'utilisateur hors de sa langue.
 */
export async function updateSession(request: NextRequest, response: NextResponse) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session if expired - required for Server Components
  const { data: { user } } = await supabase.auth.getUser()

  // Chemin logique SANS le préfixe de locale (pour toutes les gardes ci-dessous)
  const rawPath = request.nextUrl.pathname
  const seg = rawPath.split('/')[1]
  const hasLocalePrefix = (routing.locales as readonly string[]).includes(seg) && seg !== routing.defaultLocale
  const locale = hasLocalePrefix ? seg : routing.defaultLocale
  const path = hasLocalePrefix ? (rawPath.slice(seg.length + 1) || '/') : rawPath
  // Re-préfixe un chemin logique avec la locale courante (défaut = pas de préfixe)
  const localize = (p: string) => (locale === routing.defaultLocale ? p : `/${locale}${p}`)

  // Helper: créer une redirection en conservant les cookies de session rafraîchis
  function redirectWithCookies(url: URL) {
    const res = NextResponse.redirect(url)
    response.cookies.getAll().forEach(cookie => {
      res.cookies.set(cookie.name, cookie.value)
    })
    return res
  }

  // Mettre à jour last_seen_at (throttlé par cookie, max 1 fois / 5 min)
  if (user && !path.startsWith('/api/')) {
    const lastActivity = request.cookies.get('last_activity')?.value
    const now = Date.now()
    const THROTTLE_MS = 5 * 60 * 1000 // 5 minutes

    if (!lastActivity || now - parseInt(lastActivity, 10) >= THROTTLE_MS) {
      // Await pour garantir l'exécution avant que le runtime Edge ne coupe
      const { error: lastSeenError } = await supabase
        .from('profiles')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', user.id)
      if (lastSeenError) console.error('[middleware] last_seen_at update error:', lastSeenError.message)

      // Poser le cookie de throttle sur la réponse
      response.cookies.set('last_activity', now.toString(), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 300, // 5 minutes en secondes
        path: '/',
      })
    }
  }

  // Forcer la sélection de pseudo avant d'accéder à l'app
  // Cookie cache pour éviter une requête DB à chaque page load
  const isProtectedRoute = path === '/' || path === '/dashboard' || path.startsWith('/vestiaire') || /^\/[^/]+\/opposition/.test(path)
  const hasUsernameCookie = request.cookies.get('username_chosen')?.value === '1'

  if (user && isProtectedRoute && !hasUsernameCookie && !path.startsWith('/auth/') && !path.startsWith('/api/')) {
    const { data: usernameProfile } = await supabase
      .from('profiles')
      .select('has_chosen_username')
      .eq('id', user.id)
      .single()

    if (!usernameProfile || usernameProfile.has_chosen_username !== true) {
      const chooseUrl = new URL(localize('/auth/choose-username'), request.url)
      if (path !== '/') {
        chooseUrl.searchParams.set('redirectTo', rawPath)
      }
      return redirectWithCookies(chooseUrl)
    }

    // Pseudo choisi → poser le cookie pour ne plus refaire la requête
    response.cookies.set('username_chosen', '1', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365, // 1 an
      path: '/',
    })
  }

  // Si connecté et sur la page d'accueil, rediriger vers le dashboard côté serveur
  // (évite le flash de la landing page)
  if (user && path === '/') {
    return redirectWithCookies(new URL(localize('/dashboard'), request.url))
  }

  // URL sécurisée du panel admin (définie dans .env.local)
  const adminPath = process.env.ADMIN_PANEL_PATH || 'sys-panel-svspgrn1kzw8'

  // Redirection automatique pour les super admins
  // Exception: Si le paramètre ?as=user est présent, permettre l'accès au dashboard
  if (user && path === '/dashboard' && !request.nextUrl.searchParams.has('as')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    // Si super admin, rediriger vers le panel admin sécurisé (toujours en FR)
    if (profile?.role === 'super_admin') {
      return redirectWithCookies(new URL(`/${adminPath}`, request.url))
    }
  }

  // Protection du panel admin - Vérifier le rôle super_admin
  if (user && path.startsWith(`/${adminPath}`)) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    // Si pas super admin, rediriger vers dashboard
    if (profile?.role !== 'super_admin') {
      return redirectWithCookies(new URL(localize('/dashboard'), request.url))
    }
  }

  return response
}
