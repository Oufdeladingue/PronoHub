'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'

/**
 * Wrapper pour le dashboard dans Capacitor.
 * Vérifie l'authentification côté client et redirige si nécessaire,
 * puis recharge la page pour que le Server Component puisse récupérer les données.
 */
export default function DashboardCapacitorWrapper() {
  const [isChecking, setIsChecking] = useState(true)
  const [loadingPercent, setLoadingPercent] = useState(0)
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        // Pas authentifié, rediriger vers login
        router.replace('/auth/login')
      } else {
        // Authentifié, recharger la page pour que le serveur récupère la session
        // via les cookies qui devraient maintenant être synchronisés
        window.location.reload()
      }
    }

    // Petit délai pour laisser la session se synchroniser
    setTimeout(checkAuth, 500)
  }, [router])

  // Animation de chargement
  useEffect(() => {
    const interval = setInterval(() => {
      setLoadingPercent(prev => {
        if (prev < 60) return prev + 2
        if (prev < 85) return prev + 1
        if (prev < 95) return prev + 0.3
        return prev
      })
    }, 50)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0a]">
      <div className="flex flex-col items-center gap-6">
        {/* Logo avec effet de remplissage */}
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
          <span className="text-gray-400 text-sm">Chargement du vestiaire...</span>
        </div>
      </div>
    </div>
  )
}
