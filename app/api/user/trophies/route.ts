import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()

    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Non authentifié' },
        { status: 401 }
      )
    }

    // Vérifier les trophées à débloquer
    const trophiesToUnlock = []

    // Récupérer tous les tournois de l'utilisateur (utilisé par plusieurs vérifications)
    const { data: tournaments } = await supabase
      .from('tournament_participants')
      .select('tournament_id')
      .eq('user_id', user.id)

    // 1. Vérifier "King of the Day" - Premier d'une journée de tournoi
    const { data: stats } = await supabase
      .from('predictions')
      .select('user_id, points_earned, match_id, tournament_id')
      .eq('user_id', user.id)

    if (stats && stats.length > 0) {

      if (tournaments && tournaments.length > 0) {
        const tournamentIds = tournaments.map(t => t.tournament_id)

        for (const tournamentId of tournamentIds) {
          // Récupérer le tournoi pour connaître les journées
          const { data: tournament } = await supabase
            .from('tournaments')
            .select('starting_matchday, ending_matchday, competition_id')
            .eq('id', tournamentId)
            .single()

          if (!tournament || !tournament.starting_matchday || !tournament.ending_matchday) continue

          // Pour chaque journée du tournoi
          for (let matchday = tournament.starting_matchday; matchday <= tournament.ending_matchday; matchday++) {
            // Vérifier que tous les matchs de cette journée sont terminés
            const { data: journeyMatches } = await supabase
              .from('imported_matches')
              .select('id, status, finished, home_score, away_score')
              .eq('competition_id', tournament.competition_id)
              .eq('matchday', matchday)

            if (!journeyMatches || journeyMatches.length === 0) continue

            const allMatchesFinished = journeyMatches.every(m =>
              (m.status === 'FINISHED' || m.finished === true) &&
              m.home_score !== null &&
              m.away_score !== null
            )

            if (!allMatchesFinished) continue

            // Récupérer tous les participants du tournoi
            const { data: tournamentParticipants } = await supabase
              .from('tournament_participants')
              .select('user_id')
              .eq('tournament_id', tournamentId)

            if (!tournamentParticipants || tournamentParticipants.length === 0) continue

            const userIds = tournamentParticipants.map(p => p.user_id)
            const matchIds = journeyMatches.map(m => m.id)

            // Récupérer tous les pronostics pour cette journée
            const { data: journeyPredictions } = await supabase
              .from('predictions')
              .select('user_id, points_earned')
              .eq('tournament_id', tournamentId)
              .in('user_id', userIds)
              .in('match_id', matchIds)

            if (!journeyPredictions || journeyPredictions.length === 0) continue

            // Grouper par utilisateur et calculer les points totaux
            const userPoints: Record<string, number> = {}

            journeyPredictions.forEach((pred: any) => {
              if (!userPoints[pred.user_id]) {
                userPoints[pred.user_id] = 0
              }
              userPoints[pred.user_id] += pred.points_earned || 0
            })

            const maxPoints = Math.max(...Object.values(userPoints))

            // Si l'utilisateur a le maximum de points pour cette journée
            if (userPoints[user.id] === maxPoints && maxPoints > 0) {
              trophiesToUnlock.push('king_of_day')
              break // On sort de la boucle des journées
            }
          }

          if (trophiesToUnlock.includes('king_of_day')) break // On sort de la boucle des tournois
        }
      }
    }

    // 2. Vérifier "Bon résultat" - Au moins un bon résultat pronostiqué
    const { data: predictions } = await supabase
      .from('predictions')
      .select('id, predicted_home_score, predicted_away_score, match_id, points_earned, tournament_id')
      .eq('user_id', user.id)

    // Récupérer les matchs (utilisé par plusieurs vérifications)
    let matches: any[] = []
    if (predictions && predictions.length > 0) {
      const matchIds = predictions.map(p => p.match_id).filter(Boolean)

      if (matchIds.length > 0) {
        const { data: fetchedMatches } = await supabase
          .from('imported_matches')
          .select('id, home_score, away_score, status, finished, matchday, is_bonus_match')
          .in('id', matchIds)

        matches = fetchedMatches || []
      }
    }

    if (matches.length > 0) {
      const matchesMap: Record<number, any> = {}
      matches.forEach((match: any) => {
        matchesMap[match.id] = match
      })

      // Vérifier s'il y a au moins un bon résultat
      for (const pred of predictions || []) {
        const match = matchesMap[pred.match_id]

        if (!match) continue
        if (match.status !== 'FINISHED' && match.finished !== true) continue
        if (match.home_score === null || match.away_score === null) continue

        const predHomeScore = pred.predicted_home_score
        const predAwayScore = pred.predicted_away_score
        const actualHomeScore = match.home_score
        const actualAwayScore = match.away_score

        // Vérifier le score exact d'abord
        if (predHomeScore === actualHomeScore && predAwayScore === actualAwayScore) {
          trophiesToUnlock.push('exact_score')
          trophiesToUnlock.push('correct_result')
          break
        }

        // Sinon vérifier le bon résultat
        const predResult = predHomeScore > predAwayScore ? 'HOME' : predHomeScore < predAwayScore ? 'AWAY' : 'DRAW'
        const actualResult = actualHomeScore > actualAwayScore ? 'HOME' : actualHomeScore < actualAwayScore ? 'AWAY' : 'DRAW'

        if (predResult === actualResult) {
          trophiesToUnlock.push('correct_result')
          // Continue pour vérifier s'il y a un score exact
        }
      }
    }

    // 3. Vérifier "Le Ballon d'or" - Premier au classement final d'un tournoi
    const { data: finishedTournaments } = await supabase
      .from('tournament_participants')
      .select('tournament_id, tournaments(status)')
      .eq('user_id', user.id)
      .eq('tournaments.status', 'finished')

    if (finishedTournaments && finishedTournaments.length > 0) {
      for (const tournament of finishedTournaments) {
        // Récupérer le classement final du tournoi
        const { data: finalRanking } = await supabase
          .from('tournament_participants')
          .select('user_id, total_points')
          .eq('tournament_id', tournament.tournament_id)
          .order('total_points', { ascending: false })
          .limit(1)

        if (finalRanking && finalRanking.length > 0 && finalRanking[0].user_id === user.id) {
          trophiesToUnlock.push('tournament_winner')
          break
        }
      }
    }

    // 4. Vérifier "Le Roi du Doublé" - Premier au classement de deux journées consécutives
    if (tournaments && tournaments.length > 0) {
      const tournamentIds = tournaments.map(t => t.tournament_id)

      for (const tournamentId of tournamentIds) {
        const { data: tournament } = await supabase
          .from('tournaments')
          .select('starting_matchday, ending_matchday, competition_id')
          .eq('id', tournamentId)
          .single()

        if (!tournament || !tournament.starting_matchday || !tournament.ending_matchday) continue

        let consecutiveWins = 0
        for (let matchday = tournament.starting_matchday; matchday <= tournament.ending_matchday; matchday++) {
          const { data: journeyMatches } = await supabase
            .from('imported_matches')
            .select('id, status, finished, home_score, away_score')
            .eq('competition_id', tournament.competition_id)
            .eq('matchday', matchday)

          if (!journeyMatches || journeyMatches.length === 0) {
            consecutiveWins = 0
            continue
          }

          const allMatchesFinished = journeyMatches.every(m =>
            (m.status === 'FINISHED' || m.finished === true) &&
            m.home_score !== null &&
            m.away_score !== null
          )

          if (!allMatchesFinished) {
            consecutiveWins = 0
            continue
          }

          const { data: tournamentParticipants } = await supabase
            .from('tournament_participants')
            .select('user_id')
            .eq('tournament_id', tournamentId)

          if (!tournamentParticipants || tournamentParticipants.length === 0) {
            consecutiveWins = 0
            continue
          }

          const userIds = tournamentParticipants.map(p => p.user_id)
          const matchIds = journeyMatches.map(m => m.id)

          const { data: journeyPredictions } = await supabase
            .from('predictions')
            .select('user_id, points_earned')
            .eq('tournament_id', tournamentId)
            .in('user_id', userIds)
            .in('match_id', matchIds)

          if (!journeyPredictions || journeyPredictions.length === 0) {
            consecutiveWins = 0
            continue
          }

          const userPoints: Record<string, number> = {}
          journeyPredictions.forEach((pred: any) => {
            if (!userPoints[pred.user_id]) userPoints[pred.user_id] = 0
            userPoints[pred.user_id] += pred.points_earned || 0
          })

          const maxPoints = Math.max(...Object.values(userPoints))
          if (userPoints[user.id] === maxPoints && maxPoints > 0) {
            consecutiveWins++
            if (consecutiveWins >= 2) {
              trophiesToUnlock.push('double_king')
              break
            }
          } else {
            consecutiveWins = 0
          }
        }

        if (trophiesToUnlock.includes('double_king')) break
      }
    }

    // 5. Vérifier "L'Opportuniste" - Deux bons résultats sur une même journée
    // 6. Vérifier "Le Nostradamus" - Deux scores exacts sur une même journée
    if (predictions && predictions.length > 0 && matches.length > 0) {
      const matchesMap: Record<number, any> = {}
      matches.forEach((match: any) => {
        matchesMap[match.id] = match
      })

      // Grouper les pronostics par tournoi et journée
      const predictionsByMatchday: Record<string, any[]> = {}

      for (const pred of predictions) {
        const match = matchesMap[pred.match_id]
        if (!match || (match.status !== 'FINISHED' && match.finished !== true)) continue
        if (match.home_score === null || match.away_score === null) continue

        const key = `${pred.tournament_id}_${match.matchday}`
        if (!predictionsByMatchday[key]) predictionsByMatchday[key] = []

        predictionsByMatchday[key].push({
          pred_home: pred.predicted_home_score,
          pred_away: pred.predicted_away_score,
          actual_home: match.home_score,
          actual_away: match.away_score,
          is_bonus: match.is_bonus_match || false
        })
      }

      // Analyser chaque journée
      for (const matchdayPreds of Object.values(predictionsByMatchday)) {
        let correctResults = 0
        let exactScores = 0
        let bonusCorrectResult = false
        let bonusExactScore = false

        for (const p of matchdayPreds) {
          const predResult = p.pred_home > p.pred_away ? 'HOME' : p.pred_home < p.pred_away ? 'AWAY' : 'DRAW'
          const actualResult = p.actual_home > p.actual_away ? 'HOME' : p.actual_home < p.actual_away ? 'AWAY' : 'DRAW'

          const isExact = p.pred_home === p.actual_home && p.pred_away === p.actual_away
          const isCorrect = predResult === actualResult

          if (isExact) {
            exactScores++
            if (p.is_bonus) bonusExactScore = true
          }
          if (isCorrect) {
            correctResults++
            if (p.is_bonus) bonusCorrectResult = true
          }
        }

        if (correctResults >= 2) trophiesToUnlock.push('opportunist')
        if (exactScores >= 2) trophiesToUnlock.push('nostradamus')
        if (bonusCorrectResult) trophiesToUnlock.push('bonus_profiteer')
        if (bonusExactScore) trophiesToUnlock.push('bonus_optimizer')
      }
    }

    // Débloquer les trophées qui n'existent pas encore
    for (const trophyType of [...new Set(trophiesToUnlock)]) {
      await supabase
        .from('user_trophies')
        .upsert({
          user_id: user.id,
          trophy_type: trophyType,
          is_new: true
        }, {
          onConflict: 'user_id,trophy_type',
          ignoreDuplicates: true
        })
    }

    // Récupérer tous les trophées de l'utilisateur
    const { data: userTrophies } = await supabase
      .from('user_trophies')
      .select('*')
      .eq('user_id', user.id)
      .order('unlocked_at', { ascending: false })

    const hasNewTrophies = userTrophies?.some(t => t.is_new) || false

    return NextResponse.json({
      success: true,
      trophies: userTrophies || [],
      hasNewTrophies
    })

  } catch (error: any) {
    console.error('Error fetching user trophies:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}

// Marquer les trophées comme vus
export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Non authentifié' },
        { status: 401 }
      )
    }

    // Marquer tous les trophées comme vus
    await supabase
      .from('user_trophies')
      .update({ is_new: false })
      .eq('user_id', user.id)
      .eq('is_new', true)

    return NextResponse.json({
      success: true
    })

  } catch (error: any) {
    console.error('Error marking trophies as seen:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
