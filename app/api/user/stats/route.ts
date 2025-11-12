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

    // 1. Nombre total de tournois (finis + en cours)
    const { data: tournaments, error: tournamentsError } = await supabase
      .from('tournament_participants')
      .select('tournament_id, tournaments!inner(status)')
      .eq('user_id', user.id)

    const totalTournaments = tournaments?.length || 0
    const activeTournaments = tournaments?.filter((t: any) => t.tournaments.status === 'active').length || 0
    const finishedTournaments = tournaments?.filter((t: any) => t.tournaments.status === 'finished').length || 0

    // 2. Récupérer tous les pronostics de l'utilisateur
    const { data: predictions, error: predictionsError } = await supabase
      .from('predictions')
      .select('id, predicted_home_score, predicted_away_score, is_default_prediction, match_id, points_earned')
      .eq('user_id', user.id)

    console.log(`Found ${predictions?.length || 0} predictions for user ${user.id}`)

    if (predictionsError) {
      console.error('Error fetching predictions:', predictionsError)
    }

    let totalFinishedMatches = 0
    let correctResults = 0
    let exactScores = 0

    if (predictions && predictions.length > 0) {
      // Récupérer tous les IDs de matchs
      const matchIds = predictions.map((p: any) => p.match_id).filter(Boolean)

      if (matchIds.length > 0) {
        // Récupérer les informations des matchs
        const { data: matches, error: matchesError } = await supabase
          .from('imported_matches')
          .select('id, home_score, away_score, status, finished')
          .in('id', matchIds)

        console.log(`Found ${matches?.length || 0} matches`)

        if (matchesError) {
          console.error('Error fetching matches:', matchesError)
        }

        if (matches) {
          // Créer un map des matchs pour un accès rapide
          const matchesMap: Record<number, any> = {}
          matches.forEach((match: any) => {
            matchesMap[match.id] = match
          })

          // Calculer les statistiques
          predictions.forEach((pred: any) => {
            const match = matchesMap[pred.match_id]

            if (!match) return

            // Vérifier si le match est terminé
            if (match.status !== 'FINISHED' && match.finished !== true) return

            // Vérifier que les scores sont définis
            if (match.home_score === null || match.away_score === null) return

            totalFinishedMatches++

            const predHomeScore = pred.predicted_home_score
            const predAwayScore = pred.predicted_away_score
            const actualHomeScore = match.home_score
            const actualAwayScore = match.away_score

            // Vérifier le score exact
            if (predHomeScore === actualHomeScore && predAwayScore === actualAwayScore) {
              exactScores++
              correctResults++ // Un score exact est aussi un bon résultat
            } else {
              // Vérifier le bon résultat (même issue : victoire domicile, nul, victoire extérieur)
              const predResult = predHomeScore > predAwayScore ? 'HOME' : predHomeScore < predAwayScore ? 'AWAY' : 'DRAW'
              const actualResult = actualHomeScore > actualAwayScore ? 'HOME' : actualHomeScore < actualAwayScore ? 'AWAY' : 'DRAW'

              if (predResult === actualResult) {
                correctResults++
              }
            }
          })
        }
      }
    }

    console.log(`Stats: ${totalFinishedMatches} finished matches, ${correctResults} correct results, ${exactScores} exact scores`)

    const correctResultsPercentage = totalFinishedMatches > 0 ? Math.round((correctResults / totalFinishedMatches) * 100) : 0
    const exactScoresPercentage = totalFinishedMatches > 0 ? Math.round((exactScores / totalFinishedMatches) * 100) : 0

    // 3. Nombre de premières places finales (classements de tournois terminés)
    let firstPlacesFinal = 0
    if (finishedTournaments > 0) {
      const finishedTournamentIds = tournaments
        ?.filter((t: any) => t.tournaments.status === 'finished')
        .map((t: any) => t.tournament_id) || []

      for (const tournamentId of finishedTournamentIds) {
        // Calculer le classement final du tournoi
        const { data: tournamentParticipants } = await supabase
          .from('tournament_participants')
          .select('user_id, total_points')
          .eq('tournament_id', tournamentId)
          .order('total_points', { ascending: false })

        if (tournamentParticipants && tournamentParticipants.length > 0) {
          const maxPoints = tournamentParticipants[0].total_points
          const winners = tournamentParticipants.filter((p: any) => p.total_points === maxPoints)

          if (winners.some((w: any) => w.user_id === user.id)) {
            firstPlacesFinal++
          }
        }
      }
    }

    // 4. Nombre de premières places provisoires (classements de journées terminées)
    let firstPlacesProvisional = 0

    // Récupérer tous les tournois actifs ou terminés de l'utilisateur
    const tournamentIds = tournaments?.map((t: any) => t.tournament_id) || []

    if (tournamentIds.length > 0) {
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

          // Vérifier si tous les matchs sont terminés
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

          // Trouver le maximum de points
          const pointsArray = Object.values(userPoints)
          if (pointsArray.length === 0) continue

          const maxPoints = Math.max(...pointsArray)

          // Vérifier si l'utilisateur a le maximum de points
          if (userPoints[user.id] === maxPoints && maxPoints > 0) {
            firstPlacesProvisional++
          }
        }
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
