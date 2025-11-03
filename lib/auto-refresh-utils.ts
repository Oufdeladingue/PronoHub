// Utilitaires pour le rafraîchissement automatique des matchs

export interface Match {
  id: string
  status: string
  utc_date: string
  [key: string]: any
}

export type MatchStatus = 'SCHEDULED' | 'TIMED' | 'IN_PLAY' | 'PAUSED' | 'FINISHED' | 'POSTPONED' | 'SUSPENDED' | 'CANCELLED'

/**
 * Détermine si un match est en cours
 */
export function isMatchLive(match: Match): boolean {
  return match.status === 'IN_PLAY' || match.status === 'PAUSED'
}

/**
 * Détermine si un match est à venir
 */
export function isMatchUpcoming(match: Match): boolean {
  return match.status === 'SCHEDULED' || match.status === 'TIMED'
}

/**
 * Détermine si un match est terminé
 */
export function isMatchFinished(match: Match): boolean {
  return match.status === 'FINISHED'
}

/**
 * Calcule le temps en millisecondes jusqu'au début d'un match
 */
export function getTimeUntilMatchStart(match: Match): number {
  const matchDate = new Date(match.utc_date)
  const now = new Date()
  return matchDate.getTime() - now.getTime()
}

/**
 * Détermine si un match commence bientôt (dans les 15 prochaines minutes)
 */
export function isMatchStartingSoon(match: Match): boolean {
  if (!isMatchUpcoming(match)) return false
  const timeUntil = getTimeUntilMatchStart(match)
  const fifteenMinutes = 15 * 60 * 1000
  return timeUntil > 0 && timeUntil <= fifteenMinutes
}

/**
 * Calcule l'intervalle de rafraîchissement intelligent basé sur l'état des matchs
 * @param matches Liste des matchs
 * @param baseInterval Intervalle de base en millisecondes
 * @param smartMode Activer le mode intelligent
 * @returns Intervalle de rafraîchissement recommandé en millisecondes
 */
export function calculateSmartRefreshInterval(
  matches: Match[],
  baseInterval: number,
  smartMode: boolean
): number {
  if (!smartMode) return baseInterval

  // Si au moins un match est en cours, rafraîchir plus souvent (toutes les 2 minutes)
  const hasLiveMatch = matches.some(isMatchLive)
  if (hasLiveMatch) return Math.min(baseInterval, 2 * 60 * 1000)

  // Si au moins un match commence bientôt, rafraîchir plus souvent (toutes les 3 minutes)
  const hasMatchStartingSoon = matches.some(isMatchStartingSoon)
  if (hasMatchStartingSoon) return Math.min(baseInterval, 3 * 60 * 1000)

  // Sinon, utiliser l'intervalle de base
  return baseInterval
}

/**
 * Détermine si le rafraîchissement doit être actif pour cette liste de matchs
 * @param matches Liste des matchs
 * @returns true si au moins un match nécessite un rafraîchissement
 */
export function shouldRefresh(matches: Match[]): boolean {
  // Rafraîchir s'il y a des matchs en cours ou à venir
  return matches.some(match =>
    isMatchLive(match) || isMatchUpcoming(match) || isMatchStartingSoon(match)
  )
}

/**
 * Formate le temps restant jusqu'au prochain rafraîchissement
 * @param milliseconds Millisecondes restantes
 * @returns String formaté (ex: "2 min 30 sec")
 */
export function formatTimeUntilRefresh(milliseconds: number): string {
  if (milliseconds <= 0) return 'Maintenant'

  const seconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  if (minutes > 0) {
    return `${minutes} min ${remainingSeconds} sec`
  }
  return `${remainingSeconds} sec`
}

/**
 * Convertit un intervalle en millisecondes en minutes
 */
export function msToMinutes(ms: number): number {
  return Math.floor(ms / 60000)
}

/**
 * Convertit des minutes en millisecondes
 */
export function minutesToMs(minutes: number): number {
  return minutes * 60000
}

/**
 * Valide un intervalle de rafraîchissement
 * @param interval Intervalle en millisecondes
 * @param min Minimum en millisecondes
 * @param max Maximum en millisecondes
 * @returns Intervalle validé dans les limites
 */
export function validateRefreshInterval(
  interval: number,
  min: number = 60000,    // 1 minute minimum
  max: number = 1800000   // 30 minutes maximum
): number {
  return Math.max(min, Math.min(max, interval))
}

/**
 * Récupère les paramètres par défaut
 */
export const DEFAULT_SETTINGS = {
  enabled: true,
  interval: 300000, // 5 minutes
  smartMode: true,
  pauseInactive: true
} as const

/**
 * Parse les paramètres depuis l'API
 */
export function parseSettings(settings: Record<string, string>) {
  return {
    enabled: settings.auto_refresh_enabled === 'true',
    interval: parseInt(settings.auto_refresh_interval || '300000', 10),
    smartMode: settings.auto_refresh_smart_mode === 'true',
    pauseInactive: settings.auto_refresh_pause_inactive === 'true'
  }
}
