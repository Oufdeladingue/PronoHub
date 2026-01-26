'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle, Loader2, AlertCircle, ArrowRight, Trophy, Clock, Users, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { isCapacitor } from '@/lib/capacitor'
import { fetchWithAuth } from '@/lib/supabase/client'

/**
 * Détecte si on est dans un navigateur externe (Chrome Custom Tab)
 * plutôt que dans le WebView de l'app Capacitor
 */
function detectExternalBrowser(): boolean {
  if (typeof window === 'undefined') return false
  const userAgent = navigator.userAgent || ''
  const isAndroid = /Android/i.test(userAgent)
  const isWebView = /wv/.test(userAgent) || /; wv\)/.test(userAgent)
  const hasCapacitor = !!(window as any).Capacitor?.isNativePlatform?.()
  return isAndroid && !isWebView && !hasCapacitor
}

/**
 * Redirige vers l'app via intent URL Android
 */
function redirectToApp(path: string) {
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  window.location.href = `intent://www.pronohub.club${cleanPath}#Intent;scheme=https;package=club.pronohub.app;end`
}

function PaymentSuccessContent() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const [isExternalBrowser, setIsExternalBrowser] = useState(false)
  const [purchaseInfo, setPurchaseInfo] = useState<{
    purchaseType: string
    tournamentSubtype: string | null
    slotsIncluded: number
    nextAction: string
    redirectUrl: string
  } | null>(null)

  useEffect(() => {
    setIsExternalBrowser(detectExternalBrowser())
  }, [])

  useEffect(() => {
    const sessionId = searchParams.get('session_id')

    if (!sessionId) {
      setStatus('error')
      setMessage('Session de paiement non trouvee')
      return
    }

    const verifyPayment = async () => {
      try {
        // Préparer les headers avec le token Capacitor si nécessaire
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }

        if (isCapacitor()) {
          // Récupérer le token depuis localStorage (stocké par Supabase)
          const authData = localStorage.getItem('sb-txpmihreaxmtsxlgmdko-auth-token')
          if (authData) {
            try {
              const session = JSON.parse(authData)
              if (session?.access_token) {
                headers['Authorization'] = `Bearer ${session.access_token}`
              }
            } catch {
              // Ignorer les erreurs de parsing
            }
          }
        }

        const response = await fetchWithAuth('/api/stripe/verify-session', {
          method: 'POST',
          headers,
          body: JSON.stringify({ session_id: sessionId })
        })

        const data = await response.json()

        if (data.success) {
          setStatus('success')
          setPurchaseInfo({
            purchaseType: data.purchaseType,
            tournamentSubtype: data.tournamentSubtype,
            slotsIncluded: data.slotsIncluded || 1,
            nextAction: data.nextAction,
            redirectUrl: data.redirectUrl
          })

          // Message selon le type d'achat
          if (data.purchaseType === 'tournament_creation') {
            const typeLabel = data.tournamentSubtype === 'oneshot' ? 'One-Shot' :
                              data.tournamentSubtype === 'elite' ? 'Elite Team' :
                              data.tournamentSubtype === 'platinium' ? 'Platinium' : ''
            setMessage(`Votre credit ${typeLabel} a ete ajoute a votre compte !`)
          } else if (data.purchaseType === 'platinium_group') {
            setMessage(`Vos ${data.slotsIncluded} places Platinium ont ete ajoutees a votre compte !`)
          } else if (data.purchaseType === 'platinium_participation') {
            setMessage('Votre place Platinium a ete ajoutee a votre compte !')
          } else if (data.purchaseType === 'slot_invite') {
            setMessage('Votre slot supplementaire a ete active !')
          } else if (data.purchaseType === 'duration_extension') {
            setMessage('Votre credit d\'extension a ete ajoute ! Choisissez la duree sur la page du tournoi.')
          } else if (data.purchaseType === 'player_extension') {
            setMessage('Capacite du tournoi augmentee de 5 joueurs !')
          } else {
            setMessage('Paiement confirme avec succes !')
          }
        } else {
          setStatus('error')
          setMessage(data.message || data.error || 'Erreur lors de la verification')
        }
      } catch (error) {
        console.error('Error verifying payment:', error)
        setStatus('error')
        setMessage('Erreur lors de la verification du paiement')
      }
    }

    verifyPayment()
  }, [searchParams])

  const getTypeIcon = () => {
    if (purchaseInfo?.tournamentSubtype === 'platinium') {
      return <Trophy className="w-6 h-6 text-yellow-500" />
    }
    if (purchaseInfo?.tournamentSubtype === 'elite') {
      return <Users className="w-6 h-6 text-blue-500" />
    }
    return <Trophy className="w-6 h-6 text-green-500" />
  }

  const getTypeColor = () => {
    if (purchaseInfo?.tournamentSubtype === 'platinium') return 'text-yellow-400'
    if (purchaseInfo?.tournamentSubtype === 'elite') return 'text-blue-400'
    return 'text-green-400'
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 theme-bg">
      <div className="max-w-lg w-full theme-card p-8 text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="w-16 h-16 mx-auto mb-4 text-[#ff9900] animate-spin" />
            <h1 className="text-xl font-bold theme-text mb-2">Verification en cours...</h1>
            <p className="theme-text-secondary">Nous confirmons votre paiement</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
            <h1 className="text-2xl font-bold theme-text mb-2">Paiement reussi !</h1>
            <p className="theme-text-secondary mb-6">{message}</p>

            {/* Afficher les details du credit */}
            {purchaseInfo && (purchaseInfo.nextAction === 'create_tournament' || purchaseInfo.nextAction === 'join_platinium') && (
              <div className="bg-gray-800/50 rounded-xl p-4 mb-6 border border-gray-700">
                <div className="flex items-center justify-center gap-3 mb-3">
                  {getTypeIcon()}
                  <span className={`font-semibold ${getTypeColor()}`}>
                    {purchaseInfo.tournamentSubtype === 'oneshot' && 'Credit One-Shot'}
                    {purchaseInfo.tournamentSubtype === 'elite' && 'Credit Elite Team'}
                    {purchaseInfo.tournamentSubtype === 'platinium' && purchaseInfo.purchaseType === 'platinium_group' && `${purchaseInfo.slotsIncluded} places Platinium`}
                    {purchaseInfo.tournamentSubtype === 'platinium' && purchaseInfo.purchaseType === 'platinium_participation' && '1 place Platinium'}
                    {purchaseInfo.tournamentSubtype === 'platinium' && purchaseInfo.purchaseType === 'tournament_creation' && 'Credit Platinium'}
                  </span>
                </div>
                <p className="text-sm text-gray-400">
                  Ce credit est disponible sur votre compte et n&apos;expire pas.
                </p>
              </div>
            )}

            <div className="space-y-3">
              {isExternalBrowser ? (
                <>
                  {/* Mode navigateur externe (Android) — rediriger vers l'app */}
                  <button
                    onClick={() => redirectToApp(purchaseInfo?.redirectUrl || '/dashboard')}
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
                  {/* Bouton principal - Creer maintenant */}
                  {purchaseInfo?.nextAction === 'create_tournament' && (
                    <Link
                      href={`/vestiaire?type=${purchaseInfo.tournamentSubtype || 'oneshot'}`}
                      className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-[#ff9900] hover:bg-[#e68a00] text-white font-semibold rounded-lg transition-colors"
                    >
                      Creer mon tournoi maintenant <ArrowRight className="w-4 h-4" />
                    </Link>
                  )}

                  {/* Bouton principal - Choisir la duree d'extension */}
                  {purchaseInfo?.nextAction === 'choose_extension' && purchaseInfo.redirectUrl && (
                    <Link
                      href={purchaseInfo.redirectUrl}
                      className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-[#ff9900] hover:bg-[#e68a00] text-white font-semibold rounded-lg transition-colors"
                    >
                      Choisir la duree <ArrowRight className="w-4 h-4" />
                    </Link>
                  )}

                  {/* Bouton secondaire - Plus tard */}
                  <Link
                    href="/dashboard"
                    className={`flex items-center justify-center gap-2 w-full py-3 px-4 ${
                      (purchaseInfo?.nextAction === 'create_tournament' || purchaseInfo?.nextAction === 'choose_extension')
                        ? 'theme-bg-secondary hover:opacity-80 theme-text'
                        : 'bg-[#ff9900] hover:bg-[#e68a00] text-white'
                    } font-semibold rounded-lg transition-colors`}
                  >
                    {purchaseInfo?.nextAction === 'create_tournament' || purchaseInfo?.nextAction === 'choose_extension' ? (
                      <>
                        <Clock className="w-4 h-4" />
                        Plus tard
                      </>
                    ) : (
                      'Retour au dashboard'
                    )}
                  </Link>

                  {/* Lien vers le profil pour voir les credits */}
                  <Link
                    href="/profile"
                    className="block text-sm text-gray-400 hover:text-gray-300 transition-colors mt-4"
                  >
                    Voir tous mes credits sur mon profil
                  </Link>
                </>
              )}
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
            <h1 className="text-xl font-bold theme-text mb-2">Erreur</h1>
            <p className="theme-text-secondary mb-6">{message}</p>

            <div className="space-y-3">
              <Link
                href="/dashboard"
                className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-[#ff9900] hover:bg-[#e68a00] text-white font-semibold rounded-lg transition-colors"
              >
                Retour au dashboard
              </Link>

              <Link
                href="/contact"
                className="flex items-center justify-center gap-2 w-full py-3 px-4 theme-bg-secondary hover:opacity-80 theme-text font-semibold rounded-lg transition-colors"
              >
                Contacter le support
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 flex items-center justify-center p-4 bg-black">
        <div className="max-w-md w-full theme-card p-8 text-center">
          <Loader2 className="w-16 h-16 mx-auto mb-4 text-[#ff9900] animate-spin" />
          <h1 className="text-xl font-bold theme-text mb-2">Chargement...</h1>
        </div>
      </div>
    }>
      <PaymentSuccessContent />
    </Suspense>
  )
}
