/**
 * Module de traductions pour PronoHub
 * Contient les traductions pour les noms de pays et les phases de compétition
 */

export {
  COUNTRY_NAMES,
  translateCountryName,
  translateTeamName,
} from './countries'

export {
  STAGE_NAMES,
  COMPETITION_KNOCKOUT_MATCHDAYS,
  translateStage,
  getMatchdayLabel,
  isKnockoutStage,
  formatLegLabel,
} from './stages'
