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
    await supabase.auth.exchangeCodeForSession(code)

    // Vérifier la restriction par pays (via Cloudflare cf-ipcountry)
    const countryCheck = await checkCountryAllowed(request)
    if (!countryCheck.allowed) {
      await supabase.auth.signOut()
      const msg = countryCheck.message || "PronoHub n'est pas encore disponible dans votre pays."
      return NextResponse.redirect(
        `${origin}/auth/signup?error=${encodeURIComponent(msg)}`
      )
    }
  }

  // Rediriger vers le dashboard (la modale de choix de pseudo s'affichera si nécessaire)
  const finalRedirect = redirectTo ? decodeURIComponent(redirectTo) : '/dashboard'
  return NextResponse.redirect(`${origin}${finalRedirect}`)
}
