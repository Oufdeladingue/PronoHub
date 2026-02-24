import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const ids = request.nextUrl.searchParams.get('ids')
    if (!ids) {
      return NextResponse.json({ liveMap: {} })
    }

    const tournamentIds = ids.split(',').filter(Boolean)
    if (tournamentIds.length === 0) {
      return NextResponse.json({ liveMap: {} })
    }

    const supabase = await createClient()

    // 1. Récupérer tous les tournois en un batch
    const { data: tournaments } = await supabase
      .from('tournaments')
      .select('id, competition_id, custom_competition_id, starting_matchday, ending_matchday')
      .in('id', tournamentIds)

    if (!tournaments || tournaments.length === 0) {
      return NextResponse.json({ liveMap: {} })
    }

    const liveMap: Record<string, boolean> = {}
    for (const id of tournamentIds) {
      liveMap[id] = false
    }

    // Séparer les tournois standards des custom
    const standardTournaments = tournaments.filter(t => t.competition_id && !t.custom_competition_id)
    const customTournaments = tournaments.filter(t => t.custom_competition_id)

    // 2. Check standard tournaments - une seule requête pour tous les matchs LIVE
    if (standardTournaments.length > 0) {
      const competitionIds = [...new Set(standardTournaments.map(t => t.competition_id).filter(Boolean))]
      const KNOCKOUT_STAGES = ['PLAYOFFS', 'LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'FINAL']

      const { data: liveMatches } = await supabase
        .from('imported_matches')
        .select('competition_id, matchday, stage')
        .in('competition_id', competitionIds)
        .in('status', ['IN_PLAY', 'PAUSED'])

      if (liveMatches && liveMatches.length > 0) {
        for (const t of standardTournaments) {
          const hasLive = liveMatches.some(
            m => m.competition_id === t.competition_id && (
              // Phase éliminatoire : toujours inclure (matchday 1-2 se répète par stage)
              (m.stage && KNOCKOUT_STAGES.includes(m.stage)) ||
              // Phase de ligue/groupe : filtrer par range de matchday
              (m.matchday >= (t.starting_matchday || 1) &&
               m.matchday <= (t.ending_matchday || 99))
            )
          )
          if (hasLive) liveMap[t.id] = true
        }
      }
    }

    // 3. Check custom tournaments
    if (customTournaments.length > 0) {
      const customCompIds = [...new Set(customTournaments.map(t => t.custom_competition_id).filter(Boolean))]

      // Récupérer les matchdays des compétitions custom
      const { data: matchdays } = await supabase
        .from('custom_competition_matchdays')
        .select('id, custom_competition_id, matchday_number')
        .in('custom_competition_id', customCompIds)

      if (matchdays && matchdays.length > 0) {
        // Filtrer par matchday range de chaque tournoi
        const relevantMatchdayIds: string[] = []
        const matchdayToTournament = new Map<string, string[]>()

        for (const t of customTournaments) {
          const tMatchdays = matchdays.filter(
            md => md.custom_competition_id === t.custom_competition_id &&
                  md.matchday_number >= (t.starting_matchday || 1) &&
                  md.matchday_number <= (t.ending_matchday || 999)
          )
          for (const md of tMatchdays) {
            relevantMatchdayIds.push(md.id)
            if (!matchdayToTournament.has(md.id)) matchdayToTournament.set(md.id, [])
            matchdayToTournament.get(md.id)!.push(t.id)
          }
        }

        if (relevantMatchdayIds.length > 0) {
          // Récupérer les football_data_match_id des matchs custom
          const { data: customMatches } = await supabase
            .from('custom_competition_matches')
            .select('custom_matchday_id, football_data_match_id')
            .in('custom_matchday_id', relevantMatchdayIds)
            .not('football_data_match_id', 'is', null)

          if (customMatches && customMatches.length > 0) {
            const footballDataIds = customMatches.map(m => m.football_data_match_id)

            const { data: liveImported } = await supabase
              .from('imported_matches')
              .select('football_data_match_id')
              .in('football_data_match_id', footballDataIds)
              .in('status', ['IN_PLAY', 'PAUSED'])

            if (liveImported && liveImported.length > 0) {
              const liveFootballIds = new Set(liveImported.map(m => m.football_data_match_id))
              for (const cm of customMatches) {
                if (liveFootballIds.has(cm.football_data_match_id)) {
                  const tournamentIdsForMd = matchdayToTournament.get(cm.custom_matchday_id) || []
                  for (const tid of tournamentIdsForMd) {
                    liveMap[tid] = true
                  }
                }
              }
            }
          }
        }
      }
    }

    return NextResponse.json({ liveMap })
  } catch (error: any) {
    console.error('Erreur batch live-status:', error)
    return NextResponse.json({ liveMap: {} })
  }
}
