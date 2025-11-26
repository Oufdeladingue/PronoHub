'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'

interface UserContextType {
  username: string | null
  userAvatar: string | null
  refreshUserData: () => Promise<void>
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export function UserProvider({ children }: { children: ReactNode }) {
  const [username, setUsername] = useState<string | null>(null)
  const [userAvatar, setUserAvatar] = useState<string | null>(null)
  const supabase = createClient()

  const refreshUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
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

  useEffect(() => {
    refreshUserData()
  }, [])

  return (
    <UserContext.Provider value={{ username, userAvatar, refreshUserData }}>
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
