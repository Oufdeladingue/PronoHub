'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X, Loader2, Zap, Trophy, Users, Award, Building2, Plus } from 'lucide-react'
import Footer from '@/components/Footer'

interface PricingClientProps {
  isLoggedIn: boolean
}

export default function PricingClient({ isLoggedIn }: PricingClientProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  const handleCheckout = async (planType: string) => {
    setLoading(planType)
    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: planType }),
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
              <div className="mb-6 text-center">
                <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mb-4 mx-auto">
                  <Zap className="w-6 h-6 text-blue-500" />
                </div>
                <h3 className="text-xl font-bold mb-2 text-blue-400">Free-Kick</h3>
                <p className="text-gray-400 text-sm">Pour découvrir PronoHub</p>
              </div>

              <div className="mb-6 text-center">
                <span className="text-4xl font-bold">0</span>
                <span className="text-gray-400 ml-1">EUR</span>
              </div>

              <ul className="space-y-3 mb-6 flex-grow">
                <PlanFeature included>Jusqu'à 2 tournois actifs simultanés</PlanFeature>
                <PlanFeature included>1 compétition ponctuelle offerte (Euro, Coupe du monde)</PlanFeature>
                <PlanFeature included>Max 5 joueurs par tournoi</PlanFeature>
                <PlanFeature included>Limité à 10 journées</PlanFeature>
                <PlanFeature included>Pronostics simples</PlanFeature>
                <PlanFeature included>Classements basiques</PlanFeature>
                <PlanFeature included>Règles bonus simples</PlanFeature>
              </ul>

              {/* Extensions */}
              <div className="border-t border-gray-700 pt-4 mb-6">
                <p className="text-xs text-gray-500 uppercase mb-3 font-medium">Extensions disponibles</p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-400">
                    <Plus className="w-4 h-4 text-blue-400" />
                    <span>Étendre la durée : <span className="text-blue-400 font-medium">3,99 €</span></span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    <Plus className="w-4 h-4 text-blue-400" />
                    <span>+5 joueurs (une fois) : <span className="text-blue-400 font-medium">1,99 €</span></span>
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

            {/* One-Shot Premium */}
            <div className="bg-gray-800/50 rounded-2xl p-6 border border-green-500/50 flex flex-col">
              <div className="mb-6 text-center">
                <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mb-4 mx-auto">
                  <Trophy className="w-6 h-6 text-green-500" />
                </div>
                <h3 className="text-xl font-bold mb-2 text-green-400">One-Shot Premium</h3>
                <p className="text-gray-400 text-sm">Pour un tournoi premium complet</p>
              </div>

              <div className="mb-6 text-center">
                <span className="text-4xl font-bold">4,99</span>
                <span className="text-gray-400 ml-1">EUR</span>
              </div>

              <ul className="space-y-3 mb-6 flex-grow">
                <PlanFeature included>Saison complète</PlanFeature>
                <PlanFeature included>Max 10 joueurs</PlanFeature>
                <PlanFeature included>Classements complets</PlanFeature>
                <PlanFeature included>Statistiques étendues</PlanFeature>
                <PlanFeature included>Gestion des handicaps</PlanFeature>
                <PlanFeature included>Règles bonus paramétrables</PlanFeature>
                <PlanFeature included>1 slot invité offert, puis 0,99 €</PlanFeature>
              </ul>

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

              <div className="mb-6 text-center">
                <div className="w-12 h-12 bg-orange-500/20 rounded-full flex items-center justify-center mb-4 mx-auto">
                  <Users className="w-6 h-6 text-orange-500" />
                </div>
                <h3 className="text-xl font-bold mb-2 text-orange-400">Elite Team</h3>
                <p className="text-gray-400 text-sm">Pour les grands groupes</p>
              </div>

              <div className="mb-6 text-center">
                <span className="text-4xl font-bold">9,99</span>
                <span className="text-gray-400 ml-1">EUR</span>
              </div>

              <ul className="space-y-3 mb-6 flex-grow">
                <PlanFeature included>Tous les avantages One-Shot</PlanFeature>
                <PlanFeature included>Max 20 joueurs</PlanFeature>
                <PlanFeature included>Création d'équipes</PlanFeature>
                <PlanFeature included>Classement équipe + individuel</PlanFeature>
                <PlanFeature included>Page de tournoi dédiée</PlanFeature>
              </ul>

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
              <div className="mb-6 text-center">
                <div className="w-12 h-12 bg-yellow-500/20 rounded-full flex items-center justify-center mb-4 mx-auto">
                  <Award className="w-6 h-6 text-yellow-500" />
                </div>
                <h3 className="text-xl font-bold mb-2 text-yellow-400">Platinium</h3>
                <p className="text-gray-400 text-sm">Tournoi événementiel</p>
              </div>

              <div className="mb-6 text-center">
                <span className="text-4xl font-bold">6,99</span>
                <span className="text-gray-400 ml-1">EUR</span>
                <span className="text-sm text-gray-500 block">/ participant</span>
              </div>

              <ul className="space-y-3 mb-6 flex-grow">
                <PlanFeature included>Aucun slot consommé</PlanFeature>
                <PlanFeature included>11 à 30 joueurs</PlanFeature>
                <PlanFeature included>Tous les avantages Elite Team</PlanFeature>
                <PlanFeature included>Maillot officiel pour le gagnant</PlanFeature>
              </ul>

              <button
                onClick={() => handleCheckout('platinium')}
                disabled={loading === 'platinium'}
                className="w-full py-3 px-4 bg-yellow-600 hover:bg-yellow-500 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading === 'platinium' ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  'Lancer un Platinium'
                )}
              </button>
            </div>

            {/* Entreprise */}
            <div className="bg-gray-800/50 rounded-2xl p-6 border border-purple-500/50 flex flex-col">
              <div className="mb-6 text-center">
                <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center mb-4 mx-auto">
                  <Building2 className="w-6 h-6 text-purple-500" />
                </div>
                <h3 className="text-xl font-bold mb-2 text-purple-400">Entreprise</h3>
                <p className="text-gray-400 text-sm">Pour les grandes organisations</p>
              </div>

              <div className="mb-6 text-center">
                <span className="text-2xl font-bold">à partir de</span>
                <span className="text-4xl font-bold ml-2">99</span>
                <span className="text-gray-400 ml-1">EUR</span>
              </div>

              <ul className="space-y-3 mb-6 flex-grow">
                <PlanFeature included>Jusqu'à 300 participants</PlanFeature>
                <PlanFeature included>Branding complet (logo, couleurs)</PlanFeature>
                <PlanFeature included>Outils admin</PlanFeature>
                <PlanFeature included>Gestion d'équipes</PlanFeature>
                <PlanFeature included>Support prioritaire</PlanFeature>
                <PlanFeature included>Page présentation des lots</PlanFeature>
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
                question="Puis-je changer de formule à tout moment ?"
                answer="Oui, vous pouvez passer à une formule supérieure à tout moment. Le changement prend effet immédiatement."
              />
              <FaqItem
                question="Que se passe-t-il si je dépasse mes quotas ?"
                answer="Vous ne pourrez plus créer de nouveaux tournois tant que vous n'aurez pas libéré un slot (tournoi terminé) ou passé à une formule supérieure."
              />
              <FaqItem
                question="Le paiement est-il sécurisé ?"
                answer="Oui, tous les paiements sont gérés par Stripe, leader mondial du paiement en ligne. Nous ne stockons jamais vos informations bancaires."
              />
              <FaqItem
                question="Comment fonctionne le Platinium ?"
                answer="Le tarif Platinium est calculé par participant (6,99 €/personne). Idéal pour les événements de 11 à 30 joueurs avec un maillot officiel offert au gagnant."
              />
              <FaqItem
                question="Qu'est-ce qu'une compétition ponctuelle offerte ?"
                answer="Avec Free-Kick, vous bénéficiez d'un accès gratuit aux grandes compétitions comme l'Euro ou la Coupe du Monde, sans consommer de slot tournoi."
              />
            </div>
          </div>
        </div>
      </div>
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
