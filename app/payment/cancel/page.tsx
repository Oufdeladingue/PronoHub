'use client'

import { useEffect, useState } from 'react'
import { XCircle, ArrowLeft, ExternalLink } from 'lucide-react'
import Link from 'next/link'

export default function PaymentCancelPage() {
  const [isExternalBrowser, setIsExternalBrowser] = useState(false)

  useEffect(() => {
    // Détecter si on est dans un navigateur externe (Chrome Custom Tab)
    // plutôt que dans le WebView de l'app Capacitor
    const userAgent = navigator.userAgent || ''
    const isAndroid = /Android/i.test(userAgent)
    const isWebView = /wv/.test(userAgent) || /; wv\)/.test(userAgent)
    const hasCapacitor = !!(window as any).Capacitor?.isNativePlatform?.()

    // On est dans un navigateur externe si Android + pas WebView + pas de bridge Capacitor
    if (isAndroid && !isWebView && !hasCapacitor) {
      setIsExternalBrowser(true)
    }
  }, [])

  const handleReturnToApp = () => {
    // Tenter de revenir à l'app via intent URL Android
    window.location.href = 'intent://www.pronohub.club/dashboard#Intent;scheme=https;package=club.pronohub.app;end'
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 theme-bg">
      <div className="max-w-md w-full theme-card p-8 text-center">
        <XCircle className="w-16 h-16 mx-auto mb-4 text-orange-500" />
        <h1 className="text-xl font-bold theme-text mb-2">Paiement annulé</h1>
        <p className="theme-text-secondary mb-6">
          Votre paiement a été annulé. Aucun montant n&apos;a été débité.
        </p>

        <div className="space-y-3">
          {isExternalBrowser ? (
            <>
              <button
                onClick={handleReturnToApp}
                className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-[#ff9900] hover:bg-[#e68a00] text-white font-semibold rounded-lg transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Retourner à l&apos;application
              </button>
              <p className="text-xs theme-text-secondary mt-2">
                Si le bouton ne fonctionne pas, fermez cet onglet pour revenir à PronoHub.
              </p>
            </>
          ) : (
            <>
              <Link
                href="/dashboard"
                className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-[#ff9900] hover:bg-[#e68a00] text-white font-semibold rounded-lg transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Retour au dashboard
              </Link>

              <Link
                href="/pricing"
                className="flex items-center justify-center gap-2 w-full py-3 px-4 theme-bg-secondary hover:opacity-80 theme-text font-semibold rounded-lg transition-colors"
              >
                Voir les offres
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
