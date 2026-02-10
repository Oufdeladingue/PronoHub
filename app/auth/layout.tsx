import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Connexion - PronoHub Football',
  description: 'Connectez-vous ou créez votre compte PronoHub pour rejoindre des tournois de pronostics football entre amis.',
  openGraph: {
    title: 'Connexion - PronoHub Football',
    description: 'Connectez-vous ou créez votre compte PronoHub.',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children
}
