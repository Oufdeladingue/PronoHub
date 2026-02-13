'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Composant client invisible.
 * Verifie si l'utilisateur est deja connecte et redirige vers /dashboard.
 * Isole du reste de la page pour garder le SSR sur tout le contenu.
 */
export function AuthRedirect() {
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        router.replace('/dashboard')
      }
    }
    checkAuth()
  }, [router])

  return null
}
