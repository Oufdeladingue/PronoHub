import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { DEFAULT_ALLOWED_COUNTRIES, getCountryByCode } from '@/lib/countries'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const redirectTo = requestUrl.searchParams.get('redirectTo')
  const origin = requestUrl.origin

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)

    // Vérifier la restriction par pays pour les inscriptions OAuth
    try {
      const forwarded = request.headers.get('x-forwarded-for')
      const realIp = request.headers.get('x-real-ip')
      const ip = forwarded?.split(',')[0]?.trim() || realIp || null

      if (ip && ip !== '127.0.0.1' && ip !== '::1') {
        const geoResponse = await fetch(
          `http://ip-api.com/json/${ip}?fields=status,countryCode,country`
        )

        if (geoResponse.ok) {
          const geoData = await geoResponse.json()

          if (geoData.status === 'success') {
            const countryCode = geoData.countryCode as string

            // Récupérer les pays autorisés
            const adminSupabase = createAdminClient()
            const { data: setting } = await adminSupabase
              .from('admin_settings')
              .select('setting_value')
              .eq('setting_key', 'allowed_countries')
              .single()

            let allowedCountries: string[]
            if (setting?.setting_value) {
              try {
                allowedCountries = JSON.parse(setting.setting_value)
              } catch {
                allowedCountries = DEFAULT_ALLOWED_COUNTRIES
              }
            } else {
              allowedCountries = DEFAULT_ALLOWED_COUNTRIES
            }

            if (!allowedCountries.includes(countryCode)) {
              // Pays non autorisé : déconnecter et rediriger avec erreur
              await supabase.auth.signOut()
              const country = getCountryByCode(countryCode)
              const countryLabel = country ? `${country.flag} ${country.name}` : countryCode
              return NextResponse.redirect(
                `${origin}/auth/signup?error=${encodeURIComponent(`PronoHub n'est pas encore disponible dans votre pays (${countryLabel}).`)}`
              )
            }
          }
        }
      }
    } catch {
      // Fail-open : si la vérification échoue, on laisse passer
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
          // Compte OAuth sans pseudo choisi → rediriger vers choose-username
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

  // Utiliser redirectTo si présent, sinon rediriger vers le dashboard
  const finalRedirect = redirectTo ? decodeURIComponent(redirectTo) : '/dashboard'
  return NextResponse.redirect(`${origin}${finalRedirect}`)
}
