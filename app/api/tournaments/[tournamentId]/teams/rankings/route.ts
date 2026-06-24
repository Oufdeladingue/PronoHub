import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@supabase/supabase-js'
import { GET as rankingsGET } from '@/app/api/tournaments/[tournamentId]/rankings/route'

interface TeamRanking {
  teamId: string
  teamName: string
  teamAvatar: string
  memberCount: number
  avgPoints: number
  totalPoints: number
  totalExactScores: number
  totalCorrectResults: number
  avgExactScores: number
  avgCorrectResults: number
  memberUserIds: string[]
  rank: number
}

// GET - Recuperer le classement par equipe
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  try {
    const { tournamentId } = await params
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 1. Récupérer le tournoi
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('id, teams_enabled')
      .eq('id', tournamentId)
      .single()

    if (tournamentError || !tournament) {
      return NextResponse.json({ error: 'Tournoi non trouve' }, { status: 404 })
    }

    if (!tournament.teams_enabled) {
      return NextResponse.json({ rankings: [], message: 'Les equipes ne sont pas activees' })
    }

    // 2. Récupérer les équipes
    const { data: teams, error: teamsError } = await supabase
      .from('tournament_teams')
      .select('id, name, avatar')
      .eq('tournament_id', tournamentId)

    if (teamsError) {
      console.error('[Team Rankings] Error fetching teams:', teamsError)
      return NextResponse.json({ error: 'Erreur récupération équipes', details: teamsError.message }, { status: 500 })
    }

    if (!teams || teams.length === 0) {
      return NextResponse.json({ rankings: [] })
    }

    // 3. Récupérer les membres séparément
    const teamIds = teams.map(t => t.id)
    const { data: allMembers, error: membersError } = await supabase
      .from('tournament_team_members')
      .select('team_id, user_id')
      .in('team_id', teamIds)

    if (membersError) {
      console.error('[Team Rankings] Error fetching members:', membersError)
    }

    // Grouper les membres par équipe
    const membersByTeam = new Map<string, string[]>()
    for (const member of (allMembers || [])) {
      if (!membersByTeam.has(member.team_id)) {
        membersByTeam.set(member.team_id, [])
      }
      membersByTeam.get(member.team_id)!.push(member.user_id)
    }

    // 4. Points par joueur : on réutilise le classement individuel (source unique de vérité).
    //    Évite de dupliquer le scoring — et corrige le calcul knockout (score 90 min + bonus
    //    qualifié) qui était ignoré ici, faussant les totaux par équipe en CL / Coupe du Monde.
    const playerPointsMap = new Map<string, { points: number; exactScores: number; correctResults: number }>()
    try {
      const res = await rankingsGET(
        // skipPrevious=1 : les équipes n'utilisent que les totaux (points/exacts/bons) — pas les
        // flèches de progression → on évite le calcul du classement de la journée précédente (~2× plus rapide).
        new Request(`http://internal/api/tournaments/${tournamentId}/rankings?skipPrevious=1`) as any,
        { params: Promise.resolve({ tournamentId }) } as any,
      )
      if (res.ok) {
        const j = await res.json()
        for (const p of (j?.rankings || [])) {
          playerPointsMap.set(p.playerId, {
            points: p.totalPoints ?? 0,
            exactScores: p.exactScores ?? 0,
            correctResults: p.correctResults ?? 0,
          })
        }
      } else {
        console.error('[Team Rankings] rankings route a renvoyé', res.status)
      }
    } catch (pointsError) {
      console.error('[Team Rankings] Erreur récupération classement (équipes affichées avec 0 pts):', pointsError)
    }

    // 5. Calculer les stats pour chaque equipe
    const teamStats: TeamRanking[] = teams.map(team => {
      const members = membersByTeam.get(team.id) || []
      const memberCount = members.length

      if (memberCount === 0) {
        return {
          teamId: team.id,
          teamName: team.name,
          teamAvatar: team.avatar || 'team1',
          memberCount: 0,
          avgPoints: 0,
          totalPoints: 0,
          totalExactScores: 0,
          totalCorrectResults: 0,
          avgExactScores: 0,
          avgCorrectResults: 0,
          memberUserIds: [],
          rank: 0
        }
      }

      let totalPoints = 0
      let totalExactScores = 0
      let totalCorrectResults = 0

      members.forEach(userId => {
        const playerStats = playerPointsMap.get(userId)
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
        avgPoints: Math.round((totalPoints / memberCount) * 10) / 10,
        totalPoints,
        totalExactScores,
        totalCorrectResults,
        avgExactScores: Math.round((totalExactScores / memberCount) * 10) / 10,
        avgCorrectResults: Math.round((totalCorrectResults / memberCount) * 10) / 10,
        memberUserIds: members,
        rank: 0
      }
    })

    // 6. Trier et assigner les rangs
    teamStats.sort((a, b) => {
      if (b.avgPoints !== a.avgPoints) return b.avgPoints - a.avgPoints
      if (b.avgCorrectResults !== a.avgCorrectResults) return b.avgCorrectResults - a.avgCorrectResults
      return b.avgExactScores - a.avgExactScores
    })

    let currentRank = 1
    teamStats.forEach((team, index) => {
      if (index > 0) {
        const prev = teamStats[index - 1]
        const isTied = team.avgPoints === prev.avgPoints &&
                       team.avgCorrectResults === prev.avgCorrectResults &&
                       team.avgExactScores === prev.avgExactScores
        if (!isTied) {
          currentRank = index + 1
        }
      }
      team.rank = currentRank
    })

    return NextResponse.json(
      { rankings: teamStats },
      { headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=120' } }
    )

  } catch (error) {
    console.error('[Team Rankings] Error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
