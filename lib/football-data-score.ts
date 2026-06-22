/**
 * Extraction des scores depuis un objet `score` football-data.org (v4).
 *
 * PIÈGE : pour un match à élimination décidé aux tirs au but, football-data met le
 * score TAB INCLUS dans `fullTime` (ex. 5-4), alors que le vrai score du match est
 * `regularTime` (90 min, ex. 1-1) — c'est cette valeur qui sert de base au calcul des
 * points dans PronoHub (cf. home_score_90 dans OppositionClient).
 *
 * Objet football-data observé pour une finale aux TAB :
 *   duration: "PENALTY_SHOOTOUT"
 *   fullTime:    { home: 5, away: 4 }   ← inclut les TAB
 *   regularTime: { home: 1, away: 1 }   ← score à 90'
 *   extraTime:   { home: 0, away: 0 }
 *   penalties:   { home: 4, away: 3 }
 */

export interface FootballDataScore {
  winner?: 'HOME_TEAM' | 'AWAY_TEAM' | 'DRAW' | null
  duration?: 'REGULAR' | 'EXTRA_TIME' | 'PENALTY_SHOOTOUT' | string
  fullTime?: { home: number | null; away: number | null }
  halfTime?: { home: number | null; away: number | null }
  regularTime?: { home: number | null; away: number | null }
  extraTime?: { home: number | null; away: number | null }
  penalties?: { home: number | null; away: number | null }
}

export interface ExtractedScores {
  // Score affiché (résultat du match, HORS tirs au but ; inclut les prolongations)
  home_score: number | null
  away_score: number | null
  // Score à l'issue du temps réglementaire (90 min) — base de calcul des points en knockout.
  // null si non pertinent (match réglementaire) → le scoring retombe alors sur home_score.
  home_score_90: number | null
  away_score_90: number | null
  // Côté vainqueur ('home' | 'away' | null) pour mapper winner_team_id
  winnerSide: 'home' | 'away' | null
}

const num = (v: number | null | undefined): number => (typeof v === 'number' ? v : 0)

/**
 * Minute de jeu en direct.
 *
 * football-data (plan Livescores) renvoie un statut IN_PLAY/PAUSED + le score fiables,
 * mais son champ `minute` est souvent `null`. On l'utilise quand il est présent, sinon
 * on DÉRIVE une minute plausible depuis le coup d'envoi et le statut (le client lisse
 * ensuite l'affichage entre deux polls). Approximation volontaire de ±qq min autour de
 * la mi-temps — suffisant pour l'affichage.
 *
 * @param kickoffMs      coup d'envoi (ms epoch)
 * @param status         statut football-data (IN_PLAY / PAUSED / EXTRA_TIME / …)
 * @param fdMinute       champ `minute` football-data (souvent null)
 * @param firstHalfDone  true si score.halfTime est peuplé → on est en 2e période
 * @param nowMs          horloge (injectable pour les tests ; défaut Date.now())
 */
export function deriveLiveMinute(
  kickoffMs: number,
  status: string | null | undefined,
  fdMinute: number | null | undefined,
  firstHalfDone: boolean = false,
  nowMs: number = Date.now()
): number | null {
  if (fdMinute != null) return fdMinute
  if (status === 'PAUSED') return 45 // mi-temps
  const elapsed = Math.floor((nowMs - kickoffMs) / 60000)
  if (status === 'EXTRA_TIME' || status === 'PENALTY_SHOOTOUT') {
    // Prolongations : entre 91' et 120' (plafonné pour éviter l'emballement si le statut reste figé)
    return Math.min(Math.max(91, elapsed - 30), 120) // -30 ≈ pause MT (15) + pause avant prolong. (15)
  }
  if (status !== 'IN_PLAY') return null
  // 2e période si la 1re mi-temps est officiellement terminée (halfTime peuplé),
  // ou à défaut si le temps réel dépasse largement 45' (filet).
  const secondHalf = firstHalfDone || elapsed > 60
  if (!secondHalf) return Math.min(Math.max(1, elapsed), 45) // 1re période (plafonnée à 45')
  // 2e période : retirer la pause de 15 min, plafonner à 90' (le "+" du temps additionnel est
  // géré à l'affichage). Empêche l'emballement (ex. 115') si le statut reste bloqué IN_PLAY.
  return Math.min(Math.max(46, elapsed - 15), 90)
}

export type MatchPhase = 'FIRST_HALF' | 'HALF_TIME' | 'SECOND_HALF' | 'EXTRA_TIME' | 'PENALTIES' | null

/** Libellés FR courts pour l'affichage. */
export const MATCH_PHASE_LABELS: Record<NonNullable<MatchPhase>, string> = {
  FIRST_HALF: '1re MT',
  HALF_TIME: 'Mi-temps',
  SECOND_HALF: '2e MT',
  EXTRA_TIME: 'Prolong.',
  PENALTIES: 'TAB',
}

/**
 * Phase d'un match en direct, dérivée du statut + de la minute (déjà stockés).
 * Utilisable côté client (pas besoin du score halfTime) : la minute encode déjà la période.
 */
export function deriveMatchPhase(
  status: string | null | undefined,
  minute: number | null | undefined
): MatchPhase {
  if (status === 'PAUSED') return 'HALF_TIME'
  if (status === 'EXTRA_TIME') return 'EXTRA_TIME'
  if (status === 'PENALTY_SHOOTOUT') return 'PENALTIES'
  if (status !== 'IN_PLAY') return null
  return (minute ?? 0) > 45 ? 'SECOND_HALF' : 'FIRST_HALF'
}

/**
 * Extrait les scores corrects (affichage + 90 min + vainqueur) depuis un objet score
 * football-data.org. Gère les prolongations et les tirs au but.
 */
export function extractFootballDataScores(score: FootballDataScore | null | undefined): ExtractedScores {
  const s = score || {}
  const duration = s.duration
  const ft: { home: number | null; away: number | null } = s.fullTime || { home: null, away: null }
  const reg = s.regularTime
  const et = s.extraTime

  let home_score: number | null = ft.home ?? null
  let away_score: number | null = ft.away ?? null
  let home_score_90: number | null = null
  let away_score_90: number | null = null

  if (duration === 'PENALTY_SHOOTOUT') {
    // fullTime inclut les TAB → score affiché = réglementaire + prolongations (hors TAB)
    home_score = reg ? num(reg.home) + num(et?.home) : (ft.home ?? null)
    away_score = reg ? num(reg.away) + num(et?.away) : (ft.away ?? null)
    home_score_90 = reg?.home ?? null
    away_score_90 = reg?.away ?? null
  } else if (duration === 'EXTRA_TIME') {
    // fullTime = score après prolongations (pas de TAB) → OK pour l'affichage
    home_score = ft.home ?? null
    away_score = ft.away ?? null
    home_score_90 = reg?.home ?? null
    away_score_90 = reg?.away ?? null
  }
  // duration REGULAR (ou absent) : fullTime = score à 90 min, pas de _90 séparé nécessaire

  const winnerSide =
    s.winner === 'HOME_TEAM' ? 'home' : s.winner === 'AWAY_TEAM' ? 'away' : null

  return { home_score, away_score, home_score_90, away_score_90, winnerSide }
}
