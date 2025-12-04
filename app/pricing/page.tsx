import { createClient } from '@/lib/supabase/server'
import Navigation from '@/components/Navigation'
import { ThemeProvider } from '@/contexts/ThemeContext'
import PricingClient from './PricingClient'

export default async function PricingPage() {
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
