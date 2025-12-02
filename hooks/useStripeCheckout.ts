'use client'

import { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'

// Charger Stripe une seule fois
const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null

export type StripePurchaseType =
  | 'tournament_creation_oneshot'
  | 'tournament_creation_elite'
  | 'tournament_creation_platinium'
  | 'slot_invite'
  | 'duration_extension'
  | 'player_extension'
  | 'platinium_participation'

interface CheckoutOptions {
  purchaseType: StripePurchaseType
  tournamentData?: {
    name: string
    slug: string
    competitionId: string
    competitionName: string
    maxPlayers?: number
    numMatchdays: number
    allMatchdays?: boolean
    bonusMatchEnabled?: boolean
    drawWithDefaultPredictionPoints?: number
  }
  tournamentId?: string
  inviteCode?: string
}

export function useStripeCheckout() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checkout = async (options: CheckoutOptions) => {
    if (!stripePromise) {
      setError('Stripe n\'est pas configuré')
      return { success: false, error: 'Stripe n\'est pas configuré' }
    }

    setIsLoading(true)
    setError(null)

    try {
      // Créer la session de checkout
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchaseType: options.purchaseType,
          tournamentData: options.tournamentData,
          tournamentId: options.tournamentId,
          inviteCode: options.inviteCode,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la création de la session')
      }

      // Rediriger vers Stripe Checkout via l'URL
      if (data.url) {
        window.location.href = data.url
        return { success: true }
      }

      // Fallback: utiliser sessionId si url n'est pas fournie
      if (data.sessionId) {
        const stripe = await stripePromise
        if (!stripe) {
          throw new Error('Impossible de charger Stripe')
        }
        // Rediriger manuellement vers la page de checkout Stripe
        window.location.href = `https://checkout.stripe.com/pay/${data.sessionId}`
        return { success: true }
      }

      throw new Error('Aucune URL de checkout reçue')
    } catch (err: any) {
      console.error('Checkout error:', err)
      setError(err.message)
      return { success: false, error: err.message }
    } finally {
      setIsLoading(false)
    }
  }

  return {
    checkout,
    isLoading,
    error,
    isStripeConfigured: !!stripePromise,
  }
}
