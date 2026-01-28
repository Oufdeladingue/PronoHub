'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

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
  const router = useRouter()
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                <svg className="w-5 h-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Statistiques du match
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
            Accédez aux statistiques avancées pour affiner vos pronostics :
          </p>

          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-slate-700 dark:text-slate-300">
                <strong>Forme des équipes</strong> - Les 5 derniers résultats de chaque équipe dans la compétition
              </span>
            </li>
            <li className="flex items-start gap-3">
              <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-slate-700 dark:text-slate-300">
                <strong>Tendances des pronostics</strong> - Découvrez ce que parient les autres joueurs sur ce match
              </span>
            </li>
          </ul>

          {/* Purchase options */}
          <div className="space-y-3 pt-2">
            <button
              onClick={() => handlePurchase('tournament')}
              disabled={loading !== null}
              className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border-2 border-slate-200 dark:border-slate-700 hover:border-orange-400 dark:hover:border-orange-500 transition-colors disabled:opacity-50"
            >
              <div className="text-left">
                <p className="font-semibold text-slate-900 dark:text-white">Pour ce tournoi</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Accès aux stats pour ce tournoi uniquement</p>
              </div>
              <div className="text-right">
                {loading === 'tournament' ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-orange-500"></div>
                ) : (
                  <span className="text-lg font-bold text-orange-500">1,99 €</span>
                )}
              </div>
            </button>

            <button
              onClick={() => handlePurchase('lifetime')}
              disabled={loading !== null}
              className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 rounded-lg border-2 border-orange-300 dark:border-orange-700 hover:border-orange-500 dark:hover:border-orange-500 transition-colors disabled:opacity-50"
            >
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-slate-900 dark:text-white">Pour tous mes tournois</p>
                  <span className="px-1.5 py-0.5 bg-orange-500 text-white text-[10px] font-bold rounded uppercase">
                    Recommandé
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Accès à vie pour tous vos tournois actuels et futurs</p>
              </div>
              <div className="text-right">
                {loading === 'lifetime' ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-orange-500"></div>
                ) : (
                  <span className="text-lg font-bold text-orange-500">5,99 €</span>
                )}
              </div>
            </button>
          </div>

          <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
            Gratuit pour les tournois Elite et Platinium
          </p>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={onClose}
            disabled={loading !== null}
            className="w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors font-medium disabled:opacity-50"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}
