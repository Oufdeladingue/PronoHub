'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient, fetchWithAuth } from '@/lib/supabase/client'
import Image from 'next/image'
import Navigation from '@/components/Navigation'
import DashboardClient from '@/components/DashboardClient'
import { getAdminPath } from '@/lib/admin-path'

interface DashboardData {
  profile: any
  isSuper: boolean
  canCreateTournament: boolean
  hasSubscription: boolean
  quotas: any
  credits: any
  tournaments: any[]
  leftTournaments: any[]
}

/**
 * Wrapper pour le dashboard dans Capacitor.
 * Charge les données via API côté client car le serveur ne peut pas accéder à la session.
 */
export default function DashboardCapacitorWrapper() {
  const [isLoading, setIsLoading] = useState(true)
  // Récupérer le pourcentage depuis sessionStorage (continuité avec login loader)
  const [loadingPercent, setLoadingPercent] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('loaderPercent')
      if (saved) {
        sessionStorage.removeItem('loaderPercent')
        return parseInt(saved, 10)
      }
    }
    return 0
  })
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [dataReady, setDataReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const loadDashboard = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        router.replace('/auth/login')
        return
      }

      try {
        // Appeler l'API avec le token d'auth
        const response = await fetchWithAuth('/api/dashboard/data')

        if (!response.ok) {
          if (response.status === 401) {
            router.replace('/auth/login')
            return
          }
          throw new Error('Erreur chargement dashboard')
        }

        const data = await response.json()
        setDashboardData(data)
        setDataReady(true) // Signaler que les données sont prêtes
      } catch (err: any) {
        console.error('[DashboardCapacitor] Error:', err)
        setError(err.message)
        setIsLoading(false)
      }
    }

    loadDashboard()
  }, [router])

  // Animation de chargement progressive
  useEffect(() => {
    if (!isLoading) return

    const interval = setInterval(() => {
      setLoadingPercent(prev => {
        // Si les données sont prêtes, accélérer vers 100%
        if (dataReady) {
          if (prev >= 100) return 100
          return Math.min(100, prev + 8)
        }
        // Sinon, progression lente jusqu'à 90%
        if (prev < 50) return prev + 2.5
        if (prev < 75) return prev + 1.5
        if (prev < 90) return prev + 0.8
        return prev // Plafonner à 90% tant que les données ne sont pas là
      })
    }, 50)

    return () => clearInterval(interval)
  }, [isLoading, dataReady])

  // Quand on atteint 100%, attendre un court instant puis masquer le loader
  useEffect(() => {
    if (loadingPercent >= 100 && dataReady) {
      const timeout = setTimeout(() => {
        setIsLoading(false)
      }, 400) // Laisser voir le 100% pendant 400ms
      return () => clearTimeout(timeout)
    }
  }, [loadingPercent, dataReady])

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-black">
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
            <span className="text-gray-400 text-sm">Chargement du vestiaire...</span>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-black">
        <p className="text-red-500 mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-[#ff9900] text-black rounded-lg"
        >
          Réessayer
        </button>
      </div>
    )
  }

  if (!dashboardData) {
    return null
  }

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden">
      <Navigation
        username={dashboardData.profile?.username || 'utilisateur'}
        userAvatar={dashboardData.profile?.avatar || 'avatar1'}
        context="app"
      />
      <DashboardClient
        username={dashboardData.profile?.username || 'utilisateur'}
        avatar={dashboardData.profile?.avatar || 'avatar1'}
        isSuper={dashboardData.isSuper}
        canCreateTournament={dashboardData.canCreateTournament}
        hasSubscription={dashboardData.hasSubscription}
        quotas={dashboardData.quotas}
        credits={dashboardData.credits}
        tournaments={dashboardData.tournaments}
        leftTournaments={dashboardData.leftTournaments}
        adminPath={getAdminPath()}
      />
    </div>
  )
}
