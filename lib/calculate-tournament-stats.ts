/**
 * Fonction réutilisable pour calculer les statistiques d'un tournoi
 * Utilisée par /api/tournaments/[tournamentId]/rankings et /api/admin/tournaments/[tournamentId]
 */

import { createClient as createServerClient } from '@supabase/supabase-js'
import { calculatePoints, type PointsSettings } from './scoring'

export interface ParticipantStats {
  user_id: string
  username: string
  avatar: string
  total_points: number
  rank: number | null
  predictions_count: number
  joined_at: string
  exact_scores?: number
  correct_results?: number
  matches_played?: number
}

export interface TournamentStatsOptions {
  supabaseUrl: string
  supabaseKey: string
  tournamentId: string
  includeDetailedStats?: boolean // Si true, inclut exact_scores, correct_results, matches_played
}

/**
 * Calcule les statistiques des participants d'un tournoi
 * Recalcule les points à la volée en se basant sur les prédictions et les résultats des matchs
 */
export async function calculateTournamentStats(
  options: TournamentStatsOptions
): Promise<ParticipantStats[]> {
  const { supabaseUrl, supabaseKey, tournamentId, includeDetailedStats = false } = options

  const supabase = createServerClient(supabaseUrl, supabaseKey)

  // 1. Récupérer le tournoi et ses paramètres
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', tournamentId)
    .single()

  if (!tournament) {
    throw new Error('Tournament not found')
  }

  // 2. Récupérer les paramètres de scoring
  const { data: pointsSettingsData } = await supabase
    .from('admin_settings')
    .select('setting_key, setting_value')
    .in('setting_key', ['points_exact_score', 'points_correct_result', 'points_incorrect_result'])

  const exactScoreSetting = pointsSettingsData?.find(s => s.setting_key === 'points_exact_score')
  const correctResultSetting = pointsSettingsData?.find(s => s.setting_key === 'points_correct_result')
  const incorrectResultSetting = pointsSettingsData?.find(s => s.setting_key === 'points_incorrect_result')

  const pointsSettings: PointsSettings = {
    exactScore: parseInt(exactScoreSetting?.setting_value || '3'),
    correctResult: parseInt(correctResultSetting?.setting_value || '1'),
    incorrectResult: parseInt(incorrectResultSetting?.setting_value || '0'),
    drawWithDefaultPrediction: tournament.scoring_draw_with_default_prediction ?? 0
  }

  // 3. Récupérer les participants avec leurs profils
  const { data: participants } = await supabase
    .from('tournament_participants')
    .select('user_id, joined_at, profiles(username, avatar)')
    .eq('tournament_id', tournamentId)

  if (!participants || participants.length === 0) {
    return []
  }

  // 4. Déterminer les journées à calculer
  let startMatchday = tournament.starting_matchday
  let endMatchday = tournament.ending_matchday

  if (tournament.custom_competition_id && (!startMatchday || !endMatchday)) {
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

  if (!startMatchday || !endMatchday) {
    return participants.map(p => ({
      user_id: p.user_id,
      username: (p.profiles as any)?.username || 'Inconnu',
      avatar: (p.profiles as any)?.avatar || 'avatar1',
      total_points: 0,
      rank: null,
      predictions_count: 0,
      joined_at: p.joined_at
    }))
  }

  const matchdaysToCalculate = Array.from(
    { length: endMatchday - startMatchday + 1 },
    (_, i) => startMatchday + i
  )

  // 5. Récupérer les matchs terminés
  const tournamentStartDate = tournament.start_date ? new Date(tournament.start_date) : null
  const isCustomCompetition = !!tournament.custom_competition_id

  let finishedMatchesRaw: any[] = []

  if (isCustomCompetition) {
    // Tournoi custom
    const { data: matchdaysData } = await supabase
      .from('custom_competition_matchdays')
      .select('id, matchday_number')
      .eq('custom_competition_id', tournament.custom_competition_id)
      .in('matchday_number', matchdaysToCalculate)

    if (matchdaysData && matchdaysData.length > 0) {
      const matchdayIds = matchdaysData.map(md => md.id)
      const matchdayNumberMap: Record<string, number> = {}
      matchdaysData.forEach(md => { matchdayNumberMap[md.id] = md.matchday_number })

      const { data: customMatches } = await supabase
        .from('custom_competition_matches')
        .select('id, custom_matchday_id, football_data_match_id, cached_utc_date')
        .in('custom_matchday_id', matchdayIds)

      if (customMatches) {
        const footballDataIds = customMatches
          .map(m => m.football_data_match_id)
          .filter(id => id !== null)

        const { data: importedMatches } = await supabase
          .from('imported_matches')
          .select('id, football_data_match_id, home_score, away_score, status, utc_date')
          .in('football_data_match_id', footballDataIds)

        const importedMatchesMap: Record<number, any> = {}
        importedMatches?.forEach(im => {
          importedMatchesMap[im.football_data_match_id] = im
        })

        finishedMatchesRaw = customMatches
          .map(cm => {
            const im = importedMatchesMap[cm.football_data_match_id]
            return {
              id: im?.id || cm.id,
              matchday: matchdayNumberMap[cm.custom_matchday_id],
              utc_date: im?.utc_date || cm.cached_utc_date,
              home_score: im?.home_score ?? null,
              away_score: im?.away_score ?? null,
              status: im?.status || 'SCHEDULED'
            }
          })
          .filter(m => m.home_score !== null && m.away_score !== null)
      }
    }
  } else {
    // Tournoi standard
    const { data: matchesData } = await supabase
      .from('imported_matches')
      .select('*')
      .eq('competition_id', tournament.competition_id)
      .in('matchday', matchdaysToCalculate)
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)

    finishedMatchesRaw = matchesData || []
  }

  // Filtrer par date de démarrage du tournoi
  const finishedMatches = tournamentStartDate
    ? finishedMatchesRaw.filter(m => new Date(m.utc_date) >= tournamentStartDate)
    : finishedMatchesRaw

  if (finishedMatches.length === 0) {
    // Pas de matchs terminés = pas de points
    return participants.map(p => ({
      user_id: p.user_id,
      username: (p.profiles as any)?.username || 'Inconnu',
      avatar: (p.profiles as any)?.avatar || 'avatar1',
      total_points: 0,
      rank: null,
      predictions_count: 0,
      joined_at: p.joined_at
    }))
  }

  const finishedMatchesMap = new Map(finishedMatches.map(m => [m.id, m]))

  // 6. Récupérer les matchs bonus
  const { data: bonusMatches } = await supabase
    .from('tournament_bonus_matches')
    .select('match_id, matchday')
    .eq('tournament_id', tournamentId)
    .in('matchday', matchdaysToCalculate)

  const bonusMatchIds = new Set(bonusMatches?.map(bm => bm.match_id) || [])

  // 7. Récupérer toutes les prédictions du tournoi (matchs terminés ET à venir)
  // Cela permet de voir combien de pronos les users ont déjà renseignés
  const { data: allPredictionsData } = await supabase
    .from('predictions')
    .select('user_id, match_id, predicted_home_score, predicted_away_score, is_default_prediction')
    .eq('tournament_id', tournamentId)

  const predictionsByUser = new Map<string, any[]>()
  const allPredictionsByUser = new Map<string, any[]>() // Toutes les prédictions (pour le count)

  for (const pred of (allPredictionsData || [])) {
    if (!predictionsByUser.has(pred.user_id)) {
      predictionsByUser.set(pred.user_id, [])
      allPredictionsByUser.set(pred.user_id, [])
    }
    predictionsByUser.get(pred.user_id)!.push(pred)
    allPredictionsByUser.get(pred.user_id)!.push(pred)
  }

  // 8. Calculer les stats pour chaque participant
  const participantStats: ParticipantStats[] = []

  for (const participant of participants) {
    const userId = participant.user_id
    const username = (participant.profiles as any)?.username || 'Inconnu'
    const avatar = (participant.profiles as any)?.avatar || 'avatar1'

    const predictions = predictionsByUser.get(userId) || []
    const predictionsMap = new Map(predictions.map(p => [p.match_id, p]))

    // Créer des pronostics par défaut pour les matchs manquants
    const allPredictions = finishedMatches.map(match => {
      const existingPred = predictionsMap.get(match.id)
      if (existingPred) {
        return existingPred
      }
      return {
        match_id: match.id,
        predicted_home_score: 0,
        predicted_away_score: 0,
        is_default_prediction: true,
        user_id: userId,
        tournament_id: tournamentId
      }
    })

    let totalPoints = 0
    let exactScores = 0
    let correctResults = 0
    let matchesPlayed = 0

    // Calculer le nombre total de prédictions enregistrées (matchs terminés + à venir)
    const allUserPredictions = allPredictionsByUser.get(userId) || []
    const predictionsCount = allUserPredictions.filter(p => !p.is_default_prediction).length

    // Calculer les points (uniquement pour les matchs terminés)
    for (const prediction of allPredictions) {
      const match = finishedMatchesMap.get(prediction.match_id)
      if (!match || match.home_score === null || match.away_score === null) continue

      const isValidPrediction = prediction.predicted_home_score !== null &&
                               prediction.predicted_away_score !== null

      if (!isValidPrediction) continue

      const isBonusMatch = bonusMatchIds.has(match.id)
      const isDefaultPrediction = prediction.is_default_prediction || false

      const result = calculatePoints(
        {
          predictedHomeScore: prediction.predicted_home_score,
          predictedAwayScore: prediction.predicted_away_score
        },
        {
          homeScore: match.home_score,
          awayScore: match.away_score
        },
        pointsSettings,
        isBonusMatch,
        isDefaultPrediction
      )

      // Compter les stats détaillées (uniquement pour les matchs terminés)
      if (!isDefaultPrediction) {
        matchesPlayed++
        if (result.isExactScore) exactScores++
        if (result.isCorrectResult) correctResults++
      }

      totalPoints += result.points
    }

    participantStats.push({
      user_id: userId,
      username,
      avatar,
      total_points: totalPoints,
      rank: null, // Sera calculé après le tri
      predictions_count: predictionsCount,
      joined_at: participant.joined_at,
      ...(includeDetailedStats && {
        exact_scores: exactScores,
        correct_results: correctResults,
        matches_played: matchesPlayed
      })
    })
  }

  // 9. Calculer les rangs (tri par points décroissants)
  participantStats.sort((a, b) => {
    if (b.total_points !== a.total_points) {
      return b.total_points - a.total_points
    }
    // En cas d'égalité, départager par nombre de scores exacts si disponible
    if (includeDetailedStats && a.exact_scores !== undefined && b.exact_scores !== undefined) {
      if (b.exact_scores !== a.exact_scores) {
        return b.exact_scores - a.exact_scores
      }
      if (a.correct_results !== undefined && b.correct_results !== undefined) {
        return b.correct_results - a.correct_results
      }
    }
    return 0
  })

  let currentRank = 1
  participantStats.forEach((stat, index) => {
    if (index > 0) {
      const prev = participantStats[index - 1]
      const isTied = stat.total_points === prev.total_points
      if (!isTied) {
        currentRank = index + 1
      }
    }
    stat.rank = currentRank
  })

  return participantStats
}
