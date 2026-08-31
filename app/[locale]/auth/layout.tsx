import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Connexion - PronoHub Football',
  description: 'Connectez-vous ou créez votre compte PronoHub pour rejoindre des tournois de pronostics football entre amis.',
  openGraph: {
    title: 'Connexion - PronoHub Football',
    description: 'Connectez-vous ou créez votre compte PronoHub.',
  },
  // Pages utilitaires (connexion, inscription, choix pseudo, mot de passe oublié, vérif…) :
  // noindex. Elles n'ont aucune valeur SEO, sont géo-bloquées pour Googlebot (US) sur
  // login/signup, et se dupliquaient à l'identique sur les 5 préfixes de langue.
  robots: {
    index: false,
    follow: true,
  },
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children
}
