import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@supabase/supabase-js'
import { calculatePoints, calculateRankings, type PointsSettings } from '@/lib/scoring'

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
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 1. Requêtes initiales en parallèle
    const [tournamentResult, teamsResult, participantsResult, pointsSettingsResult] = await Promise.all([
      supabase
        .from('tournaments')
        .select('id, teams_enabled, tournament_type, competition_id, custom_competition_id, starting_matchday, ending_matchday, start_date, scoring_draw_with_default_prediction')
        .eq('id', tournamentId)
        .single(),

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

      supabase
        .from('tournament_participants')
        .select('user_id')
        .eq('tournament_id', tournamentId),

      supabase
        .from('admin_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['points_exact_score', 'points_correct_result', 'points_incorrect_result'])
    ])

    const { data: tournament, error: tournamentError } = tournamentResult
    const { data: teams, error: teamsError } = teamsResult
    const { data: participants } = participantsResult
    const { data: pointsSettingsData } = pointsSettingsResult

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

    // 2. Calculer les points par joueur directement (sans appel HTTP interne)
    const playerPointsMap = new Map<string, { points: number, exactScores: number, correctResults: number }>()

    if (participants && participants.length > 0) {
      // Déterminer les matchdays
      let startMatchday = tournament.starting_matchday
      let endMatchday = tournament.ending_matchday
      const isCustom = !!tournament.custom_competition_id

      if (isCustom && (!startMatchday || !endMatchday)) {
        const { data: customMatchdays } = await supabase
          .from('custom_competition_matchdays')
          .select('matchday_number')
          .eq('custom_competition_id', tournament.custom_competition_id)
          .order('matchday_number', { ascending: true })

        if (customMatchdays && customMatchdays.length > 0) {
          startMatchday = customMatchdays[0].matchday_number
          endMatchday = customMatchdays[customMatchdays.length - 1].matchday_number
        }
      }

      if (startMatchday && endMatchday) {
        const matchdaysToCalculate = Array.from(
          { length: endMatchday - startMatchday + 1 },
          (_, i) => startMatchday + i
        )
        const tournamentStartDate = tournament.start_date ? new Date(tournament.start_date) : null

        // Récupérer les matchs terminés
        let finishedMatches: any[] = []

        if (isCustom) {
          const { data: matchdaysData } = await supabase
            .from('custom_competition_matchdays')
            .select('id, matchday_number')
            .eq('custom_competition_id', tournament.custom_competition_id)
            .in('matchday_number', matchdaysToCalculate)

          if (matchdaysData && matchdaysData.length > 0) {
            const matchdayIds = matchdaysData.map((md: any) => md.id)

            const { data: customMatches } = await supabase
              .from('custom_competition_matches')
              .select('id, custom_matchday_id, football_data_match_id, cached_utc_date')
              .in('custom_matchday_id', matchdayIds)

            if (customMatches) {
              const footballDataIds = customMatches
                .map((m: any) => m.football_data_match_id)
                .filter((id: any) => id !== null)

              const { data: importedMatches } = await supabase
                .from('imported_matches')
                .select('id, football_data_match_id, home_score, away_score, status, utc_date')
                .in('football_data_match_id', footballDataIds)

              const importedMatchesMap: Record<number, any> = {}
              importedMatches?.forEach((im: any) => {
                importedMatchesMap[im.football_data_match_id] = im
              })

              finishedMatches = customMatches
                .map((cm: any) => {
                  const im = importedMatchesMap[cm.football_data_match_id]
                  return {
                    id: im?.id || cm.id,
                    utc_date: im?.utc_date || cm.cached_utc_date,
                    home_score: im?.home_score ?? null,
                    away_score: im?.away_score ?? null,
                  }
                })
                .filter((m: any) => m.home_score !== null && m.away_score !== null)
            }
          }
        } else {
          const { data: matchesData } = await supabase
            .from('imported_matches')
            .select('id, home_score, away_score, utc_date')
            .eq('competition_id', tournament.competition_id)
            .in('matchday', matchdaysToCalculate)
            .not('home_score', 'is', null)
            .not('away_score', 'is', null)

          finishedMatches = matchesData || []
        }

        // Filtrer par date de démarrage du tournoi
        if (tournamentStartDate) {
          finishedMatches = finishedMatches.filter((m: any) => new Date(m.utc_date) >= tournamentStartDate)
        }

        if (finishedMatches.length > 0) {
          const matchIds = finishedMatches.map((m: any) => m.id)

          // Récupérer toutes les prédictions en une requête
          const { data: allPredictions } = await supabase
            .from('predictions')
            .select('user_id, match_id, predicted_home_score, predicted_away_score, is_default_prediction')
            .eq('tournament_id', tournamentId)
            .in('match_id', matchIds)

          // Barème de points
          const exactScoreSetting = pointsSettingsData?.find((s: any) => s.setting_key === 'points_exact_score')
          const correctResultSetting = pointsSettingsData?.find((s: any) => s.setting_key === 'points_correct_result')
          const incorrectResultSetting = pointsSettingsData?.find((s: any) => s.setting_key === 'points_incorrect_result')

          const pointsSettings: PointsSettings = {
            exactScore: parseInt(exactScoreSetting?.setting_value || '3'),
            correctResult: parseInt(correctResultSetting?.setting_value || '1'),
            incorrectResult: parseInt(incorrectResultSetting?.setting_value || '0'),
            drawWithDefaultPrediction: tournament.scoring_draw_with_default_prediction ?? 0
          }

          // Créer un map des matchs pour accès rapide
          const matchMap = new Map(finishedMatches.map((m: any) => [m.id, m]))

          // Calculer les points par joueur
          const predsByUser = new Map<string, any[]>()
          for (const pred of (allPredictions || [])) {
            if (!predsByUser.has(pred.user_id)) {
              predsByUser.set(pred.user_id, [])
            }
            predsByUser.get(pred.user_id)!.push(pred)
          }

          for (const participant of participants) {
            const userId = participant.user_id
            const userPreds = predsByUser.get(userId) || []
            let totalPts = 0
            let exactScores = 0
            let correctResults = 0

            for (const pred of userPreds) {
              const match = matchMap.get(pred.match_id)
              if (!match) continue

              const result = calculatePoints(
                { predictedHomeScore: pred.predicted_home_score, predictedAwayScore: pred.predicted_away_score },
                { homeScore: match.home_score, awayScore: match.away_score },
                pointsSettings,
                false,
                pred.is_default_prediction || false
              )

              totalPts += result.points
              if (result.isExactScore) exactScores++
              else if (result.isCorrectResult) correctResults++
            }

            playerPointsMap.set(userId, {
              points: totalPts,
              exactScores,
              correctResults
            })
          }
        }
      }
    }

    // 3. Calculer les stats pour chaque equipe
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

    // 4. Trier et assigner les rangs
    teamStats.sort((a, b) => {
      if (b.avgPoints !== a.avgPoints) return b.avgPoints - a.avgPoints
      if (b.avgExactScores !== a.avgExactScores) return b.avgExactScores - a.avgExactScores
      return b.avgCorrectResults - a.avgCorrectResults
    })

    let currentRank = 1
    teamStats.forEach((team, index) => {
      if (index > 0) {
        const prev = teamStats[index - 1]
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
