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
    const trophiesToUnlock: Array<{ type: string, unlocked_at: string }> = []

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
              .select('id, status, finished, home_score, away_score, utc_date')
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
              // Trouver la date du match le plus récent de cette journée
              const latestMatch = journeyMatches.reduce((latest: any, match: any) => {
                if (!latest || match.utc_date > latest.utc_date) return match
                return latest
              }, null)

              trophiesToUnlock.push({ type: 'king_of_day', unlocked_at: latestMatch?.utc_date || new Date().toISOString() })
              break // On sort de la boucle des journées
            }
          }

          if (trophiesToUnlock.some(t => t.type === 'king_of_day')) break // On sort de la boucle des tournois
        }
      }
    }

    // 2. Vérifier "Bon résultat" et "Score exact" - Au moins un bon résultat ou score exact pronostiqué
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
          .select('id, home_score, away_score, status, finished, matchday, utc_date')
          .in('id', matchIds)

        matches = fetchedMatches || []
      }
    }

    if (matches.length > 0) {
      const matchesMap: Record<number, any> = {}
      matches.forEach((match: any) => {
        matchesMap[match.id] = match
      })

      let hasCorrectResult = false
      let hasExactScore = false
      let correctResultDate = ''
      let exactScoreDate = ''

      // Parcourir tous les pronostics pour trouver le premier bon résultat et le premier score exact
      for (const pred of predictions || []) {
        const match = matchesMap[pred.match_id]

        if (!match) continue
        if (match.status !== 'FINISHED' && match.finished !== true) continue
        if (match.home_score === null || match.away_score === null) continue

        const predHomeScore = pred.predicted_home_score
        const predAwayScore = pred.predicted_away_score
        const actualHomeScore = match.home_score
        const actualAwayScore = match.away_score

        // Vérifier le score exact
        if (!hasExactScore && predHomeScore === actualHomeScore && predAwayScore === actualAwayScore) {
          hasExactScore = true
          exactScoreDate = match.utc_date
        }

        // Vérifier le bon résultat
        if (!hasCorrectResult) {
          const predResult = predHomeScore > predAwayScore ? 'HOME' : predHomeScore < predAwayScore ? 'AWAY' : 'DRAW'
          const actualResult = actualHomeScore > actualAwayScore ? 'HOME' : actualHomeScore < actualAwayScore ? 'AWAY' : 'DRAW'

          if (predResult === actualResult) {
            hasCorrectResult = true
            correctResultDate = match.utc_date
          }
        }

        // Si on a trouvé les deux, on peut arrêter
        if (hasCorrectResult && hasExactScore) break
      }

      // Ajouter les trophées trouvés
      if (hasExactScore) {
        trophiesToUnlock.push({ type: 'exact_score', unlocked_at: exactScoreDate })
      }
      if (hasCorrectResult) {
        trophiesToUnlock.push({ type: 'correct_result', unlocked_at: correctResultDate })
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
        // Récupérer les détails du tournoi
        const { data: tournamentDetails } = await supabase
          .from('tournaments')
          .select('id, competition_id, ending_matchday')
          .eq('id', tournament.tournament_id)
          .single()

        // Récupérer le classement final du tournoi
        const { data: finalRanking } = await supabase
          .from('tournament_participants')
          .select('user_id, total_points')
          .eq('tournament_id', tournament.tournament_id)
          .order('total_points', { ascending: false })
          .limit(1)

        if (finalRanking && finalRanking.length > 0 && finalRanking[0].user_id === user.id && tournamentDetails) {
          // Trouver la date du dernier match du tournoi
          const { data: lastMatches } = await supabase
            .from('imported_matches')
            .select('utc_date')
            .eq('competition_id', tournamentDetails.competition_id)
            .eq('matchday', tournamentDetails.ending_matchday)
            .order('utc_date', { ascending: false })
            .limit(1)

          const unlockDate = lastMatches?.[0]?.utc_date || new Date().toISOString()
          trophiesToUnlock.push({ type: 'tournament_winner', unlocked_at: unlockDate })
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
            .select('id, status, finished, home_score, away_score, utc_date')
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
              // Trouver la date du match le plus récent de cette journée
              const latestMatch = journeyMatches.reduce((latest: any, match: any) => {
                if (!latest || match.utc_date > latest.utc_date) return match
                return latest
              }, null)

              trophiesToUnlock.push({ type: 'double_king', unlocked_at: latestMatch?.utc_date || new Date().toISOString() })
              break
            }
          } else {
            consecutiveWins = 0
          }
        }

        if (trophiesToUnlock.some(t => t.type === 'double_king')) break
      }
    }

    // 5. Vérifier "L'Opportuniste", "Le Nostradamus", "Le Profiteur" et "L'Optimisateur"
    if (predictions && predictions.length > 0 && matches.length > 0 && tournaments && tournaments.length > 0) {
      // Récupérer tous les matchs bonus pour les tournois de l'utilisateur
      const tournamentIds = tournaments.map(t => t.tournament_id)
      const { data: bonusMatches } = await supabase
        .from('tournament_bonus_matches')
        .select('tournament_id, matchday, match_id')
        .in('tournament_id', tournamentIds)

      // Créer un set pour accès rapide aux IDs de matchs bonus
      const bonusMatchIds = new Set<string>()
      bonusMatches?.forEach(bm => {
        bonusMatchIds.add(bm.match_id)
      })

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
          match_id: pred.match_id,
          pred_home: pred.predicted_home_score,
          pred_away: pred.predicted_away_score,
          actual_home: match.home_score,
          actual_away: match.away_score,
          utc_date: match.utc_date,
          is_bonus: bonusMatchIds.has(pred.match_id)
        })
      }

      // Analyser chaque journée
      for (const matchdayPreds of Object.values(predictionsByMatchday)) {
        let correctResults = 0
        let exactScores = 0
        let latestMatchDate = matchdayPreds[0]?.utc_date
        let bonusCorrectResultDate = ''
        let bonusExactScoreDate = ''
        let hasBonusCorrectResult = false
        let hasBonusExactScore = false

        // Trouver la date du match le plus récent de cette journée
        for (const p of matchdayPreds) {
          if (p.utc_date && (!latestMatchDate || p.utc_date > latestMatchDate)) {
            latestMatchDate = p.utc_date
          }
        }

        for (const p of matchdayPreds) {
          const predResult = p.pred_home > p.pred_away ? 'HOME' : p.pred_home < p.pred_away ? 'AWAY' : 'DRAW'
          const actualResult = p.actual_home > p.actual_away ? 'HOME' : p.actual_home < p.actual_away ? 'AWAY' : 'DRAW'

          const isExact = p.pred_home === p.actual_home && p.pred_away === p.actual_away
          const isCorrect = predResult === actualResult

          if (isExact) {
            exactScores++
            if (p.is_bonus && !hasBonusExactScore) {
              hasBonusExactScore = true
              bonusExactScoreDate = p.utc_date
            }
          }
          if (isCorrect) {
            correctResults++
            if (p.is_bonus && !hasBonusCorrectResult) {
              hasBonusCorrectResult = true
              bonusCorrectResultDate = p.utc_date
            }
          }
        }

        if (correctResults >= 2) trophiesToUnlock.push({ type: 'opportunist', unlocked_at: latestMatchDate })
        if (exactScores >= 2) trophiesToUnlock.push({ type: 'nostradamus', unlocked_at: latestMatchDate })
        if (hasBonusCorrectResult) trophiesToUnlock.push({ type: 'bonus_profiteer', unlocked_at: bonusCorrectResultDate })
        if (hasBonusExactScore) trophiesToUnlock.push({ type: 'bonus_optimizer', unlocked_at: bonusExactScoreDate })
      }
    }

    // Débloquer les trophées qui n'existent pas encore
    // Dédupliquer les trophées par type (garder le premier de chaque type)
    const uniqueTrophies: Record<string, { type: string, unlocked_at: string }> = {}
    for (const trophy of trophiesToUnlock) {
      if (!uniqueTrophies[trophy.type]) {
        uniqueTrophies[trophy.type] = trophy
      }
    }

    for (const trophy of Object.values(uniqueTrophies)) {
      await supabase
        .from('user_trophies')
        .upsert({
          user_id: user.id,
          trophy_type: trophy.type,
          unlocked_at: trophy.unlocked_at,
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
