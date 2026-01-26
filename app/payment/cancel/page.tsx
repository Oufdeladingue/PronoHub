'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { XCircle, ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'

function PaymentCancelContent() {
  const searchParams = useSearchParams()
  const [isExternalBrowser, setIsExternalBrowser] = useState(false)
  const [returnPath, setReturnPath] = useState('/dashboard')

  useEffect(() => {
    // Lire le paramètre return pour savoir où renvoyer l'utilisateur
    const returnParam = searchParams.get('return')
    if (returnParam) {
      setReturnPath(returnParam)
    }

    // Détecter si on est dans un navigateur externe (Chrome Custom Tab)
    // plutôt que dans le WebView de l'app Capacitor
    const userAgent = navigator.userAgent || ''
    const isAndroid = /Android/i.test(userAgent)
    const isWebView = /wv/.test(userAgent) || /; wv\)/.test(userAgent)
    const hasCapacitor = !!(window as any).Capacitor?.isNativePlatform?.()

    if (isAndroid && !isWebView && !hasCapacitor) {
      setIsExternalBrowser(true)
    }
  }, [searchParams])

  const handleReturnToApp = () => {
    const cleanPath = returnPath.startsWith('/') ? returnPath : `/${returnPath}`
    window.location.href = `intent://www.pronohub.club${cleanPath}#Intent;scheme=https;package=club.pronohub.app;end`
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
            <Link
              href={returnPath}
              className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-[#ff9900] hover:bg-[#e68a00] text-white font-semibold rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

export default function PaymentCancelPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center p-4 theme-bg">
        <div className="max-w-md w-full theme-card p-8 text-center">
          <Loader2 className="w-16 h-16 mx-auto mb-4 text-[#ff9900] animate-spin" />
          <h1 className="text-xl font-bold theme-text mb-2">Chargement...</h1>
        </div>
      </div>
    }>
      <PaymentCancelContent />
    </Suspense>
  )
}
