import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  console.log('[MIDDLEWARE] Supabase URL:', supabaseUrl)
  console.log('[MIDDLEWARE] Key exists:', !!supabaseKey)

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
      return NextResponse.redirect(new URL(`/${adminPath}`, request.url))
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
      console.warn(`[SECURITY] Tentative d'accès non autorisée au panel admin par ${user.email}`)
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Log des accès admin pour la sécurité
    console.log(`[ADMIN ACCESS] ${user.email} a accédé à ${request.nextUrl.pathname}`)
  }

  return supabaseResponse
}
