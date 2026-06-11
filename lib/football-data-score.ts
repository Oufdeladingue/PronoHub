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
