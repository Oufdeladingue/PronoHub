import { NextResponse } from 'next/server'

const FOOTBALL_DATA_API = 'https://api.football-data.org/v4'

export async function GET() {
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
