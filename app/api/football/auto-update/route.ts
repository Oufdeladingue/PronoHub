import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { SupabaseClient } from '@supabase/supabase-js'
import { patchStaleScoresWithApiFootball, type FallbackResult } from '@/lib/api-football-fallback'

const FOOTBALL_DATA_API = 'https://api.football-data.org/v4'

// Type pour le résultat de la mise à jour
export interface AutoUpdateResult {
  success: boolean
  message: string
  totalCompetitions?: number
  successCount?: number
  failureCount?: number
  finishedTournaments?: { id: string; name: string }[]
  fallback?: FallbackResult
  results?: any[]
  error?: string
}

/**
 * Fonction exportée pour exécuter la mise à jour des compétitions
 * Peut être appelée directement depuis d'autres routes API
 */
// Fonction helper pour logger les appels API (utilise admin client pour bypass RLS)
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

export async function executeAutoUpdate(): Promise<AutoUpdateResult> {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY

  if (!apiKey) {
    return {
      success: false,
      message: 'Football Data API key not configured',
      error: 'Football Data API key not configured'
    }
  }

  const supabase = createAdminClient()

  // Récupérer uniquement les compétitions actives dont la saison n'est pas terminée
  const today = new Date().toISOString().split('T')[0] // Format YYYY-MM-DD
  const { data: activeCompetitions, error: fetchError } = await supabase
    .from('competitions')
    .select('id, name, code, current_season_end_date')
    .eq('is_active', true)
    .or(`current_season_end_date.is.null,current_season_end_date.gte.${today}`)

  if (fetchError) {
    console.error('Error fetching active competitions:', fetchError)
    return {
      success: false,
      message: 'Failed to fetch active competitions',
      error: fetchError.message
    }
  }

  if (!activeCompetitions || activeCompetitions.length === 0) {
    return {
      success: true,
      message: 'No active competitions to update',
      successCount: 0,
      results: []
    }
  }

  const results = []

  // Délai entre les compétitions (en ms) pour respecter le rate limit API (10 appels/min)
  // Chaque compétition = 2 appels (détails + matchs), donc 12s entre chaque = ~5 compétitions/min max
  const DELAY_BETWEEN_COMPETITIONS_MS = 12000

  // Mettre à jour chaque compétition active
  for (let i = 0; i < activeCompetitions.length; i++) {
    const competition = activeCompetitions[i]

    // Attendre entre les compétitions (sauf pour la première)
    if (i > 0) {
      console.log(`[AUTO-UPDATE] Waiting ${DELAY_BETWEEN_COMPETITIONS_MS/1000}s before next competition...`)
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_COMPETITIONS_MS))
    }

    try {
      // 1. Récupérer les détails de la compétition
      const compStartTime = Date.now()
      const compResponse = await fetch(
        `${FOOTBALL_DATA_API}/competitions/${competition.id}`,
        {
          headers: { 'X-Auth-Token': apiKey },
        }
      )
      const compResponseTime = Date.now() - compStartTime

      // Logger l'appel API (compétition)
      await logApiCall('manual', competition.id, compResponse.ok, compResponseTime)

      if (!compResponse.ok) {
        console.error(`Failed to fetch competition ${competition.code}: ${compResponse.statusText}`)
        results.push({
          competitionId: competition.id,
          name: competition.name,
          success: false,
          error: `API error: ${compResponse.statusText}`
        })
        continue
      }

      const compData = await compResponse.json()

      // 2. Mettre à jour la compétition
      const { error: compError } = await supabase.from('competitions').update({
        name: compData.name,
        emblem: compData.emblem,
        area_name: compData.area?.name,
        current_season_start_date: compData.currentSeason?.startDate,
        current_season_end_date: compData.currentSeason?.endDate,
        current_matchday: compData.currentSeason?.currentMatchday,
        last_updated_at: new Date().toISOString(),
      }).eq('id', competition.id)

      if (compError) {
        console.error(`Error updating competition ${competition.code}:`, compError)
        results.push({
          competitionId: competition.id,
          name: competition.name,
          success: false,
          error: compError.message
        })
        continue
      }

      // 3. Récupérer tous les matchs de la compétition
      const matchesStartTime = Date.now()
      const matchesResponse = await fetch(
        `${FOOTBALL_DATA_API}/competitions/${competition.id}/matches`,
        {
          headers: { 'X-Auth-Token': apiKey },
        }
      )
      const matchesResponseTime = Date.now() - matchesStartTime

      // Logger l'appel API (matchs)
      await logApiCall('manual', competition.id, matchesResponse.ok, matchesResponseTime)

      if (!matchesResponse.ok) {
        console.error(`Failed to fetch matches for ${competition.code}: ${matchesResponse.statusText}`)
        results.push({
          competitionId: competition.id,
          name: competition.name,
          success: false,
          error: `Failed to fetch matches: ${matchesResponse.statusText}`
        })
        continue
      }

      const matchesData = await matchesResponse.json()

      // 4. Calculer le nombre total de journées (paires stage+matchday uniques)
      // Pour les compétitions avec knockout (CL, World Cup), le matchday redémarre à 1 par stage
      // Pour les knockouts à match unique (WC), matchday est null → on utilise le stage comme clé
      const stageMatchdayPairs = new Set<string>()
      matchesData.matches.forEach((match: any) => {
        const key = `${match.stage || 'REGULAR_SEASON'}_${match.matchday ?? 'KO'}`
        stageMatchdayPairs.add(key)
      })
      const totalMatchdays = stageMatchdayPairs.size > 0 ? stageMatchdayPairs.size : null

      // 5. Mettre à jour le nombre total de journées dans la compétition
      if (totalMatchdays) {
        await supabase.from('competitions').update({
          total_matchdays: totalMatchdays
        }).eq('id', competition.id)
      }

      // 6. Mettre à jour les matchs (inclure les matchs TBD knockout avec placeholders)
      // Note: matchday peut être null pour les knockouts à match unique (WC)
      // IMPORTANT: Skip stale matches to prevent overwriting good scores from API-Football fallback
      // Un match est "stale" si sa date est > 3h dans le passé mais Football Data le montre encore TIMED/SCHEDULED
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000)
      const matchesToUpsert = matchesData.matches
        .filter((match: any) => {
          if (match.id == null) return false

          // Ne pas écraser avec des données stale: si le match devrait être terminé
          // (date > 3h passée) mais l'API retourne encore TIMED/SCHEDULED, on skip
          const matchDate = new Date(match.utcDate)
          const isStale = matchDate < threeHoursAgo &&
                          ['TIMED', 'SCHEDULED'].includes(match.status)

          if (isStale) {
            console.log(`[AUTO-UPDATE] Skipping stale match ${match.id}: ${match.homeTeam?.name} vs ${match.awayTeam?.name} (${match.status}, date: ${match.utcDate})`)
            return false
          }

          return true
        })
        .map((match: any) => ({
          football_data_match_id: match.id,
          competition_id: competition.id,
          matchday: match.matchday ?? 1, // Default to 1 for single-leg knockout (WC)
          stage: match.stage || null,
          utc_date: match.utcDate,
          status: match.status,
          finished: match.status === 'FINISHED', // Flag booléen pour marquer les matchs terminés
          home_team_id: match.homeTeam?.id || 0,
          home_team_name: match.homeTeam?.name || 'À déterminer',
          home_team_crest: match.homeTeam?.crest || null,
          away_team_id: match.awayTeam?.id || 0,
          away_team_name: match.awayTeam?.name || 'À déterminer',
          away_team_crest: match.awayTeam?.crest || null,
          home_score: match.score?.fullTime?.home,
          away_score: match.score?.fullTime?.away,
        }))

      const { error: matchesError } = await supabase
        .from('imported_matches')
        .upsert(matchesToUpsert, {
          onConflict: 'football_data_match_id',
        })

      if (matchesError) {
        console.error(`Error updating matches for ${competition.code}:`, matchesError)
        results.push({
          competitionId: competition.id,
          name: competition.name,
          success: false,
          error: `Failed to update matches: ${matchesError.message}`
        })
        continue
      }

      results.push({
        competitionId: competition.id,
        name: competition.name,
        code: competition.code,
        success: true,
        matchesCount: matchesToUpsert.length
      })

    } catch (error: any) {
      console.error(`Error processing competition ${competition.code}:`, error)
      results.push({
        competitionId: competition.id,
        name: competition.name,
        success: false,
        error: error.message
      })
    }
  }

  const successCount = results.filter(r => r.success).length
  const failureCount = results.filter(r => !r.success).length

  // Vérifier et terminer les tournois dont toutes les journées sont complétées
  const competitionIds = activeCompetitions.map(c => c.id)
  const finishedTournaments = await checkAndFinishTournaments(supabase, competitionIds)

  // API-Football fallback: patcher les scores stale (avec cooldown automatique)
  let fallbackResult: FallbackResult | undefined
  try {
    fallbackResult = await patchStaleScoresWithApiFootball()
    if (fallbackResult.patched > 0) {
      console.log(`[AUTO-UPDATE] API-Football fallback: ${fallbackResult.patched} match(es) patched`)
    } else if (fallbackResult.skipped) {
      console.log(`[AUTO-UPDATE] API-Football fallback skipped: ${fallbackResult.skipReason}`)
    }
  } catch (fallbackError: any) {
    console.error('[AUTO-UPDATE] API-Football fallback error:', fallbackError.message)
  }

  return {
    success: true,
    message: `Auto-update completed: ${successCount} successful, ${failureCount} failed`,
    totalCompetitions: activeCompetitions.length,
    successCount,
    failureCount,
    finishedTournaments: finishedTournaments.length > 0 ? finishedTournaments : undefined,
    fallback: fallbackResult,
    results
  }
}

/**
 * Vérifie si les tournois actifs sont terminés et les passe en statut "completed"
 * Un tournoi est terminé quand:
 * - Sa date de fin (ending_date) est passée
 * - ET la saison de la compétition est terminée (pour éviter les faux positifs sur les compétitions avec knockout)
 * Cette approche gère tous les cas: tournois standard, custom, knockout, et extensions
 */
async function checkAndFinishTournaments(
  supabase: SupabaseClient,
  _competitionIds: number[] // Gardé pour compatibilité mais plus utilisé
): Promise<{ id: string; name: string }[]> {
  const finishedTournaments: { id: string; name: string }[] = []

  try {
    const now = new Date().toISOString()
    const today = new Date().toISOString().split('T')[0] // Format YYYY-MM-DD pour comparaison de dates

    // Récupérer tous les tournois actifs dont la date de fin est passée
    // avec les infos de la compétition pour vérifier la fin de saison
    const { data: tournamentsToCheck, error: tournamentsError } = await supabase
      .from('tournaments')
      .select(`
        id, name, ending_date, competition_id, custom_competition_id, all_matchdays,
        competitions(current_season_end_date)
      `)
      .eq('status', 'active')
      .not('ending_date', 'is', null)
      .lt('ending_date', now)

    if (tournamentsError || !tournamentsToCheck || tournamentsToCheck.length === 0) {
      return finishedTournaments
    }

    console.log(`[AUTO-UPDATE] Found ${tournamentsToCheck.length} tournament(s) to check for completion`)

    // Filtrer et passer en completed uniquement les tournois éligibles
    for (const tournament of tournamentsToCheck) {
      // Pour les tournois custom, on fait confiance à ending_date
      if (tournament.custom_competition_id) {
        const { error: updateError } = await supabase
          .from('tournaments')
          .update({ status: 'completed', updated_at: new Date().toISOString() })
          .eq('id', tournament.id)

        if (!updateError) {
          console.log(`[AUTO-UPDATE] Custom tournament "${tournament.name}" marked as completed`)
          finishedTournaments.push({ id: tournament.id, name: tournament.name })
        }
        continue
      }

      // Pour les tournois avec nombre de journées limité (all_matchdays = false),
      // on fait confiance à ending_date car le créateur a choisi une durée spécifique
      if (!tournament.all_matchdays) {
        const { error: updateError } = await supabase
          .from('tournaments')
          .update({ status: 'completed', updated_at: new Date().toISOString() })
          .eq('id', tournament.id)

        if (!updateError) {
          console.log(`[AUTO-UPDATE] Limited tournament "${tournament.name}" marked as completed - ending_date: ${tournament.ending_date}`)
          finishedTournaments.push({ id: tournament.id, name: tournament.name })
        }
        continue
      }

      // Pour les tournois "toutes les journées" (all_matchdays = true),
      // vérifier aussi que la saison est terminée (protège contre les compétitions avec knockout)
      const competitionData = tournament.competitions as unknown as { current_season_end_date: string | null } | null
      const seasonEndDate = competitionData?.current_season_end_date

      if (seasonEndDate && seasonEndDate > today) {
        console.log(`[AUTO-UPDATE] Full-season tournament "${tournament.name}" has ending_date passed but season ends ${seasonEndDate} - skipping`)
        continue
      }

      // La saison est terminée, on peut terminer le tournoi
      const { error: updateError } = await supabase
        .from('tournaments')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', tournament.id)

      if (!updateError) {
        console.log(`[AUTO-UPDATE] Full-season tournament "${tournament.name}" marked as completed - season_end: ${seasonEndDate || 'unknown'}`)
        finishedTournaments.push({ id: tournament.id, name: tournament.name })
      } else {
        console.error(`[AUTO-UPDATE] Failed to finish tournament ${tournament.id}:`, updateError)
      }
    }
  } catch (error) {
    console.error('[AUTO-UPDATE] Error checking tournaments to finish:', error)
  }

  return finishedTournaments
}

export async function POST() {
  const startTime = Date.now()

  try {
    const result = await executeAutoUpdate()
    const executionTimeMs = Date.now() - startTime

    // Logger le résultat dans cron_logs (utilise admin client pour bypass RLS)
    try {
      const adminClient = createAdminClient()
      await adminClient.from('cron_logs').insert({
        job_name: 'daily-sync',
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
    console.error('Error in auto-update:', error)
    const executionTimeMs = Date.now() - startTime

    // Logger l'erreur dans cron_logs (utilise admin client pour bypass RLS)
    try {
      const adminClient = createAdminClient()
      await adminClient.from('cron_logs').insert({
        job_name: 'daily-sync',
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
