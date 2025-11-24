import Stripe from 'stripe'

// Vérifier que la clé secrète est définie
const stripeSecretKey = process.env.STRIPE_SECRET_KEY

// Instance Stripe pour le serveur (null si pas de clé)
export const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: '2025-11-17.clover',
      typescript: true,
    })
  : null

// Helper pour vérifier si Stripe est configuré
export const isStripeEnabled = () => !!stripe

// IDs des produits Stripe (à configurer dans le dashboard Stripe)
export const STRIPE_PRICES = {
  // Abonnement mensuel - 9.99€/mois
  subscription_monthly: process.env.STRIPE_PRICE_MONTHLY || 'price_monthly_placeholder',

  // Abonnement annuel - 79.99€/an
  subscription_yearly: process.env.STRIPE_PRICE_YEARLY || 'price_yearly_placeholder',

  // One-shot - 4.99€
  oneshot: process.env.STRIPE_PRICE_ONESHOT || 'price_oneshot_placeholder',

  // Entreprise - 99€ (prix de base)
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE || 'price_enterprise_placeholder',
}

// URL de base pour les redirections
export const getBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  return 'http://localhost:3000'
}
