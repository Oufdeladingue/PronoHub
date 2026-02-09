'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient, fetchWithAuth } from '@/lib/supabase/client'
import Image from 'next/image'
import OppositionClient from '@/app/[tournamentSlug]/opposition/OppositionClient'
import ScrollToTopButton from '@/components/ScrollToTopButton'

interface TournamentData {
  tournament: any
  user: {
    id: string
    username: string
    avatar: string
  }
  pointsSettings: {
    exactScore: number
    correctResult: number
    incorrectResult: number
  }
  competitionLogo: string | null
  competitionLogoWhite: string | null
  captainUsername: string | null
  allMatches: any[]
  matchdayStages: Record<number, string | null>
}

interface OppositionCapacitorWrapperProps {
  tournamentSlug: string
}

/**
 * Wrapper pour la page Opposition dans Capacitor.
 * Charge les données via API côté client car le serveur ne peut pas accéder à la session.
 */
export default function OppositionCapacitorWrapper({ tournamentSlug }: OppositionCapacitorWrapperProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [loadingPercent, setLoadingPercent] = useState(0)
  const [data, setData] = useState<TournamentData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const loadTournament = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        router.replace('/auth/login')
        return
      }

      try {
        const response = await fetchWithAuth(`/api/tournament/data?slug=${encodeURIComponent(tournamentSlug)}`)

        if (!response.ok) {
          if (response.status === 401) {
            router.replace('/auth/login')
            return
          }
          if (response.status === 404) {
            router.replace('/dashboard')
            return
          }
          throw new Error('Erreur chargement tournoi')
        }

        const tournamentData = await response.json()
        setData(tournamentData)
        setLoadingPercent(100)
      } catch (err: any) {
        console.error('[OppositionCapacitor] Error:', err)
        setError(err.message)
      } finally {
        setIsLoading(false)
      }
    }

    loadTournament()
  }, [router, tournamentSlug])

  // Animation de chargement
  useEffect(() => {
    if (!isLoading) return
    const interval = setInterval(() => {
      setLoadingPercent(prev => {
        if (prev < 60) return prev + 3
        if (prev < 85) return prev + 1.5
        if (prev < 95) return prev + 0.5
        return prev
      })
    }, 50)
    return () => clearInterval(interval)
  }, [isLoading])

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
            <span className="text-gray-400 text-sm">Chargement du tournoi...</span>
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

  if (!data) {
    return null
  }

  return (
    <div id="capacitor-scroll-container" className="fixed inset-0 overflow-y-auto">
      <OppositionClient
        serverTournament={data.tournament}
        serverUser={data.user}
        serverPointsSettings={data.pointsSettings}
        serverCompetitionLogo={data.competitionLogo}
        serverCompetitionLogoWhite={data.competitionLogoWhite}
        serverCaptainUsername={data.captainUsername}
        serverAllMatches={data.allMatches}
        serverMatchdayStages={data.matchdayStages}
        tournamentSlug={tournamentSlug}
      />
      {/* Bouton Scroll to Top pour Capacitor - écoute le scroll du conteneur */}
      <ScrollToTopButton
        threshold={800}
        position="bottom-right"
        margin={{ bottom: 80, horizontal: 24 }}
        scrollContainerSelector="#capacitor-scroll-container"
      />
    </div>
  )
}
