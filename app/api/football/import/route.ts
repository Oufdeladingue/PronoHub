import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const FOOTBALL_DATA_API = 'https://api.football-data.org/v4'

export async function POST(request: Request) {
  try {
    const { competitionId } = await request.json()

    if (!competitionId) {
      return NextResponse.json(
        { error: 'Competition ID is required' },
        { status: 400 }
      )
    }

    const apiKey = process.env.FOOTBALL_DATA_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Football Data API key not configured' },
        { status: 500 }
      )
    }

    const supabase = await createClient()

    // 1. Récupérer les détails de la compétition
    const compResponse = await fetch(
      `${FOOTBALL_DATA_API}/competitions/${competitionId}`,
      {
        headers: { 'X-Auth-Token': apiKey },
      }
    )

    if (!compResponse.ok) {
      throw new Error(`Failed to fetch competition: ${compResponse.statusText}`)
    }

    const compData = await compResponse.json()

    // 2. Sauvegarder la compétition
    const { error: compError } = await supabase.from('competitions').upsert({
      id: compData.id,
      name: compData.name,
      code: compData.code,
      emblem: compData.emblem,
      area_name: compData.area?.name,
      current_season_start_date: compData.currentSeason?.startDate,
      current_season_end_date: compData.currentSeason?.endDate,
      current_matchday: compData.currentSeason?.currentMatchday,
    })

    if (compError) throw compError

    // 3. Récupérer tous les matchs de la compétition
    const matchesResponse = await fetch(
      `${FOOTBALL_DATA_API}/competitions/${competitionId}/matches`,
      {
        headers: { 'X-Auth-Token': apiKey },
      }
    )

    if (!matchesResponse.ok) {
      throw new Error(`Failed to fetch matches: ${matchesResponse.statusText}`)
    }

    const matchesData = await matchesResponse.json()

    // 4. Préparer les matchs pour l'insertion
    const matchesToInsert = matchesData.matches.map((match: any) => ({
      football_data_match_id: match.id,
      competition_id: competitionId,
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

    // 5. Insérer ou mettre à jour les matchs
    const { error: matchesError } = await supabase
      .from('imported_matches')
      .upsert(matchesToInsert, {
        onConflict: 'football_data_match_id',
      })

    if (matchesError) throw matchesError

    return NextResponse.json({
      success: true,
      competition: compData.name,
      matchesCount: matchesToInsert.length,
    })
  } catch (error: any) {
    console.error('Error importing competition:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
