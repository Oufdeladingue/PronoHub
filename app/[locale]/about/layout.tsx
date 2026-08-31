import type { Metadata } from 'next'

// Contenu FR non traduit (FR-only au sitemap) : canonique auto-référente FR + noindex sur
// les variantes de langue (/en/about…) pour éviter le doublon inter-langue en GSC.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const isFr = locale === 'fr'
  return {
    title: 'A propos de PronoHub - Tournois de Pronostics Football',
    description: 'Découvrez PronoHub, l\'application de pronostics football entre amis. Créez des tournois, pronostiquez sur la Ligue 1, Premier League, Champions League et défiez vos amis !',
    alternates: isFr ? { canonical: 'https://www.pronohub.club/about' } : undefined,
    robots: isFr ? undefined : { index: false, follow: true },
    openGraph: {
      title: 'A propos de PronoHub - Tournois de Pronostics Football',
      description: 'Découvrez PronoHub, l\'application de pronostics football entre amis.',
      url: 'https://www.pronohub.club/about',
    },
  }
}

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children
}
