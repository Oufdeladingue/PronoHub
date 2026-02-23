import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { checkCountryAllowed } from '@/lib/geo'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const redirectTo = requestUrl.searchParams.get('redirectTo')
  const origin = requestUrl.origin

  if (code) {
    const supabase = await createClient()
    const { data: sessionData } = await supabase.auth.exchangeCodeForSession(code)

    // Vérifier la restriction par pays (via Cloudflare cf-ipcountry)
    const countryCheck = await checkCountryAllowed(request)
    if (!countryCheck.allowed) {
      await supabase.auth.signOut()
      const msg = countryCheck.message || "PronoHub n'est pas encore disponible dans votre pays."
      return NextResponse.redirect(
        `${origin}/auth/signup?error=${encodeURIComponent(msg)}`
      )
    }

    // Vérifier si l'utilisateur a déjà choisi son pseudo (OAuth)
    if (sessionData?.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('has_chosen_username')
        .eq('id', sessionData.user.id)
        .single()

      if (profile && profile.has_chosen_username !== true) {
        const chooseUsernameUrl = redirectTo
          ? `/auth/choose-username?redirectTo=${encodeURIComponent(redirectTo)}`
          : '/auth/choose-username'
        return NextResponse.redirect(`${origin}${chooseUsernameUrl}`)
      }
    }
  }

  const finalRedirect = redirectTo ? decodeURIComponent(redirectTo) : '/dashboard'
  return NextResponse.redirect(`${origin}${finalRedirect}`)
}
