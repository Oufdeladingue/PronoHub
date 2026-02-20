'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { isCapacitor } from '@/lib/capacitor'

interface CapacitorAuthGuardProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

/**
 * Composant qui vérifie l'authentification côté client pour Capacitor.
 * Sur le web, il affiche directement les enfants.
 * Sur Capacitor, il vérifie la session locale avant d'afficher le contenu.
 */
export default function CapacitorAuthGuard({ children, fallback }: CapacitorAuthGuardProps) {
  const [isChecking, setIsChecking] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Sur le web, laisser le serveur gérer l'auth
    if (!isCapacitor()) {
      setIsChecking(false)
      setIsAuthenticated(true)
      return
    }

    // Sur Capacitor, vérifier la session côté client
    const checkAuth = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        setIsAuthenticated(true)
      } else {
        // Rediriger vers login si pas authentifié
        router.replace('/auth/login')
      }
      setIsChecking(false)
    }

    checkAuth()
  }, [router])

  if (isChecking) {
    return fallback || (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="loading-spinner"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return <>{children}</>
}
