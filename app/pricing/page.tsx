'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X, Loader2, Crown, Zap, Building2 } from 'lucide-react'
import { PRICING, ACCOUNT_LIMITS } from '@/types/monetization'

type PlanInterval = 'monthly' | 'yearly'

export default function PricingPage() {
  const router = useRouter()
  const [interval, setInterval] = useState<PlanInterval>('monthly')
  const [loading, setLoading] = useState<string | null>(null)

  const handleCheckout = async (type: 'subscription' | 'oneshot' | 'enterprise', subscriptionType?: PlanInterval) => {
    setLoading(type)
    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          subscriptionType: type === 'subscription' ? subscriptionType || interval : undefined,
        }),
      })

      const data = await response.json()
      if (data.url) {
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

  const formatPrice = (priceInCents: number) => {
    return (priceInCents / 100).toFixed(2).replace('.', ',')
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white py-16 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Choisissez votre formule
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Commencez gratuitement, puis passez au niveau superieur quand vous etes pret
          </p>
        </div>

        {/* Toggle Mensuel/Annuel */}
        <div className="flex justify-center mb-12">
          <div className="bg-gray-800 p-1 rounded-full flex gap-1">
            <button
              onClick={() => setInterval('monthly')}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                interval === 'monthly'
                  ? 'bg-orange-500 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Mensuel
            </button>
            <button
              onClick={() => setInterval('yearly')}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                interval === 'yearly'
                  ? 'bg-orange-500 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Annuel
              <span className="ml-2 text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">
                -33%
              </span>
            </button>
          </div>
        </div>

        {/* Plans Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {/* Plan Gratuit */}
          <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700 flex flex-col">
            <div className="mb-6">
              <div className="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-gray-400" />
              </div>
              <h3 className="text-xl font-bold mb-2">Gratuit</h3>
              <p className="text-gray-400 text-sm">Pour decouvrir PronoHub</p>
            </div>

            <div className="mb-6">
              <span className="text-4xl font-bold">0</span>
              <span className="text-gray-400">EUR</span>
            </div>

            <ul className="space-y-3 mb-8 flex-grow">
              <PlanFeature included>Jusqu'a {ACCOUNT_LIMITS.free.maxTournaments} tournois</PlanFeature>
              <PlanFeature included>Max {ACCOUNT_LIMITS.free.maxPlayersPerTournament} joueurs par tournoi</PlanFeature>
              <PlanFeature included>Classements basiques</PlanFeature>
              <PlanFeature included>Pronostics simples</PlanFeature>
              <PlanFeature>Statistiques avancees</PlanFeature>
              <PlanFeature>Historique complet</PlanFeature>
            </ul>

            <button
              onClick={() => router.push('/auth')}
              className="w-full py-3 px-4 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
            >
              Commencer gratuitement
            </button>
          </div>

          {/* Plan One-Shot */}
          <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700 flex flex-col">
            <div className="mb-6">
              <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-blue-500" />
              </div>
              <h3 className="text-xl font-bold mb-2">One-Shot</h3>
              <p className="text-gray-400 text-sm">Pour un tournoi premium unique</p>
            </div>

            <div className="mb-6">
              <span className="text-4xl font-bold">{formatPrice(PRICING.oneshot.price)}</span>
              <span className="text-gray-400">EUR</span>
              <span className="text-sm text-gray-500 block">paiement unique</span>
            </div>

            <ul className="space-y-3 mb-8 flex-grow">
              <PlanFeature included>1 tournoi premium</PlanFeature>
              <PlanFeature included>Max {ACCOUNT_LIMITS.oneshot.maxPlayersPerTournament} joueurs</PlanFeature>
              <PlanFeature included>Classements complets</PlanFeature>
              <PlanFeature included>Statistiques etendues</PlanFeature>
              <PlanFeature included>Valable jusqu'a fin du tournoi</PlanFeature>
              <PlanFeature>Tournois illimites</PlanFeature>
            </ul>

            <button
              onClick={() => handleCheckout('oneshot')}
              disabled={loading === 'oneshot'}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading === 'oneshot' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>Acheter</>
              )}
            </button>
          </div>

          {/* Plan Premium */}
          <div className="bg-gradient-to-b from-orange-500/20 to-transparent rounded-2xl p-6 border-2 border-orange-500 flex flex-col relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                POPULAIRE
              </span>
            </div>

            <div className="mb-6">
              <div className="w-12 h-12 bg-orange-500/20 rounded-full flex items-center justify-center mb-4">
                <Crown className="w-6 h-6 text-orange-500" />
              </div>
              <h3 className="text-xl font-bold mb-2">Premium</h3>
              <p className="text-gray-400 text-sm">Pour les passionnes</p>
            </div>

            <div className="mb-6">
              <span className="text-4xl font-bold">
                {interval === 'monthly'
                  ? formatPrice(PRICING.subscription.monthly.price)
                  : formatPrice(Math.round(PRICING.subscription.yearly.price / 12))
                }
              </span>
              <span className="text-gray-400">EUR/mois</span>
              {interval === 'yearly' && (
                <span className="text-sm text-green-400 block">
                  {formatPrice(PRICING.subscription.yearly.price)} EUR/an
                </span>
              )}
            </div>

            <ul className="space-y-3 mb-8 flex-grow">
              <PlanFeature included>Jusqu'a {ACCOUNT_LIMITS.premium.maxActiveTournaments} tournois actifs</PlanFeature>
              <PlanFeature included>Max {ACCOUNT_LIMITS.premium.maxPlayersPerTournament} joueurs par tournoi</PlanFeature>
              <PlanFeature included>Tous les classements</PlanFeature>
              <PlanFeature included>Statistiques completes</PlanFeature>
              <PlanFeature included>Historique complet</PlanFeature>
              <PlanFeature included>Gestion avancee</PlanFeature>
            </ul>

            <button
              onClick={() => handleCheckout('subscription', interval)}
              disabled={loading === 'subscription'}
              className="w-full py-3 px-4 bg-orange-500 hover:bg-orange-400 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading === 'subscription' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>S'abonner</>
              )}
            </button>
          </div>

          {/* Plan Entreprise */}
          <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700 flex flex-col">
            <div className="mb-6">
              <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center mb-4">
                <Building2 className="w-6 h-6 text-purple-500" />
              </div>
              <h3 className="text-xl font-bold mb-2">Entreprise</h3>
              <p className="text-gray-400 text-sm">Pour les grandes organisations</p>
            </div>

            <div className="mb-6">
              <span className="text-4xl font-bold">{formatPrice(PRICING.enterprise.basePrice)}</span>
              <span className="text-gray-400">EUR</span>
              <span className="text-sm text-gray-500 block">configuration unique</span>
            </div>

            <ul className="space-y-3 mb-8 flex-grow">
              <PlanFeature included>Jusqu'a {ACCOUNT_LIMITS.enterprise.maxPlayersPerTournament} participants</PlanFeature>
              <PlanFeature included>Branding personnalise</PlanFeature>
              <PlanFeature included>Logo et couleurs custom</PlanFeature>
              <PlanFeature included>Outils d'administration</PlanFeature>
              <PlanFeature included>Gestion d'equipes</PlanFeature>
              <PlanFeature included>Support prioritaire</PlanFeature>
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
          <h2 className="text-2xl font-bold text-center mb-8">Questions frequentes</h2>
          <div className="space-y-4">
            <FaqItem
              question="Puis-je changer de formule a tout moment ?"
              answer="Oui, vous pouvez passer a une formule superieure a tout moment. Le changement prend effet immediatement."
            />
            <FaqItem
              question="Que se passe-t-il si je depasse mes quotas ?"
              answer="Vous ne pourrez plus creer de nouveaux tournois tant que vous n'aurez pas libere un slot (tournoi termine) ou passe a une formule superieure."
            />
            <FaqItem
              question="Le paiement est-il securise ?"
              answer="Oui, tous les paiements sont geres par Stripe, leader mondial du paiement en ligne. Nous ne stockons jamais vos informations bancaires."
            />
            <FaqItem
              question="Puis-je annuler mon abonnement ?"
              answer="Oui, vous pouvez annuler a tout moment depuis votre espace client. Votre abonnement restera actif jusqu'a la fin de la periode payee."
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function PlanFeature({ children, included = false }: { children: React.ReactNode; included?: boolean }) {
  return (
    <li className="flex items-center gap-3 text-sm">
      {included ? (
        <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
      ) : (
        <X className="w-5 h-5 text-gray-600 flex-shrink-0" />
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
