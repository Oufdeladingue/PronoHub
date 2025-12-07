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

    // ============================================
    // ÉTAPE 1 : Récupérer les tournois en parallèle avec les predictions et matches
    // ============================================

    const [tournamentsResult, predictionsResult] = await Promise.all([
      // 1. Tous les tournois de l'utilisateur avec leur statut
      supabase
        .from('tournament_participants')
        .select('tournament_id, tournaments!inner(id, status, starting_matchday, ending_matchday, competition_id)')
        .eq('user_id', user.id),

      // 2. Tous les pronostics de l'utilisateur avec les infos du match
      supabase
        .from('predictions')
        .select(`
          id,
          predicted_home_score,
          predicted_away_score,
          is_default_prediction,
          match_id,
          points_earned,
          tournament_id,
          imported_matches!inner(id, home_score, away_score, status, finished, matchday, competition_id)
        `)
        .eq('user_id', user.id)
    ])

    const tournaments = tournamentsResult.data || []
    const predictions = predictionsResult.data || []

    // ============================================
    // ÉTAPE 2 : Calculer les stats de base des tournois
    // ============================================

    const totalTournaments = tournaments.length
    const activeTournaments = tournaments.filter((t: any) => t.tournaments.status === 'active').length
    const finishedTournaments = tournaments.filter((t: any) => t.tournaments.status === 'finished').length

    // ============================================
    // ÉTAPE 3 : Calculer les stats de pronostics (optimisé - plus de requête supplémentaire)
    // ============================================

    let totalFinishedMatches = 0
    let correctResults = 0
    let exactScores = 0
    let defaultPredictions = 0

    predictions.forEach((pred: any) => {
      const match = pred.imported_matches
      if (!match) return

      // Vérifier si le match est terminé
      if (match.status !== 'FINISHED' && match.finished !== true) return
      if (match.home_score === null || match.away_score === null) return

      totalFinishedMatches++

      if (pred.is_default_prediction) {
        defaultPredictions++
      }

      const predHomeScore = pred.predicted_home_score
      const predAwayScore = pred.predicted_away_score
      const actualHomeScore = match.home_score
      const actualAwayScore = match.away_score

      // Score exact
      if (predHomeScore === actualHomeScore && predAwayScore === actualAwayScore) {
        exactScores++
        correctResults++
      } else {
        // Bon résultat
        const predResult = predHomeScore > predAwayScore ? 'HOME' : predHomeScore < predAwayScore ? 'AWAY' : 'DRAW'
        const actualResult = actualHomeScore > actualAwayScore ? 'HOME' : actualHomeScore < actualAwayScore ? 'AWAY' : 'DRAW'
        if (predResult === actualResult) {
          correctResults++
        }
      }
    })

    const correctResultsPercentage = totalFinishedMatches > 0 ? Math.round((correctResults / totalFinishedMatches) * 100) : 0
    const exactScoresPercentage = totalFinishedMatches > 0 ? Math.round((exactScores / totalFinishedMatches) * 100) : 0
    const defaultPredictionsPercentage = totalFinishedMatches > 0 ? Math.round((defaultPredictions / totalFinishedMatches) * 100) : 0

    // ============================================
    // ÉTAPE 4 : Calculer premières places finales (optimisé)
    // ============================================

    let firstPlacesFinal = 0
    const finishedTournamentIds = tournaments
      .filter((t: any) => t.tournaments.status === 'finished')
      .map((t: any) => t.tournament_id)

    if (finishedTournamentIds.length > 0) {
      // Une seule requête pour tous les participants de tous les tournois terminés
      const { data: allParticipants } = await supabase
        .from('tournament_participants')
        .select('tournament_id, user_id, total_points')
        .in('tournament_id', finishedTournamentIds)
        .order('total_points', { ascending: false })

      if (allParticipants) {
        // Grouper par tournoi et vérifier si l'utilisateur est premier
        const tournamentGroups: Record<string, any[]> = {}
        allParticipants.forEach((p: any) => {
          if (!tournamentGroups[p.tournament_id]) {
            tournamentGroups[p.tournament_id] = []
          }
          tournamentGroups[p.tournament_id].push(p)
        })

        Object.values(tournamentGroups).forEach((participants: any[]) => {
          if (participants.length === 0) return
          const maxPoints = participants[0].total_points
          const winners = participants.filter(p => p.total_points === maxPoints)
          if (winners.some(w => w.user_id === user.id)) {
            firstPlacesFinal++
          }
        })
      }
    }

    // ============================================
    // ÉTAPE 5 : Calculer premières places provisoires (optimisé - calcul local)
    // ============================================

    let firstPlacesProvisional = 0
    const tournamentIds = tournaments.map((t: any) => t.tournament_id)

    if (tournamentIds.length > 0) {
      // Une seule requête pour tous les pronostics de tous les tournois
      const { data: allPredictions } = await supabase
        .from('predictions')
        .select(`
          user_id,
          points_earned,
          tournament_id,
          imported_matches!inner(matchday, competition_id, status, finished, home_score, away_score)
        `)
        .in('tournament_id', tournamentIds)

      if (allPredictions) {
        // Créer une structure pour regrouper par tournoi/journée
        const journeyData: Record<string, {
          predictions: any[],
          competitionId: number,
          matchday: number
        }> = {}

        allPredictions.forEach((pred: any) => {
          const match = pred.imported_matches
          if (!match) return

          // Vérifier si le match est terminé
          if (match.status !== 'FINISHED' && match.finished !== true) return
          if (match.home_score === null || match.away_score === null) return

          const key = `${pred.tournament_id}_${match.matchday}`
          if (!journeyData[key]) {
            journeyData[key] = {
              predictions: [],
              competitionId: match.competition_id,
              matchday: match.matchday
            }
          }
          journeyData[key].predictions.push(pred)
        })

        // Pour chaque journée, calculer le classement
        Object.values(journeyData).forEach((journey) => {
          const userPoints: Record<string, number> = {}

          journey.predictions.forEach((pred: any) => {
            if (!userPoints[pred.user_id]) {
              userPoints[pred.user_id] = 0
            }
            userPoints[pred.user_id] += pred.points_earned || 0
          })

          const pointsArray = Object.values(userPoints)
          if (pointsArray.length === 0) return

          const maxPoints = Math.max(...pointsArray)
          if (userPoints[user.id] === maxPoints && maxPoints > 0) {
            firstPlacesProvisional++
          }
        })
      }
    }

    return NextResponse.json({
      success: true,
      stats: {
        totalTournaments,
        activeTournaments,
        finishedTournaments,
        totalFinishedMatches,
        correctResultsPercentage,
        exactScoresPercentage,
        defaultPredictionsPercentage,
        firstPlacesFinal,
        firstPlacesProvisional
      }
    })

  } catch (error: any) {
    console.error('Error fetching user stats:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
