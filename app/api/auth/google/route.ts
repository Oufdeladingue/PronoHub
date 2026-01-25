import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Route proxy pour OAuth Google
 * Masque l'URL Supabase en créant une URL intermédiaire
 *
 * Flow:
 * 1. Client appelle /api/auth/google
 * 2. Serveur génère l'URL OAuth Supabase
 * 3. Serveur redirige vers Google (sans exposer l'URL Supabase)
 * 4. Google redirige vers /auth/callback avec le code
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const redirectTo = requestUrl.searchParams.get('redirectTo')

  try {
    const supabase = await createClient()

    // Générer l'URL OAuth côté serveur
    const origin = requestUrl.origin
    const callbackUrl = redirectTo
      ? `${origin}/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}`
      : `${origin}/auth/callback`

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

    // Rediriger directement vers l'URL OAuth Google
    // L'URL Supabase n'est jamais exposée au client
    return NextResponse.redirect(data.url)
  } catch (err) {
    console.error('[API Google OAuth] Exception:', err)
    const origin = requestUrl.origin
    return NextResponse.redirect(`${origin}/auth/login?error=oauth_failed`)
  }
}
