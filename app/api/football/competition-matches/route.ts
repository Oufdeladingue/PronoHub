import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const competitionId = searchParams.get('competitionId')

    if (!competitionId) {
      return NextResponse.json(
        { error: 'Competition ID is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Récupérer les infos de la compétition
    const { data: competition, error: compError } = await supabase
      .from('competitions')
      .select('*')
      .eq('id', parseInt(competitionId))
      .single()

    if (compError || !competition) {
      return NextResponse.json(
        { error: 'Competition not found' },
        { status: 404 }
      )
    }

    // Récupérer tous les matchs de cette compétition
    const { data: matches, error: matchesError } = await supabase
      .from('imported_matches')
      .select('*')
      .eq('competition_id', parseInt(competitionId))
      .order('matchday', { ascending: true })
      .order('utc_date', { ascending: true })

    if (matchesError) {
      console.error('Error fetching matches:', matchesError)
      return NextResponse.json(
        { error: 'Failed to fetch matches' },
        { status: 500 }
      )
    }

    // Grouper les matchs par journée
    const matchesByMatchday = matches?.reduce((acc: any, match: any) => {
      if (!acc[match.matchday]) {
        acc[match.matchday] = []
      }
      acc[match.matchday].push(match)
      return acc
    }, {}) || {}

    // Extraire le stage pour chaque journée
    const stagesByMatchday: Record<number, string | null> = {}
    matches?.forEach((match: any) => {
      if (match.matchday && !stagesByMatchday[match.matchday]) {
        stagesByMatchday[match.matchday] = match.stage || null
      }
    })

    // Grouper les journées par stage pour une meilleure navigation
    const matchdaysByStage: Record<string, number[]> = {}
    Object.entries(stagesByMatchday).forEach(([matchday, stage]) => {
      const stageKey = stage || 'REGULAR_SEASON'
      if (!matchdaysByStage[stageKey]) {
        matchdaysByStage[stageKey] = []
      }
      matchdaysByStage[stageKey].push(parseInt(matchday))
    })

    return NextResponse.json({
      competition,
      matches: matches || [],
      matchesByMatchday,
      totalMatches: matches?.length || 0,
      matchdays: Object.keys(matchesByMatchday).map(Number).sort((a, b) => a - b),
      stagesByMatchday,
      matchdaysByStage
    })
  } catch (error: any) {
    console.error('Error in competition-matches route:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
