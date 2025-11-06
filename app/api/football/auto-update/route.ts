import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const FOOTBALL_DATA_API = 'https://api.football-data.org/v4'

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

    return NextResponse.json({
      success: true,
      message: `Auto-update completed: ${successCount} successful, ${failureCount} failed`,
      totalCompetitions: activeCompetitions.length,
      successCount,
      failureCount,
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
