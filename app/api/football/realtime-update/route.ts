import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const FOOTBALL_DATA_API = 'https://api.football-data.org/v4'

// Type pour le résultat de la mise à jour temps réel
export interface RealtimeUpdateResult {
  success: boolean
  message: string
  totalMatches?: number
  successCount?: number
  failureCount?: number
  results?: any[]
  error?: string
  strategy?: string // 'hybrid', 'by-match', 'by-competition'
}

// Seuil à partir duquel on bascule sur approche par compétition
const COMPETITION_THRESHOLD = 5

// Logger les appels API
async function logApiCall(
  callType: string,
  competitionId: number | null,
  success: boolean,
  responseTimeMs?: number
) {
  try {
    const adminClient = createAdminClient()
    await adminClient.from('api_calls_log').insert({
      api_name: 'football-data',
      call_type: callType,
      competition_id: competitionId,
      success,
      response_time_ms: responseTimeMs
    })
  } catch {
    // Ignore logging errors
  }
}

/**
 * Structure pour grouper les matchs par compétition
 */
interface MatchGroup {
  competitionId: number
  matches: Array<{
    football_data_match_id: number
    home_team_name: string
    away_team_name: string
    status: string
    utc_date: string
  }>
}

/**
 * Fonction pour récupérer les matchs actifs groupés par compétition
 * Retourne une structure permettant la stratégie hybride
 */
async function getActiveMatchesGrouped(): Promise<MatchGroup[]> {
  const supabase = createAdminClient()
  const now = new Date().toISOString()

  // Récupérer les fenêtres actives (now entre window_start et window_end)
  const { data: activeWindows, error } = await supabase
    .from('match_windows')
    .select('competition_id, match_date')
    .lte('window_start', now)
    .gte('window_end', now)

  if (error || !activeWindows || activeWindows.length === 0) {
    console.log('[REALTIME-UPDATE] No active match windows found')
    return []
  }

  console.log(`[REALTIME-UPDATE] Found ${activeWindows.length} active window(s)`)

  const matchGroups: MatchGroup[] = []

  for (const window of activeWindows) {
    const { data: matches, error: matchesError } = await supabase
      .from('imported_matches')
      .select('football_data_match_id, home_team_name, away_team_name, status, utc_date')
      .eq('competition_id', window.competition_id)
      .gte('utc_date', window.match_date)
      .lt('utc_date', new Date(new Date(window.match_date).getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .in('status', ['TIMED', 'IN_PLAY', 'PAUSED'])

    if (matchesError) {
      console.error(`[REALTIME-UPDATE] Error fetching matches for window:`, matchesError)
      continue
    }

    if (matches && matches.length > 0) {
      // Filtrer les matchs selon leur proximité temporelle
      const nowTime = new Date().getTime()
      const MARGIN_BEFORE_KICKOFF_MS = 10 * 60 * 1000
      const MARGIN_AFTER_KICKOFF_MS = 3 * 60 * 60 * 1000

      const filteredMatches = matches.filter(match => {
        const kickoffTime = new Date(match.utc_date).getTime()
        const timeSinceKickoff = nowTime - kickoffTime

        return (
          match.status === 'IN_PLAY' ||
          match.status === 'PAUSED' ||
          (match.status === 'TIMED' && timeSinceKickoff >= -MARGIN_BEFORE_KICKOFF_MS && timeSinceKickoff <= MARGIN_AFTER_KICKOFF_MS)
        )
      })

      if (filteredMatches.length > 0) {
        console.log(`[REALTIME-UPDATE] Competition ${window.competition_id}: ${filteredMatches.length} active match(es)`)
        matchGroups.push({
          competitionId: window.competition_id,
          matches: filteredMatches
        })
      }
    }
  }

  return matchGroups
}

/**
 * Fonction exportée pour exécuter la mise à jour temps réel ciblée HYBRIDE
 * Choisit automatiquement entre approche par match ou par compétition selon le nombre de matchs
 */
export async function executeRealtimeUpdate(): Promise<RealtimeUpdateResult> {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY

  if (!apiKey) {
    return {
      success: false,
      message: 'Football Data API key not configured',
      error: 'Football Data API key not configured'
    }
  }

  // Récupérer les matchs actifs groupés par compétition
  const matchGroups = await getActiveMatchesGrouped()

  if (matchGroups.length === 0) {
    return {
      success: true,
      message: 'No active matches to update (no match windows)',
      successCount: 0,
      totalMatches: 0,
      results: [],
      strategy: 'none'
    }
  }

  // Analyser la stratégie optimale
  const totalMatches = matchGroups.reduce((sum, group) => sum + group.matches.length, 0)
  let strategyUsed = 'hybrid'

  console.log('[REALTIME-UPDATE] ===== STRATÉGIE HYBRIDE =====')
  matchGroups.forEach(group => {
    const strategy = group.matches.length >= COMPETITION_THRESHOLD ? 'COMPETITION' : 'INDIVIDUAL'
    console.log(`  Competition ${group.competitionId}: ${group.matches.length} matchs → ${strategy}`)
  })
  console.log(`  Total: ${totalMatches} matchs à mettre à jour`)
  console.log('[REALTIME-UPDATE] ================================')

  const supabase = createAdminClient()
  const results = []
  const MIN_DELAY_BETWEEN_CALLS_MS = 6000

  // Traiter chaque groupe de compétition
  for (let groupIdx = 0; groupIdx < matchGroups.length; groupIdx++) {
    const group = matchGroups[groupIdx]

    // Délai entre les groupes (sauf pour le premier)
    if (groupIdx > 0) {
      console.log(`[REALTIME-UPDATE] Waiting ${MIN_DELAY_BETWEEN_CALLS_MS/1000}s before next competition...`)
      await new Promise(resolve => setTimeout(resolve, MIN_DELAY_BETWEEN_CALLS_MS))
    }

    // STRATÉGIE : Si >= 5 matchs, récupérer toute la compétition (1 appel)
    if (group.matches.length >= COMPETITION_THRESHOLD) {
      console.log(`[REALTIME-UPDATE] 🏆 Using COMPETITION approach for ${group.competitionId} (${group.matches.length} matches)`)

      try {
        const startTime = Date.now()
        const response = await fetch(
          `${FOOTBALL_DATA_API}/competitions/${group.competitionId}/matches`,
          { headers: { 'X-Auth-Token': apiKey } }
        )
        const responseTime = Date.now() - startTime

        await logApiCall('realtime', group.competitionId, response.ok, responseTime)

        if (!response.ok) {
          console.error(`Failed to fetch competition ${group.competitionId}: ${response.statusText}`)
          group.matches.forEach(m => {
            results.push({ matchId: m.football_data_match_id, success: false, error: `Competition API error: ${response.statusText}` })
          })
          continue
        }

        const competitionData = await response.json()
        const matchIds = new Set(group.matches.map(m => m.football_data_match_id))

        // Filtrer uniquement les matchs actifs de notre groupe
        const relevantMatches = competitionData.matches.filter((m: any) => matchIds.has(m.id))

        console.log(`[REALTIME-UPDATE] Competition fetched: ${relevantMatches.length}/${group.matches.length} relevant matches found`)

        // Mettre à jour chaque match
        for (const matchData of relevantMatches) {
          const updateData = {
            status: matchData.status,
            finished: matchData.status === 'FINISHED',
            home_score: matchData.score?.fullTime?.home ?? null,
            away_score: matchData.score?.fullTime?.away ?? null,
            last_updated_at: new Date().toISOString(),
          }

          const { error: updateError } = await supabase
            .from('imported_matches')
            .update(updateData)
            .eq('football_data_match_id', matchData.id)

          results.push({
            matchId: matchData.id,
            success: !updateError,
            error: updateError?.message,
            status: matchData.status,
            score: `${matchData.score?.fullTime?.home ?? '-'} - ${matchData.score?.fullTime?.away ?? '-'}`
          })
        }

      } catch (error: any) {
        console.error(`Error processing competition ${group.competitionId}:`, error)
        group.matches.forEach(m => {
          results.push({ matchId: m.football_data_match_id, success: false, error: error.message })
        })
      }
    }
    // STRATÉGIE : Si < 5 matchs, récupérer match par match
    else {
      console.log(`[REALTIME-UPDATE] ⚡ Using INDIVIDUAL approach for ${group.competitionId} (${group.matches.length} matches)`)

      const matchIds = group.matches.map(m => m.football_data_match_id)
      const individualResults = await updateMatchesIndividually(apiKey, matchIds, supabase)
      results.push(...individualResults)
    }
  }

  const successCount = results.filter(r => r.success).length
  const failureCount = results.filter(r => !r.success).length

  return {
    success: true,
    message: `Hybrid update: ${successCount} successful, ${failureCount} failed`,
    totalMatches,
    successCount,
    failureCount,
    results,
    strategy: strategyUsed
  }
}

/**
 * Fonction helper pour mettre à jour des matchs individuellement
 * Utilisée quand < 5 matchs dans une compétition
 */
async function updateMatchesIndividually(
  apiKey: string,
  matchIds: number[],
  supabase: any
): Promise<any[]> {
  const results = []
  const MIN_DELAY_BETWEEN_CALLS_MS = 6000

  // Récupérer infos pour cache et filtrage
  const { data: matchesInfo } = await supabase
    .from('imported_matches')
    .select('football_data_match_id, status, last_updated_at')
    .in('football_data_match_id', matchIds)

  const matchInfoMap = new Map<number, any>(matchesInfo?.map((m: any) => [m.football_data_match_id, m]) || [])

  // Filtrer les matchs à vraiment mettre à jour (cache)
  const matchIdsToUpdate = matchIds.filter(matchId => {
    const info = matchInfoMap.get(matchId)
    if (!info) return true

    if (info.status === 'IN_PLAY' || info.status === 'PAUSED') return true

    if (info.status === 'TIMED' && info.last_updated_at) {
      const minutesSinceUpdate = (Date.now() - new Date(info.last_updated_at).getTime()) / 60000
      if (minutesSinceUpdate < 3) {
        console.log(`[REALTIME-UPDATE] Skipping match ${matchId} (TIMED, updated ${Math.round(minutesSinceUpdate)}m ago)`)
        return false
      }
    }

    return true
  })

  console.log(`[REALTIME-UPDATE] ${matchIdsToUpdate.length}/${matchIds.length} matches need update (${matchIds.length - matchIdsToUpdate.length} skipped)`)

  for (let i = 0; i < matchIdsToUpdate.length; i++) {
    const matchId = matchIdsToUpdate[i]
    const currentInfo = matchInfoMap.get(matchId)

    if (i > 0) {
      const delay = currentInfo?.status === 'IN_PLAY' || currentInfo?.status === 'PAUSED' ? 3000 : MIN_DELAY_BETWEEN_CALLS_MS
      console.log(`[REALTIME-UPDATE] Waiting ${delay/1000}s before next match...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }

    try {
      const startTime = Date.now()
      const response = await fetch(`${FOOTBALL_DATA_API}/matches/${matchId}`, {
        headers: { 'X-Auth-Token': apiKey },
      })
      const responseTime = Date.now() - startTime

      await logApiCall('realtime', null, response.ok, responseTime)

      if (!response.ok) {
        results.push({ matchId, success: false, error: `API error: ${response.statusText}` })
        continue
      }

      const matchData = await response.json()

      const updateData = {
        status: matchData.status,
        finished: matchData.status === 'FINISHED',
        home_score: matchData.score?.fullTime?.home ?? null,
        away_score: matchData.score?.fullTime?.away ?? null,
        last_updated_at: new Date().toISOString(),
      }

      const { error: updateError } = await supabase
        .from('imported_matches')
        .update(updateData)
        .eq('football_data_match_id', matchId)

      results.push({
        matchId,
        success: !updateError,
        error: updateError?.message,
        status: matchData.status,
        score: `${matchData.score?.fullTime?.home ?? '-'} - ${matchData.score?.fullTime?.away ?? '-'}`
      })

    } catch (error: any) {
      results.push({ matchId, success: false, error: error.message })
    }
  }

  return results
}

export async function POST() {
  const startTime = Date.now()

  try {
    const result = await executeRealtimeUpdate()
    const executionTimeMs = Date.now() - startTime

    // Logger le résultat dans cron_logs
    try {
      const adminClient = createAdminClient()
      await adminClient.from('cron_logs').insert({
        job_name: 'realtime-update',
        status: result.success ? 'success' : 'error',
        message: result.message,
        competitions_updated: result.successCount || 0,
        execution_time_ms: executionTimeMs
      })
    } catch (logError) {
      console.error('Failed to log cron result:', logError)
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || result.message },
        { status: 500 }
      )
    }

    return NextResponse.json(result)

  } catch (error: any) {
    console.error('Error in realtime-update:', error)
    const executionTimeMs = Date.now() - startTime

    // Logger l'erreur
    try {
      const adminClient = createAdminClient()
      await adminClient.from('cron_logs').insert({
        job_name: 'realtime-update',
        status: 'error',
        message: error.message,
        competitions_updated: 0,
        execution_time_ms: executionTimeMs
      })
    } catch (logError) {
      console.error('Failed to log cron error:', logError)
    }

    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
