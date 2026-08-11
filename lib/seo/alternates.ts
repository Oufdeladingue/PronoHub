import { routing } from '@/i18n/routing'

/**
 * Construction des balises SEO `alternates` (canonical + hreflang) pour une page
 * localisée. Règle métier :
 *  - `canonical` = URL AUTO-RÉFÉRENTE de la locale courante (jamais celle du FR pour
 *    une page /en, /es… sinon Google refuse d'indexer les versions traduites).
 *  - `languages` = hreflang pour TOUTES les langues + `x-default` (→ FR).
 *
 * Routing `as-needed` : le FR (défaut) n'a PAS de préfixe, les autres oui (`/en/…`).
 */
const BASE = 'https://www.pronohub.club'

// Code hreflang par locale (fr → fr-FR, cohérent avec l'existant).
const HREFLANG: Record<string, string> = { fr: 'fr-FR', en: 'en', es: 'es', de: 'de', it: 'it' }

/** URL absolue d'un chemin pour une locale donnée. `path` commence par '/' (ou '/' pour l'accueil). */
export function localizedUrl(locale: string, path: string): string {
  const p = path === '/' ? '' : path
  return locale === routing.defaultLocale ? `${BASE}${p}` : `${BASE}/${locale}${p}`
}

/**
 * `alternates` Next.js pour une page indexable : canonical auto-référent + hreflang complet.
 * @param path chemin sans préfixe de locale (ex '/', '/pricing', '/guides/mon-slug')
 * @param locale locale courante de la page
 */
export function buildAlternates(path: string, locale: string) {
  const languages: Record<string, string> = {}
  for (const loc of routing.locales) {
    languages[HREFLANG[loc] ?? loc] = localizedUrl(loc, path)
  }
  languages['x-default'] = localizedUrl(routing.defaultLocale, path)
  return { canonical: localizedUrl(locale, path), languages }
}
