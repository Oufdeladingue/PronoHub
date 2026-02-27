/**
 * API-Football Fallback
 * Utilisé comme backup quand Football Data API retourne des données stale
 * (matchs passés avec status TIMED et scores null)
 *
 * Contrainte: 100 requêtes/jour sur le plan gratuit
 */

import { createAdminClient } from '@/lib/supabase/server'

const API_FOOTBALL_BASE = 'https://v3.football.api-sports.io'

// Mapping Football Data competition ID → API-Football league ID
// Note: la table api_migration_mapping a un bug (Ligue 1 / La Liga inversés)
// On utilise les valeurs correctes ici
const COMPETITION_MAPPING: Record<number, number> = {
  2021: 39,   // Premier League
  2015: 61,   // Ligue 1
  2014: 140,  // La Liga
  2002: 78,   // Bundesliga
  2019: 135,  // Serie A
  2001: 2,    // Champions League
  2146: 3,    // Europa League
  2017: 848,  // Conference League
}

const MAX_API_CALLS_PER_RUN = 20
const FALLBACK_COOLDOWN_HOURS = 4
const MAX_DAILY_API_FOOTBALL_CALLS = 80 // Garder 20 en réserve sur les 100

// Status mapping API-Football short → internal format
const STATUS_MAP: Record<string, string> = {
  'FT': 'FINISHED',
  'AET': 'FINISHED',
  'PEN': 'FINISHED',
  'AWD': 'FINISHED',
  'WO': 'FINISHED',
  'NS': 'TIMED',
  'TBD': 'SCHEDULED',
  '1H': 'IN_PLAY',
  '2H': 'IN_PLAY',
  'ET': 'IN_PLAY',
  'P': 'IN_PLAY',
  'LIVE': 'IN_PLAY',
  'HT': 'PAUSED',
  'BT': 'PAUSED',
  'SUSP': 'SUSPENDED',
  'INT': 'SUSPENDED',
  'PST': 'POSTPONED',
  'CANC': 'CANCELLED',
  'ABD': 'CANCELLED',
}

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

interface ApiFootballFixtureResponse {
  fixture: { id: number; status: { short: string } }
  league: { round: string }
  teams: { home: { name: string }; away: { name: string } }
  goals: { home: number | null; away: number | null }
  score: {
    fulltime: { home: number | null; away: number | null }
    extratime: { home: number | null; away: number | null }
    penalty: { home: number | null; away: number | null }
  }
}

export interface FallbackResult {
  patched: number
  checked: number
  apiCalls: number
  skipped: boolean
  skipReason?: string
  errors: string[]
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
 * Détermine l'année de saison API-Football depuis une date
 * Les saisons européennes couvrent 2 ans (2024-2025), API-Football utilise l'année de début
 */
function getSeasonYear(startDate: string | null): number {
  if (startDate) {
    return new Date(startDate).getFullYear()
  }
  const now = new Date()
  return now.getMonth() < 7 ? now.getFullYear() - 1 : now.getFullYear()
}

/**
 * Appel direct à l'API API-Football
 */
async function fetchApiFootball(
  apiKey: string,
  leagueId: number,
  season: number,
  round: string
): Promise<ApiFootballFixtureResponse[] | null> {
  const url = new URL(`${API_FOOTBALL_BASE}/fixtures`)
  url.searchParams.append('league', String(leagueId))
  url.searchParams.append('season', String(season))
  url.searchParams.append('round', round)

  try {
    const response = await fetch(url.toString(), {
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': 'v3.football.api-sports.io',
      },
    })

    if (!response.ok) {
      console.error(`[API-FOOTBALL] Error ${response.status}: ${response.statusText}`)
      return null
    }

    const data = await response.json()

    if (data.errors && Object.keys(data.errors).length > 0) {
      console.error('[API-FOOTBALL] API errors:', data.errors)
      return null
    }

    return data.response || []
  } catch (error) {
    console.error('[API-FOOTBALL] Fetch error:', error)
    return null
  }
}

/**
 * Vérifie si le fallback peut s'exécuter (cooldown + quota)
 */
async function canRunFallback(supabase: any): Promise<{ allowed: boolean; reason?: string }> {
  // 1. Vérifier le cooldown
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

  // 2. Vérifier le quota journalier (via api_calls_log)
  const today = new Date().toISOString().split('T')[0]
  const { count } = await supabase
    .from('api_calls_log')
    .select('*', { count: 'exact', head: true })
    .eq('api_name', 'api-football')
    .gte('created_at', `${today}T00:00:00`)

  if ((count || 0) >= MAX_DAILY_API_FOOTBALL_CALLS) {
    return {
      allowed: false,
      reason: `Quota: ${count}/${MAX_DAILY_API_FOOTBALL_CALLS} API-Football calls used today`
    }
  }

  return { allowed: true }
}

/**
 * Fonction principale: patche les scores stale via API-Football
 */
export async function patchStaleScoresWithApiFootball(): Promise<FallbackResult> {
  const apiKey = process.env.API_FOOTBALL_KEY
  if (!apiKey) {
    return { patched: 0, checked: 0, apiCalls: 0, skipped: true, skipReason: 'API_FOOTBALL_KEY not configured', errors: [] }
  }

  const supabase = createAdminClient()

  // Vérifier cooldown et quota
  const { allowed, reason } = await canRunFallback(supabase)
  if (!allowed) {
    console.log(`[API-FOOTBALL FALLBACK] Skipped: ${reason}`)
    return { patched: 0, checked: 0, apiCalls: 0, skipped: true, skipReason: reason, errors: [] }
  }

  const errors: string[] = []
  let patched = 0
  let checked = 0
  let apiCalls = 0

  // 1. Trouver les matchs stale: utc_date > 3h dans le passé ET status toujours TIMED/SCHEDULED
  const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
  // Limiter aux 14 derniers jours pour éviter un backfill massif
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
    console.log('[API-FOOTBALL FALLBACK] No stale matches found')
    // Mettre à jour le timestamp même sans matchs stale (pour éviter des checks répétés)
    await updateLastRunTimestamp(supabase)
    return { patched: 0, checked: 0, apiCalls: 0, skipped: false, errors: [] }
  }

  console.log(`[API-FOOTBALL FALLBACK] Found ${staleMatches.length} stale match(es) to check`)

  // 2. Grouper par (competition, matchday)
  const groupKey = (m: StaleMatch) => `${m.competition_id}_${m.matchday}`
  const groups = new Map<string, StaleMatch[]>()

  for (const match of staleMatches) {
    const key = groupKey(match)
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(match)
  }

  // 3. Récupérer les saisons des compétitions
  const competitionIds = [...new Set(staleMatches.map(m => m.competition_id))]
  const { data: competitions } = await supabase
    .from('competitions')
    .select('id, current_season_start_date')
    .in('id', competitionIds)

  const seasonMap = new Map<number, number>()
  competitions?.forEach((c: any) => {
    seasonMap.set(c.id, getSeasonYear(c.current_season_start_date))
  })

  // 4. Pour chaque groupe (competition, matchday), fetch depuis API-Football
  for (const [key, matches] of groups) {
    if (apiCalls >= MAX_API_CALLS_PER_RUN) {
      console.log(`[API-FOOTBALL FALLBACK] Reached max API calls (${MAX_API_CALLS_PER_RUN}), stopping`)
      break
    }

    const compId = matches[0].competition_id
    const matchday = matches[0].matchday
    const apiFootballLeagueId = COMPETITION_MAPPING[compId]

    if (!apiFootballLeagueId) {
      console.log(`[API-FOOTBALL FALLBACK] No mapping for competition ${compId}, skipping`)
      continue
    }

    const season = seasonMap.get(compId) || getSeasonYear(null)
    const round = `Regular Season - ${matchday}`

    console.log(`[API-FOOTBALL FALLBACK] Fetching league ${apiFootballLeagueId} season ${season} round "${round}" (${matches.length} stale matches)`)

    // Rate limit: attendre entre les appels
    if (apiCalls > 0) {
      await new Promise(resolve => setTimeout(resolve, 2000))
    }

    const startTime = Date.now()
    const fixtures = await fetchApiFootball(apiKey, apiFootballLeagueId, season, round)
    const responseTime = Date.now() - startTime
    apiCalls++

    // Logger l'appel API
    try {
      await supabase.from('api_calls_log').insert({
        api_name: 'api-football',
        call_type: 'fallback-scores',
        competition_id: compId,
        success: !!fixtures,
        response_time_ms: responseTime
      })
    } catch { /* ignore logging errors */ }

    if (!fixtures || fixtures.length === 0) {
      console.log(`[API-FOOTBALL FALLBACK] No fixtures returned for round "${round}"`)
      continue
    }

    console.log(`[API-FOOTBALL FALLBACK] Got ${fixtures.length} fixtures from API-Football`)

    // 5. Matcher et patcher chaque match stale
    for (const staleMatch of matches) {
      checked++

      // Trouver le fixture correspondant via fuzzy matching des noms d'équipe
      const apiFixture = fixtures.find(f =>
        teamsMatch(f.teams.home.name, staleMatch.home_team_name) &&
        teamsMatch(f.teams.away.name, staleMatch.away_team_name)
      )

      if (!apiFixture) {
        // Essayer en inversant (cas rare)
        const apiFixtureReversed = fixtures.find(f =>
          teamsMatch(f.teams.home.name, staleMatch.away_team_name) &&
          teamsMatch(f.teams.away.name, staleMatch.home_team_name)
        )

        if (!apiFixtureReversed) {
          console.log(`[API-FOOTBALL FALLBACK] No match found for ${staleMatch.home_team_name} vs ${staleMatch.away_team_name}`)
          continue
        }
      }

      const matchedFixture = apiFixture || fixtures.find(f =>
        teamsMatch(f.teams.home.name, staleMatch.away_team_name) &&
        teamsMatch(f.teams.away.name, staleMatch.home_team_name)
      )

      if (!matchedFixture) continue

      const apiStatus = STATUS_MAP[matchedFixture.fixture.status.short] || staleMatch.status

      // Ne mettre à jour que si API-Football a un status plus avancé
      if (apiStatus === 'FINISHED' || apiStatus === 'IN_PLAY' || apiStatus === 'PAUSED') {
        const updateData: Record<string, any> = {
          status: apiStatus,
          finished: apiStatus === 'FINISHED',
          home_score: matchedFixture.goals.home,
          away_score: matchedFixture.goals.away,
          last_updated_at: new Date().toISOString(),
        }

        // Scores 90min si terminé
        if (apiStatus === 'FINISHED') {
          updateData.home_score_90 = matchedFixture.score.fulltime.home
          updateData.away_score_90 = matchedFixture.score.fulltime.away

          // Prolongation
          if (matchedFixture.score.extratime.home !== null) {
            updateData.home_score_extra = matchedFixture.score.extratime.home
            updateData.away_score_extra = matchedFixture.score.extratime.away
          }

          // Tirs au but
          if (matchedFixture.score.penalty.home !== null) {
            updateData.home_score_penalty = matchedFixture.score.penalty.home
            updateData.away_score_penalty = matchedFixture.score.penalty.away
          }
        }

        const { error: updateError } = await supabase
          .from('imported_matches')
          .update(updateData)
          .eq('id', staleMatch.id)

        if (updateError) {
          errors.push(`Failed to update ${staleMatch.home_team_name} vs ${staleMatch.away_team_name}: ${updateError.message}`)
        } else {
          patched++
          console.log(`[API-FOOTBALL FALLBACK] Patched: ${staleMatch.home_team_name} ${matchedFixture.goals.home}-${matchedFixture.goals.away} ${staleMatch.away_team_name} (${apiStatus})`)
        }
      } else {
        console.log(`[API-FOOTBALL FALLBACK] ${staleMatch.home_team_name} vs ${staleMatch.away_team_name}: API-Football also shows "${matchedFixture.fixture.status.short}" (${apiStatus})`)
      }
    }
  }

  // 6. Mettre à jour le timestamp de dernière exécution
  await updateLastRunTimestamp(supabase)

  console.log(`[API-FOOTBALL FALLBACK] Done: ${patched} patched, ${checked} checked, ${apiCalls} API calls`)

  return { patched, checked, apiCalls, skipped: false, errors }
}

async function updateLastRunTimestamp(supabase: any): Promise<void> {
  await supabase
    .from('admin_settings')
    .upsert({
      setting_key: 'api_football_last_fallback_run',
      setting_value: new Date().toISOString()
    }, { onConflict: 'setting_key' })
}
