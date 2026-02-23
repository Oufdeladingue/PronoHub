import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@supabase/supabase-js'
import { calculatePoints, type PointsSettings } from '@/lib/scoring'

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

    // 1. Récupérer le tournoi (select * pour avoir tous les champs comme la route individuelle)
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('*')
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

    // 4. Récupérer les participants et points settings en parallèle
    const [participantsResult, pointsSettingsResult] = await Promise.all([
      supabase
        .from('tournament_participants')
        .select('user_id')
        .eq('tournament_id', tournamentId),
      supabase
        .from('admin_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['points_exact_score', 'points_correct_result', 'points_incorrect_result'])
    ])

    const { data: participants } = participantsResult
    const { data: pointsSettingsData } = pointsSettingsResult

    // 5. Calculer les points par joueur (même logique que la route individuelle)
    const playerPointsMap = new Map<string, { points: number, exactScores: number, correctResults: number }>()

    try {
      if (participants && participants.length > 0) {
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

          let finishedMatches: any[] = []
          let allMatches: any[] = []

          if (isCustom) {
            const { data: matchdaysData } = await supabase
              .from('custom_competition_matchdays')
              .select('id, matchday_number')
              .eq('custom_competition_id', tournament.custom_competition_id)
              .in('matchday_number', matchdaysToCalculate)

            if (matchdaysData && matchdaysData.length > 0) {
              const matchdayIds = matchdaysData.map((md: any) => md.id)
              const matchdayNumberMap: Record<string, number> = {}
              matchdaysData.forEach((md: any) => { matchdayNumberMap[md.id] = md.matchday_number })

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

                const allMapped = customMatches.map((cm: any) => {
                  const im = importedMatchesMap[cm.football_data_match_id]
                  return {
                    id: im?.id || cm.id,
                    matchday: matchdayNumberMap[cm.custom_matchday_id],
                    utc_date: im?.utc_date || cm.cached_utc_date,
                    home_score: im?.home_score ?? null,
                    away_score: im?.away_score ?? null,
                  }
                })

                finishedMatches = allMapped.filter((m: any) => m.home_score !== null && m.away_score !== null)
                allMatches = allMapped
              }
            }
          } else {
            // Tournoi standard : récupérer matchs terminés et tous les matchs
            const [finishedResult, allResult] = await Promise.all([
              supabase
                .from('imported_matches')
                .select('id, home_score, away_score, utc_date, matchday')
                .eq('competition_id', tournament.competition_id)
                .in('matchday', matchdaysToCalculate)
                .not('home_score', 'is', null)
                .not('away_score', 'is', null),
              supabase
                .from('imported_matches')
                .select('id, utc_date, matchday')
                .eq('competition_id', tournament.competition_id)
                .in('matchday', matchdaysToCalculate)
            ])

            finishedMatches = finishedResult.data || []
            allMatches = allResult.data || []
          }

          // Filtrer par date de démarrage du tournoi
          if (tournamentStartDate) {
            finishedMatches = finishedMatches.filter((m: any) => new Date(m.utc_date) >= tournamentStartDate)
            allMatches = allMatches.filter((m: any) => new Date(m.utc_date) >= tournamentStartDate)
          }

          if (finishedMatches.length > 0) {
            const finishedMatchesMap = new Map(finishedMatches.map((m: any) => [m.id, m]))
            const matchIds = finishedMatches.map((m: any) => m.id)

            // Récupérer toutes les prédictions ET les matchs bonus en parallèle
            const [predictionsResult, bonusResult] = await Promise.all([
              supabase
                .from('predictions')
                .select('user_id, match_id, predicted_home_score, predicted_away_score, is_default_prediction, created_at')
                .eq('tournament_id', tournamentId)
                .in('match_id', matchIds),
              supabase
                .from('tournament_bonus_matches')
                .select('match_id, matchday')
                .eq('tournament_id', tournamentId)
                .in('matchday', matchdaysToCalculate)
            ])

            const { data: allPredictions } = predictionsResult
            const bonusMatchIds = new Set(bonusResult.data?.map((bm: any) => bm.match_id) || [])

            const exactScoreSetting = pointsSettingsData?.find((s: any) => s.setting_key === 'points_exact_score')
            const correctResultSetting = pointsSettingsData?.find((s: any) => s.setting_key === 'points_correct_result')
            const incorrectResultSetting = pointsSettingsData?.find((s: any) => s.setting_key === 'points_incorrect_result')

            const pointsSettings: PointsSettings = {
              exactScore: parseInt(exactScoreSetting?.setting_value || '3'),
              correctResult: parseInt(correctResultSetting?.setting_value || '1'),
              incorrectResult: parseInt(incorrectResultSetting?.setting_value || '0'),
              drawWithDefaultPrediction: tournament.scoring_draw_with_default_prediction || 1
            }

            // Grouper les prédictions par utilisateur
            const predsByUser = new Map<string, any[]>()
            for (const pred of (allPredictions || [])) {
              if (!predsByUser.has(pred.user_id)) {
                predsByUser.set(pred.user_id, [])
              }
              predsByUser.get(pred.user_id)!.push(pred)
            }

            // Préparer les données pour le bonus "Prime d'avant-match"
            const firstMatchByMatchday: Record<number, Date> = {}
            const matchIdsByMatchday: Record<number, string[]> = {}

            if (tournament.early_prediction_bonus && allMatches) {
              for (const match of allMatches) {
                const md = match.matchday
                if (!matchIdsByMatchday[md]) {
                  matchIdsByMatchday[md] = []
                }
                matchIdsByMatchday[md].push(match.id)

                const matchDate = new Date(match.utc_date)
                if (!firstMatchByMatchday[md] || matchDate < firstMatchByMatchday[md]) {
                  firstMatchByMatchday[md] = matchDate
                }
              }
            }

            // Calculer les points pour chaque participant
            for (const participant of participants) {
              const userId = participant.user_id
              const userPreds = predsByUser.get(userId) || []
              const predictionsMap = new Map(userPreds.map((p: any) => [p.match_id, p]))

              // Créer des pronostics par défaut 0-0 pour les matchs non pronostiqués
              // (même logique que la route individuelle)
              const allUserPredictions = finishedMatches.map((match: any) => {
                const existingPred = predictionsMap.get(match.id)
                if (existingPred) return existingPred
                return {
                  match_id: match.id,
                  predicted_home_score: 0,
                  predicted_away_score: 0,
                  is_default_prediction: true,
                  user_id: userId,
                  tournament_id: tournamentId
                }
              })

              let totalPts = 0
              let exactScores = 0
              let correctResults = 0

              for (const pred of allUserPredictions) {
                const match = finishedMatchesMap.get(pred.match_id)
                if (!match || match.home_score === null || match.away_score === null) continue

                const isValidPrediction = pred.predicted_home_score !== null &&
                                         pred.predicted_away_score !== null
                if (!isValidPrediction) continue

                const isBonusMatch = bonusMatchIds.has(match.id)
                const isDefaultPrediction = pred.is_default_prediction || false

                const result = calculatePoints(
                  { predictedHomeScore: pred.predicted_home_score, predictedAwayScore: pred.predicted_away_score },
                  { homeScore: match.home_score, awayScore: match.away_score },
                  pointsSettings,
                  isBonusMatch,
                  isDefaultPrediction
                )

                totalPts += result.points

                // Compter exactScores et correctResults seulement pour les pronos non par défaut
                // (même logique que la route individuelle)
                if (!isDefaultPrediction) {
                  if (result.isExactScore) exactScores++
                  if (result.isCorrectResult) correctResults++
                }
              }

              // Calculer le bonus "Prime d'avant-match" si activé
              let earlyPredictionBonusPoints = 0
              if (tournament.early_prediction_bonus && userPreds.length > 0) {
                for (const md of matchdaysToCalculate) {
                  const matchIdsForDay = matchIdsByMatchday[md] || []
                  if (matchIdsForDay.length === 0) continue

                  const allMatchesFinished = matchIdsForDay.every((mId: string) => finishedMatchesMap.has(mId))
                  if (!allMatchesFinished) continue

                  let hasDefaultPrediction = false
                  for (const matchId of matchIdsForDay) {
                    const pred = userPreds.find((p: any) => p.match_id === matchId)
                    if (!pred || pred.is_default_prediction) {
                      hasDefaultPrediction = true
                      break
                    }
                  }

                  if (!hasDefaultPrediction) {
                    earlyPredictionBonusPoints += 1
                  }
                }

                totalPts += earlyPredictionBonusPoints
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
    } catch (pointsError) {
      console.error('[Team Rankings] Erreur calcul points (équipes affichées avec 0 pts):', pointsError)
    }

    // 6. Calculer les stats pour chaque equipe
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

    // 7. Trier et assigner les rangs
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

    return NextResponse.json({ rankings: teamStats })

  } catch (error) {
    console.error('[Team Rankings] Error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
