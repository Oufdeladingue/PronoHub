import type { MetadataRoute } from 'next'
import { COMPETITIONS_SEO } from '@/lib/seo/pronostics-content'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://www.pronohub.club'
  const now = new Date().toISOString()

  // Pages de contenu SEO (hub + une page par compétition)
  const pronostics: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/pronostics`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    ...COMPETITIONS_SEO.map((c) => ({
      url: `${baseUrl}/pronostics/${c.slug}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
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
