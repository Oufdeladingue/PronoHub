// =====================================================
// Types pour le système de monétisation PronoHub v2
// =====================================================

// Types de tournoi
export type TournamentType = 'free' | 'oneshot' | 'elite' | 'platinium' | 'enterprise';

// Rôle du participant
export type ParticipantRole = 'captain' | 'member';

// Type d'invitation
export type InviteType = 'free' | 'paid_slot' | 'premium_invite' | 'prepaid_slot';

// Types d'achat
export type PurchaseType =
  | 'tournament_creation'
  | 'slot_invite'
  | 'duration_extension'
  | 'player_extension'
  | 'platinium_participation';

// Statut des achats
export type PurchaseStatus = 'pending' | 'completed' | 'refunded' | 'failed';

// =====================================================
// Prix en euros (pas en centimes pour v2)
// =====================================================

export const PRICES = {
  // FREE-KICK extensions
  SLOT_INVITE: 0.99,           // Slot pour 3ème tournoi free+
  DURATION_EXTENSION: 3.99,    // Extension durée jusqu'à fin compétition
  PLAYER_EXTENSION: 1.99,      // +5 joueurs

  // ONE-SHOT
  ONESHOT_CREATION: 4.99,      // Création du tournoi
  ONESHOT_MAX_PLAYERS: 10,     // Créateur + 9 invités

  // ELITE TEAM
  ELITE_CREATION: 9.99,        // Création du tournoi
  ELITE_MAX_PLAYERS: 20,       // Créateur + 19 invités

  // PLATINIUM
  PLATINIUM_CREATION: 6.99,    // Création du tournoi
  PLATINIUM_PARTICIPATION: 6.99, // Participation au tournoi
  PLATINIUM_MIN_PLAYERS: 11,   // Minimum pour démarrer
  PLATINIUM_MAX_PLAYERS: 30,   // Maximum

  // FREE-KICK limites
  FREE_MAX_MATCHDAYS: 10,      // Maximum 10 journées
  FREE_MAX_PLAYERS: 5,         // Maximum 5 joueurs
  FREE_MAX_TOURNAMENTS: 2,     // Maximum 2 tournois gratuits actifs
  FREE_PLAYER_EXTENSION_AMOUNT: 5, // +5 joueurs par extension
} as const;

// =====================================================
// Interfaces des quotas utilisateur (vue v2)
// =====================================================

export interface UserQuotasV2 {
  user_id: string;
  username: string;

  // Tournois FREE (gratuits)
  free_tournaments_active: number;      // Nombre actuel de tournois free
  free_tournaments_max: number;         // Maximum (2)
  free_tournaments_paid_slots: number;  // Slots payés (illimité)

  // Invitations premium (ONE-SHOT/ELITE)
  premium_invites_active: number;       // Nombre d'invitations gratuites utilisées
  premium_invites_max: number;          // Maximum (1)

  // PLATINIUM
  platinium_tournaments_active: number;

  // Legacy (anciens tournois)
  legacy_tournaments_active: number;

  // Résumé
  can_create_free_tournament: boolean;
  can_join_premium_free: boolean;
}

// =====================================================
// Interface des achats
// =====================================================

export interface TournamentPurchase {
  id: string;
  user_id: string;
  tournament_id: string | null;
  purchase_type: PurchaseType;
  amount: number;
  currency: string;
  stripe_payment_intent_id: string | null;
  stripe_checkout_session_id: string | null;
  status: PurchaseStatus;
  created_at: string;
  updated_at: string;
}

// =====================================================
// Configuration par type de tournoi
// =====================================================

export interface TournamentRules {
  maxPlayers: number;
  maxMatchdays: number | null; // null = illimité
  creationPrice: number;
  participationPrice: number;
  canExtendDuration: boolean;
  canExtendPlayers: boolean;
  requiresMinPlayers: number;
  freeInvites: number;
}

export const TOURNAMENT_RULES: Record<TournamentType, TournamentRules> = {
  free: {
    maxPlayers: PRICES.FREE_MAX_PLAYERS,
    maxMatchdays: PRICES.FREE_MAX_MATCHDAYS,
    creationPrice: 0,
    participationPrice: 0,
    canExtendDuration: true,
    canExtendPlayers: true,
    requiresMinPlayers: 2,
    freeInvites: PRICES.FREE_MAX_PLAYERS - 1,
  },
  oneshot: {
    maxPlayers: PRICES.ONESHOT_MAX_PLAYERS,
    maxMatchdays: null,
    creationPrice: PRICES.ONESHOT_CREATION,
    participationPrice: 0,
    canExtendDuration: false,
    canExtendPlayers: false,
    requiresMinPlayers: 2,
    freeInvites: PRICES.ONESHOT_MAX_PLAYERS - 1,
  },
  elite: {
    maxPlayers: PRICES.ELITE_MAX_PLAYERS,
    maxMatchdays: null,
    creationPrice: PRICES.ELITE_CREATION,
    participationPrice: 0,
    canExtendDuration: false,
    canExtendPlayers: false,
    requiresMinPlayers: 2,
    freeInvites: PRICES.ELITE_MAX_PLAYERS - 1,
  },
  platinium: {
    maxPlayers: PRICES.PLATINIUM_MAX_PLAYERS,
    maxMatchdays: null,
    creationPrice: PRICES.PLATINIUM_CREATION,
    participationPrice: PRICES.PLATINIUM_PARTICIPATION,
    canExtendDuration: false,
    canExtendPlayers: false,
    requiresMinPlayers: PRICES.PLATINIUM_MIN_PLAYERS,
    freeInvites: 0,
  },
  enterprise: {
    maxPlayers: 300,
    maxMatchdays: null,
    creationPrice: 99,
    participationPrice: 0,
    canExtendDuration: false,
    canExtendPlayers: false,
    requiresMinPlayers: 2,
    freeInvites: 299,
  },
};

// =====================================================
// Legacy - Anciennes interfaces (pour compatibilité)
// =====================================================

export type SubscriptionType = 'monthly' | 'yearly';
export type SubscriptionStatus = 'active' | 'cancelled' | 'expired' | 'past_due' | 'none';
export type OneshotStatus = 'available' | 'in_use' | 'expired';
export type EnterpriseStatus = 'active' | 'expired' | 'cancelled';

export interface UserQuotas {
  user_id: string;
  username: string;
  subscription_status: SubscriptionStatus;
  subscription_type: SubscriptionType | null;
  subscription_expires_at: string | null;
  free_tournaments_active: number;
  free_tournaments_max: number;
  oneshot_tournaments_active: number;
  oneshot_tournaments_max: number;
  oneshot_slots_available: number;
  premium_tournaments_active: number;
  premium_tournaments_max: number;
  enterprise_accounts_active: number;
  can_create_tournament: boolean;
}

// Legacy constants (pour compatibilité avec le code existant)
export const ACCOUNT_LIMITS = {
  free: {
    maxTournaments: 2,
    maxPlayersPerTournament: 5,
    features: ['basic_rankings', 'simple_predictions'],
  },
  oneshot: {
    maxActiveTournaments: 1,
    maxPlayersPerTournament: 10,
    features: ['basic_rankings', 'simple_predictions', 'trophies'],
  },
  elite: {
    maxActiveTournaments: 1,
    maxPlayersPerTournament: 20,
    features: ['basic_rankings', 'simple_predictions', 'trophies', 'team_play'],
  },
  platinium: {
    maxActiveTournaments: 1,
    maxPlayersPerTournament: 30,
    features: ['basic_rankings', 'simple_predictions', 'trophies', 'team_play', 'prize'],
  },
  premium: {
    maxActiveTournaments: 5,
    maxPlayersPerTournament: 20,
    features: ['basic_rankings', 'simple_predictions', 'extended_stats'],
  },
  enterprise: {
    maxActiveTournaments: 1,
    maxPlayersPerTournament: 300,
    features: ['all'],
  },
} as const;

export const PRICING = {
  oneshot: {
    price: 499,
    currency: 'eur',
  },
  subscription: {
    monthly: {
      price: 999,
      currency: 'eur',
      interval: 'month' as const,
    },
    yearly: {
      price: 7999,
      currency: 'eur',
      interval: 'year' as const,
    },
  },
  enterprise: {
    basePrice: 9900,
    currency: 'eur',
  },
} as const;

// =====================================================
// Fonctions utilitaires
// =====================================================

export function formatPrice(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

export function getTournamentTypeName(type: TournamentType): string {
  const names: Record<TournamentType, string> = {
    free: 'Free-Kick',
    oneshot: 'One-Shot',
    elite: 'Elite Team',
    platinium: 'Platinium',
    enterprise: 'Corpo',
  };
  return names[type];
}

export function getTournamentTypeColor(type: TournamentType): string {
  const colors: Record<TournamentType, string> = {
    free: 'blue',
    oneshot: 'green',
    elite: 'orange',
    platinium: 'yellow',
    enterprise: 'purple',
  };
  return colors[type];
}
