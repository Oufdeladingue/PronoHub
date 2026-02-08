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
}

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
 * Fonction pour récupérer les IDs des matchs dans les fenêtres actives
 * Une fenêtre est active si l'heure actuelle est entre window_start et window_end
 */
async function getActiveMatchIds() {
  const supabase = await createClient()
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

  // Pour chaque fenêtre, récupérer les matchs correspondants
  const allMatchIds = new Set<number>()

  for (const window of activeWindows) {
    const { data: matches, error: matchesError } = await supabase
      .from('imported_matches')
      .select('football_data_match_id, home_team_name, away_team_name, status, utc_date')
      .eq('competition_id', window.competition_id)
      .gte('utc_date', window.match_date)
      .lt('utc_date', new Date(new Date(window.match_date).getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .in('status', ['TIMED', 'IN_PLAY', 'PAUSED']) // Uniquement les matchs à venir ou en cours (pas FINISHED)

    if (matchesError) {
      console.error(`[REALTIME-UPDATE] Error fetching matches for window:`, matchesError)
      continue
    }

    if (matches && matches.length > 0) {
      console.log(`[REALTIME-UPDATE] Window ${window.competition_id} (${window.match_date}): ${matches.length} match(es) found`)

      // Filtrer les matchs selon leur proximité temporelle
      const nowTime = new Date().getTime()
      const MARGIN_BEFORE_KICKOFF_MS = 10 * 60 * 1000 // 10 minutes avant le coup d'envoi
      const MARGIN_AFTER_KICKOFF_MS = 3 * 60 * 60 * 1000 // 3 heures après (temps réglementaire + prolongations)

      matches.forEach(match => {
        const kickoffTime = new Date(match.utc_date).getTime()
        const timeSinceKickoff = nowTime - kickoffTime

        // Inclure le match si :
        // 1. Il est IN_PLAY ou PAUSED (toujours prioritaire)
        // 2. Il est TIMED ET commence dans moins de 10 minutes
        // 3. Il est TIMED mais le kick-off est passé (peut être mal synchronisé côté API)
        const shouldUpdate =
          match.status === 'IN_PLAY' ||
          match.status === 'PAUSED' ||
          (match.status === 'TIMED' && timeSinceKickoff >= -MARGIN_BEFORE_KICKOFF_MS && timeSinceKickoff <= MARGIN_AFTER_KICKOFF_MS)

        if (shouldUpdate) {
          allMatchIds.add(match.football_data_match_id)
          const minutesUntilKickoff = Math.round((kickoffTime - nowTime) / 60000)
          console.log(`  ✓ ${match.home_team_name} vs ${match.away_team_name} (${match.status}${match.status === 'TIMED' ? `, dans ${minutesUntilKickoff} min` : ''})`)
        } else {
          const minutesUntilKickoff = Math.round((kickoffTime - nowTime) / 60000)
          console.log(`  ⊘ ${match.home_team_name} vs ${match.away_team_name} (${match.status}, dans ${minutesUntilKickoff} min - trop tôt)`)
        }
      })
    }
  }

  console.log(`[REALTIME-UPDATE] Total: ${allMatchIds.size} matches to update`)
  return Array.from(allMatchIds)
}

/**
 * Fonction exportée pour exécuter la mise à jour temps réel ciblée
 * Met à jour uniquement les matchs dans les fenêtres actives
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

  // Récupérer les IDs des matchs dans les fenêtres actives
  const matchIds = await getActiveMatchIds()

  if (matchIds.length === 0) {
    return {
      success: true,
      message: 'No active matches to update (no match windows)',
      successCount: 0,
      totalMatches: 0,
      results: []
    }
  }

  const supabase = await createClient()
  const results = []

  // Délai minimal entre les appels (API rate limit: 10 calls/min = 6s entre chaque)
  const MIN_DELAY_BETWEEN_CALLS_MS = 6000

  // Récupérer les infos de tous les matchs pour optimiser les délais et éviter les appels redondants
  const { data: matchesInfo } = await supabase
    .from('imported_matches')
    .select('football_data_match_id, status, last_updated_at, home_score, away_score')
    .in('football_data_match_id', matchIds)

  const matchInfoMap = new Map(matchesInfo?.map(m => [m.football_data_match_id, m]) || [])

  // Filtrer les matchs à vraiment mettre à jour
  const matchIdsToUpdate = matchIds.filter(matchId => {
    const info = matchInfoMap.get(matchId)
    if (!info) return true // Match inconnu, on le met à jour

    // Si le match est en cours, toujours le mettre à jour
    if (info.status === 'IN_PLAY' || info.status === 'PAUSED') {
      return true
    }

    // Si le match est TIMED, vérifier quand il a été mis à jour pour la dernière fois
    if (info.status === 'TIMED' && info.last_updated_at) {
      const lastUpdateTime = new Date(info.last_updated_at).getTime()
      const now = Date.now()
      const minutesSinceUpdate = (now - lastUpdateTime) / 60000

      // Si mis à jour il y a moins de 3 minutes, on saute
      if (minutesSinceUpdate < 3) {
        console.log(`[REALTIME-UPDATE] Skipping match ${matchId} (TIMED, updated ${Math.round(minutesSinceUpdate)}m ago)`)
        return false
      }
    }

    return true
  })

  console.log(`[REALTIME-UPDATE] ${matchIdsToUpdate.length}/${matchIds.length} matches need update (${matchIds.length - matchIdsToUpdate.length} skipped)`)

  if (matchIdsToUpdate.length === 0) {
    return {
      success: true,
      message: 'No matches need update (all recently updated)',
      successCount: 0,
      totalMatches: 0,
      results: []
    }
  }

  // Mettre à jour chaque match individuellement via /matches/{id}
  for (let i = 0; i < matchIdsToUpdate.length; i++) {
    const matchId = matchIdsToUpdate[i]
    const currentInfo = matchInfoMap.get(matchId)

    // Attendre entre les appels (sauf pour le premier)
    if (i > 0) {
      // Délai adaptatif : 3s pour les matchs en cours (prioritaires), 6s pour les autres
      const delay = currentInfo?.status === 'IN_PLAY' || currentInfo?.status === 'PAUSED'
        ? Math.max(MIN_DELAY_BETWEEN_CALLS_MS / 2, 3000)
        : MIN_DELAY_BETWEEN_CALLS_MS

      console.log(`[REALTIME-UPDATE] Waiting ${delay/1000}s before next match...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }

    try {
      const startTime = Date.now()
      const response = await fetch(
        `${FOOTBALL_DATA_API}/matches/${matchId}`,
        {
          headers: { 'X-Auth-Token': apiKey },
        }
      )
      const responseTime = Date.now() - startTime

      // Logger l'appel API (utiliser l'ID de la compétition si disponible)
      const competitionId = null // On ne l'a pas encore à ce stade
      await logApiCall('realtime', competitionId, response.ok, responseTime)

      if (!response.ok) {
        console.error(`Failed to fetch match ${matchId}: ${response.statusText}`)
        results.push({
          matchId,
          success: false,
          error: `API error: ${response.statusText}`
        })
        continue
      }

      const matchData = await response.json()

      // Préparer les données de mise à jour
      const updateData = {
        status: matchData.status,
        finished: matchData.status === 'FINISHED',
        home_score: matchData.score?.fullTime?.home ?? null,
        away_score: matchData.score?.fullTime?.away ?? null,
        last_updated_at: new Date().toISOString(),
      }

      // Mettre à jour le match dans imported_matches
      const { error: updateError } = await supabase
        .from('imported_matches')
        .update(updateData)
        .eq('football_data_match_id', matchId)

      if (updateError) {
        console.error(`Error updating match ${matchId}:`, updateError)
        results.push({
          matchId,
          success: false,
          error: updateError.message
        })
        continue
      }

      results.push({
        matchId,
        success: true,
        status: matchData.status,
        score: `${matchData.score?.fullTime?.home ?? '-'} - ${matchData.score?.fullTime?.away ?? '-'}`
      })

    } catch (error: any) {
      console.error(`Error processing match ${matchId}:`, error)
      results.push({
        matchId,
        success: false,
        error: error.message
      })
    }
  }

  const successCount = results.filter(r => r.success).length
  const failureCount = results.filter(r => !r.success).length

  return {
    success: true,
    message: `Realtime update completed: ${successCount} successful, ${failureCount} failed`,
    totalMatches: matchIds.length,
    successCount,
    failureCount,
    results
  }
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
