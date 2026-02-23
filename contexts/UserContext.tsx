'use client'

import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { identifyUser, resetUser, trackPlatform } from '@/lib/analytics'
import { isCapacitor } from '@/lib/capacitor'

// Intervalle minimum entre deux mises à jour d'activité (5 minutes en ms)
const ACTIVITY_THROTTLE_INTERVAL = 5 * 60 * 1000
const ACTIVITY_STORAGE_KEY = 'last_activity_tracked'

interface UserContextType {
  userId: string | null
  username: string | null
  userAvatar: string | null
  refreshUserData: () => Promise<void>
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export function UserProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null)
  const [username, setUsername] = useState<string | null>(null)
  const [userAvatar, setUserAvatar] = useState<string | null>(null)
  const activityTracked = useRef(false)
  const supabase = createClient()

  const refreshUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
        const { data: profile } = await supabase
          .from('profiles')
          .select('username, avatar')
          .eq('id', user.id)
          .single()

        if (profile) {
          setUsername(profile.username)
          setUserAvatar(profile.avatar)
        }
      }
    } catch (err) {
      console.error('Error fetching user data:', err)
    }
  }

  // Identifier l'utilisateur dans PostHog quand il est connecté
  useEffect(() => {
    if (userId && username) {
      identifyUser(userId, { username, platform: isCapacitor() ? 'capacitor' : 'web' })
      trackPlatform(isCapacitor() ? 'capacitor' : 'web')
    }
  }, [userId, username])

  // Tracker l'activité de l'utilisateur (throttled)
  useEffect(() => {
    if (!userId || activityTracked.current) return

    // Vérifier si on a déjà tracké récemment
    try {
      const lastTracked = sessionStorage.getItem(ACTIVITY_STORAGE_KEY)
      if (lastTracked) {
        const lastTrackedTime = parseInt(lastTracked, 10)
        if (Date.now() - lastTrackedTime < ACTIVITY_THROTTLE_INTERVAL) {
          activityTracked.current = true
          return
        }
      }
    } catch {
      // sessionStorage peut être indisponible (Capacitor, iframe, etc.)
    }

    // Tracker l'activité
    const trackActivity = async () => {
      try {
        const response = await fetch('/api/user/activity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
        if (response.ok) {
          try {
            sessionStorage.setItem(ACTIVITY_STORAGE_KEY, Date.now().toString())
          } catch {
            // sessionStorage indisponible — on continue quand même
          }
          activityTracked.current = true
        }
        // Si !response.ok (401, 500...), on ne set pas le ref
        // pour permettre un retry au prochain mount
      } catch {
        // Erreur réseau — on ne set pas le ref pour permettre un retry
      }
    }

    trackActivity()
  }, [userId])

  useEffect(() => {
    refreshUserData()
  }, [])

  return (
    <UserContext.Provider value={{ userId, username, userAvatar, refreshUserData }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider')
  }
  return context
}
