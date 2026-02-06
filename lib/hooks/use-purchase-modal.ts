import { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { ExtensionProduct } from '@/lib/stripe-products'

// Vérifier que la clé publique Stripe est définie
const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

let stripePromise: ReturnType<typeof loadStripe> | null = null

// Initialiser Stripe uniquement si la clé existe
if (stripePublishableKey) {
  stripePromise = loadStripe(stripePublishableKey)
} else {
  console.warn('[Stripe] NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY non définie - les paiements ne fonctionneront pas')
}

export function usePurchaseModal() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handlePurchase = async (productType: ExtensionProduct, tournamentId?: string) => {
    try {
      setLoading(true)
      setError(null)

      // Vérifier que Stripe est configuré
      if (!stripePromise) {
        throw new Error('Stripe n\'est pas configuré. Veuillez contacter l\'administrateur.')
      }

      // Créer une session de checkout
      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productType,
          tournamentId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la création de la session')
      }

      // Rediriger vers Stripe Checkout
      const stripe = await stripePromise
      if (!stripe) {
        throw new Error('Stripe non initialisé')
      }

      const { error: stripeError } = await stripe.redirectToCheckout({
        sessionId: data.sessionId,
      })

      if (stripeError) {
        throw new Error(stripeError.message)
      }
    } catch (err: any) {
      console.error('Erreur achat:', err)
      setError(err.message || 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  return {
    handlePurchase,
    loading,
    error,
  }
}
