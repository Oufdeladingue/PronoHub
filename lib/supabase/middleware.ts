import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

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
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session if expired - required for Server Components
  const { data: { user } } = await supabase.auth.getUser()

  // Mettre à jour last_seen_at (throttlé par cookie, max 1 fois / 5 min)
  if (user && !request.nextUrl.pathname.startsWith('/api/')) {
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
      supabaseResponse.cookies.set('last_activity', now.toString(), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 300, // 5 minutes en secondes
        path: '/',
      })
    }
  }

  // Helper: créer une redirection en conservant les cookies de session rafraîchis
  function redirectWithCookies(url: URL) {
    const response = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach(cookie => {
      response.cookies.set(cookie.name, cookie.value)
    })
    return response
  }

  const pathname = request.nextUrl.pathname

  // Si connecté et sur la page d'accueil, rediriger vers le dashboard côté serveur
  // (évite le flash de la landing page)
  if (user && pathname === '/') {
    return redirectWithCookies(new URL('/dashboard', request.url))
  }

  // URL sécurisée du panel admin (définie dans .env.local)
  const adminPath = process.env.ADMIN_PANEL_PATH || 'sys-panel-svspgrn1kzw8'

  // Redirection automatique pour les super admins
  // Exception: Si le paramètre ?as=user est présent, permettre l'accès au dashboard
  if (user && request.nextUrl.pathname === '/dashboard' && !request.nextUrl.searchParams.has('as')) {
    // Récupérer le rôle de l'utilisateur
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    // Si super admin, rediriger vers le panel admin sécurisé
    if (profile?.role === 'super_admin') {
      return redirectWithCookies(new URL(`/${adminPath}`, request.url))
    }
  }

  // Protection du panel admin - Vérifier le rôle super_admin
  if (user && request.nextUrl.pathname.startsWith(`/${adminPath}`)) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    // Si pas super admin, rediriger vers dashboard
    if (profile?.role !== 'super_admin') {
      return redirectWithCookies(new URL('/dashboard', request.url))
    }
  }

  return supabaseResponse
}
