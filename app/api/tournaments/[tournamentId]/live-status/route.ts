import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  try {
    const supabase = await createClient()
    const { tournamentId } = await params

    // Récupérer le tournoi
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('competition_id, custom_competition_id, starting_matchday, ending_matchday')
      .eq('id', tournamentId)
      .single()

    if (tournamentError || !tournament) {
      return NextResponse.json({ hasLiveMatch: false })
    }

    let hasLiveMatch = false

    // Compétition custom
    if (tournament.custom_competition_id) {
      // Récupérer les journées du tournoi
      const { data: matchdays } = await supabase
        .from('custom_competition_matchdays')
        .select('id')
        .eq('custom_competition_id', tournament.custom_competition_id)
        .gte('matchday_number', tournament.starting_matchday)
        .lte('matchday_number', tournament.ending_matchday)

      if (matchdays && matchdays.length > 0) {
        const matchdayIds = matchdays.map(md => md.id)

        // Récupérer les IDs football-data des matchs
        const { data: customMatches } = await supabase
          .from('custom_competition_matches')
          .select('football_data_match_id')
          .in('custom_matchday_id', matchdayIds)
          .not('football_data_match_id', 'is', null)

        if (customMatches && customMatches.length > 0) {
          const footballDataIds = customMatches.map(m => m.football_data_match_id)

          // Vérifier si au moins un match est IN_PLAY ou PAUSED
          const { data: liveMatches } = await supabase
            .from('imported_matches')
            .select('id')
            .in('football_data_match_id', footballDataIds)
            .in('status', ['IN_PLAY', 'PAUSED'])
            .limit(1)

          hasLiveMatch = (liveMatches && liveMatches.length > 0)
        }
      }
    }
    // Compétition standard
    else if (tournament.competition_id) {
      // Vérifier directement les matchs de la compétition
      const { data: liveMatches } = await supabase
        .from('imported_matches')
        .select('id')
        .eq('competition_id', tournament.competition_id)
        .gte('matchday', tournament.starting_matchday)
        .lte('matchday', tournament.ending_matchday)
        .in('status', ['IN_PLAY', 'PAUSED'])
        .limit(1)

      hasLiveMatch = (liveMatches && liveMatches.length > 0)
    }

    return NextResponse.json({ hasLiveMatch })

  } catch (error: any) {
    console.error('Erreur vérification matchs LIVE:', error)
    return NextResponse.json({ hasLiveMatch: false })
  }
}
