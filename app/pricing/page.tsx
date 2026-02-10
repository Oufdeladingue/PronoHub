import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import Navigation from '@/components/Navigation'
import { ThemeProvider } from '@/contexts/ThemeContext'
import PricingClient from './PricingClient'
import PricingCapacitorWrapper from '@/components/PricingCapacitorWrapper'

export const metadata: Metadata = {
  title: 'Tarifs - PronoHub Football | Gratuit et Premium',
  description: 'Découvrez les offres PronoHub : version gratuite ou Premium. Créez des tournois de pronostics football, invitez vos amis et débloquez des fonctionnalités exclusives.',
  alternates: {
    canonical: 'https://www.pronohub.club/pricing',
  },
  openGraph: {
    title: 'Tarifs - PronoHub Football | Gratuit et Premium',
    description: 'Découvrez les offres PronoHub : version gratuite ou Premium.',
    url: 'https://www.pronohub.club/pricing',
  },
}

// Détecter si la requête vient d'un WebView Android (Capacitor)
function isCapacitorRequest(userAgent: string | null): boolean {
  if (!userAgent) return false
  return /Android.*wv/.test(userAgent) || /; wv\)/.test(userAgent)
}

export default async function PricingPage() {
  const headersList = await headers()
  const userAgent = headersList.get('user-agent')
  const isCapacitor = isCapacitorRequest(userAgent)

  // Dans Capacitor, utiliser le wrapper client
  if (isCapacitor) {
    return <PricingCapacitorWrapper />
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let profile = null
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('username, avatar')
      .eq('id', user.id)
      .single()
    profile = data
  }

  return (
    <ThemeProvider>
      {profile && (
        <Navigation
          username={profile.username || 'Utilisateur'}
          userAvatar={profile.avatar}
          context="app"
          appContext={{ showBackToDashboard: true }}
        />
      )}
      <PricingClient isLoggedIn={!!user} />
    </ThemeProvider>
  )
}
