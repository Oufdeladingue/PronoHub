'use client'

import { useState } from 'react'

interface StatsExplanationModalProps {
  tournamentId: string
  returnUrl?: string
  onClose: () => void
}

export default function StatsExplanationModal({
  tournamentId,
  returnUrl,
  onClose
}: StatsExplanationModalProps) {
  const [loading, setLoading] = useState<'tournament' | 'lifetime' | null>(null)

  const handlePurchase = async (type: 'tournament' | 'lifetime') => {
    setLoading(type)
    try {
      const purchaseType = type === 'tournament' ? 'stats_access_tournament' : 'stats_access_lifetime'

      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchaseType,
          tournamentId: type === 'tournament' ? tournamentId : undefined,
          returnUrl: returnUrl || window.location.pathname
        })
      })

      const data = await response.json()

      if (data.url) {
        window.location.href = data.url
      } else {
        throw new Error(data.error || 'Erreur lors de la création de la session')
      }
    } catch (error) {
      console.error('Error creating checkout session:', error)
      setLoading(null)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="theme-card max-w-md w-full !p-0 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b theme-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#ff9900]/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-[#ff9900]" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="4" y="10" width="4" height="10" rx="1" />
                  <rect x="10" y="4" width="4" height="16" rx="1" />
                  <rect x="16" y="8" width="4" height="12" rx="1" />
                </svg>
              </div>
              <h3 className="text-lg font-bold theme-text">
                Statistiques du match
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <svg className="w-5 h-5 theme-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          <p className="theme-text-secondary text-sm leading-relaxed">
            Accédez aux statistiques avancées pour affiner vos pronostics :
          </p>

          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm theme-text">
                <strong>Forme des équipes</strong> - Les 5 derniers résultats de chaque équipe dans la compétition
              </span>
            </li>
            <li className="flex items-start gap-3">
              <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm theme-text">
                <strong>Tendances des pronostics</strong> - Découvrez ce que la communauté pronostique pour ce match
              </span>
            </li>
          </ul>

          {/* Purchase options */}
          <div className="space-y-3 pt-2">
            <button
              onClick={() => handlePurchase('tournament')}
              disabled={loading !== null}
              className="w-full flex items-center justify-between p-4 theme-bg rounded-lg border-2 theme-border hover:border-[#ff9900] transition-colors disabled:opacity-50"
            >
              <div className="text-left">
                <p className="font-semibold theme-text">Pour ce tournoi</p>
                <p className="text-xs theme-text-secondary">Accès aux stats pour ce tournoi uniquement</p>
              </div>
              <div className="text-right">
                {loading === 'tournament' ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#ff9900]"></div>
                ) : (
                  <span className="text-lg font-bold text-[#ff9900]">1,99 €</span>
                )}
              </div>
            </button>

            <button
              onClick={() => handlePurchase('lifetime')}
              disabled={loading !== null}
              className="w-full flex items-center justify-between p-4 bg-[#ff9900]/10 rounded-lg border-2 border-[#ff9900]/50 hover:border-[#ff9900] transition-colors disabled:opacity-50"
            >
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <p className="font-semibold theme-text">Pour tous mes tournois</p>
                  <span className="px-1.5 py-0.5 bg-[#ff9900] text-black text-[10px] font-bold rounded uppercase">
                    Recommandé
                  </span>
                </div>
                <p className="text-xs theme-text-secondary">Accès à vie pour tous vos tournois actuels et futurs</p>
              </div>
              <div className="text-right">
                {loading === 'lifetime' ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#ff9900]"></div>
                ) : (
                  <span className="text-lg font-bold text-[#ff9900]">5,99 €</span>
                )}
              </div>
            </button>
          </div>

          <p className="text-xs theme-text-secondary text-center">
            Fonctionnalité gratuite pour les tournois Elite et Platinium
          </p>
        </div>

        {/* Footer */}
        <div className="p-4 border-t theme-border">
          <button
            onClick={onClose}
            disabled={loading !== null}
            className="w-full px-4 py-2.5 theme-bg theme-text rounded-lg border theme-border hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors font-medium disabled:opacity-50"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}
