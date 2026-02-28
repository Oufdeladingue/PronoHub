/**
 * Score Fallback via TheSportsDB
 * Utilisé comme backup quand Football Data API retourne des données stale
 * (matchs passés avec status TIMED et scores null)
 *
 * TheSportsDB est gratuit et ne nécessite aucune clé API
 * Limite: 30 requêtes/minute (largement suffisant)
 */

import { createAdminClient } from '@/lib/supabase/server'

const THESPORTSDB_BASE = 'https://www.thesportsdb.com/api/v1/json/123'

// Mapping Football Data competition ID → TheSportsDB league ID
const COMPETITION_MAPPING: Record<number, number> = {
  2021: 4328,  // English Premier League
  2015: 4334,  // French Ligue 1
  2014: 4335,  // Spanish La Liga
  2002: 4331,  // German Bundesliga
  2019: 4332,  // Italian Serie A
  2001: 4480,  // UEFA Champions League
  2146: 4481,  // UEFA Europa League
}

const MAX_API_CALLS_PER_RUN = 10
const FALLBACK_COOLDOWN_HOURS = 4

interface StaleMatch {
  id: string
  football_data_match_id: number
  competition_id: number
  matchday: number
  utc_date: string
  status: string
  home_team_name: string
  away_team_name: string
}

interface TheSportsDBEvent {
  idEvent: string
  strEvent: string
  strHomeTeam: string
  strAwayTeam: string
  intHomeScore: string | null
  intAwayScore: string | null
  intRound: string
  dateEvent: string
  strTime: string
  strStatus: string
  strLeague: string
}

export interface FallbackResult {
  patched: number
  checked: number
  apiCalls: number
  skipped: boolean
  skipReason?: string
  errors: string[]
  debug?: {
    staleMatchesFound: number
    groups: any[]
    apiResponses: any[]
  }
}

/**
 * Normalise un nom d'équipe pour le matching fuzzy
 */
function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/\b(fc|ac|as|sc|ssc|rc|cf|cd|ud|sv|us|ss|og|rb|tsg|vfb|vfl|1\.)\b/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim()
}

/**
 * Vérifie si deux noms d'équipe correspondent (fuzzy matching)
 */
function teamsMatch(name1: string, name2: string): boolean {
  const n1 = normalizeTeamName(name1)
  const n2 = normalizeTeamName(name2)

  if (n1 === n2) return true
  if (n1.length >= 4 && n2.length >= 4) {
    if (n1.includes(n2) || n2.includes(n1)) return true
  }
  return false
}

/**
 * Détermine la saison au format TheSportsDB (ex: "2025-2026")
 */
function getSeasonString(startDate: string | null): string {
  let startYear: number
  if (startDate) {
    startYear = new Date(startDate).getFullYear()
  } else {
    const now = new Date()
    startYear = now.getMonth() < 7 ? now.getFullYear() - 1 : now.getFullYear()
  }
  return `${startYear}-${startYear + 1}`
}

/**
 * Fetch tous les matchs d'une saison depuis TheSportsDB
 */
async function fetchSeasonEvents(
  leagueId: number,
  season: string
): Promise<{ events: TheSportsDBEvent[]; debug: any }> {
  const url = `${THESPORTSDB_BASE}/eventsseason.php?id=${leagueId}&s=${season}`
  const debugInfo: any = { url, leagueId, season }

  try {
    const response = await fetch(url)
    debugInfo.httpStatus = response.status

    if (!response.ok) {
      console.error(`[FALLBACK] Error ${response.status}: ${response.statusText}`)
      debugInfo.error = `HTTP ${response.status}: ${response.statusText}`
      return { events: [], debug: debugInfo }
    }

    const data = await response.json()
    const events: TheSportsDBEvent[] = data.events || []
    debugInfo.totalEvents = events.length

    return { events, debug: debugInfo }
  } catch (error: any) {
    console.error('[FALLBACK] Fetch error:', error)
    debugInfo.error = error.message
    return { events: [], debug: debugInfo }
  }
}

/**
 * Vérifie si le fallback peut s'exécuter (cooldown)
 */
async function canRunFallback(supabase: any): Promise<{ allowed: boolean; reason?: string }> {
  const { data: lastRunSetting } = await supabase
    .from('admin_settings')
    .select('setting_value')
    .eq('setting_key', 'api_football_last_fallback_run')
    .single()

  if (lastRunSetting?.setting_value) {
    const lastRun = new Date(lastRunSetting.setting_value)
    const hoursSinceLastRun = (Date.now() - lastRun.getTime()) / (1000 * 60 * 60)

    if (hoursSinceLastRun < FALLBACK_COOLDOWN_HOURS) {
      return {
        allowed: false,
        reason: `Cooldown: last run ${Math.round(hoursSinceLastRun * 10) / 10}h ago (min ${FALLBACK_COOLDOWN_HOURS}h)`
      }
    }
  }

  return { allowed: true }
}

/**
 * Fonction principale: patche les scores stale via TheSportsDB
 */
export async function patchStaleScoresWithApiFootball(): Promise<FallbackResult> {
  const supabase = createAdminClient()

  // Vérifier cooldown
  const { allowed, reason } = await canRunFallback(supabase)
  if (!allowed) {
    console.log(`[FALLBACK] Skipped: ${reason}`)
    return { patched: 0, checked: 0, apiCalls: 0, skipped: true, skipReason: reason, errors: [] }
  }

  const errors: string[] = []
  let patched = 0
  let checked = 0
  let apiCalls = 0
  const debugGroups: any[] = []
  const debugApiResponses: any[] = []

  // 1. Trouver les matchs stale: utc_date > 3h dans le passé ET status toujours TIMED/SCHEDULED
  const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

  const { data: staleMatches, error: queryError } = await supabase
    .from('imported_matches')
    .select('id, football_data_match_id, competition_id, matchday, utc_date, status, home_team_name, away_team_name')
    .lt('utc_date', threeHoursAgo)
    .gt('utc_date', twoWeeksAgo)
    .in('status', ['TIMED', 'SCHEDULED'])
    .order('utc_date', { ascending: false })
    .limit(200)

  if (queryError) {
    return { patched: 0, checked: 0, apiCalls: 0, skipped: false, errors: [queryError.message] }
  }

  if (!staleMatches || staleMatches.length === 0) {
    console.log('[FALLBACK] No stale matches found')
    await updateLastRunTimestamp(supabase)
    return { patched: 0, checked: 0, apiCalls: 0, skipped: false, errors: [], debug: { staleMatchesFound: 0, groups: [], apiResponses: [] } }
  }

  console.log(`[FALLBACK] Found ${staleMatches.length} stale match(es) to check`)

  // 2. Grouper par competition_id (1 appel API par compétition)
  const competitionGroups = new Map<number, StaleMatch[]>()
  for (const match of staleMatches) {
    if (!competitionGroups.has(match.competition_id)) {
      competitionGroups.set(match.competition_id, [])
    }
    competitionGroups.get(match.competition_id)!.push(match)
  }

  // 3. Récupérer les saisons des compétitions
  const competitionIds = [...competitionGroups.keys()]
  const { data: competitions } = await supabase
    .from('competitions')
    .select('id, current_season_start_date')
    .in('id', competitionIds)

  const seasonMap = new Map<number, string>()
  competitions?.forEach((c: any) => {
    seasonMap.set(c.id, getSeasonString(c.current_season_start_date))
  })

  // 4. Pour chaque compétition, fetch la saison complète et matcher les matchs stale
  // Cache des événements par compétition pour éviter les appels redondants
  const eventsCache = new Map<number, TheSportsDBEvent[]>()

  for (const [compId, matches] of competitionGroups) {
    if (apiCalls >= MAX_API_CALLS_PER_RUN) {
      console.log(`[FALLBACK] Reached max API calls (${MAX_API_CALLS_PER_RUN}), stopping`)
      break
    }

    const theSportsDbLeagueId = COMPETITION_MAPPING[compId]
    if (!theSportsDbLeagueId) {
      console.log(`[FALLBACK] No mapping for competition ${compId}, skipping`)
      debugGroups.push({ compId, skipped: true, reason: 'no mapping' })
      continue
    }

    const season = seasonMap.get(compId) || getSeasonString(null)

    debugGroups.push({
      compId,
      theSportsDbLeagueId,
      season,
      staleMatchCount: matches.length,
      sampleMatches: matches.slice(0, 3).map(m => `${m.home_team_name} vs ${m.away_team_name} (md${m.matchday}, ${m.status})`)
    })

    // Fetch la saison (ou utiliser le cache)
    let events = eventsCache.get(compId)
    if (!events) {
      console.log(`[FALLBACK] Fetching TheSportsDB league ${theSportsDbLeagueId} season ${season} (${matches.length} stale matches)`)

      if (apiCalls > 0) {
        await new Promise(resolve => setTimeout(resolve, 2500))
      }

      const startTime = Date.now()
      const { events: fetchedEvents, debug: fetchDebug } = await fetchSeasonEvents(theSportsDbLeagueId, season)
      const responseTime = Date.now() - startTime
      apiCalls++

      // Filtrer aux matchs terminés avec scores
      events = fetchedEvents.filter(e => e.strStatus === 'Match Finished' && e.intHomeScore !== null)
      eventsCache.set(compId, events)

      debugApiResponses.push({
        ...fetchDebug,
        finishedEvents: events.length,
        sampleEvents: events.slice(-3).map(e => `${e.strHomeTeam} ${e.intHomeScore}-${e.intAwayScore} ${e.strAwayTeam} (R${e.intRound})`),
        responseTimeMs: responseTime
      })

      // Logger l'appel API
      try {
        await supabase.from('api_calls_log').insert({
          api_name: 'thesportsdb',
          call_type: 'fallback-scores',
          competition_id: compId,
          success: events.length > 0,
          response_time_ms: responseTime
        })
      } catch { /* ignore logging errors */ }
    }

    if (events.length === 0) {
      console.log(`[FALLBACK] No finished events found for league ${theSportsDbLeagueId}`)
      continue
    }

    // 5. Matcher et patcher chaque match stale
    for (const staleMatch of matches) {
      checked++

      // Filtrer les événements du même round
      const roundEvents = events.filter(e => String(e.intRound) === String(staleMatch.matchday))

      if (roundEvents.length === 0) {
        continue
      }

      // Trouver l'événement correspondant via fuzzy matching des noms d'équipe
      const matchedEvent = roundEvents.find(e =>
        teamsMatch(e.strHomeTeam, staleMatch.home_team_name) &&
        teamsMatch(e.strAwayTeam, staleMatch.away_team_name)
      ) || roundEvents.find(e =>
        // Essayer en inversant (cas rare)
        teamsMatch(e.strHomeTeam, staleMatch.away_team_name) &&
        teamsMatch(e.strAwayTeam, staleMatch.home_team_name)
      )

      if (!matchedEvent) {
        console.log(`[FALLBACK] No match found for ${staleMatch.home_team_name} vs ${staleMatch.away_team_name} (md${staleMatch.matchday})`)
        continue
      }

      const homeScore = parseInt(matchedEvent.intHomeScore!, 10)
      const awayScore = parseInt(matchedEvent.intAwayScore!, 10)

      if (isNaN(homeScore) || isNaN(awayScore)) {
        continue
      }

      const updateData: Record<string, any> = {
        status: 'FINISHED',
        finished: true,
        home_score: homeScore,
        away_score: awayScore,
        last_updated_at: new Date().toISOString(),
      }

      const { error: updateError } = await supabase
        .from('imported_matches')
        .update(updateData)
        .eq('id', staleMatch.id)

      if (updateError) {
        errors.push(`Failed to update ${staleMatch.home_team_name} vs ${staleMatch.away_team_name}: ${updateError.message}`)
      } else {
        patched++
        console.log(`[FALLBACK] Patched: ${staleMatch.home_team_name} ${homeScore}-${awayScore} ${staleMatch.away_team_name}`)
      }
    }
  }

  // 6. Mettre à jour le timestamp de dernière exécution
  await updateLastRunTimestamp(supabase)

  console.log(`[FALLBACK] Done: ${patched} patched, ${checked} checked, ${apiCalls} API calls`)

  return {
    patched, checked, apiCalls, skipped: false, errors,
    debug: {
      staleMatchesFound: staleMatches.length,
      groups: debugGroups,
      apiResponses: debugApiResponses
    }
  }
}

async function updateLastRunTimestamp(supabase: any): Promise<void> {
  await supabase
    .from('admin_settings')
    .upsert({
      setting_key: 'api_football_last_fallback_run',
      setting_value: new Date().toISOString()
    }, { onConflict: 'setting_key' })
}
