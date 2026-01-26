'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { X, Minus, Plus } from 'lucide-react'
import { fetchWithAuth } from '@/lib/supabase/client'

interface DurationExtensionInfo {
  canExtend: boolean
  hasCredit: boolean
  creditsAvailable: number
  currentEndMatchday: number
  newEndMatchday: number
  additionalMatchdays: number
  maxAdditional: number
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
  const searchParams = useSearchParams()
  const [info, setInfo] = useState<DurationExtensionInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [buying, setBuying] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [matchdaysToAdd, setMatchdaysToAdd] = useState(1)
  const [confirming, setConfirming] = useState(false)

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

  // Quand l'app revient au premier plan (retour depuis Stripe), reset le spinner
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setBuying(false)
        fetchExtensionInfo()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [tournamentId])

  // Ouvrir la modale automatiquement si ?extend=true
  useEffect(() => {
    if (searchParams.get('extend') === 'true' && info?.hasCredit && info?.canExtend) {
      setShowModal(true)
      // Nettoyer l'URL sans recharger
      const url = new URL(window.location.href)
      url.searchParams.delete('extend')
      window.history.replaceState({}, '', url.toString())
    }
  }, [searchParams, info])

  const fetchExtensionInfo = async () => {
    try {
      const response = await fetchWithAuth(`/api/tournaments/extend-duration?tournamentId=${tournamentId}`)
      const data = await response.json()

      if (data.success) {
        setInfo(data)
        // Initialiser le compteur au max
        setMatchdaysToAdd(data.maxAdditional || 1)
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

  const handleBuyCredit = async () => {
    setBuying(true)
    try {
      const response = await fetchWithAuth('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchaseType: 'duration_extension',
          tournamentId,
          returnUrl: window.location.pathname,
        })
      })

      const data = await response.json()

      if (data.success && data.url) {
        window.location.href = data.url
      } else {
        alert(data.error || 'Erreur lors de la création du paiement')
        setBuying(false)
      }
    } catch (error) {
      console.error('Error creating checkout session:', error)
      alert('Erreur lors de la création du paiement')
      setBuying(false)
    }
  }

  const handleButtonClick = () => {
    if (info?.hasCredit) {
      // Ouvrir la modale pour choisir le nombre de journées
      setShowModal(true)
    } else {
      // Acheter un crédit
      handleBuyCredit()
    }
  }

  const handleConfirmExtension = async () => {
    setConfirming(true)
    try {
      const response = await fetchWithAuth('/api/tournaments/extend-duration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId, matchdaysToAdd })
      })

      const data = await response.json()

      if (data.success) {
        setShowModal(false)
        window.location.reload()
      } else if (data.requiresPayment) {
        setShowModal(false)
        handleBuyCredit()
      } else {
        alert(data.error || 'Erreur lors de l\'extension')
      }
    } catch (error) {
      console.error('Error applying duration extension:', error)
      alert('Erreur lors de l\'extension')
    } finally {
      setConfirming(false)
    }
  }

  // Ne rien afficher si loading, dismissed, ou pas d'extension possible
  if (loading || dismissed || !info?.canExtend) {
    return null
  }

  const maxAdd = info.maxAdditional || Math.min(10, info.additionalMatchdays)

  return (
    <>
      <div
        className={`transition-all duration-300 ${isClosing ? 'opacity-0 -translate-y-2 h-0 overflow-hidden' : 'opacity-100'}`}
      >
        <div className="relative upgrade-banner border-2 rounded-lg p-3 md:p-4">
          <div className="flex flex-row items-center justify-between gap-3 pr-6">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="w-8 h-8 md:w-10 md:h-10 duration-icon-bg rounded-full flex items-center justify-center shrink-0">
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
                    +{maxAdd} journées disponibles
                  </span>
                  <span className="hidden md:inline">
                    Jusqu&apos;à {maxAdd} journées supplémentaires disponibles
                  </span>
                </p>
              </div>
            </div>
            <button
              onClick={handleButtonClick}
              disabled={buying}
              className={`premium-btn-shimmer flex items-center justify-center p-2 md:px-4 md:py-2 md:gap-2 ${
                info.hasCredit
                  ? 'bg-blue-500/20 hover:bg-blue-500/30'
                  : 'bg-orange-500/20 hover:bg-orange-500/30'
              } rounded-lg text-sm font-medium ${
                info.hasCredit ? 'text-blue-400' : 'text-orange-400'
              } transition-all shrink-0 disabled:opacity-50`}
              title={info.hasCredit ? 'Choisir la durée' : `Acheter (${info.price}€)`}
            >
              {buying ? (
                <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <img
                    src={info.hasCredit ? '/images/icons/time.svg' : '/images/icons/plus.svg'}
                    alt=""
                    className={`w-5 h-5 md:w-4 md:h-4 ${
                      info.hasCredit ? 'icon-filter-blue' : 'icon-filter-orange'
                    }`}
                  />
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

      {/* Modale de choix du nombre de journées */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !confirming && setShowModal(false)}
          />
          <div className="relative w-full max-w-sm bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl p-6 shadow-2xl">
            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 duration-icon-bg rounded-full flex items-center justify-center shrink-0">
                <img
                  src="/images/icons/time.svg"
                  alt=""
                  className="w-5 h-5 duration-icon-filter"
                />
              </div>
              <div>
                <h3 className="font-semibold theme-text text-lg">
                  Prolonger le tournoi
                </h3>
                <p className="text-xs theme-text-secondary">
                  Choisissez le nombre de journées
                </p>
              </div>
              <button
                onClick={() => !confirming && setShowModal(false)}
                className="ml-auto p-1 rounded hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5 theme-text-secondary" />
              </button>
            </div>

            {/* Compteur */}
            <div className="flex items-center justify-center gap-4 mb-5">
              <button
                onClick={() => setMatchdaysToAdd(Math.max(1, matchdaysToAdd - 1))}
                disabled={matchdaysToAdd <= 1 || confirming}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-[var(--border-color)] hover:bg-[var(--border-color)]/80 theme-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <Minus className="w-5 h-5" />
              </button>

              <div className="text-center min-w-[80px]">
                <span className="text-4xl font-bold text-[#ff9900]">
                  {matchdaysToAdd}
                </span>
                <p className="text-xs theme-text-secondary mt-1">
                  journée{matchdaysToAdd > 1 ? 's' : ''}
                </p>
              </div>

              <button
                onClick={() => setMatchdaysToAdd(Math.min(maxAdd, matchdaysToAdd + 1))}
                disabled={matchdaysToAdd >= maxAdd || confirming}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-[var(--border-color)] hover:bg-[var(--border-color)]/80 theme-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>

            {/* Infos */}
            <div className="bg-[var(--border-color)]/30 rounded-xl p-3 mb-5 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="theme-text-secondary">Fin actuelle</span>
                <span className="theme-text font-medium">Journée {info.currentEndMatchday}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="theme-text-secondary">Nouvelle fin</span>
                <span className="text-[#ff9900] font-semibold">Journée {info.currentEndMatchday + matchdaysToAdd}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="theme-text-secondary">Compétition</span>
                <span className="theme-text-secondary">jusqu&apos;à la journée {info.newEndMatchday}</span>
              </div>
            </div>

            {/* Boutons */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                disabled={confirming}
                className="flex-1 py-2.5 px-4 rounded-lg border border-[var(--border-color)] theme-text font-medium hover:bg-[var(--border-color)]/30 transition-colors disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmExtension}
                disabled={confirming}
                className="flex-1 py-2.5 px-4 rounded-lg bg-[#ff9900] hover:bg-[#e68a00] text-white font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {confirming ? (
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Confirmer'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
