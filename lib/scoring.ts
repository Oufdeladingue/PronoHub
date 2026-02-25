// Types pour le système de scoring
export interface Prediction {
  predictedHomeScore: number
  predictedAwayScore: number
}

export interface MatchResult {
  homeScore: number
  awayScore: number
}

export interface PointsSettings {
  exactScore: number
  correctResult: number
  incorrectResult: number
  drawWithDefaultPrediction?: number // Points pour match nul avec prono 0-0 par défaut
}

export interface ScoringResult {
  points: number
  isExactScore: boolean
  isCorrectResult: boolean
}

export interface PlayerStats {
  playerId: string
  playerName: string
  totalPoints: number
  exactScores: number
  correctResults: number
  matchesPlayed: number
  matchesAvailable: number
  rank: number
  previousRank?: number
  rankChange?: 'up' | 'down' | 'same'
}

// Détermine le résultat d'un match (victoire domicile, nul, victoire extérieur)
type MatchOutcome = 'HOME_WIN' | 'DRAW' | 'AWAY_WIN'

function getMatchOutcome(homeScore: number, awayScore: number): MatchOutcome {
  if (homeScore > awayScore) return 'HOME_WIN'
  if (homeScore < awayScore) return 'AWAY_WIN'
  return 'DRAW'
}

/**
 * Calcule les points gagnés pour un pronostic
 * @param prediction Le pronostic du joueur
 * @param result Le résultat réel du match
 * @param settings Les paramètres de points
 * @param isBonusMatch Si c'est un match bonus (points x2)
 * @param isDefaultPrediction Si c'est un pronostic par défaut (0-0 non saisi par le joueur)
 * @returns Le résultat du scoring avec les points et les drapeaux
 */
export function calculatePoints(
  prediction: Prediction,
  result: MatchResult,
  settings: PointsSettings,
  isBonusMatch: boolean = false,
  isDefaultPrediction: boolean = false
): ScoringResult {
  const { predictedHomeScore, predictedAwayScore } = prediction
  const { homeScore, awayScore } = result

  // Cas spécial : prono par défaut (0-0) avec match nul
  if (isDefaultPrediction && predictedHomeScore === 0 && predictedAwayScore === 0) {
    const actualOutcome = getMatchOutcome(homeScore, awayScore)
    if (actualOutcome === 'DRAW') {
      // Match nul avec prono par défaut : appliquer les points configurés
      const drawPoints = settings.drawWithDefaultPrediction ?? settings.correctResult
      return {
        points: drawPoints * (isBonusMatch ? 2 : 1),
        isExactScore: false,
        isCorrectResult: true
      }
    }
  }

  // Vérifier si c'est un score exact
  const isExactScore = predictedHomeScore === homeScore && predictedAwayScore === awayScore
  if (isExactScore) {
    return {
      points: settings.exactScore * (isBonusMatch ? 2 : 1),
      isExactScore: true,
      isCorrectResult: true
    }
  }

  // Vérifier si c'est un bon résultat (victoire domicile/nul/victoire extérieur)
  const predictedOutcome = getMatchOutcome(predictedHomeScore, predictedAwayScore)
  const actualOutcome = getMatchOutcome(homeScore, awayScore)
  const isCorrectResult = predictedOutcome === actualOutcome

  if (isCorrectResult) {
    return {
      points: settings.correctResult * (isBonusMatch ? 2 : 1),
      isExactScore: false,
      isCorrectResult: true
    }
  }

  // Mauvais résultat
  return {
    points: settings.incorrectResult * (isBonusMatch ? 2 : 1),
    isExactScore: false,
    isCorrectResult: false
  }
}

export interface KnockoutScoringResult extends ScoringResult {
  qualifierBonus: number
}

/**
 * Calcule les points pour un match éliminatoire (knockout)
 * - Points classiques calculés sur le score 90 minutes
 * - +1 bonus si le qualifié est correctement prédit
 */
export function calculateKnockoutPoints(
  prediction: Prediction,
  result90: MatchResult,
  predictedQualifier: 'home' | 'away' | null,
  actualWinnerSide: 'home' | 'away' | null,
  settings: PointsSettings,
  isBonusMatch: boolean = false,
  isDefaultPrediction: boolean = false,
  bonusQualifiedEnabled: boolean = false,
): KnockoutScoringResult {
  // Points classiques calculés sur le score 90 minutes
  const baseResult = calculatePoints(prediction, result90, settings, isBonusMatch, isDefaultPrediction)

  // Bonus qualifié : +1 si activé et prédiction correcte
  let qualifierBonus = 0
  if (bonusQualifiedEnabled && predictedQualifier && actualWinnerSide) {
    if (predictedQualifier === actualWinnerSide) {
      qualifierBonus = 1
    }
  }

  return {
    ...baseResult,
    points: baseResult.points + qualifierBonus,
    qualifierBonus,
  }
}

/**
 * Détermine le côté (home/away) du qualifié à partir du winner_team_id
 */
export function getWinnerSide(
  winnerTeamId: number | null,
  homeTeamId: number,
  awayTeamId: number
): 'home' | 'away' | null {
  if (!winnerTeamId) return null
  if (winnerTeamId === homeTeamId) return 'home'
  if (winnerTeamId === awayTeamId) return 'away'
  return null
}

/**
 * Génère un match bonus de manière reproductible
 * Utilise un hash du tournamentId + matchday comme seed pour avoir toujours le même résultat
 * @param tournamentId L'ID du tournoi
 * @param matchday Le numéro de la journée
 * @param availableMatches Liste des IDs de matchs disponibles (UUIDs)
 * @returns L'ID du match bonus sélectionné
 */
export function generateBonusMatch(
  tournamentId: string,
  matchday: number,
  availableMatches: string[]
): string {
  if (availableMatches.length === 0) {
    throw new Error('Aucun match disponible pour le match bonus')
  }

  // Créer un seed à partir du tournamentId et du matchday
  const seed = hashString(`${tournamentId}-${matchday}`)

  // Utiliser le seed pour sélectionner un match de manière déterministe
  const index = seed % availableMatches.length
  return availableMatches[index]
}

/**
 * Hash simple d'une chaîne de caractères pour obtenir un nombre
 * @param str La chaîne à hasher
 * @returns Un nombre positif
 */
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash)
}

/**
 * Calcule les classements avec rangs et progressions
 * Gère les égalités parfaites avec rangs partagés
 * @param players Liste des joueurs avec leurs stats (sans rang)
 * @param previousRankings Classement de la journée précédente (optionnel)
 * @returns Liste des joueurs avec rangs et changements de rang
 */
export function calculateRankings(
  players: Omit<PlayerStats, 'rank' | 'rankChange'>[],
  previousRankings?: PlayerStats[]
): PlayerStats[] {
  // Trier par points décroissants, puis par scores exacts décroissants, puis bons résultats
  const sorted = [...players].sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) {
      return b.totalPoints - a.totalPoints
    }
    // En cas d'égalité de points, départager par le nombre de scores exacts
    if (b.exactScores !== a.exactScores) {
      return b.exactScores - a.exactScores
    }
    // En cas d'égalité de scores exacts, départager par le nombre de bons résultats
    return b.correctResults - a.correctResults
  })

  // Calculer les rangs avec gestion des égalités parfaites
  // En cas d'égalité parfaite (pts, scores exacts, bons résultats), le rang est partagé
  let currentRank = 1

  return sorted.map((player, index) => {
    // Vérifier si ce joueur a les mêmes stats que le précédent
    if (index > 0) {
      const prev = sorted[index - 1]
      const isTied = player.totalPoints === prev.totalPoints &&
                     player.exactScores === prev.exactScores &&
                     player.correctResults === prev.correctResults

      if (!isTied) {
        // Pas d'égalité : le rang = position + 1
        currentRank = index + 1
      }
      // Si égalité parfaite, on garde le même rang que le précédent
    }

    let rankChange: 'up' | 'down' | 'same' | undefined
    let previousRank: number | undefined

    if (previousRankings) {
      const prevPlayer = previousRankings.find(p => p.playerId === player.playerId)
      if (prevPlayer) {
        previousRank = prevPlayer.rank
        if (currentRank < prevPlayer.rank) {
          rankChange = 'up'
        } else if (currentRank > prevPlayer.rank) {
          rankChange = 'down'
        } else {
          rankChange = 'same'
        }
      }
    }

    return {
      ...player,
      rank: currentRank,
      previousRank,
      rankChange
    }
  })
}
