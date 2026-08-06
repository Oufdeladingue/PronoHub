import { type NextRequest, NextResponse } from 'next/server'
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

  // Détection PAYS → langue par défaut : si l'utilisateur n'a pas encore de langue
  // mémorisée (cookie NEXT_LOCALE), on la déduit du pays (cf-ipcountry, fourni par
  // Cloudflare, edge-safe). next-intl la lira ce tour-ci et la persistera.
  // L'utilisateur pourra toujours changer via le sélecteur de langue.
  if (!request.cookies.get('NEXT_LOCALE')) {
    const cfCountry = request.headers.get('cf-ipcountry')
    if (cfCountry && cfCountry !== 'XX' && cfCountry !== 'T1') {
      request.cookies.set('NEXT_LOCALE', localeForCountry(cfCountry))
    }
  }

  // Routing i18n (locale, préfixe /en, cookie NEXT_LOCALE)
  const response = handleI18nRouting(request)

  // Si next-intl décide une redirection (normalisation / détection de langue),
  // on la laisse passer telle quelle.
  if (response.headers.has('location')) {
    return response
  }

  // Session Supabase + gardes d'accès, par-dessus la réponse i18n (locale-aware)
  return await updateSession(request, response)
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
