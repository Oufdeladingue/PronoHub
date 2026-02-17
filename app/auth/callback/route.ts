import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { checkCountryAllowed } from '@/lib/geo'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const redirectTo = requestUrl.searchParams.get('redirectTo')
  const origin = requestUrl.origin

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)

    // Vérifier la restriction par pays (fail-closed via geoip-lite)
    const countryCheck = await checkCountryAllowed(request)
    if (!countryCheck.allowed) {
      // Pays non autorisé ou indétectable : déconnecter et rediriger
      await supabase.auth.signOut()
      const msg = countryCheck.message || "PronoHub n'est pas encore disponible dans votre pays."
      return NextResponse.redirect(
        `${origin}/auth/signup?error=${encodeURIComponent(msg)}`
      )
    }
  }

  // Vérifier si l'utilisateur a un username (nécessaire pour les nouveaux comptes OAuth)
  if (code) {
    try {
      const supabaseCheck = await createClient()
      const { data: { user } } = await supabaseCheck.auth.getUser()
      if (user) {
        const adminSupabase = createAdminClient()
        const { data: profile } = await adminSupabase
          .from('profiles')
          .select('has_chosen_username')
          .eq('id', user.id)
          .single()

        if (profile && profile.has_chosen_username === false) {
          const chooseUsernameUrl = redirectTo
            ? `/auth/choose-username?redirectTo=${encodeURIComponent(redirectTo)}`
            : '/auth/choose-username'
          return NextResponse.redirect(`${origin}${chooseUsernameUrl}`)
        }
      }
    } catch {
      // En cas d'erreur, continuer vers le dashboard
    }
  }

  const finalRedirect = redirectTo ? decodeURIComponent(redirectTo) : '/dashboard'
  return NextResponse.redirect(`${origin}${finalRedirect}`)
}
