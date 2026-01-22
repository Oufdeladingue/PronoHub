'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'
import Navigation from '@/components/Navigation'
import VestiaireClient from '@/components/VestiaireClient'

interface UserProfile {
  username: string
  avatar: string
}

/**
 * Wrapper pour la page Vestiaire dans Capacitor.
 * Charge les données utilisateur côté client car le serveur ne peut pas accéder à la session.
 */
export default function VestiaireCapacitorWrapper() {
  const [isLoading, setIsLoading] = useState(true)
  const [loadingPercent, setLoadingPercent] = useState(0)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const router = useRouter()

  useEffect(() => {
    const loadUser = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.replace('/auth/login')
        return
      }

      const { data } = await supabase
        .from('profiles')
        .select('username, avatar')
        .eq('id', user.id)
        .single()

      if (data) {
        setProfile(data)
      }

      setLoadingPercent(100)
      setIsLoading(false)
    }

    loadUser()
  }, [router])

  // Animation de chargement
  useEffect(() => {
    if (!isLoading) return
    const interval = setInterval(() => {
      setLoadingPercent(prev => {
        if (prev < 60) return prev + 4
        if (prev < 85) return prev + 2
        if (prev < 95) return prev + 0.5
        return prev
      })
    }, 50)
    return () => clearInterval(interval)
  }, [isLoading])

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0a]">
        <div className="flex flex-col items-center gap-6">
          <div className="relative w-24 h-24">
            <Image
              src="/images/logo.svg"
              alt="PronoHub"
              width={96}
              height={96}
              className="w-24 h-24 opacity-20 grayscale"
            />
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ clipPath: `inset(${100 - loadingPercent}% 0 0 0)` }}
            >
              <Image
                src="/images/logo.svg"
                alt="PronoHub"
                width={96}
                height={96}
                className="w-24 h-24"
              />
            </div>
          </div>
          <div className="flex flex-col items-center gap-2">
            <span className="text-[#ff9900] text-2xl font-bold">{Math.round(loadingPercent)}%</span>
            <span className="text-gray-400 text-sm">Chargement...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#020308]">
      <Navigation
        username={profile?.username || 'utilisateur'}
        userAvatar={profile?.avatar || 'avatar1'}
        context="app"
      />
      <VestiaireClient />
    </div>
  )
}
