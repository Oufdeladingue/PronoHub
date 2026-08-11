import type { MetadataRoute } from 'next'
import { getCompetitions } from '@/lib/seo/pronostics-content'
import { getGuides } from '@/lib/seo/guides-content'
import { routing } from '@/i18n/routing'
import { localizedUrl } from '@/lib/seo/alternates'

const HREFLANG: Record<string, string> = { fr: 'fr-FR', en: 'en', es: 'es', de: 'de', it: 'it' }

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://www.pronohub.club'
  const now = new Date().toISOString()

  /**
   * Entrée localisée : URL FR (canonique) + annotations hreflang `alternates.languages`
   * pour TOUTES les langues + x-default → Google relie les traductions et les indexe.
   */
  const localized = (
    path: string,
    changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'],
    priority: number,
  ): MetadataRoute.Sitemap[number] => {
    const languages: Record<string, string> = {}
    for (const loc of routing.locales) languages[HREFLANG[loc] ?? loc] = localizedUrl(loc, path)
    languages['x-default'] = localizedUrl(routing.defaultLocale, path)
    return {
      url: localizedUrl(routing.defaultLocale, path),
      lastModified: now,
      changeFrequency,
      priority,
      alternates: { languages },
    }
  }

  // Slugs identiques entre langues.
  const competitions = getCompetitions('fr')
  const guides = getGuides('fr')

  // Pages localisées (contenu multilingue FR/EN/ES/DE/IT).
  const localizedPages: MetadataRoute.Sitemap = [
    localized('/', 'weekly', 1.0),
    localized('/pronostics', 'weekly', 0.9),
    ...competitions.map((c) => localized(`/pronostics/${c.slug}`, 'weekly', 0.8)),
    localized('/guides', 'monthly', 0.7),
    ...guides.map((g) => localized(`/guides/${g.slug}`, 'monthly', 0.7)),
    localized('/pricing', 'monthly', 0.7),
    localized('/privacy', 'yearly', 0.3),
    localized('/cgv', 'yearly', 0.3),
  ]

  // Pages non localisées (FR uniquement).
  const frOnly: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/auth/login`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/auth/signup`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/contact`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
  ]

  return [...localizedPages, ...frOnly]
}
