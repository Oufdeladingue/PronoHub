import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { checkCountryAllowed } from '@/lib/geo'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const redirectTo = requestUrl.searchParams.get('redirectTo')
  const source = requestUrl.searchParams.get('source')
  const origin = requestUrl.origin
  const isCapacitor = source === 'capacitor'

  if (code) {
    const supabase = await createClient()
    const { data: sessionData } = await supabase.auth.exchangeCodeForSession(code)

    // Vérifier la restriction par pays (via Cloudflare cf-ipcountry)
    const countryCheck = await checkCountryAllowed(request)
    if (!countryCheck.allowed) {
      await supabase.auth.signOut()
      const msg = countryCheck.message || "PronoHub n'est pas encore disponible dans votre pays."
      if (isCapacitor) {
        // Retour dans l'app avec l'erreur
        return NextResponse.redirect(
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

    // Pour Capacitor : rediriger via custom URL scheme avec les tokens de session
    // Le navigateur externe se ferme et l'app récupère la session
    if (isCapacitor && sessionData?.session) {
      const params = new URLSearchParams({
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
        redirectTo: finalPath,
      })
      return NextResponse.redirect(`pronohub://auth/callback?${params.toString()}`)
    }

    // Pour le web : redirection classique
    return NextResponse.redirect(`${origin}${finalPath}`)
  }

  const finalRedirect = redirectTo ? decodeURIComponent(redirectTo) : '/dashboard'
  if (isCapacitor) {
    return NextResponse.redirect(`pronohub://auth/callback?redirectTo=${encodeURIComponent(finalRedirect)}`)
  }
  return NextResponse.redirect(`${origin}${finalRedirect}`)
}
