import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

/**
 * Route proxy pour OAuth Google
 * Masque l'URL Supabase en créant une URL intermédiaire
 *
 * Flow:
 * 1. Client appelle /api/auth/google
 * 2. Serveur génère l'URL OAuth Supabase (+ stocke le code_verifier PKCE en cookie)
 * 3. Serveur redirige vers Google (sans exposer l'URL Supabase)
 * 4. Google redirige vers /auth/callback avec le code
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const redirectTo = requestUrl.searchParams.get('redirectTo')
  const source = requestUrl.searchParams.get('source')

  // Origin publique (important derrière un reverse proxy Coolify/Traefik)
  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https'
  const origin = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : (process.env.NEXT_PUBLIC_APP_URL || requestUrl.origin)

  console.log('[API Google OAuth] origin:', origin, '| raw:', requestUrl.origin)

  try {
    const cookieStore = await cookies()
    // Collecter les cookies PKCE que Supabase va poser via setAll
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

    // Générer l'URL OAuth côté serveur
    const callbackParams = new URLSearchParams()
    if (redirectTo) callbackParams.set('redirectTo', redirectTo)
    if (source) callbackParams.set('source', source)
    const callbackQuery = callbackParams.toString()
    const callbackUrl = `${origin}/auth/callback${callbackQuery ? `?${callbackQuery}` : ''}`

    console.log('[API Google OAuth] callbackUrl:', callbackUrl)

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: callbackUrl,
        skipBrowserRedirect: true,
      },
    })

    if (error) {
      console.error('[API Google OAuth] Erreur:', error)
      return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent(error.message)}`)
    }

    if (!data.url) {
      return NextResponse.redirect(`${origin}/auth/login?error=no_oauth_url`)
    }

    // IMPORTANT: Ajouter les cookies PKCE (code_verifier) explicitement au redirect
    // Sans ça, le navigateur ne reçoit pas le cookie et exchangeCodeForSession échoue
    const response = NextResponse.redirect(data.url)
    pendingCookies.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options)
    })

    console.log('[API Google OAuth] Redirecting to Google, cookies set:', pendingCookies.map(c => c.name))
    return response
  } catch (err) {
    console.error('[API Google OAuth] Exception:', err)
    return NextResponse.redirect(`${origin}/auth/login?error=oauth_failed`)
  }
}
