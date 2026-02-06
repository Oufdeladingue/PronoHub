/**
 * Configuration des produits Stripe pour les extensions
 */

export type ExtensionProduct =
  | 'duration_extension'
  | 'player_extension'
  | 'stats_option'

interface ProductConfig {
  name: string
  description: string
  priceId: string // ID du prix Stripe (à créer dans le dashboard Stripe)
  price: number // Prix en centimes
  currency: 'eur'
}

/**
 * Configuration des produits
 * TODO: Remplacer les priceId par les vrais IDs depuis le dashboard Stripe
 */
export const STRIPE_PRODUCTS: Record<ExtensionProduct, ProductConfig> = {
  duration_extension: {
    name: 'Joue les prolongations',
    description: 'Ajouter 10 journées supplémentaires au tournoi',
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_DURATION_EXTENSION || 'price_duration_extension',
    price: 399, // 3.99€ (aligné avec lib/stripe.ts)
    currency: 'eur'
  },
  player_extension: {
    name: 'Renfort du banc',
    description: 'Ajouter 5 places supplémentaires au tournoi',
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PLAYER_EXTENSION || 'price_player_extension',
    price: 199, // 1.99€ (aligné avec lib/stripe.ts)
    currency: 'eur'
  },
  stats_option: {
    name: 'Stats du match - À vie',
    description: 'Accès aux statistiques avancées pour tous vos tournois',
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_STATS_LIFETIME || 'price_stats_lifetime',
    price: 599, // 5.99€ (aligné avec lib/stripe.ts)
    currency: 'eur'
  }
}

/**
 * Récupère la configuration d'un produit
 */
export function getProductConfig(product: ExtensionProduct): ProductConfig {
  return STRIPE_PRODUCTS[product]
}

/**
 * Formate un prix en centimes vers une chaîne lisible
 */
export function formatPrice(priceInCents: number, currency: string = 'eur'): string {
  const price = priceInCents / 100
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currency.toUpperCase()
  }).format(price)
}
