import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'A propos de PronoHub - Tournois de Pronostics Football',
  description: 'Découvrez PronoHub, l\'application de pronostics football entre amis. Créez des tournois, pronostiquez sur la Ligue 1, Premier League, Champions League et défiez vos amis !',
  alternates: {
    canonical: 'https://www.pronohub.club/about',
  },
  openGraph: {
    title: 'A propos de PronoHub - Tournois de Pronostics Football',
    description: 'Découvrez PronoHub, l\'application de pronostics football entre amis.',
    url: 'https://www.pronohub.club/about',
  },
}

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children
}
