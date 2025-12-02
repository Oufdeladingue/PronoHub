import Stripe from 'stripe'

// Vérifier si Stripe est configuré
export const isStripeEnabled = !!process.env.STRIPE_SECRET_KEY

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('STRIPE_SECRET_KEY is not defined - Stripe payments will not work')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-11-20.acacia',
  typescript: true,
})

export type StripePurchaseType =
  | 'tournament_creation_oneshot'
  | 'tournament_creation_elite'
  | 'tournament_creation_platinium'
  | 'slot_invite'
  | 'duration_extension'
  | 'player_extension'
  | 'platinium_participation'
  | 'platinium_group_11'

export const STRIPE_PRODUCTS: Record<StripePurchaseType, {
  name: string
  description: string
  priceInCents: number
}> = {
  tournament_creation_oneshot: {
    name: 'Tournoi One-Shot',
    description: 'Creation tournoi One-Shot (10 joueurs)',
    priceInCents: 499,
  },
  tournament_creation_elite: {
    name: 'Tournoi Elite Team',
    description: 'Creation tournoi Elite Team (20 joueurs)',
    priceInCents: 999,
  },
  tournament_creation_platinium: {
    name: 'Tournoi Platinium',
    description: 'Creation tournoi Platinium (11-30 joueurs)',
    priceInCents: 699,
  },
  slot_invite: {
    name: 'Recrue du mercato',
    description: 'Slot supplementaire pour un 3eme tournoi',
    priceInCents: 99,
  },
  duration_extension: {
    name: 'Joue les prolongations',
    description: 'Prolonger le tournoi',
    priceInCents: 399,
  },
  player_extension: {
    name: 'Renfort du banc',
    description: 'Ajouter 5 joueurs au tournoi',
    priceInCents: 199,
  },
  platinium_participation: {
    name: 'Participation Platinium',
    description: 'Rejoindre un tournoi Platinium',
    priceInCents: 699,
  },
  platinium_group_11: {
    name: 'Platinium Groupe 11',
    description: 'Lancer un tournoi Platinium avec 11 places incluses',
    priceInCents: 7689,
  },
}

export function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  return 'http://localhost:3100'
}
