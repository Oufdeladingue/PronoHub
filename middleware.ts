import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import createMiddleware from 'next-intl/middleware'
import { routing } from '@/i18n/routing'
import { updateSession } from '@/lib/supabase/middleware'
import { localeForCountry } from '@/lib/i18n/country-locale'

const handleI18nRouting = createMiddleware(routing)

export async function middleware(request: NextRequest) {
  const host = request.headers.get('host') || ''

  // Rediriger pronohub.club vers www.pronohub.club pour cohérence des cookies
  // Aussi gérer le cas où le port interne (3000) est exposé
  if (host === 'pronohub.club' || host.startsWith('pronohub.club:') ||
      host === 'www.pronohub.club:3000' || host.startsWith('www.pronohub.club:')) {
    const pathname = request.nextUrl.pathname
    const search = request.nextUrl.search
    const redirectUrl = `https://www.pronohub.club${pathname}${search}`
    return NextResponse.redirect(redirectUrl, 301)
  }

  // Les routes API ne sont pas localisées : on saute next-intl et on garde
  // uniquement le rafraîchissement de session (comportement historique).
  if (request.nextUrl.pathname.startsWith('/api')) {
    return await updateSession(request, NextResponse.next({ request }))
  }

  // Détermination de la langue quand aucune n'est encore mémorisée (cookie NEXT_LOCALE
  // absent = premier passage / nouvel appareil / cookies effacés). Priorité :
  //   1. Préférence ENREGISTRÉE du compte (profiles.locale) → persistance cross-device
  //   2. PAYS détecté (cf-ipcountry Cloudflare, edge-safe)
  // next-intl lira le cookie ce tour-ci (appliqué dès cette requête, sans flash) et le
  // persistera. L'utilisateur peut toujours changer via le sélecteur de langue.
  let seededLocale: string | null = null
  if (!request.cookies.get('NEXT_LOCALE')) {
    let seeded: string | null = null

    // 1. Préférence du compte connecté (autoritaire). getUser uniquement ici (chemin rare
    //    « pas de cookie »), donc coût négligeable ; setAll no-op car lecture seule
    //    (updateSession rafraîchira/persistera la session juste après).
    try {
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { getAll: () => request.cookies.getAll(), setAll: () => {} } }
      )
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('locale').eq('id', user.id).single()
        if (profile?.locale && (routing.locales as readonly string[]).includes(profile.locale)) {
          seeded = profile.locale
        }
      }
    } catch {
      // best-effort : on retombe sur la détection pays
    }

    // 2. Détection pays si pas de préférence enregistrée
    if (!seeded) {
      const cfCountry = request.headers.get('cf-ipcountry')
      if (cfCountry && cfCountry !== 'XX' && cfCountry !== 'T1') {
        seeded = localeForCountry(cfCountry)
      }
    }

    if (seeded) {
      request.cookies.set('NEXT_LOCALE', seeded)
      seededLocale = seeded
    }
  }

  // Persiste la locale semée sur la réponse pour que les requêtes suivantes aient le
  // cookie (le getUser ci-dessus ne s'exécute donc qu'une seule fois par appareil).
  const persistSeed = (res: NextResponse) => {
    if (seededLocale) {
      res.cookies.set('NEXT_LOCALE', seededLocale, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
    }
    return res
  }

  // Routing i18n (locale, préfixe /en, cookie NEXT_LOCALE)
  const response = handleI18nRouting(request)

  // Si next-intl décide une redirection (normalisation / détection de langue),
  // on la laisse passer telle quelle.
  if (response.headers.has('location')) {
    return persistSeed(response)
  }

  // Session Supabase + gardes d'accès, par-dessus la réponse i18n (locale-aware)
  return persistSeed(await updateSession(request, response))
}

export const config = {
  matcher: [
    /*
     * Toutes les requêtes sauf :
     * - _next/static, _next/image (fichiers statiques)
     * - ingest (proxy PostHog)
     * - favicon.ico et fichiers image
     * (les routes /api sont incluses mais traitées à part, sans i18n)
     */
    '/((?!_next/static|_next/image|ingest|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
