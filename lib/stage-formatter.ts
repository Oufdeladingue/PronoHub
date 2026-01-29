/**
 * Utilitaires pour formatter et traduire les stages de compétition
 */

export type StageType =
  | 'REGULAR_SEASON'
  | 'LEAGUE_STAGE'
  | 'GROUP_STAGE'
  | 'PLAYOFFS'
  | 'PRELIMINARY_ROUND'
  | 'LAST_32'
  | 'LAST_16'
  | 'ROUND_OF_16'
  | 'QUARTER_FINALS'
  | 'SEMI_FINALS'
  | 'THIRD_PLACE'
  | 'FINAL'
  | null

/**
 * Traduction française des stages de compétition
 */
const STAGE_TRANSLATIONS: Record<string, string> = {
  // Phases de poule
  'LEAGUE_STAGE': 'Phase de championnat',
  'GROUP_STAGE': 'Phase de poule',

  // Barrages et préliminaires
  'PRELIMINARY_ROUND': 'Tour préliminaire',
  'PLAYOFFS': 'Barrages',

  // Phases à élimination
  'LAST_32': '32èmes de finale',
  'LAST_16': '8èmes de finale',
  'ROUND_OF_16': '8èmes de finale',
  'QUARTER_FINALS': 'Quarts de finale',
  'SEMI_FINALS': 'Demi-finales',

  // Finales
  'THIRD_PLACE': 'Petite finale',
  'FINAL': 'Finale',
}

/**
 * Traduction courte des stages (pour les onglets)
 */
const STAGE_SHORT_TRANSLATIONS: Record<string, string> = {
  'LEAGUE_STAGE': 'Championnat',
  'GROUP_STAGE': 'Poule',
  'PRELIMINARY_ROUND': 'Préliminaire',
  'PLAYOFFS': 'Barrage',
  'LAST_32': '32ème',
  'LAST_16': '8ème',
  'ROUND_OF_16': '8ème',
  'QUARTER_FINALS': 'Quart',
  'SEMI_FINALS': 'Demi',
  'THIRD_PLACE': 'Petite finale',
  'FINAL': 'Finale',
}

/**
 * Traduction des matchs aller-retour
 */
const LEG_TRANSLATIONS: Record<number, string> = {
  1: 'Aller',
  2: 'Retour',
}

/**
 * Retourne le nom français complet d'un stage
 */
export function getStageLabel(stage: StageType, matchday?: number): string {
  // Si pas de stage ou REGULAR_SEASON, c'est un championnat classique avec numéro de journée
  if (!stage || stage === 'REGULAR_SEASON') {
    return matchday ? `Journée ${matchday}` : 'Journée'
  }

  const baseLabel = STAGE_TRANSLATIONS[stage] || stage

  // Pour les phases à élimination directe, ajouter aller/retour si matchday est fourni
  const isKnockoutStage = [
    'PLAYOFFS',
    'LAST_32',
    'LAST_16',
    'ROUND_OF_16',
    'QUARTER_FINALS',
    'SEMI_FINALS'
  ].includes(stage)

  if (isKnockoutStage && matchday && [1, 2].includes(matchday)) {
    return `${baseLabel} - ${LEG_TRANSLATIONS[matchday]}`
  }

  // Pour la phase de poule, ajouter le numéro de journée
  if ((stage === 'LEAGUE_STAGE' || stage === 'GROUP_STAGE') && matchday) {
    return `${baseLabel} - J${matchday}`
  }

  return baseLabel
}

/**
 * Retourne le nom français court d'un stage (pour les onglets)
 * @param stage Le stage de la compétition (peut être null si pas encore connu)
 * @param matchday Le numéro de journée
 * @param hasMatches Indique si des matchs existent pour cette journée (optionnel)
 * @param leg Le numéro du leg pour les phases à élimination (1=Aller, 2=Retour)
 */
export function getStageShortLabel(stage: StageType, matchday?: number, hasMatches?: boolean, leg?: number): string {
  // Si pas de stage et pas de matchs pour cette journée, afficher "-"
  // (journée future dont le stage n'est pas encore connu)
  if (!stage && hasMatches === false) {
    return '-'
  }

  // Si pas de stage ou REGULAR_SEASON, c'est un championnat classique avec numéro de journée
  if (!stage || stage === 'REGULAR_SEASON') {
    return matchday ? `J${matchday}` : 'Journée'
  }

  const baseLabel = STAGE_SHORT_TRANSLATIONS[stage] || stage

  // Pour les phases à élimination directe avec aller-retour, ajouter le leg
  const isTwoLeggedKnockout = [
    'PLAYOFFS',
    'LAST_32',
    'LAST_16',
    'ROUND_OF_16',
    'QUARTER_FINALS',
    'SEMI_FINALS'
  ].includes(stage)

  if (isTwoLeggedKnockout && leg && [1, 2].includes(leg)) {
    return `${baseLabel} ${leg === 1 ? 'A' : 'R'}`
  }

  // Pour la phase de poule, ajouter le numéro de journée
  if ((stage === 'LEAGUE_STAGE' || stage === 'GROUP_STAGE') && matchday) {
    return `J${matchday}`
  }

  return baseLabel
}

/**
 * Calcule le numéro de leg (1=Aller, 2=Retour) pour une journée donnée
 * en analysant les journées consécutives avec le même stage knockout
 * @param matchday La journée dont on veut connaître le leg
 * @param matchdayStages Map des stages par journée
 * @returns 1 (Aller), 2 (Retour) ou undefined si pas applicable
 */
export function getLegNumber(
  matchday: number,
  matchdayStages: Record<number, StageType | null>
): number | undefined {
  const stage = matchdayStages[matchday]

  // Pas de leg pour les phases non-knockout
  if (!stage) return undefined

  const twoLeggedStages = [
    'PLAYOFFS',
    'LAST_32',
    'LAST_16',
    'ROUND_OF_16',
    'QUARTER_FINALS',
    'SEMI_FINALS'
  ]

  if (!twoLeggedStages.includes(stage)) return undefined

  // Chercher si la journée précédente a le même stage (donc on est en retour)
  const prevStage = matchdayStages[matchday - 1]
  if (prevStage === stage) {
    return 2 // Retour
  }

  // Chercher si la journée suivante a le même stage (donc on est en aller)
  const nextStage = matchdayStages[matchday + 1]
  if (nextStage === stage) {
    return 1 // Aller
  }

  // Stage unique (match simple, pas d'aller-retour)
  return undefined
}

/**
 * Détermine si un stage est une phase à élimination directe
 */
export function isKnockoutStage(stage: StageType): boolean {
  if (!stage) return false

  return [
    'PLAYOFFS',
    'LAST_32',
    'LAST_16',
    'ROUND_OF_16',
    'QUARTER_FINALS',
    'SEMI_FINALS',
    'THIRD_PLACE',
    'FINAL'
  ].includes(stage)
}

/**
 * Détermine si un stage est une phase de poule
 */
export function isGroupStage(stage: StageType): boolean {
  if (!stage) return false
  return ['LEAGUE_STAGE', 'GROUP_STAGE'].includes(stage)
}

/**
 * Retourne l'ordre de tri pour les stages
 * (utilisé pour afficher les onglets dans le bon ordre)
 */
export function getStageOrder(stage: StageType): number {
  const order: Record<string, number> = {
    'PRELIMINARY_ROUND': 1,
    'GROUP_STAGE': 2,
    'LEAGUE_STAGE': 2,
    'PLAYOFFS': 3,
    'LAST_32': 4,
    'LAST_16': 5,
    'ROUND_OF_16': 5,
    'QUARTER_FINALS': 6,
    'SEMI_FINALS': 7,
    'THIRD_PLACE': 8,
    'FINAL': 9,
  }

  return stage ? order[stage] || 0 : 0
}

/**
 * Groupe les journées par stage pour une compétition
 * Retourne une structure organisée pour l'affichage des onglets
 */
export interface StageGroup {
  stage: StageType
  stageLabel: string
  stageShortLabel: string
  matchdays: number[]
  order: number
}

export function groupMatchdaysByStage(
  matchdays: Array<{ matchday: number; stage: StageType | null }>
): StageGroup[] {
  // Grouper par stage
  const grouped = matchdays.reduce((acc, { matchday, stage }) => {
    const key = stage || 'null'
    if (!acc[key]) {
      acc[key] = {
        stage: stage,
        stageLabel: getStageLabel(stage),
        stageShortLabel: getStageShortLabel(stage),
        matchdays: [],
        order: getStageOrder(stage)
      }
    }
    acc[key].matchdays.push(matchday)
    return acc
  }, {} as Record<string, StageGroup>)

  // Trier par ordre
  return Object.values(grouped).sort((a, b) => a.order - b.order)
}
