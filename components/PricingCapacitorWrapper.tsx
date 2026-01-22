'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Navigation from '@/components/Navigation'
import { ThemeProvider } from '@/contexts/ThemeContext'
import PricingClient from '@/app/pricing/PricingClient'
import Image from 'next/image'

interface UserProfile {
  username: string
  avatar: string
}

/**
 * Wrapper pour la page pricing dans Capacitor.
 * Charge les données utilisateur côté client car le serveur ne peut pas accéder à la session.
 */
export default function PricingCapacitorWrapper() {
  const [isLoading, setIsLoading] = useState(true)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    const loadUser = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        setIsLoggedIn(true)
        const { data } = await supabase
          .from('profiles')
          .select('username, avatar')
          .eq('id', user.id)
          .single()

        if (data) {
          setProfile(data)
        }
      }

      setIsLoading(false)
    }

    loadUser()
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0a]">
        <div className="flex flex-col items-center gap-4">
          <Image
            src="/images/logo.svg"
            alt="PronoHub"
            width={64}
            height={64}
            className="w-16 h-16 animate-pulse"
          />
          <span className="text-gray-400 text-sm">Chargement...</span>
        </div>
      </div>
    )
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
      <PricingClient isLoggedIn={isLoggedIn} />
    </ThemeProvider>
  )
}
