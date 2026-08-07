'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Check, X, Loader2, Plus, AlertTriangle } from 'lucide-react'
import Footer from '@/components/Footer'
import { openExternalUrl, isCapacitor } from '@/lib/capacitor'
import { createClient, fetchWithAuth } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'

interface PricingClientProps {
  isLoggedIn: boolean
}

interface UserQuotas {
  free_tournaments_active: number
  free_tournaments_max: number
  can_create_tournament: boolean
}

interface Prices {
  oneshot: number
  elite: number
  platinium: number
  platiniumGroup: number
  platiniumGroupSize: number
  platiniumGroupDiscount: number
  slotInvite: number
  durationExtension: number
  playerExtension: number
  freeMaxPlayers: number
  freeMaxMatchdays: number
  oneshotMaxPlayers: number
  eliteMaxPlayers: number
  platiniumMinPlayers: number
  platiniumMaxPlayers: number
}

const defaultPrices: Prices = {
  oneshot: 4.99,
  elite: 9.99,
  platinium: 6.99,
  platiniumGroup: 69.20, // 11 x 6.99 = 76.89 - 10% = 69.20
  platiniumGroupSize: 11,
  platiniumGroupDiscount: 10,
  slotInvite: 0.99,
  durationExtension: 3.99,
  playerExtension: 1.99,
  freeMaxPlayers: 5,
  freeMaxMatchdays: 10,
  oneshotMaxPlayers: 10,
  eliteMaxPlayers: 20,
  platiniumMinPlayers: 11,
  platiniumMaxPlayers: 30,
}

export default function PricingClient({ isLoggedIn }: PricingClientProps) {
  const t = useTranslations('Pricing')
  const tc = useTranslations('Common')
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState<string | null>(null)
  const [showPlatiniumModal, setShowPlatiniumModal] = useState(false)
  const [prices, setPrices] = useState<Prices>(defaultPrices)
  const autoCheckoutTriggered = useRef(false)
  const [stripeError, setStripeError] = useState<string | null>(null)
  const [userQuotas, setUserQuotas] = useState<UserQuotas | null>(null)

  // Reset loading quand l'app revient au premier plan (retour depuis Stripe sur Android)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setLoading(null)
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  // Charger les prix depuis l'API
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const response = await fetchWithAuth('/api/pricing/config')
        const data = await response.json()
        if (data.success && data.prices) {
          setPrices(data.prices)
        }
      } catch (err) {
        console.error('Error fetching prices:', err)
        // Garder les prix par défaut
      }
    }
    fetchPrices()
  }, [])

  // Charger les quotas utilisateur si connecté
  useEffect(() => {
    if (!isLoggedIn) return
    const fetchQuotas = async () => {
      try {
        const response = await fetchWithAuth('/api/user/quotas')
        const data = await response.json()
        if (data.success && data.quotas) {
          setUserQuotas(data.quotas)
        }
      } catch (err) {
        console.error('Error fetching quotas:', err)
      }
    }
    fetchQuotas()
  }, [isLoggedIn])

  // Auto-checkout si paramètre buy ou product présent
  useEffect(() => {
    const buyParam = searchParams.get('buy')
    const productParam = searchParams.get('product')

    if (isLoggedIn && !autoCheckoutTriggered.current) {
      // Mapper les paramètres buy vers les planTypes
      const buyToPlanMap: Record<string, string> = {
        'oneshot': 'oneshot-premium',
        'elite': 'elite-team',
        'platinium': 'platinium_solo',
      }

      // Mapper les paramètres product vers les planTypes
      const productToPlanMap: Record<string, string> = {
        'free-slot': 'slot_invite',
      }

      let planType: string | undefined

      if (buyParam) {
        planType = buyToPlanMap[buyParam]
      } else if (productParam) {
        planType = productToPlanMap[productParam]
      }

      if (planType) {
        autoCheckoutTriggered.current = true
        // Petit délai pour que la page soit chargée
        setTimeout(() => handleCheckout(planType), 100)
      }
    }
  }, [searchParams, isLoggedIn])

  const handleCheckout = async (planType: string) => {
    if (!isLoggedIn) {
      router.push('/auth/login?redirect=/pricing')
      return
    }

    setLoading(planType)
    try {
      // Mapper les types de plan vers les types Stripe
      const purchaseTypeMap: Record<string, string> = {
        'oneshot-premium': 'tournament_creation_oneshot',
        'elite-team': 'tournament_creation_elite',
        'platinium_solo': 'platinium_participation',
        'platinium_group': 'platinium_group_11',
        'slot_invite': 'slot_invite',
      }

      const purchaseType = purchaseTypeMap[planType]
      if (!purchaseType) {
        alert(t('stripeModal.invalidPlan'))
        return
      }

      // Préparer les headers
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }

      // Dans Capacitor, ajouter le token d'auth dans le header
      if (isCapacitor()) {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`
        }
      }

      const response = await fetchWithAuth('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers,
        body: JSON.stringify({ purchaseType, returnUrl: window.location.pathname }),
      })

      const data = await response.json()
      if (data.url) {
        // Rediriger vers la page de checkout Stripe (compatible Capacitor)
        await openExternalUrl(data.url)
      } else {
        // Afficher l'erreur dans une modale conviviale
        setStripeError(data.error || t('stripeModal.paymentError'))
      }
    } catch (error) {
      console.error('Checkout error:', error)
      setStripeError(t('stripeModal.paymentErrorRetry'))
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 theme-bg theme-text py-16 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12 relative z-10">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              {t('header.title')}
            </h1>
            <p className="text-xl theme-text-secondary max-w-2xl mx-auto">
              {t('header.subtitle')}
            </p>
          </div>

          {/* Plans Grid - 5 cartes */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mb-16 relative z-0">

            {/* Free-Kick - Gratuit */}
            <div className="bg-(--card-bg) rounded-2xl p-6 border border-blue-500/50 flex flex-col">
              <div className="mb-6 text-center h-32 flex flex-col justify-start">
                <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mb-4 mx-auto">
                  <img src="/images/icons/free-tour.svg" alt="Free-Kick" className="w-6 h-6 icon-filter-blue" />
                </div>
                <h3 className="text-xl font-bold mb-2 text-blue-400">Free-Kick</h3>
                <p className="theme-text-secondary text-sm">{t('plans.freeSubtitle')}</p>
              </div>

              <div className="mb-6 text-center h-16 flex flex-col justify-center">
                <span className="text-sm theme-text-secondary">{t('pricePerTournament')}</span>
                <div>
                  <span className="text-4xl font-bold">0</span>
                  <span className="theme-text-secondary ml-1">EUR</span>
                </div>
              </div>

              <ul className="space-y-3 mb-6 flex-grow">
                <PlanFeature included>{t('features.freeTournaments2')}</PlanFeature>
                <PlanFeature included>{t('features.freeCompetition')}</PlanFeature>
                <PlanFeature included>{t('features.matchdayLimit', { count: prices.freeMaxMatchdays })}</PlanFeature>
                <PlanFeature included>{t('features.maxPlayers', { count: prices.freeMaxPlayers })}</PlanFeature>
                <PlanFeature included>{t('features.bonusSettings')}</PlanFeature>
              </ul>

              {/* Extensions */}
              <div className="border-t theme-border pt-4 mb-6">
                <p className="text-xs theme-text-secondary uppercase mb-3 font-medium">{t('extensionsAvailable')}</p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 theme-text-secondary">
                    <Plus className="w-4 h-4 text-blue-400" />
                    <span>{t('extensions.extendDuration')} <span className="text-blue-400 font-medium">{prices.durationExtension.toFixed(2).replace('.', ',')} EUR</span></span>
                  </div>
                  <div className="flex items-center gap-2 theme-text-secondary">
                    <Plus className="w-4 h-4 text-blue-400" />
                    <span>{t('extensions.plus5Players')} <span className="text-blue-400 font-medium">{prices.playerExtension.toFixed(2).replace('.', ',')} EUR</span></span>
                  </div>
                  <div className="flex items-center gap-2 theme-text-secondary">
                    <Plus className="w-4 h-4 text-blue-400" />
                    <span>{t('extensions.slotInvite')} <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleCheckout('slot_invite')
                      }}
                      disabled={loading === 'slot_invite'}
                      className="text-blue-400 font-medium hover:text-blue-300 hover:underline transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {loading === 'slot_invite' ? '...' : `${prices.slotInvite.toFixed(2).replace('.', ',')} EUR`}
                    </button></span>
                  </div>
                </div>
              </div>

              {/* Bouton conditionnel selon les quotas */}
              {!isLoggedIn ? (
                <button
                  onClick={() => router.push('/auth/signup')}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors"
                >
                  {t('cta.startFree')}
                </button>
              ) : userQuotas && userQuotas.free_tournaments_active >= userQuotas.free_tournaments_max ? (
                <button
                  onClick={() => handleCheckout('slot_invite')}
                  disabled={loading === 'slot_invite'}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading === 'slot_invite' ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    t('cta.buySlot')
                  )}
                </button>
              ) : (
                <button
                  onClick={() => router.push('/dashboard')}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors"
                >
                  {t('cta.backToDashboard')}
                </button>
              )}
            </div>

            {/* One-Shot */}
            <div className="bg-(--card-bg) rounded-2xl p-6 border border-green-500/50 flex flex-col">
              <div className="mb-6 text-center h-32 flex flex-col justify-start">
                <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mb-4 mx-auto">
                  <img src="/images/icons/on-shot-tour.svg" alt="One-Shot" className="w-6 h-6 icon-filter-green" />
                </div>
                <h3 className="text-xl font-bold mb-2 text-green-400">One-Shot</h3>
                <p className="theme-text-secondary text-sm">{t('plans.oneshotSubtitle')}</p>
              </div>

              <div className="mb-6 text-center h-16 flex flex-col justify-center">
                <span className="text-sm theme-text-secondary">{t('pricePerTournament')}</span>
                <div>
                  <span className="text-4xl font-bold">{prices.oneshot.toFixed(2).replace('.', ',')}</span>
                  <span className="theme-text-secondary ml-1">EUR</span>
                </div>
              </div>

              <ul className="space-y-3 mb-6 flex-grow">
                <PlanFeature included>{t('features.oneActiveTournament')}</PlanFeature>
                <PlanFeature included>{t('features.freeCompetition')}</PlanFeature>
                <PlanFeature included>{t('features.unlimitedDuration')}</PlanFeature>
                <PlanFeature included>{t('features.maxPlayers', { count: prices.oneshotMaxPlayers })}</PlanFeature>
                <PlanFeature included>{t('features.trophiesUnlock')}</PlanFeature>
                <PlanFeature included>{t('features.bonusSettings')}</PlanFeature>
              </ul>

              {/* Extensions */}
              <div className="border-t theme-border pt-4 mb-6">
                <p className="text-xs theme-text-secondary uppercase mb-3 font-medium">{t('extensionsAvailable')}</p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 theme-text-secondary">
                    <Plus className="w-4 h-4 text-green-400" />
                    <span>{t('extensions.slotInvite')} <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleCheckout('slot_invite')
                      }}
                      disabled={loading === 'slot_invite'}
                      className="text-green-400 font-medium hover:text-green-300 hover:underline transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {loading === 'slot_invite' ? '...' : `${prices.slotInvite.toFixed(2).replace('.', ',')} EUR`}
                    </button></span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleCheckout('oneshot-premium')}
                disabled={loading === 'oneshot-premium'}
                className="w-full py-3 px-4 bg-green-600 hover:bg-green-500 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading === 'oneshot-premium' ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  t('cta.buy')
                )}
              </button>
            </div>

            {/* Elite Team - Populaire */}
            <div className="bg-gradient-to-b from-orange-500/20 to-transparent rounded-2xl p-6 border-2 border-orange-500 flex flex-col relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                  {t('plans.popular')}
                </span>
              </div>

              <div className="mb-6 text-center h-32 flex flex-col justify-start">
                <div className="w-12 h-12 bg-orange-500/20 rounded-full flex items-center justify-center mb-4 mx-auto">
                  <img src="/images/icons/team-elite-tour.svg" alt="Elite Team" className="w-6 h-6 icon-filter-orange" />
                </div>
                <h3 className="text-xl font-bold mb-2 text-orange-400">Elite Team</h3>
                <p className="theme-text-secondary text-sm">{t('plans.eliteSubtitle')}</p>
              </div>

              <div className="mb-6 text-center h-16 flex flex-col justify-center">
                <span className="text-sm theme-text-secondary">{t('pricePerTournament')}</span>
                <div>
                  <span className="text-4xl font-bold">{prices.elite.toFixed(2).replace('.', ',')}</span>
                  <span className="theme-text-secondary ml-1">EUR</span>
                </div>
              </div>

              <ul className="space-y-3 mb-6 flex-grow">
                <PlanFeature included>{t('features.oneActiveTournament')}</PlanFeature>
                <PlanFeature included>{t('features.freeCompetition')}</PlanFeature>
                <PlanFeature included>{t('features.unlimitedDuration')}</PlanFeature>
                <PlanFeature included>{t('features.maxPlayers', { count: prices.eliteMaxPlayers })}</PlanFeature>
                <PlanFeature included>{t('features.trophiesUnlock')}</PlanFeature>
                <PlanFeature included>{t('features.bonusSettings')}</PlanFeature>
                <PlanFeature included>{t('features.teamPlay')}</PlanFeature>
              </ul>

              {/* Extensions */}
              <div className="border-t theme-border pt-4 mb-6">
                <p className="text-xs theme-text-secondary uppercase mb-3 font-medium">{t('extensionsAvailable')}</p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 theme-text-secondary">
                    <Plus className="w-4 h-4 text-orange-400" />
                    <span>{t('extensions.slotInvite')} <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleCheckout('slot_invite')
                      }}
                      disabled={loading === 'slot_invite'}
                      className="text-orange-400 font-medium hover:text-orange-300 hover:underline transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {loading === 'slot_invite' ? '...' : `${prices.slotInvite.toFixed(2).replace('.', ',')} EUR`}
                    </button></span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleCheckout('elite-team')}
                disabled={loading === 'elite-team'}
                className="w-full py-3 px-4 bg-orange-500 hover:bg-orange-400 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading === 'elite-team' ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  t('cta.buyElite')
                )}
              </button>
            </div>

            {/* Platinium */}
            <div className="bg-(--card-bg) rounded-2xl p-6 border border-yellow-500/50 flex flex-col">
              <div className="mb-6 text-center h-32 flex flex-col justify-start">
                <div className="w-12 h-12 bg-yellow-500/20 rounded-full flex items-center justify-center mb-4 mx-auto">
                  <img src="/images/icons/premium-tour.svg" alt="Platinium" className="w-6 h-6 icon-filter-yellow" />
                </div>
                <h3 className="text-xl font-bold mb-2 text-yellow-400">Platinium</h3>
                <p className="theme-text-secondary text-sm">{t('plans.platiniumSubtitle')}</p>
              </div>

              <div className="mb-6 text-center h-16 flex flex-col justify-center">
                <span className="text-sm theme-text-secondary">{t('pricePerParticipant')}</span>
                <div>
                  <span className="text-4xl font-bold">{prices.platinium.toFixed(2).replace('.', ',')}</span>
                  <span className="theme-text-secondary ml-1">EUR</span>
                </div>
              </div>

              <ul className="space-y-3 mb-6 flex-grow">
                <PlanFeature included>{t('features.oneActiveTournament')}</PlanFeature>
                <PlanFeature included>{t('features.freeCompetition')}</PlanFeature>
                <PlanFeature included>{t('features.unlimitedDuration')}</PlanFeature>
                <PlanFeature included>{t('features.playersRange', { min: prices.platiniumMinPlayers, max: prices.platiniumMaxPlayers })}</PlanFeature>
                <PlanFeature included>{t('features.trophiesUnlock')}</PlanFeature>
                <PlanFeature included>{t('features.bonusSettings')}</PlanFeature>
                <PlanFeature included>{t('features.teamPlay')}</PlanFeature>
                <PlanFeature included>{t('features.winnerPrize')}</PlanFeature>
                <li className="flex items-center justify-center mt-2">
                  <img src="/images/le-bon-maillot.svg" alt="Le Bon Maillot" className="h-10" />
                </li>
              </ul>

              <button
                onClick={() => {
                  if (!isLoggedIn) {
                    router.push('/auth/login?redirect=/pricing')
                    return
                  }
                  setShowPlatiniumModal(true)
                }}
                className="w-full py-3 px-4 bg-yellow-600 hover:bg-yellow-500 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                {t('cta.launchPlatinium')}
              </button>
            </div>

            {/* Corpo */}
            <div className="bg-(--card-bg) rounded-2xl p-6 border border-purple-500/50 flex flex-col">
              <div className="mb-6 text-center h-32 flex flex-col justify-start">
                <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center mb-4 mx-auto">
                  <img src="/images/icons/company-tour.svg" alt="Corpo" className="w-6 h-6 icon-filter-purple" />
                </div>
                <h3 className="text-xl font-bold mb-2 text-purple-400">Corpo</h3>
                <p className="theme-text-secondary text-sm">{t('plans.corpoSubtitle')}</p>
              </div>

              <div className="mb-6 text-center h-16 flex flex-col justify-center">
                <span className="text-sm theme-text-secondary">{t('from')}</span>
                <div>
                  <span className="text-4xl font-bold">99</span>
                  <span className="theme-text-secondary ml-1">EUR</span>
                </div>
              </div>

              <ul className="space-y-3 mb-6 flex-grow">
                <PlanFeature included>{t('features.oneActiveTournament')}</PlanFeature>
                <PlanFeature included>{t('features.freeCompetition')}</PlanFeature>
                <PlanFeature included>{t('features.unlimitedDuration')}</PlanFeature>
                <PlanFeature included>{t('features.upTo300')}</PlanFeature>
                <PlanFeature included>{t('features.trophiesUnlock')}</PlanFeature>
                <PlanFeature included>{t('features.bonusSettings')}</PlanFeature>
                <PlanFeature included>{t('features.teamPlay')}</PlanFeature>
                <PlanFeature included>{t('features.tournamentBranding')}</PlanFeature>
                <PlanFeature included>{t('features.adminTools')}</PlanFeature>
                <PlanFeature included>{t('features.prizeGallery')}</PlanFeature>
              </ul>

              <button
                onClick={() => router.push('/contact?type=enterprise')}
                className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-500 rounded-lg font-medium transition-colors"
              >
                {t('cta.contactUs')}
              </button>
            </div>
          </div>

          {/* FAQ */}
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-8">{t('faq.title')}</h2>
            <div className="space-y-4">
              <FaqItem
                question={t('faq.q1')}
                answer={t('faq.a1')}
              />
              <FaqItem
                question={t('faq.q2')}
                answer={t('faq.a2')}
              />
              <FaqItem
                question={t('faq.q3')}
                answer={t('faq.a3')}
              />
              <FaqItem
                question={t('faq.q4')}
                answer={t('faq.a4')}
              />
              <FaqItem
                question={t('faq.q5')}
                answer={t('faq.a5')}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Modal Erreur Stripe */}
      {stripeError && (
        <div className="modal-backdrop">
          <div className="bg-(--card-bg) rounded-2xl max-w-md w-full overflow-hidden">
            <div className="p-6 border-b theme-border bg-red-500/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                </div>
                <h2 className="text-xl font-bold text-red-400">{t('stripeModal.title')}</h2>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <p className="theme-text-secondary">{stripeError}</p>
              {stripeError.includes('configure') && (
                <p className="text-sm theme-text-secondary">
                  {t('stripeModal.devNote')}
                </p>
              )}
              <button
                onClick={() => setStripeError(null)}
                className="w-full py-3 px-4 bg-gray-500 hover:bg-gray-400 rounded-lg font-medium transition-colors"
              >
                {tc('close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Platinium */}
      {showPlatiniumModal && (
        <div className="modal-backdrop">
          <div className="bg-(--card-bg) rounded-2xl max-w-4xl w-full">
            {/* Header */}
            <div className="p-4 border-b theme-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-yellow-500/20 rounded-full flex items-center justify-center">
                    <img src="/images/icons/premium-tour.svg" alt="Platinium" className="w-5 h-5 icon-filter-yellow" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-yellow-400">{t('platiniumModal.title')}</h2>
                    <p className="text-xs theme-text-secondary">{t('platiniumModal.subtitle')}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPlatiniumModal(false)}
                  className="theme-text-secondary hover:theme-text transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Contenu - 2 colonnes sur desktop */}
            <div className="p-4">
              <div className="grid md:grid-cols-2 gap-4">
                {/* Option 1 : Solo */}
                <div className="bg-(--card-bg) rounded-xl p-4 border border-(--border-color) hover:border-yellow-500/50 transition-colors flex flex-col">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-semibold theme-text">{t('platiniumModal.solo.title')}</h3>
                      <p className="text-xs theme-text-secondary">{t('platiniumModal.solo.subtitle')}</p>
                    </div>
                    <p className="text-2xl font-bold text-yellow-400">{prices.platinium.toFixed(2).replace('.', ',')} <span className="text-sm font-normal theme-text-secondary">€</span></p>
                  </div>
                  <ul className="space-y-1.5 mb-3 text-sm theme-text-secondary flex-grow">
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span>{t('platiniumModal.solo.feat1')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span>{t('platiniumModal.solo.feat2', { price: prices.platinium.toFixed(2).replace('.', ',') })}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span>{t('platiniumModal.solo.feat3', { count: prices.platiniumMinPlayers })}</span>
                    </li>
                  </ul>
                  <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-2 mb-3">
                    <p className="text-xs text-orange-300">
                      {t.rich('platiniumModal.solo.note', { b: (c) => <strong>{c}</strong>, count: prices.platiniumMinPlayers })}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowPlatiniumModal(false)
                      handleCheckout('platinium_solo')
                    }}
                    disabled={loading === 'platinium_solo'}
                    className="w-full py-2.5 px-4 bg-yellow-600 hover:bg-yellow-500 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading === 'platinium_solo' ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      t('platiniumModal.solo.pay', { price: prices.platinium.toFixed(2).replace('.', ',') })
                    )}
                  </button>
                </div>

                {/* Option 2 : Groupe */}
                <div className="bg-(--card-bg) rounded-xl p-4 border-2 border-yellow-500/50 hover:border-yellow-500 transition-colors relative flex flex-col">
                  <div className="absolute -top-2.5 left-4">
                    <span className="bg-yellow-500 text-black text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                      {t('platiniumModal.group.save', { amount: (prices.platinium * prices.platiniumGroupSize - prices.platiniumGroup).toFixed(2).replace('.', ',') })}
                    </span>
                  </div>
                  <div className="flex items-start justify-between mb-3 mt-1">
                    <div>
                      <h3 className="text-lg font-semibold theme-text">{t('platiniumModal.group.places', { count: prices.platiniumGroupSize })}</h3>
                      <p className="text-xs theme-text-secondary">{t('platiniumModal.group.subtitle')}</p>
                    </div>
                    <p className="text-2xl font-bold text-yellow-400">{prices.platiniumGroup.toFixed(2).replace('.', ',')} <span className="text-sm font-normal theme-text-secondary">€</span></p>
                  </div>
                  <ul className="space-y-1.5 mb-3 text-sm theme-text-secondary flex-grow">
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span>{t.rich('platiniumModal.group.feat1', { b: (c) => <strong>{c}</strong> })}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span>{t('platiniumModal.group.feat2', { count: prices.platiniumGroupSize })}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span>{t('platiniumModal.group.feat3', { count: prices.platiniumMaxPlayers - prices.platiniumGroupSize, price: prices.platinium.toFixed(2).replace('.', ',') })}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span>{t('platiniumModal.group.feat4')}</span>
                    </li>
                  </ul>
                  <button
                    onClick={() => {
                      setShowPlatiniumModal(false)
                      handleCheckout('platinium_group')
                    }}
                    disabled={loading === 'platinium_group'}
                    className="w-full py-2.5 px-4 bg-green-600 hover:bg-green-500 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading === 'platinium_group' ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      t('platiniumModal.group.pay', { price: prices.platiniumGroup.toFixed(2).replace('.', ',') })
                    )}
                  </button>
                </div>
              </div>

              {/* Lot à gagner */}
              <div className="flex items-center justify-center gap-3 p-3 mt-4 border border-yellow-500/30 rounded-lg bg-yellow-500/5">
                <img src="/images/le-bon-maillot.svg" alt="Le Bon Maillot" className="h-8" />
                <p className="text-sm text-yellow-400 font-medium">
                  {t('platiniumModal.prize')}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  )
}

function PlanFeature({ children, included = false }: { children: React.ReactNode; included?: boolean }) {
  return (
    <li className="flex items-start gap-3 text-sm">
      {included ? (
        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
      ) : (
        <X className="w-5 h-5 text-gray-600 flex-shrink-0 mt-0.5" />
      )}
      <span className={included ? 'theme-text' : 'theme-text-secondary'}>{children}</span>
    </li>
  )
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="border theme-border rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-(--card-bg) transition-colors"
      >
        <span className="font-medium">{question}</span>
        <span className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>
      {isOpen && (
        <div className="px-6 py-4 bg-(--card-bg) theme-text-secondary">
          {answer}
        </div>
      )}
    </div>
  )
}
