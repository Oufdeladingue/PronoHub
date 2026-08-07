import type { MetadataRoute } from 'next'
import { getCompetitions } from '@/lib/seo/pronostics-content'
import { getGuides } from '@/lib/seo/guides-content'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://www.pronohub.club'
  const now = new Date().toISOString()

  // Les slugs sont identiques FR/EN → on décline chaque page en FR (racine) + EN (/en/…).
  const competitions = getCompetitions('fr')
  const guides = getGuides('fr')

  // Pages de contenu SEO (hub + une page par compétition + guides), FR puis miroir EN.
  const pronostics: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/pronostics`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${baseUrl}/en/pronostics`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    ...competitions.flatMap((c) => [
      {
        url: `${baseUrl}/pronostics/${c.slug}`,
        lastModified: now,
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      },
      {
        url: `${baseUrl}/en/pronostics/${c.slug}`,
        lastModified: now,
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      },
    ]),
    { url: `${baseUrl}/guides`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/en/guides`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    ...guides.flatMap((g) => [
      {
        url: `${baseUrl}/guides/${g.slug}`,
        lastModified: now,
        changeFrequency: 'monthly' as const,
        priority: 0.7,
      },
      {
        url: `${baseUrl}/en/guides/${g.slug}`,
        lastModified: now,
        changeFrequency: 'monthly' as const,
        priority: 0.7,
      },
    ]),
  ]

  return [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    ...pronostics,
    {
      url: `${baseUrl}/auth/login`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/auth/signup`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/pricing`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/cgv`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ]
}
