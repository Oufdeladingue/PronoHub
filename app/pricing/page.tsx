import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import Navigation from '@/components/Navigation'
import { ThemeProvider } from '@/contexts/ThemeContext'
import PricingClient from './PricingClient'
import PricingCapacitorWrapper from '@/components/PricingCapacitorWrapper'

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
