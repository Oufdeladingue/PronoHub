import type { Metadata } from 'next'

// Page au contenu FR non traduit (FR-only dans le sitemap). On garde une canonique
// auto-référente pour la version FR, et on met les variantes de langue (/en/contact…)
// en noindex : ce sont le MÊME contenu FR à des URLs étrangères → sinon Google les
// classe « autre page avec balise canonique correcte » (doublon inter-langue).
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const isFr = locale === 'fr'
  return {
    title: 'Contact - PronoHub Football',
    description: 'Contactez l\'équipe PronoHub pour toute question, suggestion ou demande de partenariat. Nous sommes à votre écoute !',
    alternates: isFr ? { canonical: 'https://www.pronohub.club/contact' } : undefined,
    robots: isFr ? undefined : { index: false, follow: true },
    openGraph: {
      title: 'Contact - PronoHub Football',
      description: 'Contactez l\'équipe PronoHub pour toute question ou suggestion.',
      url: 'https://www.pronohub.club/contact',
    },
  }
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children
}
