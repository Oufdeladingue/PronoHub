import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

const FOOTBALL_DATA_API = 'https://api.football-data.org/v4'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const checkDb = searchParams.get('db') === 'true'

  // Si on veut vérifier la BDD
  if (checkDb) {
    const supabase = createAdminClient()
    const tournamentSlug = searchParams.get('tournament')

    // Infos sur la compétition CL
    const { data: competition } = await supabase
      .from('competitions')
      .select('id, name, is_active, current_matchday, total_matchdays, current_season_end_date, last_updated_at')
      .eq('id', 2001)
      .single()

    // Nombre de matchs par stage avec leurs matchdays
    const { data: matchesByStage } = await supabase
      .from('imported_matches')
      .select('stage, matchday')
      .eq('competition_id', 2001)

    const stageCount: Record<string, { count: number; matchdays: number[] }> = {}
    matchesByStage?.forEach((m: any) => {
      const stage = m.stage || 'NULL'
      if (!stageCount[stage]) {
        stageCount[stage] = { count: 0, matchdays: [] }
      }
      stageCount[stage].count++
      if (m.matchday && !stageCount[stage].matchdays.includes(m.matchday)) {
        stageCount[stage].matchdays.push(m.matchday)
      }
    })

    // Total matchs
    const { count: totalMatches } = await supabase
      .from('imported_matches')
      .select('*', { count: 'exact', head: true })
      .eq('competition_id', 2001)

    // Si un tournoi spécifique est demandé, vérifier sa config
    let tournamentInfo = null
    if (tournamentSlug) {
      const { data: tournament } = await supabase
        .from('tournaments')
        .select('id, name, slug, status, starting_matchday, ending_matchday, all_matchdays, competition_id')
        .eq('slug', tournamentSlug)
        .single()

      if (tournament) {
        // Simuler la nouvelle logique de la page opposition (avec support knockout)
        // 1. Vérifier si la compétition a des phases knockout
        const { data: knockoutCheck } = await supabase
          .from('imported_matches')
          .select('id')
          .eq('competition_id', tournament.competition_id)
          .neq('stage', 'LEAGUE_STAGE')
          .not('stage', 'is', null)
          .limit(1)

        const hasKnockoutStages = knockoutCheck && knockoutCheck.length > 0

        let matchesForTournament: any[] = []

        if (hasKnockoutStages) {
          // Compétition knockout: 2 requêtes parallèles
          const [leagueResult, knockoutResult] = await Promise.all([
            supabase
              .from('imported_matches')
              .select('id, matchday, stage, utc_date, home_team_name, away_team_name')
              .eq('competition_id', tournament.competition_id)
              .eq('stage', 'LEAGUE_STAGE')
              .gte('matchday', tournament.starting_matchday)
              .lte('matchday', tournament.ending_matchday),
            supabase
              .from('imported_matches')
              .select('id, matchday, stage, utc_date, home_team_name, away_team_name')
              .eq('competition_id', tournament.competition_id)
              .neq('stage', 'LEAGUE_STAGE')
              .not('stage', 'is', null)
          ])

          const STAGE_ORDER: Record<string, number> = {
            'LEAGUE_STAGE': 0,
            'PLAYOFFS': 8,
            'LAST_16': 10,
            'QUARTER_FINALS': 12,
            'SEMI_FINALS': 14,
            'FINAL': 16
          }

          const leagueWithVirtual = (leagueResult.data || []).map((m: any) => ({
            ...m,
            virtual_matchday: m.matchday
          }))

          const knockoutWithVirtual = (knockoutResult.data || []).map((m: any) => ({
            ...m,
            virtual_matchday: (STAGE_ORDER[m.stage] || 8) + (m.matchday || 1)
          }))

          matchesForTournament = [...leagueWithVirtual, ...knockoutWithVirtual]
            .sort((a, b) => new Date(a.utc_date).getTime() - new Date(b.utc_date).getTime())
        } else {
          // Compétition classique
          const { data } = await supabase
            .from('imported_matches')
            .select('id, matchday, stage, utc_date, home_team_name, away_team_name')
            .eq('competition_id', tournament.competition_id)
            .gte('matchday', tournament.starting_matchday)
            .lte('matchday', tournament.ending_matchday)
            .order('utc_date', { ascending: true })

          matchesForTournament = data || []
        }

        // Grouper par stage
        const matchesByStageForTournament: Record<string, number> = {}
        matchesForTournament.forEach((m: any) => {
          const stage = m.stage || 'NULL'
          matchesByStageForTournament[stage] = (matchesByStageForTournament[stage] || 0) + 1
        })

        tournamentInfo = {
          tournament,
          hasKnockoutStages,
          matchesReturned: matchesForTournament.length,
          matchesByStage: matchesByStageForTournament,
          sampleMatches: matchesForTournament.slice(0, 10)
        }
      }
    }

    return NextResponse.json({
      database: {
        competition,
        totalMatchesInDb: totalMatches,
        matchesByStage: stageCount
      },
      tournamentInfo
    })
  }

  const apiKey = process.env.FOOTBALL_DATA_API_KEY

  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
  }

  try {
    // Récupérer tous les matchs de la Champions League
    const response = await fetch(`${FOOTBALL_DATA_API}/competitions/CL/matches`, {
      headers: { 'X-Auth-Token': apiKey },
      next: { revalidate: 0 }
    })

    if (!response.ok) {
      return NextResponse.json({
        error: 'API call failed',
        status: response.status,
        statusText: response.statusText
      }, { status: response.status })
    }

    const data = await response.json()

    // Grouper par stage et matchday
    const summary: Record<string, any> = {}
    const upcomingMatches: any[] = []

    for (const match of data.matches || []) {
      const key = `${match.stage}_MD${match.matchday}`

      if (!summary[key]) {
        summary[key] = {
          stage: match.stage,
          matchday: match.matchday,
          total: 0,
          finished: 0,
          scheduled: 0,
          firstDate: null,
          lastDate: null
        }
      }

      summary[key].total++

      if (match.status === 'FINISHED') {
        summary[key].finished++
      } else {
        summary[key].scheduled++
        upcomingMatches.push({
          date: match.utcDate,
          home: match.homeTeam?.name || match.homeTeam?.shortName,
          away: match.awayTeam?.name || match.awayTeam?.shortName,
          stage: match.stage,
          matchday: match.matchday,
          status: match.status
        })
      }

      if (!summary[key].firstDate || match.utcDate < summary[key].firstDate) {
        summary[key].firstDate = match.utcDate
      }
      if (!summary[key].lastDate || match.utcDate > summary[key].lastDate) {
        summary[key].lastDate = match.utcDate
      }
    }

    // Trier les matchs à venir par date
    upcomingMatches.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    // Détail des matchs de playoffs/knockout
    const playoffMatches = (data.matches || [])
      .filter((m: any) => m.stage !== 'LEAGUE_STAGE')
      .map((m: any) => ({
        id: m.id,
        date: m.utcDate,
        stage: m.stage,
        matchday: m.matchday,
        status: m.status,
        homeTeam: m.homeTeam?.name || m.homeTeam?.shortName || 'TBD',
        homeTeamId: m.homeTeam?.id,
        awayTeam: m.awayTeam?.name || m.awayTeam?.shortName || 'TBD',
        awayTeamId: m.awayTeam?.id,
        score: m.score?.fullTime
      }))
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())

    return NextResponse.json({
      totalMatches: data.matches?.length || 0,
      summary: Object.values(summary).sort((a: any, b: any) => {
        if (a.stage !== b.stage) return a.stage.localeCompare(b.stage)
        return a.matchday - b.matchday
      }),
      upcomingMatches: upcomingMatches.slice(0, 20),
      playoffMatches,
      hasKnockoutMatches: upcomingMatches.some(m =>
        m.stage?.includes('KNOCKOUT') ||
        m.stage?.includes('ROUND_OF') ||
        m.stage?.includes('QUARTER') ||
        m.stage?.includes('SEMI') ||
        m.stage?.includes('FINAL')
      )
    })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
