/**
 * Traduction des noms de phases de compétition
 * Pour les phases finales (élimination directe) et les matchs aller-retour
 */

// Traduction des stages de l'API Football-Data
export const STAGE_NAMES: Record<string, string> = {
  // ============================================
  // PHASES DE GROUPES / SAISON RÉGULIÈRE
  // ============================================
  'GROUP_STAGE': 'Phase de groupes',
  'REGULAR_SEASON': 'Saison régulière',
  'LEAGUE': 'Championnat',
  'PRELIMINARY_SEMI_FINAL': 'Demi-finale préliminaire',

  // ============================================
  // QUALIFICATIONS / BARRAGES
  // ============================================
  'PRELIMINARY_ROUND': 'Tour préliminaire',
  'QUALIFICATION': 'Qualifications',
  'QUALIFICATION_ROUND_1': 'Qualifications - Tour 1',
  'QUALIFICATION_ROUND_2': 'Qualifications - Tour 2',
  'QUALIFICATION_ROUND_3': 'Qualifications - Tour 3',
  'PLAY_OFF_ROUND': 'Barrages',
  'PLAYOFF': 'Barrages',
  'PLAYOFFS': 'Barrages',
  'PLAY_OFFS': 'Barrages',
  'LEAGUE_PHASE': 'Phase de ligue',
  'KNOCKOUT_ROUND_PLAY_OFFS': 'Barrages éliminatoires',

  // ============================================
  // TOURS À ÉLIMINATION DIRECTE
  // ============================================
  'ROUND_OF_64': '64èmes de finale',
  'LAST_64': '64èmes de finale',
  'ROUND_OF_32': '32èmes de finale',
  'LAST_32': '32èmes de finale',
  'ROUND_OF_16': 'Huitièmes de finale',
  'LAST_16': 'Huitièmes de finale',
  'QUARTER_FINALS': 'Quarts de finale',
  'QUARTER_FINAL': 'Quarts de finale',
  'SEMI_FINALS': 'Demi-finales',
  'SEMI_FINAL': 'Demi-finales',
  'THIRD_PLACE': 'Petite finale',
  'THIRD_PLACE_FINAL': 'Match pour la 3ème place',
  'FINAL': 'Finale',
  'FINALS': 'Finale',

  // ============================================
  // ALLER-RETOUR
  // ============================================
  'FIRST_LEG': 'Aller',
  '1ST_LEG': 'Aller',
  'SECOND_LEG': 'Retour',
  '2ND_LEG': 'Retour',
}

// Mapping spécifique par compétition pour les matchdays en phase finale
// Clé: competitionId ou competitionCode, Valeur: mapping matchday -> label
export const COMPETITION_KNOCKOUT_MATCHDAYS: Record<string, Record<number, string>> = {
  // Champions League (2024-25 format: 8 journées de ligue + phases finales)
  'CL': {
    9: 'Barrages aller',
    10: 'Barrages retour',
    11: 'Huitièmes aller',
    12: 'Huitièmes retour',
    13: 'Quarts aller',
    14: 'Quarts retour',
    15: 'Demi-finales aller',
    16: 'Demi-finales retour',
    17: 'Finale',
  },
  // Europa League
  'EL': {
    9: 'Barrages aller',
    10: 'Barrages retour',
    11: 'Huitièmes aller',
    12: 'Huitièmes retour',
    13: 'Quarts aller',
    14: 'Quarts retour',
    15: 'Demi-finales aller',
    16: 'Demi-finales retour',
    17: 'Finale',
  },
  // Conference League
  'ECL': {
    9: 'Barrages aller',
    10: 'Barrages retour',
    11: 'Huitièmes aller',
    12: 'Huitièmes retour',
    13: 'Quarts aller',
    14: 'Quarts retour',
    15: 'Demi-finales aller',
    16: 'Demi-finales retour',
    17: 'Finale',
  },
  // Coupe du Monde (après phase de groupes J1-J3)
  'WC': {
    4: 'Huitièmes de finale',
    5: 'Quarts de finale',
    6: 'Demi-finales',
    7: 'Petite finale / Finale',
  },
  // Euro (après phase de groupes J1-J3)
  'EC': {
    4: 'Huitièmes de finale',
    5: 'Quarts de finale',
    6: 'Demi-finales',
    7: 'Finale',
  },
  // Copa America (après phase de groupes J1-J3)
  'COPA': {
    4: 'Quarts de finale',
    5: 'Demi-finales',
    6: 'Petite finale / Finale',
  },
  // Coupe de France
  'CDL': {
    1: '32èmes de finale',
    2: '16èmes de finale',
    3: 'Huitièmes de finale',
    4: 'Quarts de finale',
    5: 'Demi-finales',
    6: 'Finale',
  },
}

/**
 * Traduit un nom de stage en français
 * @param stage Code du stage de l'API
 * @returns Nom traduit
 */
export function translateStage(stage: string | null | undefined): string | null {
  if (!stage) return null
  return STAGE_NAMES[stage] || stage
}

/**
 * Obtient le label d'un matchday pour l'affichage
 * Prend en compte le stage, le type de compétition, et les mappings personnalisés
 *
 * @param matchday Numéro de la journée
 * @param stage Stage de l'API (optionnel)
 * @param competitionCode Code de la compétition (CL, EL, WC, etc.)
 * @param competitionFormat Format de la compétition (league, cup, knockout)
 * @returns Label formaté pour l'affichage
 */
export function getMatchdayLabel(
  matchday: number,
  stage?: string | null,
  competitionCode?: string | null,
  competitionFormat?: 'league' | 'cup' | 'knockout' | 'mixed' | null
): string {
  // 1. Si on a un stage explicite et qu'il est traduit, l'utiliser
  if (stage) {
    const translatedStage = STAGE_NAMES[stage]
    if (translatedStage) {
      return translatedStage
    }
  }

  // 2. Vérifier si on a un mapping spécifique pour cette compétition
  if (competitionCode) {
    const knockoutMapping = COMPETITION_KNOCKOUT_MATCHDAYS[competitionCode]
    if (knockoutMapping && knockoutMapping[matchday]) {
      return knockoutMapping[matchday]
    }
  }

  // 3. Pour les coupes pures, essayer de deviner le tour
  if (competitionFormat === 'cup' || competitionFormat === 'knockout') {
    // Heuristique basique pour les coupes sans mapping
    const cupLabels: Record<number, string> = {
      1: '1er tour',
      2: '2ème tour',
      3: '3ème tour',
      4: '4ème tour',
      5: '5ème tour',
      6: '6ème tour',
    }
    if (cupLabels[matchday]) {
      return cupLabels[matchday]
    }
  }

  // 4. Par défaut : format journée classique
  return `J${matchday}`
}

/**
 * Détermine si un matchday est une phase finale (élimination directe)
 * @param stage Stage de l'API
 * @param matchday Numéro du matchday
 * @param totalGroupMatchdays Nombre de journées de la phase de groupes
 */
export function isKnockoutStage(
  stage?: string | null,
  matchday?: number,
  totalGroupMatchdays: number = 6
): boolean {
  // Vérifier le stage d'abord
  if (stage) {
    const knockoutStages = [
      'ROUND_OF_64', 'LAST_64',
      'ROUND_OF_32', 'LAST_32',
      'ROUND_OF_16', 'LAST_16',
      'QUARTER_FINALS', 'QUARTER_FINAL',
      'SEMI_FINALS', 'SEMI_FINAL',
      'THIRD_PLACE', 'THIRD_PLACE_FINAL',
      'FINAL', 'FINALS',
      'PLAY_OFF_ROUND', 'PLAYOFF', 'PLAYOFFS',
      'KNOCKOUT_ROUND_PLAY_OFFS',
    ]
    return knockoutStages.includes(stage)
  }

  // Sinon, se baser sur le matchday
  if (matchday && matchday > totalGroupMatchdays) {
    return true
  }

  return false
}

/**
 * Formate le label avec le contexte aller/retour si applicable
 * @param baseLabel Label de base (ex: "Huitièmes de finale")
 * @param leg 1 pour aller, 2 pour retour, null si match unique
 */
export function formatLegLabel(baseLabel: string, leg?: 1 | 2 | null): string {
  if (!leg) return baseLabel
  return leg === 1 ? `${baseLabel} (Aller)` : `${baseLabel} (Retour)`
}
