import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Contact - PronoHub Football',
  description: 'Contactez l\'équipe PronoHub pour toute question, suggestion ou demande de partenariat. Nous sommes à votre écoute !',
  alternates: {
    canonical: 'https://www.pronohub.club/contact',
  },
  openGraph: {
    title: 'Contact - PronoHub Football',
    description: 'Contactez l\'équipe PronoHub pour toute question ou suggestion.',
    url: 'https://www.pronohub.club/contact',
  },
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children
}
