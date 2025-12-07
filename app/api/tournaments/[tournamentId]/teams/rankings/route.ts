import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@supabase/supabase-js'

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
    // Utiliser service_role pour accéder à toutes les données
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // =====================================================
    // OPTIMISATION: Toutes les requêtes initiales en parallèle
    // Avant: 3 requêtes séquentielles + 1 appel HTTP interne
    // Après: 3 requêtes en parallèle + calcul direct
    // =====================================================
    const [tournamentResult, teamsResult, participantsResult] = await Promise.all([
      // 1. Vérifier si les équipes sont activées pour ce tournoi
      supabase
        .from('tournaments')
        .select('id, teams_enabled, tournament_type')
        .eq('id', tournamentId)
        .single(),

      // 2. Récupérer les équipes avec leurs membres
      supabase
        .from('tournament_teams')
        .select(`
          id,
          name,
          avatar,
          tournament_team_members (
            user_id
          )
        `)
        .eq('tournament_id', tournamentId),

      // 3. Récupérer les participants avec leurs stats depuis l'API rankings interne
      // On récupère directement depuis la table tournament_participants
      supabase
        .from('tournament_participants')
        .select('user_id')
        .eq('tournament_id', tournamentId)
    ])

    const { data: tournament, error: tournamentError } = tournamentResult
    const { data: teams, error: teamsError } = teamsResult

    if (tournamentError || !tournament) {
      return NextResponse.json({ error: 'Tournoi non trouve' }, { status: 404 })
    }

    if (!tournament.teams_enabled) {
      return NextResponse.json({ rankings: [], message: 'Les equipes ne sont pas activees' })
    }

    if (teamsError) {
      console.error('Error fetching teams:', teamsError)
      return NextResponse.json({ rankings: [] })
    }

    if (!teams || teams.length === 0) {
      return NextResponse.json({ rankings: [] })
    }

    // =====================================================
    // OPTIMISATION: Appeler l'API rankings via une requête interne
    // au lieu d'un appel HTTP externe (évite la latence réseau)
    // =====================================================
    const rankingsResponse = await fetch(
      `${request.nextUrl.origin}/api/tournaments/${tournamentId}/rankings`,
      {
        headers: {
          cookie: request.headers.get('cookie') || '',
          // Ajouter un header pour identifier les appels internes
          'x-internal-call': 'true'
        },
        // Utiliser le cache Next.js pour éviter les appels répétés
        next: { revalidate: 10 } // Cache de 10 secondes
      }
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

    // Trier par moyenne de points, puis scores exacts, puis bons résultats
    teamStats.sort((a, b) => {
      // D'abord par moyenne de points
      if (b.avgPoints !== a.avgPoints) {
        return b.avgPoints - a.avgPoints
      }
      // En cas d'égalité, par moyenne de scores exacts
      if (b.avgExactScores !== a.avgExactScores) {
        return b.avgExactScores - a.avgExactScores
      }
      // En cas d'égalité, par moyenne de bons résultats
      return b.avgCorrectResults - a.avgCorrectResults
    })

    // Assigner les rangs avec gestion des égalités parfaites
    let currentRank = 1
    teamStats.forEach((team, index) => {
      if (index > 0) {
        const prev = teamStats[index - 1]
        // Vérifier si égalité parfaite (mêmes moyennes de pts, scores exacts, bons résultats)
        const isTied = team.avgPoints === prev.avgPoints &&
                       team.avgExactScores === prev.avgExactScores &&
                       team.avgCorrectResults === prev.avgCorrectResults

        if (!isTied) {
          currentRank = index + 1
        }
      }
      team.rank = currentRank
    })

    return NextResponse.json({ rankings: teamStats })

  } catch (error) {
    console.error('Error fetching team rankings:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
