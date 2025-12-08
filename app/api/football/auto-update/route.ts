import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SupabaseClient } from '@supabase/supabase-js'

const FOOTBALL_DATA_API = 'https://api.football-data.org/v4'

/**
 * Vérifie si les tournois actifs sont terminés et les passe en statut "completed"
 * Un tournoi est terminé quand TOUS les matchs de TOUTES ses journées sont FINISHED
 * (gère le cas des matchs décalés sur des journées antérieures)
 */
async function checkAndFinishTournaments(
  supabase: SupabaseClient,
  competitionIds: number[]
): Promise<{ id: string; name: string }[]> {
  const finishedTournaments: { id: string; name: string }[] = []

  try {
    // Récupérer les tournois actifs pour ces compétitions
    const { data: activeTournaments, error: tournamentsError } = await supabase
      .from('tournaments')
      .select('id, name, competition_id, starting_matchday, ending_matchday')
      .eq('status', 'active')
      .in('competition_id', competitionIds)

    if (tournamentsError || !activeTournaments || activeTournaments.length === 0) {
      return finishedTournaments
    }

    // Pour chaque tournoi actif, vérifier si TOUTES les journées sont terminées
    for (const tournament of activeTournaments) {
      if (!tournament.starting_matchday || !tournament.ending_matchday) continue

      // Récupérer TOUS les matchs du tournoi (de starting_matchday à ending_matchday)
      const { data: allTournamentMatches, error: matchesError } = await supabase
        .from('imported_matches')
        .select('id, matchday, status, finished')
        .eq('competition_id', tournament.competition_id)
        .gte('matchday', tournament.starting_matchday)
        .lte('matchday', tournament.ending_matchday)

      if (matchesError || !allTournamentMatches || allTournamentMatches.length === 0) {
        continue
      }

      // Vérifier si TOUS les matchs de TOUTES les journées sont terminés
      const allMatchesFinished = allTournamentMatches.every(
        match => match.status === 'FINISHED' || match.finished === true
      )

      if (allMatchesFinished) {
        // Passer le tournoi en statut "completed"
        const { error: updateError } = await supabase
          .from('tournaments')
          .update({
            status: 'completed',
            updated_at: new Date().toISOString()
          })
          .eq('id', tournament.id)

        if (!updateError) {
          console.log(`[AUTO-UPDATE] Tournament "${tournament.name}" (${tournament.id}) marked as completed - all ${allTournamentMatches.length} matches finished`)
          finishedTournaments.push({ id: tournament.id, name: tournament.name })
        } else {
          console.error(`[AUTO-UPDATE] Failed to finish tournament ${tournament.id}:`, updateError)
        }
      }
    }
  } catch (error) {
    console.error('[AUTO-UPDATE] Error checking tournaments to finish:', error)
  }

  return finishedTournaments
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.FOOTBALL_DATA_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Football Data API key not configured' },
        { status: 500 }
      )
    }

    const supabase = await createClient()

    // Récupérer uniquement les compétitions actives
    const { data: activeCompetitions, error: fetchError } = await supabase
      .from('competitions')
      .select('id, name, code')
      .eq('is_active', true)

    if (fetchError) {
      console.error('Error fetching active competitions:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch active competitions' },
        { status: 500 }
      )
    }

    if (!activeCompetitions || activeCompetitions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active competitions to update',
        updated: []
      })
    }

    const results = []

    // Mettre à jour chaque compétition active
    for (const competition of activeCompetitions) {
      try {
        // 1. Récupérer les détails de la compétition
        const compResponse = await fetch(
          `${FOOTBALL_DATA_API}/competitions/${competition.id}`,
          {
            headers: { 'X-Auth-Token': apiKey },
          }
        )

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
        const matchesResponse = await fetch(
          `${FOOTBALL_DATA_API}/competitions/${competition.id}/matches`,
          {
            headers: { 'X-Auth-Token': apiKey },
          }
        )

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

        // 4. Calculer le nombre total de journées
        const matchdays = matchesData.matches.map((match: any) => match.matchday).filter((md: any) => md != null)
        const totalMatchdays = matchdays.length > 0 ? Math.max(...matchdays) : null

        // 5. Mettre à jour le nombre total de journées dans la compétition
        if (totalMatchdays) {
          await supabase.from('competitions').update({
            total_matchdays: totalMatchdays
          }).eq('id', competition.id)
        }

        // 6. Mettre à jour les matchs
        const matchesToUpsert = matchesData.matches.map((match: any) => ({
          football_data_match_id: match.id,
          competition_id: competition.id,
          matchday: match.matchday,
          utc_date: match.utcDate,
          status: match.status,
          home_team_id: match.homeTeam.id,
          home_team_name: match.homeTeam.name,
          home_team_crest: match.homeTeam.crest,
          away_team_id: match.awayTeam.id,
          away_team_name: match.awayTeam.name,
          away_team_crest: match.awayTeam.crest,
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

    return NextResponse.json({
      success: true,
      message: `Auto-update completed: ${successCount} successful, ${failureCount} failed`,
      totalCompetitions: activeCompetitions.length,
      successCount,
      failureCount,
      finishedTournaments: finishedTournaments.length > 0 ? finishedTournaments : undefined,
      results
    })

  } catch (error: any) {
    console.error('Error in auto-update:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
