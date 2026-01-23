'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { fetchWithAuth } from '@/lib/supabase/client'

interface DurationExtensionInfo {
  canExtend: boolean
  hasCredit: boolean
  creditsAvailable: number
  currentEndMatchday: number
  newEndMatchday: number
  additionalMatchdays: number
  durationExtended: boolean
  price: number
  isCaptain: boolean
}

interface DurationExtensionBannerProps {
  tournamentId: string
  tournamentType?: string
  tournamentStatus?: string
}

export function DurationExtensionBanner({
  tournamentId,
  tournamentType,
  tournamentStatus
}: DurationExtensionBannerProps) {
  const router = useRouter()
  const [info, setInfo] = useState<DurationExtensionInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    // Ne pas charger si ce n'est pas un tournoi free ou actif
    if (tournamentType && tournamentType !== 'free') {
      setLoading(false)
      return
    }
    if (tournamentStatus && tournamentStatus !== 'active') {
      setLoading(false)
      return
    }

    fetchExtensionInfo()
  }, [tournamentId, tournamentType, tournamentStatus])

  const fetchExtensionInfo = async () => {
    try {
      const response = await fetchWithAuth(`/api/tournaments/extend-duration?tournamentId=${tournamentId}`)
      const data = await response.json()

      if (data.success) {
        setInfo(data)
      }
    } catch (error) {
      console.error('Error fetching duration extension info:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDismiss = () => {
    setIsClosing(true)
    setTimeout(() => setDismissed(true), 300)
  }

  const handleBuyCredit = () => {
    router.push('/pricing?highlight=duration_extension')
  }

  const handleApplyExtension = async () => {
    if (!info?.hasCredit) {
      handleBuyCredit()
      return
    }

    setApplying(true)
    try {
      const response = await fetchWithAuth('/api/tournaments/extend-duration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId })
      })

      const data = await response.json()

      if (data.success) {
        window.location.reload()
      } else if (data.requiresPayment) {
        handleBuyCredit()
      } else {
        alert(data.error || 'Erreur lors de l\'extension')
      }
    } catch (error) {
      console.error('Error applying duration extension:', error)
      alert('Erreur lors de l\'extension')
    } finally {
      setApplying(false)
    }
  }

  // Ne rien afficher si loading, dismissed, ou pas d'extension possible
  if (loading || dismissed || !info?.canExtend) {
    return null
  }

  return (
    <div
      className={`transition-all duration-300 ${isClosing ? 'opacity-0 -translate-y-2 h-0 overflow-hidden' : 'opacity-100'}`}
    >
      <div className="relative upgrade-banner border-2 rounded-lg p-3 md:p-4">
        <div className="flex flex-row items-center justify-between gap-3 pr-6">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-8 h-8 md:w-10 md:h-10 duration-icon-bg rounded-full flex items-center justify-center flex-shrink-0">
              <img
                src="/images/icons/time.svg"
                alt=""
                className="w-4 h-4 md:w-5 md:h-5 duration-icon-filter"
              />
            </div>
            <div>
              <p className="font-medium upgrade-banner-title text-sm md:text-base">
                Prolongez votre tournoi !
              </p>
              <p className="text-xs md:text-sm upgrade-banner-subtitle">
                <span className="md:hidden">
                  +{info.additionalMatchdays} journées disponibles
                </span>
                <span className="hidden md:inline">
                  Étendez jusqu'à la journée {info.newEndMatchday} (+{info.additionalMatchdays} journées supplémentaires)
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={handleApplyExtension}
            disabled={applying}
            className={`premium-btn-shimmer flex items-center justify-center p-2 md:px-4 md:py-2 md:gap-2 ${
              info.hasCredit
                ? 'bg-blue-500/20 hover:bg-blue-500/30'
                : 'bg-orange-500/20 hover:bg-orange-500/30'
            } rounded-lg text-sm font-medium ${
              info.hasCredit ? 'text-blue-400' : 'text-orange-400'
            } transition-all flex-shrink-0 disabled:opacity-50`}
            title={info.hasCredit ? 'Appliquer l\'extension' : `Acheter (${info.price}EUR)`}
          >
            {applying ? (
              <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <img
                  src={info.hasCredit ? '/images/icons/time.svg' : '/images/icons/plus.svg'}
                  alt=""
                  className={`w-5 h-5 md:w-4 md:h-4 ${
                    info.hasCredit ? 'icon-filter-blue' : 'icon-filter-orange'
                  } ${!info.hasCredit ? 'md:block' : ''}`}
                />
                {/* Mobile: afficher le prix si pas de crédit */}
                {!info.hasCredit && (
                  <span className="md:hidden text-xs font-bold ml-1">
                    {info.price}€
                  </span>
                )}
                <span className="hidden md:inline">
                  {info.hasCredit ? 'Prolonger' : `${info.price}€`}
                </span>
              </>
            )}
          </button>
        </div>
        {/* Bouton fermer */}
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 p-1 rounded hover:bg-white/10 dark:hover:bg-white/10 transition-colors"
          title="Fermer"
        >
          <X className="w-4 h-4 text-gray-400 hover:text-gray-200" />
        </button>
      </div>
    </div>
  )
}
