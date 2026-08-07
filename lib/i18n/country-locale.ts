import { routing, type Locale } from '@/i18n/routing'

/**
 * Pays à contenu francophone → langue FR par défaut.
 * (France + francophones + DOM-TOM.)
 */
const FRENCH_COUNTRIES = new Set([
  'FR', 'BE', 'CH', 'CA', 'LU', 'MC',
  'RE', 'GP', 'MQ', 'GF', 'YT', 'NC', 'PF',
])

/**
 * Pays hispanophones → langue ES par défaut.
 * (Espagne + Amérique latine hispanophone + Guinée équatoriale.)
 */
const SPANISH_COUNTRIES = new Set([
  'ES',
  'MX', 'AR', 'CO', 'CL', 'PE', 'VE', 'EC', 'GT', 'CU', 'BO',
  'DO', 'HN', 'PY', 'SV', 'NI', 'CR', 'PA', 'UY', 'PR', 'GQ',
])

/**
 * Pays germanophones → langue DE par défaut.
 * (Allemagne, Autriche, Liechtenstein. La Suisse et le Luxembourg restent
 * mappés FR ci-dessus, vérifiés en premier — choix produit.)
 */
const GERMAN_COUNTRIES = new Set([
  'DE', 'AT', 'LI',
])

/**
 * Pays italophones → langue IT par défaut.
 * (Italie, Saint-Marin, Vatican. La Suisse reste mappée FR ci-dessus.)
 */
const ITALIAN_COUNTRIES = new Set([
  'IT', 'SM', 'VA',
])

/**
 * Langue par défaut à partir du pays détecté (cf-ipcountry).
 * - Pays francophone → 'fr'
 * - Autre marché ouvert → 'en' (langue passerelle tant qu'ES/IT/DE ne sont pas produites)
 * - Pays inconnu → défaut (fr)
 *
 * NB: quand une nouvelle langue est produite, mapper ici les pays concernés
 * (ex: ES/AR → 'es', IT → 'it', DE/AT → 'de').
 */
export function localeForCountry(country: string | null | undefined): Locale {
  if (!country) return routing.defaultLocale
  const cc = country.toUpperCase()
  if (FRENCH_COUNTRIES.has(cc)) return 'fr'
  if (SPANISH_COUNTRIES.has(cc)) return 'es'
  if (GERMAN_COUNTRIES.has(cc)) return 'de'
  if (ITALIAN_COUNTRIES.has(cc)) return 'it'
  return 'en'
}
