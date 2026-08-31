import type { Metadata } from 'next'

// Page PRIVÉE (auth-gated) : jamais indexée. On retire la canonique (qui pointait vers une
// URL Disallow) et on pose un noindex explicite couvrant TOUTES les locales (/en/profile…
// que le robots.txt « Disallow: /profile » ne bloque pas).
export const metadata: Metadata = {
  title: 'Mon profil - PronoHub',
  description: 'Gérez votre profil PronoHub : avatar, statistiques, trophées débloqués et préférences de notifications.',
  robots: { index: false, follow: false },
}

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
