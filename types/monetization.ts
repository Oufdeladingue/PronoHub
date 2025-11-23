// =====================================================
// Types pour le système de monétisation PronoHub
// =====================================================

// Types de tournoi
export type TournamentType = 'free' | 'oneshot' | 'premium' | 'enterprise';

// Types d'abonnement
export type SubscriptionType = 'monthly' | 'yearly';
export type SubscriptionStatus = 'active' | 'cancelled' | 'expired' | 'past_due' | 'none';

// Statut des achats one-shot
export type OneshotStatus = 'available' | 'in_use' | 'expired';

// Statut des comptes entreprise
export type EnterpriseStatus = 'active' | 'expired' | 'cancelled';

// =====================================================
// Interfaces des tables
// =====================================================

export interface UserSubscription {
  id: string;
  user_id: string;
  subscription_type: SubscriptionType;
  status: SubscriptionStatus;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserOneshotPurchase {
  id: string;
  user_id: string;
  tournament_id: string | null;
  status: OneshotStatus;
  stripe_payment_intent_id: string | null;
  stripe_checkout_session_id: string | null;
  amount_paid: number | null;
  currency: string;
  purchased_at: string;
  used_at: string | null;
  expired_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EnterpriseAccount {
  id: string;
  user_id: string;
  company_name: string;
  contact_email: string | null;
  custom_logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  tournament_id: string | null;
  competition_id: number | null;
  status: EnterpriseStatus;
  max_participants: number;
  stripe_payment_intent_id: string | null;
  amount_paid: number | null;
  currency: string;
  valid_from: string;
  valid_until: string | null;
  created_at: string;
  updated_at: string;
}

// =====================================================
// Interface des quotas utilisateur (vue calculée)
// =====================================================

export interface UserQuotas {
  user_id: string;
  username: string;

  // Abonnement
  subscription_status: SubscriptionStatus;
  subscription_type: SubscriptionType | null;
  subscription_expires_at: string | null;

  // Tournois gratuits
  free_tournaments_active: number;
  free_tournaments_max: number;

  // Tournois one-shot
  oneshot_tournaments_active: number;
  oneshot_tournaments_max: number;
  oneshot_slots_available: number;

  // Tournois premium (abonnement)
  premium_tournaments_active: number;
  premium_tournaments_max: number;

  // Entreprise
  enterprise_accounts_active: number;

  // Résumé
  can_create_tournament: boolean;
}

// =====================================================
// Résultat de la fonction determine_tournament_type
// =====================================================

export interface TournamentTypeResult {
  tournament_type: TournamentType | null;
  max_players: number;
  reason: string;
}

// =====================================================
// Limites par type de compte
// =====================================================

export const ACCOUNT_LIMITS = {
  free: {
    maxTournaments: 3,
    maxPlayersPerTournament: 8,
    features: ['basic_rankings', 'simple_predictions'],
  },
  oneshot: {
    maxActiveTournaments: 2,
    maxPlayersPerTournament: 20,
    features: ['basic_rankings', 'simple_predictions', 'extended_stats'],
  },
  premium: {
    maxActiveTournaments: 5,
    maxPlayersPerTournament: 20,
    features: [
      'basic_rankings',
      'simple_predictions',
      'extended_stats',
      'private_tournaments',
      'advanced_history',
      'advanced_management',
    ],
  },
  enterprise: {
    maxActiveTournaments: 1,
    maxPlayersPerTournament: 300,
    features: [
      'basic_rankings',
      'simple_predictions',
      'extended_stats',
      'private_tournaments',
      'advanced_history',
      'advanced_management',
      'custom_branding',
      'admin_tools',
      'team_management',
    ],
  },
} as const;

// =====================================================
// Prix (en centimes EUR)
// =====================================================

export const PRICING = {
  oneshot: {
    price: 499, // 4.99 EUR
    currency: 'eur',
  },
  subscription: {
    monthly: {
      price: 999, // 9.99 EUR/mois
      currency: 'eur',
      interval: 'month' as const,
    },
    yearly: {
      price: 7999, // 79.99 EUR/an (2 mois gratuits)
      currency: 'eur',
      interval: 'year' as const,
    },
  },
  enterprise: {
    basePrice: 9900, // 99 EUR (prix de base, peut varier)
    currency: 'eur',
  },
} as const;

// =====================================================
// Features par type
// =====================================================

export type Feature =
  | 'basic_rankings'
  | 'simple_predictions'
  | 'extended_stats'
  | 'private_tournaments'
  | 'advanced_history'
  | 'advanced_management'
  | 'custom_branding'
  | 'admin_tools'
  | 'team_management';

export function hasFeature(
  tournamentType: TournamentType,
  feature: Feature
): boolean {
  return ACCOUNT_LIMITS[tournamentType].features.includes(feature);
}

export function getMaxPlayers(tournamentType: TournamentType): number {
  return ACCOUNT_LIMITS[tournamentType].maxPlayersPerTournament;
}
