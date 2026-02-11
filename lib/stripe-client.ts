import { loadStripe, Stripe } from '@stripe/stripe-js'

let stripePromise: Promise<Stripe | null>

// Vérifier si on est en mode test ou live
export const isStripeTestMode = () => {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''
  return key.startsWith('pk_test_')
}

// Instance Stripe pour le client (navigateur)
export const getStripe = () => {
  if (!stripePromise) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''
    if (!key) {
      console.warn('[Stripe Client] No publishable key configured')
      return Promise.resolve(null)
    }
    stripePromise = loadStripe(key)
  }
  return stripePromise
}
