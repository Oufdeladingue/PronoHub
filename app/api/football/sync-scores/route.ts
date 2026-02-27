import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { SupabaseClient } from '@supabase/supabase-js'

const FOOTBALL_DATA_API = 'https://api.football-data.org/v4'

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

    console.log(`[SYNC] Found ${tournamentsToCheck.length} tournament(s) to check for completion`)

    // Filtrer et passer en completed uniquement les tournois éligibles
    for (const tournament of tournamentsToCheck) {
      // Pour les tournois custom, on fait confiance à ending_date
      if (tournament.custom_competition_id) {
        const { error: updateError } = await supabase
          .from('tournaments')
          .update({ status: 'completed', updated_at: new Date().toISOString() })
          .eq('id', tournament.id)

        if (!updateError) {
          console.log(`[SYNC] Custom tournament "${tournament.name}" marked as completed`)
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
          console.log(`[SYNC] Limited tournament "${tournament.name}" marked as completed - ending_date: ${tournament.ending_date}`)
          finishedTournaments.push({ id: tournament.id, name: tournament.name })
        }
        continue
      }

      // Pour les tournois "toutes les journées" (all_matchdays = true),
      // vérifier aussi que la saison est terminée (protège contre les compétitions avec knockout)
      const competitionData = tournament.competitions as unknown as { current_season_end_date: string | null } | null
      const seasonEndDate = competitionData?.current_season_end_date

      if (seasonEndDate && seasonEndDate > today) {
        console.log(`[SYNC] Full-season tournament "${tournament.name}" has ending_date passed but season ends ${seasonEndDate} - skipping`)
        continue
      }

      // La saison est terminée, on peut terminer le tournoi
      const { error: updateError } = await supabase
        .from('tournaments')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', tournament.id)

      if (!updateError) {
        console.log(`[SYNC] Full-season tournament "${tournament.name}" marked as completed - season_end: ${seasonEndDate || 'unknown'}`)
        finishedTournaments.push({ id: tournament.id, name: tournament.name })
      } else {
        console.error(`[SYNC] Failed to finish tournament ${tournament.id}:`, updateError)
      }
    }
  } catch (error) {
    console.error('[SYNC] Error checking tournaments to finish:', error)
  }

  return finishedTournaments
}

/**
 * API pour synchroniser les scores des matchs en cours et terminés
 *
 * Usage:
 * - GET /api/football/sync-scores - Synchronise tous les matchs en cours
 * - GET /api/football/sync-scores?competitionId=2013 - Synchronise une compétition spécifique
 * - GET /api/football/sync-scores?matchday=33 - Synchronise une journée spécifique
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const competitionId = searchParams.get('competitionId')
    const matchday = searchParams.get('matchday')

    const apiKey = process.env.FOOTBALL_DATA_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Football Data API key not configured' },
        { status: 500 }
      )
    }

    const supabase = createAdminClient()

    // 1. Récupérer les compétitions à synchroniser
    let competitionsToSync: number[] = []

    if (competitionId) {
      // Une seule compétition spécifiée
      competitionsToSync = [parseInt(competitionId)]
    } else {
      // Récupérer toutes les compétitions actives
      const { data: activeComps } = await supabase
        .from('competitions')
        .select('id')
        .eq('is_active', true)

      competitionsToSync = activeComps?.map(c => c.id) || []
    }

    if (competitionsToSync.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active competitions to sync',
        updatedMatches: 0
      })
    }

    let totalUpdated = 0
    let totalErrors = 0
    const errors: any[] = []

    // 2. Pour chaque compétition, synchroniser les matchs
    for (const compId of competitionsToSync) {
      try {
        console.log(`[SYNC] Synchronizing competition ${compId}...`)

        // Récupérer les matchs depuis l'API
        const matchesResponse = await fetch(
          `${FOOTBALL_DATA_API}/competitions/${compId}/matches`,
          {
            headers: { 'X-Auth-Token': apiKey },
          }
        )

        if (!matchesResponse.ok) {
          throw new Error(`Failed to fetch matches for competition ${compId}: ${matchesResponse.statusText}`)
        }

        const matchesData = await matchesResponse.json()

        // Filtrer les matchs à synchroniser
        // - Matchs EN_PLAY (en cours)
        // - Matchs FINISHED (terminés)
        // - Matchs PAUSED (mi-temps)
        // - Si matchday spécifié, filtrer par journée
        const matchesToSync = matchesData.matches.filter((match: any) => {
          const isRelevantStatus = ['IN_PLAY', 'PAUSED', 'FINISHED'].includes(match.status)
          const matchesMatchday = matchday ? match.matchday === parseInt(matchday) : true
          const hasTeams = match.homeTeam?.id && match.awayTeam?.id

          return isRelevantStatus && matchesMatchday && hasTeams
        })

        console.log(`[SYNC] Found ${matchesToSync.length} matches to sync for competition ${compId}`)

        // 3. Mettre à jour chaque match
        for (const match of matchesToSync) {
          const updateData: any = {
            status: match.status,
            home_score: match.score?.fullTime?.home,
            away_score: match.score?.fullTime?.away,
            finished: match.status === 'FINISHED'
          }

          // Scores détaillés pour les matchs terminés (support knockout)
          if (match.status === 'FINISHED') {
            if (match.score?.duration && match.score.duration !== 'REGULAR') {
              // Match allé en prolongation ou TAB : score 90min = regularTime
              updateData.home_score_90 = match.score?.regularTime?.home ?? match.score?.fullTime?.home
              updateData.away_score_90 = match.score?.regularTime?.away ?? match.score?.fullTime?.away
              // Buts en prolongation
              if (match.score?.extraTime) {
                updateData.home_score_extra = match.score.extraTime.home
                updateData.away_score_extra = match.score.extraTime.away
              }
              // Tirs au but
              if (match.score?.penalties) {
                updateData.home_score_penalty = match.score.penalties.home
                updateData.away_score_penalty = match.score.penalties.away
              }
            } else {
              // Match terminé en 90min : score 90min = score final
              updateData.home_score_90 = match.score?.fullTime?.home
              updateData.away_score_90 = match.score?.fullTime?.away
            }

            // Équipe qualifiée (football-data.org renvoie "HOME_TEAM" ou "AWAY_TEAM")
            if (match.score?.winner && match.score.winner !== 'DRAW') {
              updateData.winner_team_id = match.score.winner === 'HOME_TEAM'
                ? match.homeTeam?.id
                : match.awayTeam?.id
            }
          }

          const { error } = await supabase
            .from('imported_matches')
            .update(updateData)
            .eq('football_data_match_id', match.id)

          if (error) {
            console.error(`[SYNC] Error updating match ${match.id}:`, error)
            totalErrors++
            errors.push({
              matchId: match.id,
              error: error.message
            })
          } else {
            totalUpdated++
            console.log(`[SYNC] Updated match ${match.id}: ${match.homeTeam.name} ${match.score?.fullTime?.home ?? '-'} - ${match.score?.fullTime?.away ?? '-'} ${match.awayTeam.name}${match.score?.duration && match.score.duration !== 'REGULAR' ? ` (${match.score.duration})` : ''}`)
          }
        }

      } catch (compError: any) {
        console.error(`[SYNC] Error syncing competition ${compId}:`, compError)
        totalErrors++
        errors.push({
          competitionId: compId,
          error: compError.message
        })
      }
    }

    // 4. Vérifier et mettre à jour les tournois terminés
    const finishedTournaments = await checkAndFinishTournaments(supabase, competitionsToSync)

    // 5. Retourner le résultat
    return NextResponse.json({
      success: true,
      message: `Synchronized ${totalUpdated} match(es)`,
      updatedMatches: totalUpdated,
      finishedTournaments: finishedTournaments.length > 0 ? finishedTournaments : undefined,
      errors: totalErrors > 0 ? errors : undefined,
      competitionsSync: competitionsToSync.length
    })

  } catch (error: any) {
    console.error('[SYNC] Error in sync-scores:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
