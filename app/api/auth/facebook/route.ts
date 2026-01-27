import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Route proxy pour OAuth Facebook
 * Même pattern que /api/auth/google — masque l'URL Supabase
 *
 * Flow:
 * 1. Client appelle /api/auth/facebook
 * 2. Serveur génère l'URL OAuth Supabase pour Facebook
 * 3. Serveur redirige vers Facebook (sans exposer l'URL Supabase)
 * 4. Facebook redirige vers /auth/callback avec le code
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const redirectTo = requestUrl.searchParams.get('redirectTo')

  try {
    const supabase = await createClient()

    const origin = requestUrl.origin
    const callbackUrl = redirectTo
      ? `${origin}/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}`
      : `${origin}/auth/callback`

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'facebook',
      options: {
        redirectTo: callbackUrl,
        skipBrowserRedirect: true,
        scopes: 'email,public_profile',
      },
    })

    if (error) {
      console.error('[API Facebook OAuth] Erreur:', error)
      return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent(error.message)}`)
    }

    if (!data.url) {
      return NextResponse.redirect(`${origin}/auth/login?error=no_oauth_url`)
    }

    return NextResponse.redirect(data.url)
  } catch (err) {
    console.error('[API Facebook OAuth] Exception:', err)
    const origin = requestUrl.origin
    return NextResponse.redirect(`${origin}/auth/login?error=oauth_failed`)
  }
}
