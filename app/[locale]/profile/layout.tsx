import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Mon profil - PronoHub',
  description: 'Gérez votre profil PronoHub : avatar, statistiques, trophées débloqués et préférences de notifications.',
  alternates: {
    canonical: 'https://www.pronohub.club/profile',
  },
}

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
