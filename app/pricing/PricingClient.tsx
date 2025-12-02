'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X, Loader2, Zap, Trophy, Users, Award, Building2, Plus } from 'lucide-react'
import Footer from '@/components/Footer'

interface PricingClientProps {
  isLoggedIn: boolean
}

interface Prices {
  oneshot: number
  elite: number
  platinium: number
  platiniumGroup: number
  platiniumGroupSize: number
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
  platiniumGroup: 76.89,
  platiniumGroupSize: 11,
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
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [showPlatiniumModal, setShowPlatiniumModal] = useState(false)
  const [prices, setPrices] = useState<Prices>(defaultPrices)

  // Charger les prix depuis l'API
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const response = await fetch('/api/pricing/config')
        const data = await response.json()
        if (data.success && data.prices) {
          setPrices(data.prices)
        }
      } catch (err) {
        console.error('Error fetching prices:', err)
        // Garder les prix par defaut
      }
    }
    fetchPrices()
  }, [])

  const handleCheckout = async (planType: string) => {
    if (!isLoggedIn) {
      router.push('/auth?redirect=/pricing')
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
      }

      const purchaseType = purchaseTypeMap[planType]
      if (!purchaseType) {
        alert('Type de plan invalide')
        return
      }

      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchaseType }),
      })

      const data = await response.json()
      if (data.url) {
        // Rediriger vers la page de checkout Stripe
        window.location.href = data.url
      } else {
        alert(data.error || 'Erreur lors du paiement')
      }
    } catch (error) {
      console.error('Checkout error:', error)
      alert('Erreur lors du paiement')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 bg-gradient-to-b from-gray-900 to-gray-800 text-white py-16 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Choisissez votre stratégie
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              4-4-2 classique ou en losange ? Optez pour la formule qui vous convient.
            </p>
          </div>

          {/* Plans Grid - 5 cartes */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mb-16">

            {/* Free-Kick - Gratuit */}
            <div className="bg-gray-800/50 rounded-2xl p-6 border border-blue-500/50 flex flex-col">
              <div className="mb-6 text-center h-32 flex flex-col justify-start">
                <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mb-4 mx-auto">
                  <Zap className="w-6 h-6 text-blue-500" />
                </div>
                <h3 className="text-xl font-bold mb-2 text-blue-400">Free-Kick</h3>
                <p className="text-gray-400 text-sm">Pour découvrir PronoHub</p>
              </div>

              <div className="mb-6 text-center h-16 flex flex-col justify-center">
                <span className="text-sm text-gray-500">Tarif par tournoi</span>
                <div>
                  <span className="text-4xl font-bold">0</span>
                  <span className="text-gray-400 ml-1">EUR</span>
                </div>
              </div>

              <ul className="space-y-3 mb-6 flex-grow">
                <PlanFeature included>2 tournois actifs max</PlanFeature>
                <PlanFeature included>Competition ponctuelle gratuite</PlanFeature>
                <PlanFeature included>Limite a {prices.freeMaxMatchdays} journees</PlanFeature>
                <PlanFeature included>Max {prices.freeMaxPlayers} joueurs</PlanFeature>
                <PlanFeature included>Parametrage de bonus</PlanFeature>
              </ul>

              {/* Extensions */}
              <div className="border-t border-gray-700 pt-4 mb-6">
                <p className="text-xs text-gray-500 uppercase mb-3 font-medium">Extensions disponibles</p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-400">
                    <Plus className="w-4 h-4 text-blue-400" />
                    <span>Etendre la duree : <span className="text-blue-400 font-medium">{prices.durationExtension.toFixed(2).replace('.', ',')} EUR</span></span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    <Plus className="w-4 h-4 text-blue-400" />
                    <span>+5 joueurs : <span className="text-blue-400 font-medium">{prices.playerExtension.toFixed(2).replace('.', ',')} EUR</span></span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    <Plus className="w-4 h-4 text-blue-400" />
                    <span>Slot invite : <span className="text-blue-400 font-medium">{prices.slotInvite.toFixed(2).replace('.', ',')} EUR</span></span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => router.push(isLoggedIn ? '/dashboard' : '/auth')}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors"
              >
                {isLoggedIn ? 'Retour au dashboard' : 'Commencer gratuitement'}
              </button>
            </div>

            {/* One-Shot */}
            <div className="bg-gray-800/50 rounded-2xl p-6 border border-green-500/50 flex flex-col">
              <div className="mb-6 text-center h-32 flex flex-col justify-start">
                <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mb-4 mx-auto">
                  <Trophy className="w-6 h-6 text-green-500" />
                </div>
                <h3 className="text-xl font-bold mb-2 text-green-400">One-Shot</h3>
                <p className="text-gray-400 text-sm">Pour un tournoi complet</p>
              </div>

              <div className="mb-6 text-center h-16 flex flex-col justify-center">
                <span className="text-sm text-gray-500">Tarif par tournoi</span>
                <div>
                  <span className="text-4xl font-bold">{prices.oneshot.toFixed(2).replace('.', ',')}</span>
                  <span className="text-gray-400 ml-1">EUR</span>
                </div>
              </div>

              <ul className="space-y-3 mb-6 flex-grow">
                <PlanFeature included>1 tournoi actif</PlanFeature>
                <PlanFeature included>Competition ponctuelle gratuite</PlanFeature>
                <PlanFeature included>Duree illimitee</PlanFeature>
                <PlanFeature included>Max {prices.oneshotMaxPlayers} joueurs</PlanFeature>
                <PlanFeature included>Deblocage de trophees</PlanFeature>
                <PlanFeature included>Parametrage de bonus</PlanFeature>
              </ul>

              {/* Extensions */}
              <div className="border-t border-gray-700 pt-4 mb-6">
                <p className="text-xs text-gray-500 uppercase mb-3 font-medium">Extensions disponibles</p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-400">
                    <Plus className="w-4 h-4 text-green-400" />
                    <span>Slot invite : <span className="text-green-400 font-medium">{prices.slotInvite.toFixed(2).replace('.', ',')} EUR</span></span>
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
                  'Acheter'
                )}
              </button>
            </div>

            {/* Elite Team - Populaire */}
            <div className="bg-gradient-to-b from-orange-500/20 to-transparent rounded-2xl p-6 border-2 border-orange-500 flex flex-col relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                  POPULAIRE
                </span>
              </div>

              <div className="mb-6 text-center h-32 flex flex-col justify-start">
                <div className="w-12 h-12 bg-orange-500/20 rounded-full flex items-center justify-center mb-4 mx-auto">
                  <Users className="w-6 h-6 text-orange-500" />
                </div>
                <h3 className="text-xl font-bold mb-2 text-orange-400">Elite Team</h3>
                <p className="text-gray-400 text-sm">Pour les grands groupes</p>
              </div>

              <div className="mb-6 text-center h-16 flex flex-col justify-center">
                <span className="text-sm text-gray-500">Tarif par tournoi</span>
                <div>
                  <span className="text-4xl font-bold">{prices.elite.toFixed(2).replace('.', ',')}</span>
                  <span className="text-gray-400 ml-1">EUR</span>
                </div>
              </div>

              <ul className="space-y-3 mb-6 flex-grow">
                <PlanFeature included>1 tournoi actif</PlanFeature>
                <PlanFeature included>Competition ponctuelle gratuite</PlanFeature>
                <PlanFeature included>Duree illimitee</PlanFeature>
                <PlanFeature included>Max {prices.eliteMaxPlayers} joueurs</PlanFeature>
                <PlanFeature included>Deblocage de trophees</PlanFeature>
                <PlanFeature included>Parametrage de bonus</PlanFeature>
                <PlanFeature included>Jeu en equipe</PlanFeature>
              </ul>

              {/* Extensions */}
              <div className="border-t border-gray-700 pt-4 mb-6">
                <p className="text-xs text-gray-500 uppercase mb-3 font-medium">Extensions disponibles</p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-400">
                    <Plus className="w-4 h-4 text-orange-400" />
                    <span>Slot invite : <span className="text-orange-400 font-medium">{prices.slotInvite.toFixed(2).replace('.', ',')} EUR</span></span>
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
                  'Acheter Elite Team'
                )}
              </button>
            </div>

            {/* Platinium */}
            <div className="bg-gray-800/50 rounded-2xl p-6 border border-yellow-500/50 flex flex-col">
              <div className="mb-6 text-center h-32 flex flex-col justify-start">
                <div className="w-12 h-12 bg-yellow-500/20 rounded-full flex items-center justify-center mb-4 mx-auto">
                  <Award className="w-6 h-6 text-yellow-500" />
                </div>
                <h3 className="text-xl font-bold mb-2 text-yellow-400">Platinium</h3>
                <p className="text-gray-400 text-sm">Tournoi événementiel</p>
              </div>

              <div className="mb-6 text-center h-16 flex flex-col justify-center">
                <span className="text-sm text-gray-500">Tarif par participant</span>
                <div>
                  <span className="text-4xl font-bold">{prices.platinium.toFixed(2).replace('.', ',')}</span>
                  <span className="text-gray-400 ml-1">EUR</span>
                </div>
              </div>

              <ul className="space-y-3 mb-6 flex-grow">
                <PlanFeature included>1 tournoi actif</PlanFeature>
                <PlanFeature included>Competition ponctuelle gratuite</PlanFeature>
                <PlanFeature included>Duree illimitee</PlanFeature>
                <PlanFeature included>{prices.platiniumMinPlayers} a {prices.platiniumMaxPlayers} joueurs</PlanFeature>
                <PlanFeature included>Deblocage de trophees</PlanFeature>
                <PlanFeature included>Parametrage de bonus</PlanFeature>
                <PlanFeature included>Jeu en equipe</PlanFeature>
                <PlanFeature included>Lot pour le vainqueur</PlanFeature>
                <li className="flex items-center justify-center mt-2">
                  <img src="/images/le-bon-maillot.svg" alt="Le Bon Maillot" className="h-10" />
                </li>
              </ul>

              <button
                onClick={() => {
                  if (!isLoggedIn) {
                    router.push('/auth?redirect=/pricing')
                    return
                  }
                  setShowPlatiniumModal(true)
                }}
                className="w-full py-3 px-4 bg-yellow-600 hover:bg-yellow-500 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                Lancer un Platinium
              </button>
            </div>

            {/* Corpo */}
            <div className="bg-gray-800/50 rounded-2xl p-6 border border-purple-500/50 flex flex-col">
              <div className="mb-6 text-center h-32 flex flex-col justify-start">
                <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center mb-4 mx-auto">
                  <Building2 className="w-6 h-6 text-purple-500" />
                </div>
                <h3 className="text-xl font-bold mb-2 text-purple-400">Corpo</h3>
                <p className="text-gray-400 text-sm">Pour les entreprises</p>
              </div>

              <div className="mb-6 text-center h-16 flex flex-col justify-center">
                <span className="text-sm text-gray-500">à partir de</span>
                <div>
                  <span className="text-4xl font-bold">99</span>
                  <span className="text-gray-400 ml-1">EUR</span>
                </div>
              </div>

              <ul className="space-y-3 mb-6 flex-grow">
                <PlanFeature included>1 tournoi actif</PlanFeature>
                <PlanFeature included>Compétition ponctuelle gratuite</PlanFeature>
                <PlanFeature included>Durée illimitée</PlanFeature>
                <PlanFeature included>Jusqu'à 300 joueurs</PlanFeature>
                <PlanFeature included>Déblocage de trophées</PlanFeature>
                <PlanFeature included>Paramétrage de bonus</PlanFeature>
                <PlanFeature included>Jeu en équipe</PlanFeature>
                <PlanFeature included>Branding du tournoi</PlanFeature>
                <PlanFeature included>Outils d'administration</PlanFeature>
                <PlanFeature included>Galerie des lots</PlanFeature>
              </ul>

              <button
                onClick={() => router.push('/contact?type=enterprise')}
                className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-500 rounded-lg font-medium transition-colors"
              >
                Nous contacter
              </button>
            </div>
          </div>

          {/* FAQ */}
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-8">Questions fréquentes</h2>
            <div className="space-y-4">
              <FaqItem
                question="Comment fonctionnent les tournois gratuits (Free-Kick) ?"
                answer="Chaque utilisateur peut participer à 2 tournois gratuits maximum simultanément, limités à 10 journées et 5 joueurs. Besoin de plus ? Achetez un slot invité (0,99 €), étendez la durée (3,99 €) ou augmentez le nombre de joueurs (1,99 € pour +5 joueurs)."
              />
              <FaqItem
                question="Comment fonctionnent One-Shot et Elite Team ?"
                answer="Le créateur paie une fois (4,99 € ou 9,99 €) et peut inviter gratuitement jusqu'à 9 (One-Shot) ou 19 (Elite Team) joueurs. Chaque joueur ne peut être invité gratuitement que dans un seul tournoi premium à la fois."
              />
              <FaqItem
                question="Le paiement est-il sécurisé ?"
                answer="Oui, tous les paiements sont gérés par Stripe, leader mondial du paiement en ligne. Nous ne stockons jamais vos informations bancaires."
              />
              <FaqItem
                question="Comment fonctionne le Platinium ?"
                answer="Le créateur paie 6,99 € et chaque participant doit également payer 6,99 € pour rejoindre. Le tournoi démarre à partir de 11 joueurs inscrits et peut accueillir jusqu'à 30 participants. Le gagnant remporte un maillot officiel !"
              />
              <FaqItem
                question="Qu'est-ce qu'une compétition ponctuelle offerte ?"
                answer="Avec Free-Kick, vous bénéficiez d'un accès gratuit aux grandes compétitions comme l'Euro ou la Coupe du Monde, sans consommer de slot tournoi."
              />
            </div>
          </div>
        </div>
      </div>

      {/* Modal Platinium */}
      {showPlatiniumModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-yellow-500/20 rounded-full flex items-center justify-center">
                    <Award className="w-5 h-5 text-yellow-500" />
                  </div>
                  <h2 className="text-xl font-bold text-yellow-400">Lancer un tournoi Platinium</h2>
                </div>
                <button
                  onClick={() => setShowPlatiniumModal(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <p className="text-gray-300">
                Le tournoi Platinium est un format premium avec un lot pour le vainqueur.
                Choisissez comment vous souhaitez lancer votre tournoi :
              </p>

              {/* Option 1 : Solo */}
              <div className="bg-gray-700/50 rounded-xl p-5 border border-gray-600 hover:border-yellow-500/50 transition-colors">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-1">Je paie ma place</h3>
                    <p className="text-2xl font-bold text-yellow-400">{prices.platinium.toFixed(2).replace('.', ',')} <span className="text-sm font-normal text-gray-400">EUR</span></p>
                  </div>
                  <span className="bg-yellow-500/20 text-yellow-400 text-xs px-2 py-1 rounded-full">Individuel</span>
                </div>
                <ul className="space-y-2 mb-4 text-sm text-gray-300">
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>Vous payez uniquement votre participation</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>Les autres participants paieront chacun {prices.platinium.toFixed(2).replace('.', ',')} EUR pour rejoindre</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>Le tournoi demarre a partir de {prices.platiniumMinPlayers} joueurs inscrits</span>
                  </li>
                </ul>
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 mb-4">
                  <p className="text-sm text-orange-300">
                    <strong>Important :</strong> Si le tournoi n&apos;atteint pas {prices.platiniumMinPlayers} participants,
                    votre paiement sera automatiquement converti en un acces One-Shot + 2 slots invites
                    (pas de remboursement).
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowPlatiniumModal(false)
                    handleCheckout('platinium_solo')
                  }}
                  disabled={loading === 'platinium_solo'}
                  className="w-full py-3 px-4 bg-yellow-600 hover:bg-yellow-500 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading === 'platinium_solo' ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    `Payer ${prices.platinium.toFixed(2).replace('.', ',')} EUR`
                  )}
                </button>
              </div>

              {/* Option 2 : Groupe */}
              <div className="bg-gray-700/50 rounded-xl p-5 border border-gray-600 hover:border-yellow-500/50 transition-colors">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-1">Je paie pour {prices.platiniumGroupSize} participants</h3>
                    <p className="text-2xl font-bold text-yellow-400">{prices.platiniumGroup.toFixed(2).replace('.', ',')} <span className="text-sm font-normal text-gray-400">EUR</span></p>
                    <p className="text-xs text-gray-500 mt-1">{prices.platiniumGroupSize} x {prices.platinium.toFixed(2).replace('.', ',')} EUR</p>
                  </div>
                  <span className="bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded-full">Recommande</span>
                </div>
                <ul className="space-y-2 mb-4 text-sm text-gray-300">
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>Le tournoi est <strong>garanti</strong> de demarrer immediatement</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>{prices.platiniumGroupSize} places deja payees pour vos invites</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>{prices.platiniumMaxPlayers - prices.platiniumGroupSize} places supplementaires disponibles (payantes a {prices.platinium.toFixed(2).replace('.', ',')} EUR)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>Vos amis peuvent vous rembourser entre vous</span>
                  </li>
                </ul>
                <button
                  onClick={() => {
                    setShowPlatiniumModal(false)
                    handleCheckout('platinium_group')
                  }}
                  disabled={loading === 'platinium_group'}
                  className="w-full py-3 px-4 bg-green-600 hover:bg-green-500 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading === 'platinium_group' ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    `Payer ${prices.platiniumGroup.toFixed(2).replace('.', ',')} EUR`
                  )}
                </button>
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
      <span className={included ? 'text-gray-200' : 'text-gray-500'}>{children}</span>
    </li>
  )
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-800/50 transition-colors"
      >
        <span className="font-medium">{question}</span>
        <span className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>
      {isOpen && (
        <div className="px-6 py-4 bg-gray-800/30 text-gray-400">
          {answer}
        </div>
      )}
    </div>
  )
}
