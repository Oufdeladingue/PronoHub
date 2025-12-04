import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface TeamRanking {
  teamId: string
  teamName: string
  teamAvatar: string
  memberCount: number
  avgPoints: number
  totalPoints: number
  avgExactScores: number
  avgCorrectResults: number
  rank: number
}

// GET - Recuperer le classement par equipe
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  try {
    const { tournamentId } = await params
    const supabase = await createClient()

    // Verifier si les equipes sont activees pour ce tournoi
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('id, teams_enabled, tournament_type')
      .eq('id', tournamentId)
      .single()

    if (tournamentError || !tournament) {
      return NextResponse.json({ error: 'Tournoi non trouve' }, { status: 404 })
    }

    if (!tournament.teams_enabled) {
      return NextResponse.json({ rankings: [], message: 'Les equipes ne sont pas activees' })
    }

    // Recuperer les equipes avec leurs membres
    const { data: teams, error: teamsError } = await supabase
      .from('tournament_teams')
      .select(`
        id,
        name,
        avatar,
        tournament_team_members (
          user_id
        )
      `)
      .eq('tournament_id', tournamentId)

    if (teamsError) {
      console.error('Error fetching teams:', teamsError)
      return NextResponse.json({ rankings: [] })
    }

    if (!teams || teams.length === 0) {
      return NextResponse.json({ rankings: [] })
    }

    // Recuperer le classement individuel pour calculer les moyennes
    const rankingsResponse = await fetch(
      `${request.nextUrl.origin}/api/tournaments/${tournamentId}/rankings`,
      { headers: { cookie: request.headers.get('cookie') || '' } }
    )

    let playerRankings: any[] = []
    if (rankingsResponse.ok) {
      const rankingsData = await rankingsResponse.json()
      playerRankings = rankingsData.rankings || []
    }

    // Creer un map des points par joueur
    const playerPointsMap = new Map<string, { points: number, exactScores: number, correctResults: number }>()
    playerRankings.forEach((player: any) => {
      playerPointsMap.set(player.playerId, {
        points: player.totalPoints || 0,
        exactScores: player.exactScores || 0,
        correctResults: player.correctResults || 0
      })
    })

    // Calculer les stats pour chaque equipe
    const teamStats: TeamRanking[] = teams.map(team => {
      const members = (team.tournament_team_members || []) as { user_id: string }[]
      const memberCount = members.length

      if (memberCount === 0) {
        return {
          teamId: team.id,
          teamName: team.name,
          teamAvatar: team.avatar || 'team1',
          memberCount: 0,
          avgPoints: 0,
          totalPoints: 0,
          avgExactScores: 0,
          avgCorrectResults: 0,
          rank: 0
        }
      }

      let totalPoints = 0
      let totalExactScores = 0
      let totalCorrectResults = 0

      members.forEach(member => {
        const playerStats = playerPointsMap.get(member.user_id)
        if (playerStats) {
          totalPoints += playerStats.points
          totalExactScores += playerStats.exactScores
          totalCorrectResults += playerStats.correctResults
        }
      })

      return {
        teamId: team.id,
        teamName: team.name,
        teamAvatar: team.avatar || 'team1',
        memberCount,
        avgPoints: totalPoints / memberCount,
        totalPoints,
        avgExactScores: totalExactScores / memberCount,
        avgCorrectResults: totalCorrectResults / memberCount,
        rank: 0
      }
    })

    // Trier par moyenne de points (decroissant)
    teamStats.sort((a, b) => {
      // D'abord par moyenne de points
      if (b.avgPoints !== a.avgPoints) {
        return b.avgPoints - a.avgPoints
      }
      // En cas d'egalite, par total de points
      if (b.totalPoints !== a.totalPoints) {
        return b.totalPoints - a.totalPoints
      }
      // En cas d'egalite, par nombre de scores exacts
      return b.avgExactScores - a.avgExactScores
    })

    // Assigner les rangs
    teamStats.forEach((team, index) => {
      team.rank = index + 1
    })

    return NextResponse.json({ rankings: teamStats })

  } catch (error) {
    console.error('Error fetching team rankings:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
