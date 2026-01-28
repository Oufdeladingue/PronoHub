import Stripe from 'stripe'

// Vérifier si Stripe est configuré
export const isStripeEnabled = !!process.env.STRIPE_SECRET_KEY

// Vérifier si on est en mode test ou live (côté serveur)
export const isStripeTestMode = () => {
  const key = process.env.STRIPE_SECRET_KEY || ''
  return key.startsWith('sk_test_')
}

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('[Stripe Server] STRIPE_SECRET_KEY is not defined - Stripe payments will not work')
} else {
  console.log(`[Stripe Server] Configured in ${isStripeTestMode() ? 'TEST' : 'LIVE'} mode`)
}

// Créer l'instance Stripe seulement si la clé est disponible
export const stripe: Stripe | null = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-11-17.clover',
      typescript: true,
    })
  : null

export type StripePurchaseType =
  | 'tournament_creation_oneshot'
  | 'tournament_creation_elite'
  | 'tournament_creation_platinium'
  | 'slot_invite'
  | 'duration_extension'
  | 'player_extension'
  | 'platinium_participation'
  | 'platinium_group_11'
  | 'stats_access_tournament'
  | 'stats_access_lifetime'

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
    description: 'Lancer un tournoi Platinium avec 11 places incluses (10% de remise)',
    priceInCents: 6920, // 11 x 6.99€ = 76.89€ - 10% = 69.20€
  },
  stats_access_tournament: {
    name: 'Stats du match - Tournoi',
    description: 'Accès aux statistiques des matchs pour ce tournoi',
    priceInCents: 199,
  },
  stats_access_lifetime: {
    name: 'Stats du match - À vie',
    description: 'Accès aux statistiques des matchs pour tous vos tournois',
    priceInCents: 599,
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
