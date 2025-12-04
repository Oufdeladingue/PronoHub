'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Navigation from './Navigation'
import { createClient } from '@/lib/supabase/client'
import { ThemeProvider } from '@/contexts/ThemeContext'

interface AdminLayoutProps {
  children: React.ReactNode
  currentPage?: 'general' | 'import' | 'settings' | 'logos' | 'tournaments' | 'pricing' | 'credits'
}

export default function AdminLayout({ children, currentPage }: AdminLayoutProps) {
  const router = useRouter()
  const [username, setUsername] = useState('Admin')
  const [userAvatar, setUserAvatar] = useState('avatar1')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchUser = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/auth/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('username, avatar')
        .eq('id', user.id)
        .single()

      if (profile) {
        setUsername(profile.username || 'Admin')
        setUserAvatar(profile.avatar || 'avatar1')
      }

      setLoading(false)
    }

    fetchUser()
  }, [router])

  if (loading) {
    return (
      <ThemeProvider>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-gray-600">Chargement...</div>
        </div>
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider>
      <Navigation
        username={username}
        userAvatar={userAvatar}
        context="admin"
        adminContext={{ currentPage }}
      />
      {children}
    </ThemeProvider>
  )
}
