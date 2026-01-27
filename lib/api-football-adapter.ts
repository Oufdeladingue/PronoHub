/**
 * API-Football Adapter
 * Transforme les données de api-football.com vers le format interne de l'application
 */

// ============================================
// Mapping des statuts de match
// ============================================
const STATUS_MAPPING: Record<string, string> = {
  // Not Started
  'TBD': 'SCHEDULED',       // Time To Be Defined
  'NS': 'SCHEDULED',        // Not Started

  // In Play
  '1H': 'IN_PLAY',         // First Half, Kick Off
  'HT': 'PAUSED',          // Halftime
  '2H': 'IN_PLAY',         // Second Half, 2nd Half Started
  'ET': 'IN_PLAY',         // Extra Time
  'BT': 'PAUSED',          // Break Time (in Extra Time)
  'P': 'IN_PLAY',          // Penalty In Progress

  // Finished
  'FT': 'FINISHED',        // Match Finished
  'AET': 'FINISHED',       // Match Finished After Extra Time
  'PEN': 'FINISHED',       // Match Finished After Penalty

  // Postponed / Cancelled / Suspended
  'SUSP': 'SUSPENDED',     // Match Suspended
  'INT': 'SUSPENDED',      // Match Interrupted
  'PST': 'POSTPONED',      // Match Postponed
  'CANC': 'CANCELLED',     // Match Cancelled
  'ABD': 'CANCELLED',      // Match Abandoned

  // Awards / Technical
  'AWD': 'FINISHED',       // Technical Loss
  'WO': 'FINISHED',        // WalkOver

  // Live
  'LIVE': 'IN_PLAY'        // In Progress (générique)
}

/**
 * Transforme un statut API-Football vers format interne
 */
export function transformStatus(apiStatus: string): string {
  return STATUS_MAPPING[apiStatus] || 'SCHEDULED'
}

// ============================================
// Interfaces API-Football
// ============================================

export interface ApiFootballLeague {
  league: {
    id: number
    name: string
    type: string
    logo: string
  }
  country: {
    name: string
    code: string | null
    flag: string | null
  }
  seasons: Array<{
    year: number
    start: string
    end: string
    current: boolean
    coverage: {
      fixtures: {
        events: boolean
        lineups: boolean
        statistics_fixtures: boolean
        statistics_players: boolean
      }
      standings: boolean
      players: boolean
      top_scorers: boolean
      top_assists: boolean
      top_cards: boolean
      injuries: boolean
      predictions: boolean
      odds: boolean
    }
  }>
}

export interface ApiFootballFixture {
  fixture: {
    id: number
    referee: string | null
    timezone: string
    date: string
    timestamp: number
    periods: {
      first: number | null
      second: number | null
    }
    venue: {
      id: number | null
      name: string | null
      city: string | null
    }
    status: {
      long: string
      short: string
      elapsed: number | null
    }
  }
  league: {
    id: number
    name: string
    country: string
    logo: string
    flag: string | null
    season: number
    round: string
  }
  teams: {
    home: {
      id: number
      name: string
      logo: string
      winner: boolean | null
    }
    away: {
      id: number
      name: string
      logo: string
      winner: boolean | null
    }
  }
  goals: {
    home: number | null
    away: number | null
  }
  score: {
    halftime: {
      home: number | null
      away: number | null
    }
    fulltime: {
      home: number | null
      away: number | null
    }
    extratime: {
      home: number | null
      away: number | null
    }
    penalty: {
      home: number | null
      away: number | null
    }
  }
}

// ============================================
// Interfaces Format Interne
// ============================================

export interface InternalCompetition {
  id: number
  name: string
  code: string
  emblem: string
  area_name: string
  current_season_start_date: string
  current_season_end_date: string
  current_matchday: number
  total_matchdays: number
  is_active: boolean
  api_provider: string
}

export interface InternalMatch {
  football_data_match_id: number  // On garde ce nom pour compatibilité
  competition_id: number
  matchday: number
  stage: string | null  // Phase de compétition (ex: LEAGUE_STAGE, QUARTER_FINALS)
  utc_date: string
  status: string
  home_team_id: number
  home_team_name: string
  home_team_crest: string
  away_team_id: number
  away_team_name: string
  away_team_crest: string
  home_score: number | null
  away_score: number | null
}

// ============================================
// Fonctions de Transformation
// ============================================

/**
 * Parse le stage (phase) depuis le round string d'API-Football
 * Exemples:
 * - "Regular Season - 15" → null (saison régulière)
 * - "Group A - 1" → GROUP_STAGE
 * - "Round of 16" → ROUND_OF_16
 * - "Quarter-finals" → QUARTER_FINALS
 * - "Semi-finals" → SEMI_FINALS
 * - "Final" → FINAL
 * - "3rd Place Final" → THIRD_PLACE
 * - "League Stage - 1" → LEAGUE_STAGE (nouveau format Champions League)
 */
export function parseStageFromRound(round: string): string | null {
  const roundLower = round.toLowerCase()

  // Phase de poule (World Cup, Euro, etc.)
  if (roundLower.includes('group')) {
    return 'GROUP_STAGE'
  }

  // Phase de ligue (nouveau format Champions League)
  if (roundLower.includes('league stage')) {
    return 'LEAGUE_STAGE'
  }

  // Tour préliminaire
  if (roundLower.includes('preliminary') || roundLower.includes('qualifying')) {
    return 'PRELIMINARY_ROUND'
  }

  // Barrages / Playoffs
  if (roundLower.includes('playoff') || roundLower.includes('play-off')) {
    return 'PLAYOFFS'
  }

  // 32èmes de finale
  if (roundLower.includes('round of 32') || roundLower.includes('last 32')) {
    return 'LAST_32'
  }

  // 16èmes / 8èmes de finale
  if (roundLower.includes('round of 16') || roundLower.includes('last 16')) {
    return 'ROUND_OF_16'
  }

  // Quarts de finale
  if (roundLower.includes('quarter')) {
    return 'QUARTER_FINALS'
  }

  // Demi-finales
  if (roundLower.includes('semi')) {
    return 'SEMI_FINALS'
  }

  // Petite finale (3ème place)
  if (roundLower.includes('3rd place') || roundLower.includes('third place')) {
    return 'THIRD_PLACE'
  }

  // Finale (doit être après les autres pour éviter les faux positifs)
  if (roundLower.includes('final') && !roundLower.includes('quarter') && !roundLower.includes('semi')) {
    return 'FINAL'
  }

  // Saison régulière ou non reconnu
  return null
}

/**
 * Parse le numéro de journée depuis le round string d'API-Football
 * Pour les phases de poule: numéro de journée dans la poule
 * Pour les phases knockout: numéro du leg (1 = aller, 2 = retour) ou 1 si match unique
 * Exemples:
 * - "Regular Season - 15" → 15
 * - "Group A - 1" → 1
 * - "League Stage - 3" → 3
 * - "Round of 16" → 1 (match unique ou aller)
 * - "Quarter-finals - 2nd Leg" → 2
 */
export function parseMatchdayFromRound(round: string): number {
  // Cas standard: "Regular Season - 15"
  const regularMatch = round.match(/Regular Season - (\d+)/)
  if (regularMatch) {
    return parseInt(regularMatch[1], 10)
  }

  // Phase de ligue: "League Stage - 3"
  const leagueStageMatch = round.match(/League Stage - (\d+)/)
  if (leagueStageMatch) {
    return parseInt(leagueStageMatch[1], 10)
  }

  // Phase de poule: "Group A - 1", "Group B - 2", etc.
  const groupMatch = round.match(/Group [A-Z] - (\d+)/)
  if (groupMatch) {
    return parseInt(groupMatch[1], 10)
  }

  // Matchs aller-retour knockout: "Round of 16 - 1st Leg" ou "Quarter-finals - 2"
  const legMatch = round.match(/- (\d+)(?:st|nd|rd|th)?\s*(?:Leg)?$/i)
  if (legMatch) {
    return parseInt(legMatch[1], 10)
  }

  // Cas spéciaux pour tournois à élimination (match unique)
  // On retourne 1 par défaut pour les phases knockout
  const stage = parseStageFromRound(round)
  if (stage && ['ROUND_OF_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'FINAL', 'THIRD_PLACE', 'LAST_32', 'PLAYOFFS'].includes(stage)) {
    return 1
  }

  // Cas générique avec numéro
  const genericMatch = round.match(/(\d+)/)
  if (genericMatch) {
    return parseInt(genericMatch[1], 10)
  }

  // Par défaut
  return 1
}

/**
 * Calcule le nombre total de journées depuis une liste de fixtures
 * Compte les paires uniques (stage, matchday) pour gérer les knockouts
 * où le matchday redémarre à 1 par stage
 */
export function calculateTotalMatchdays(fixtures: ApiFootballFixture[]): number {
  if (!fixtures || fixtures.length === 0) return 0

  const stageMatchdayPairs = new Set<string>()
  fixtures.forEach(f => {
    const matchday = parseMatchdayFromRound(f.league.round)
    const stage = parseStageFromRound(f.league.round) || 'REGULAR_SEASON'
    stageMatchdayPairs.add(`${stage}_${matchday}`)
  })
  return stageMatchdayPairs.size
}

/**
 * Transforme une league API-Football vers format interne
 */
export function transformLeagueToCompetition(
  apiLeague: ApiFootballLeague,
  totalMatchdays?: number
): InternalCompetition {
  const currentSeason = apiLeague.seasons.find(s => s.current) || apiLeague.seasons[0]

  return {
    id: apiLeague.league.id,
    name: apiLeague.league.name,
    code: apiLeague.league.type,
    emblem: apiLeague.league.logo,
    area_name: apiLeague.country.name,
    current_season_start_date: currentSeason?.start || new Date().toISOString().split('T')[0],
    current_season_end_date: currentSeason?.end || new Date().toISOString().split('T')[0],
    current_matchday: 1, // À mettre à jour avec les fixtures
    total_matchdays: totalMatchdays || 38, // Valeur par défaut
    is_active: true,
    api_provider: 'api-football'
  }
}

/**
 * Transforme un fixture API-Football vers format interne
 */
export function transformFixtureToMatch(
  apiFixture: ApiFootballFixture,
  competitionId: number
): InternalMatch {
  return {
    football_data_match_id: apiFixture.fixture.id,
    competition_id: competitionId,
    matchday: parseMatchdayFromRound(apiFixture.league.round),
    stage: parseStageFromRound(apiFixture.league.round),
    utc_date: apiFixture.fixture.date,
    status: transformStatus(apiFixture.fixture.status.short),
    home_team_id: apiFixture.teams.home.id,
    home_team_name: apiFixture.teams.home.name,
    home_team_crest: apiFixture.teams.home.logo,
    away_team_id: apiFixture.teams.away.id,
    away_team_name: apiFixture.teams.away.name,
    away_team_crest: apiFixture.teams.away.logo,
    home_score: apiFixture.goals.home,
    away_score: apiFixture.goals.away
  }
}

/**
 * Transforme une liste de fixtures
 * Pour les matchs knockout sans équipes définies, on garde le match avec des placeholders
 */
export function transformFixturesToMatches(
  apiFixtures: ApiFootballFixture[],
  competitionId: number,
  options?: { keepKnockoutWithoutTeams?: boolean }
): InternalMatch[] {
  const keepKnockout = options?.keepKnockoutWithoutTeams ?? true

  return apiFixtures
    .filter(fixture => {
      const hasTeams = fixture.teams.home.id && fixture.teams.away.id

      // Si les équipes sont définies, on garde le match
      if (hasTeams) return true

      // Si on veut garder les matchs knockout sans équipes
      if (keepKnockout) {
        const stage = parseStageFromRound(fixture.league.round)
        // Garder les matchs des phases finales même sans équipes
        if (stage && ['ROUND_OF_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'FINAL', 'THIRD_PLACE', 'LAST_32', 'PLAYOFFS'].includes(stage)) {
          return true
        }
      }

      return false
    })
    .map(fixture => {
      // Pour les matchs sans équipes, utiliser des placeholders
      const hasHomeTeam = fixture.teams.home?.id
      const hasAwayTeam = fixture.teams.away?.id

      return {
        football_data_match_id: fixture.fixture.id,
        competition_id: competitionId,
        matchday: parseMatchdayFromRound(fixture.league.round),
        stage: parseStageFromRound(fixture.league.round),
        utc_date: fixture.fixture.date,
        status: transformStatus(fixture.fixture.status.short),
        home_team_id: hasHomeTeam ? fixture.teams.home.id : 0,
        home_team_name: hasHomeTeam ? fixture.teams.home.name : 'À déterminer',
        home_team_crest: hasHomeTeam ? fixture.teams.home.logo : '',
        away_team_id: hasAwayTeam ? fixture.teams.away.id : 0,
        away_team_name: hasAwayTeam ? fixture.teams.away.name : 'À déterminer',
        away_team_crest: hasAwayTeam ? fixture.teams.away.logo : '',
        home_score: fixture.goals.home,
        away_score: fixture.goals.away
      }
    })
}

/**
 * Détermine la journée actuelle d'une compétition
 * Basé sur les matchs en cours ou à venir
 */
export function determineCurrentMatchday(fixtures: ApiFootballFixture[]): number {
  const now = new Date()

  // Trouver le premier match non terminé
  const upcomingOrLive = fixtures.find(f => {
    const status = transformStatus(f.fixture.status.short)
    return status === 'SCHEDULED' || status === 'IN_PLAY' || status === 'PAUSED'
  })

  if (upcomingOrLive) {
    return parseMatchdayFromRound(upcomingOrLive.league.round)
  }

  // Si tous les matchs sont terminés, retourner la dernière journée
  const allMatchdays = fixtures.map(f => parseMatchdayFromRound(f.league.round))
  return Math.max(...allMatchdays, 1)
}

/**
 * Filtre les fixtures par statut
 */
export function filterFixturesByStatus(
  fixtures: ApiFootballFixture[],
  statuses: string[]
): ApiFootballFixture[] {
  return fixtures.filter(f =>
    statuses.includes(transformStatus(f.fixture.status.short))
  )
}

/**
 * Filtre les fixtures par journée
 */
export function filterFixturesByMatchday(
  fixtures: ApiFootballFixture[],
  matchday: number
): ApiFootballFixture[] {
  return fixtures.filter(f =>
    parseMatchdayFromRound(f.league.round) === matchday
  )
}

/**
 * Groupe les fixtures par journée
 */
export function groupFixturesByMatchday(
  fixtures: ApiFootballFixture[]
): Record<number, ApiFootballFixture[]> {
  return fixtures.reduce((acc, fixture) => {
    const matchday = parseMatchdayFromRound(fixture.league.round)
    if (!acc[matchday]) {
      acc[matchday] = []
    }
    acc[matchday].push(fixture)
    return acc
  }, {} as Record<number, ApiFootballFixture[]>)
}

/**
 * Vérifie si un match est en cours ou à venir dans les N minutes
 */
export function isMatchLiveOrUpcoming(
  fixture: ApiFootballFixture,
  minutesAhead: number = 120
): boolean {
  const status = transformStatus(fixture.fixture.status.short)

  // Match en cours
  if (status === 'IN_PLAY' || status === 'PAUSED') {
    return true
  }

  // Match à venir dans les N minutes
  if (status === 'SCHEDULED') {
    const matchTime = new Date(fixture.fixture.date)
    const now = new Date()
    const diffMinutes = (matchTime.getTime() - now.getTime()) / (1000 * 60)

    return diffMinutes >= 0 && diffMinutes <= minutesAhead
  }

  return false
}

/**
 * Extrait les informations de saison depuis les fixtures
 */
export function extractSeasonInfo(fixtures: ApiFootballFixture[]): {
  season: number
  startDate: string
  endDate: string
} | null {
  if (!fixtures || fixtures.length === 0) return null

  const firstFixture = fixtures[0]
  const season = firstFixture.league.season

  // Trouver les dates min et max
  const dates = fixtures.map(f => new Date(f.fixture.date))
  const startDate = new Date(Math.min(...dates.map(d => d.getTime())))
  const endDate = new Date(Math.max(...dates.map(d => d.getTime())))

  return {
    season,
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0]
  }
}

/**
 * Validation des données API-Football
 */
export function validateFixture(fixture: ApiFootballFixture): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (!fixture.fixture?.id) {
    errors.push('Missing fixture ID')
  }

  if (!fixture.teams?.home?.id) {
    errors.push('Missing home team ID')
  }

  if (!fixture.teams?.away?.id) {
    errors.push('Missing away team ID')
  }

  if (!fixture.league?.id) {
    errors.push('Missing league ID')
  }

  if (!fixture.fixture?.date) {
    errors.push('Missing fixture date')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}
