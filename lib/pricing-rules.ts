// =====================================================
// Règles de pricing PronoHub v2
// =====================================================

export type TournamentType = 'free' | 'oneshot' | 'elite' | 'platinium' | 'enterprise'
export type ParticipantRole = 'captain' | 'member'
export type InviteType = 'free' | 'paid_slot' | 'premium_invite'
export type PurchaseType =
  | 'tournament_creation'
  | 'slot_invite'
  | 'duration_extension'
  | 'player_extension'
  | 'platinium_participation'

// Prix en euros
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
} as const

export interface TournamentRules {
  maxPlayers: number
  maxMatchdays: number | null // null = illimité
  creationPrice: number
  participationPrice: number
  canExtendDuration: boolean
  canExtendPlayers: boolean
  requiresMinPlayers: number
  freeInvites: number // Nombre d'invités gratuits (hors créateur)
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
    freeInvites: PRICES.FREE_MAX_PLAYERS - 1, // 4 invités gratuits
  },
  oneshot: {
    maxPlayers: PRICES.ONESHOT_MAX_PLAYERS,
    maxMatchdays: null, // Illimité
    creationPrice: PRICES.ONESHOT_CREATION,
    participationPrice: 0,
    canExtendDuration: false,
    canExtendPlayers: false,
    requiresMinPlayers: 2,
    freeInvites: PRICES.ONESHOT_MAX_PLAYERS - 1, // 9 invités gratuits
  },
  elite: {
    maxPlayers: PRICES.ELITE_MAX_PLAYERS,
    maxMatchdays: null, // Illimité
    creationPrice: PRICES.ELITE_CREATION,
    participationPrice: 0,
    canExtendDuration: false,
    canExtendPlayers: false,
    requiresMinPlayers: 2,
    freeInvites: PRICES.ELITE_MAX_PLAYERS - 1, // 19 invités gratuits
  },
  platinium: {
    maxPlayers: PRICES.PLATINIUM_MAX_PLAYERS,
    maxMatchdays: null, // Illimité
    creationPrice: PRICES.PLATINIUM_CREATION,
    participationPrice: PRICES.PLATINIUM_PARTICIPATION,
    canExtendDuration: false,
    canExtendPlayers: false,
    requiresMinPlayers: PRICES.PLATINIUM_MIN_PLAYERS,
    freeInvites: 0, // Tout le monde paie
  },
  enterprise: {
    maxPlayers: 300,
    maxMatchdays: null,
    creationPrice: 99, // À partir de
    participationPrice: 0,
    canExtendDuration: false,
    canExtendPlayers: false,
    requiresMinPlayers: 2,
    freeInvites: 299,
  },
}

// =====================================================
// Fonctions utilitaires
// =====================================================

export interface JoinCheckResult {
  canJoin: boolean
  requiresPayment: boolean
  paymentAmount: number
  paymentType: PurchaseType | null
  reason: string
}

/**
 * Vérifie si un utilisateur peut rejoindre un tournoi
 */
export function checkCanJoinTournament(
  tournamentType: TournamentType,
  isLegacy: boolean,
  currentParticipants: number,
  maxPlayers: number,
  userFreeTournamentsActive: number,
  userPremiumInvitesActive: number
): JoinCheckResult {
  // Tournoi legacy = pas de restrictions
  if (isLegacy) {
    return {
      canJoin: currentParticipants < maxPlayers,
      requiresPayment: false,
      paymentAmount: 0,
      paymentType: null,
      reason: currentParticipants < maxPlayers ? 'Tournoi legacy - accès libre' : 'Tournoi complet',
    }
  }

  // Vérifier si le tournoi est complet
  if (currentParticipants >= maxPlayers) {
    return {
      canJoin: false,
      requiresPayment: false,
      paymentAmount: 0,
      paymentType: null,
      reason: 'Tournoi complet',
    }
  }

  // FREE: Vérifier quota
  if (tournamentType === 'free') {
    if (userFreeTournamentsActive < PRICES.FREE_MAX_TOURNAMENTS) {
      return {
        canJoin: true,
        requiresPayment: false,
        paymentAmount: 0,
        paymentType: null,
        reason: 'Slot gratuit disponible',
      }
    } else {
      return {
        canJoin: true,
        requiresPayment: true,
        paymentAmount: PRICES.SLOT_INVITE,
        paymentType: 'slot_invite',
        reason: 'Slot payant requis (0,99€)',
      }
    }
  }

  // ONE-SHOT / ELITE: Vérifier si peut être invité gratuit
  if (tournamentType === 'oneshot' || tournamentType === 'elite') {
    if (userPremiumInvitesActive < 1) {
      return {
        canJoin: true,
        requiresPayment: false,
        paymentAmount: 0,
        paymentType: null,
        reason: 'Invitation gratuite',
      }
    } else {
      return {
        canJoin: true,
        requiresPayment: true,
        paymentAmount: PRICES.SLOT_INVITE,
        paymentType: 'slot_invite',
        reason: 'Slot payant requis (0,99€)',
      }
    }
  }

  // PLATINIUM: Tout le monde paie
  if (tournamentType === 'platinium') {
    return {
      canJoin: true,
      requiresPayment: true,
      paymentAmount: PRICES.PLATINIUM_PARTICIPATION,
      paymentType: 'platinium_participation',
      reason: 'Participation payante (6,99€)',
    }
  }

  // Par défaut
  return {
    canJoin: true,
    requiresPayment: false,
    paymentAmount: 0,
    paymentType: null,
    reason: 'OK',
  }
}

/**
 * Vérifie si un tournoi peut démarrer
 */
export function checkCanTournamentStart(
  tournamentType: TournamentType,
  currentParticipants: number
): { canStart: boolean; reason: string; minPlayers: number } {
  const rules = TOURNAMENT_RULES[tournamentType]

  if (currentParticipants < rules.requiresMinPlayers) {
    return {
      canStart: false,
      reason: `Minimum ${rules.requiresMinPlayers} joueurs requis`,
      minPlayers: rules.requiresMinPlayers,
    }
  }

  return {
    canStart: true,
    reason: 'OK',
    minPlayers: rules.requiresMinPlayers,
  }
}

/**
 * Calcule le nombre max de journées pour un tournoi free
 */
export function calculateMaxMatchdays(
  remainingMatchdaysInCompetition: number,
  durationExtended: boolean
): number {
  if (durationExtended) {
    return remainingMatchdaysInCompetition
  }
  return Math.min(PRICES.FREE_MAX_MATCHDAYS, remainingMatchdaysInCompetition)
}

/**
 * Calcule le nombre max de joueurs pour un tournoi
 */
export function calculateMaxPlayers(
  tournamentType: TournamentType,
  playersExtensionCount: number
): number {
  const baseMax = TOURNAMENT_RULES[tournamentType].maxPlayers
  if (tournamentType === 'free') {
    return baseMax + (playersExtensionCount * PRICES.FREE_PLAYER_EXTENSION_AMOUNT)
  }
  return baseMax
}

/**
 * Prix de création d'un tournoi
 */
export function getCreationPrice(tournamentType: TournamentType): number {
  return TOURNAMENT_RULES[tournamentType].creationPrice
}

/**
 * Formatte un prix pour l'affichage
 */
export function formatPrice(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)
}
