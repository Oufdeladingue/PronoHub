/**
 * Calcul de trophées côté serveur (pour le cron check-trophies)
 * Adapté depuis app/api/user/trophies/route.ts (PUT handler)
 * Optimisé : traite par tournoi, partage les données entre participants
 */

import { calculatePoints, type PointsSettings } from '@/lib/scoring'

export interface TriggerMatchInfo {
  homeTeamName: string
  awayTeamName: string
  homeTeamCrest: string | null
  awayTeamCrest: string | null
  homeScore: number
  awayScore: number
  predictedHomeScore: number
  predictedAwayScore: number
  utcDate: string
}

export interface TrophyResult {
  newTrophies: string[]
  trophyDates: Record<string, string> // trophy_type -> unlocked_at ISO date
  trophyTriggerMatches: Record<string, TriggerMatchInfo> // trophy_type -> match info
}

/**
 * Calcule les trophées pour TOUS les participants d'un tournoi.
 * Retourne uniquement les NOUVEAUX trophées (pas déjà en BDD).
 */
export async function calculateTrophiesForTournament(
  supabase: any,
  tournament: any,
  allParticipantIds: string[]
): Promise<Map<string, TrophyResult>> {
  const results = new Map<string, TrophyResult>()

  // Initialiser les résultats pour chaque participant
  for (const userId of allParticipantIds) {
    results.set(userId, { newTrophies: [], trophyDates: {}, trophyTriggerMatches: {} })
  }

  if (!tournament.starting_matchday || !tournament.ending_matchday) {
    return results
  }

  // ============================================
  // ÉTAPE 1 : Charger toutes les données en parallèle (partagées)
  // ============================================

  const [
    predictionsResult,
    existingTrophiesResult,
    bonusMatchesResult
  ] = await Promise.all([
    // Toutes les prédictions du tournoi (tous les participants) avec infos équipes
    supabase
      .from('predictions')
      .select(`
        user_id, tournament_id, match_id,
        predicted_home_score, predicted_away_score, is_default_prediction,
        imported_matches!inner(
          id, matchday, status, finished, home_score, away_score, utc_date, competition_id,
          home_team_name, away_team_name, home_team_crest, away_team_crest
        )
      `)
      .eq('tournament_id', tournament.id),

    // Trophées existants de tous les participants
    supabase
      .from('user_trophies')
      .select('user_id, trophy_type')
      .in('user_id', allParticipantIds),

    // Matchs bonus du tournoi
    supabase
      .from('tournament_bonus_matches')
      .select('tournament_id, match_id')
      .eq('tournament_id', tournament.id)
  ])

  const allPredictions = predictionsResult.data || []
  const allExistingTrophies = existingTrophiesResult.data || []
  const bonusMatches = bonusMatchesResult.data || []

  // ============================================
  // ÉTAPE 2 : Préparer les structures de données
  // ============================================

  // Trophées existants par user
  const existingTrophiesByUser: Record<string, Set<string>> = {}
  for (const userId of allParticipantIds) {
    existingTrophiesByUser[userId] = new Set()
  }
  for (const t of allExistingTrophies) {
    if (existingTrophiesByUser[t.user_id]) {
      existingTrophiesByUser[t.user_id].add(t.trophy_type)
    }
  }

  // Matchs bonus
  const bonusMatchIds = new Set(bonusMatches.map((bm: any) => bm.match_id))

  // Helper pour extraire les données de jointure Supabase
  const getMatch = (data: any) => Array.isArray(data) ? data[0] : data

  // Scoring settings du tournoi
  const tournamentSettings: PointsSettings = {
    exactScore: tournament.scoring_exact_score || 3,
    correctResult: tournament.scoring_correct_winner || 1,
    incorrectResult: 0,
    drawWithDefaultPrediction: tournament.scoring_default_prediction_max || 1
  }

  // Grouper les prédictions par journée
  const predictionsByJourney: Record<string, any[]> = {}
  const matchesByJourney: Record<string, any[]> = {}

  for (const pred of allPredictions) {
    const match = getMatch(pred.imported_matches)
    if (!match) continue

    const key = `${match.matchday}`

    if (!predictionsByJourney[key]) {
      predictionsByJourney[key] = []
      matchesByJourney[key] = []
    }

    predictionsByJourney[key].push(pred)

    if (!matchesByJourney[key].some((m: any) => m.id === match.id)) {
      matchesByJourney[key].push(match)
    }
  }

  // Helper : journée terminée ?
  const isJourneyComplete = (matches: any[]) => {
    return matches.length > 0 && matches.every(m =>
      (m.status === 'FINISHED' || m.finished === true) &&
      m.home_score !== null &&
      m.away_score !== null
    )
  }

  // Helper : calculer le ranking d'une journée (points par user)
  const getJourneyRanking = (predictions: any[], participantIds: string[]) => {
    const userPoints: Record<string, number> = {}
    for (const uid of participantIds) {
      userPoints[uid] = 0
    }

    for (const pred of predictions) {
      if (userPoints[pred.user_id] === undefined) return userPoints

      const match = getMatch(pred.imported_matches)
      if (!match) continue
      if (match.home_score === null || match.away_score === null) continue
      if (match.status !== 'FINISHED' && match.finished !== true) continue

      const isBonusMatch = bonusMatchIds.has(pred.match_id)
      const isDefaultPrediction = pred.is_default_prediction || false

      const result = calculatePoints(
        { predictedHomeScore: pred.predicted_home_score, predictedAwayScore: pred.predicted_away_score },
        { homeScore: match.home_score, awayScore: match.away_score },
        tournamentSettings,
        isBonusMatch,
        isDefaultPrediction
      )

      userPoints[pred.user_id] += result.points
    }

    return userPoints
  }

  // Helper : date la plus récente
  const getLatestDate = (matches: any[]) => {
    return matches.reduce((latest: string | null, m: any) => {
      if (!latest || (m.utc_date && m.utc_date > latest)) return m.utc_date
      return latest
    }, null) || new Date().toISOString()
  }

  // Helper : extraire les infos du match déclencheur depuis une prédiction
  const buildTriggerMatch = (pred: any, match: any): TriggerMatchInfo => ({
    homeTeamName: match.home_team_name || 'Équipe A',
    awayTeamName: match.away_team_name || 'Équipe B',
    homeTeamCrest: match.home_team_crest || null,
    awayTeamCrest: match.away_team_crest || null,
    homeScore: match.home_score,
    awayScore: match.away_score,
    predictedHomeScore: pred.predicted_home_score,
    predictedAwayScore: pred.predicted_away_score,
    utcDate: match.utc_date
  })

  // Helper : trouver le dernier match d'une journée + prono d'un user
  const getLastMatchTrigger = (matchday: string, userId: string): TriggerMatchInfo | null => {
    const journeyMatches = matchesByJourney[matchday] || []
    if (journeyMatches.length === 0) return null

    // Trier par date décroissante
    const sorted = [...journeyMatches].sort((a, b) => (b.utc_date || '').localeCompare(a.utc_date || ''))
    const lastMatch = sorted[0]

    // Trouver la prédiction de l'user pour ce match
    const journeyPreds = predictionsByJourney[matchday] || []
    const userPred = journeyPreds.find((p: any) => p.user_id === userId && p.match_id === lastMatch.id)

    return {
      homeTeamName: lastMatch.home_team_name || 'Équipe A',
      awayTeamName: lastMatch.away_team_name || 'Équipe B',
      homeTeamCrest: lastMatch.home_team_crest || null,
      awayTeamCrest: lastMatch.away_team_crest || null,
      homeScore: lastMatch.home_score,
      awayScore: lastMatch.away_score,
      predictedHomeScore: userPred?.predicted_home_score ?? 0,
      predictedAwayScore: userPred?.predicted_away_score ?? 0,
      utcDate: lastMatch.utc_date
    }
  }

  // ============================================
  // ÉTAPE 3 : Calculer les trophées pour chaque participant
  // ============================================

  // Pré-calculer les rankings par journée (partagé entre tous les participants)
  const journeyRankings: Record<string, Record<string, number>> = {}
  const journeyMeta: Record<string, { maxPoints: number, minPoints: number, usersWithMax: number, usersWithMin: number, latestDate: string }> = {}

  for (let matchday = tournament.starting_matchday; matchday <= tournament.ending_matchday; matchday++) {
    const key = `${matchday}`
    const journeyMatches = matchesByJourney[key] || []

    if (!isJourneyComplete(journeyMatches)) continue

    const journeyPredictions = predictionsByJourney[key] || []
    const userPoints = getJourneyRanking(journeyPredictions, allParticipantIds)
    journeyRankings[key] = userPoints

    const pointValues = Object.values(userPoints)
    const maxPoints = Math.max(...pointValues)
    const minPoints = Math.min(...pointValues)

    journeyMeta[key] = {
      maxPoints,
      minPoints,
      usersWithMax: pointValues.filter(pts => pts === maxPoints).length,
      usersWithMin: pointValues.filter(pts => pts === minPoints).length,
      latestDate: getLatestDate(journeyMatches)
    }
  }

  const isTournamentFinished = tournament.status === 'finished' || tournament.status === 'completed'
  const totalJourneys = tournament.ending_matchday - tournament.starting_matchday + 1

  // Pour chaque participant, évaluer les trophées
  for (const userId of allParticipantIds) {
    const existing = existingTrophiesByUser[userId]
    const trophiesToUnlock: Record<string, string> = {}
    const triggerMatches: Record<string, TriggerMatchInfo> = {}

    // --- TROPHÉES BASIQUES : correct_result & exact_score ---
    let hasCorrectResult = existing.has('correct_result')
    let hasExactScore = existing.has('exact_score')

    if (!hasCorrectResult || !hasExactScore) {
      const userPredictions = allPredictions.filter((p: any) => p.user_id === userId)
      for (const pred of userPredictions) {
        const match = getMatch(pred.imported_matches)
        if (!match || (match.status !== 'FINISHED' && match.finished !== true)) continue
        if (match.home_score === null || match.away_score === null) continue

        const isExact = pred.predicted_home_score === match.home_score &&
                        pred.predicted_away_score === match.away_score

        if (isExact && !hasExactScore) {
          trophiesToUnlock['exact_score'] = match.utc_date
          triggerMatches['exact_score'] = buildTriggerMatch(pred, match)
          hasExactScore = true
        }

        const predResult = pred.predicted_home_score > pred.predicted_away_score ? 'HOME' :
                          pred.predicted_home_score < pred.predicted_away_score ? 'AWAY' : 'DRAW'
        const actualResult = match.home_score > match.away_score ? 'HOME' :
                            match.home_score < match.away_score ? 'AWAY' : 'DRAW'

        if (predResult === actualResult && !hasCorrectResult) {
          trophiesToUnlock['correct_result'] = match.utc_date
          triggerMatches['correct_result'] = buildTriggerMatch(pred, match)
          hasCorrectResult = true
        }

        if (hasCorrectResult && hasExactScore) break
      }
    }

    // --- TROPHÉES PAR JOURNÉE ---
    let hasKingOfDay = existing.has('king_of_day')
    let hasDoubleKing = existing.has('double_king')
    let hasOpportunist = existing.has('opportunist')
    let hasNostradamus = existing.has('nostradamus')
    let hasBonusProfiteer = existing.has('bonus_profiteer')
    let hasBonusOptimizer = existing.has('bonus_optimizer')
    let hasLantern = existing.has('lantern')
    let hasDownwardSpiral = existing.has('downward_spiral')
    let hasCursed = existing.has('cursed')

    let consecutiveWins = 0
    let consecutiveLosses = 0
    let totalCompletedJourneys = 0
    let firstPlaceCount = 0

    for (let matchday = tournament.starting_matchday; matchday <= tournament.ending_matchday; matchday++) {
      const key = `${matchday}`
      const ranking = journeyRankings[key]
      const meta = journeyMeta[key]

      if (!ranking || !meta) {
        consecutiveWins = 0
        consecutiveLosses = 0
        continue
      }

      totalCompletedJourneys++

      const myPoints = ranking[userId] || 0
      const isFirst = myPoints === meta.maxPoints
      const isSoleLeader = isFirst && (meta.maxPoints > 0 || meta.usersWithMax === 1)
      const isLast = myPoints === meta.minPoints
      const isSoleLast = isLast && meta.usersWithMin === 1 && allParticipantIds.length > 1

      // King of Day
      if (!hasKingOfDay && isSoleLeader) {
        trophiesToUnlock['king_of_day'] = meta.latestDate
        const trigger = getLastMatchTrigger(key, userId)
        if (trigger) triggerMatches['king_of_day'] = trigger
        hasKingOfDay = true
      }

      // Double King
      if (isSoleLeader) {
        consecutiveWins++
        firstPlaceCount++
        if (!hasDoubleKing && consecutiveWins >= 2) {
          trophiesToUnlock['double_king'] = meta.latestDate
          const trigger = getLastMatchTrigger(key, userId)
          if (trigger) triggerMatches['double_king'] = trigger
          hasDoubleKing = true
        }
      } else {
        consecutiveWins = 0
      }

      // Lantern
      if (!hasLantern && isSoleLast) {
        trophiesToUnlock['lantern'] = meta.latestDate
        const trigger = getLastMatchTrigger(key, userId)
        if (trigger) triggerMatches['lantern'] = trigger
        hasLantern = true
      }

      // Downward Spiral
      if (isSoleLast) {
        consecutiveLosses++
        if (!hasDownwardSpiral && consecutiveLosses >= 2) {
          trophiesToUnlock['downward_spiral'] = meta.latestDate
          const trigger = getLastMatchTrigger(key, userId)
          if (trigger) triggerMatches['downward_spiral'] = trigger
          hasDownwardSpiral = true
        }
      } else {
        consecutiveLosses = 0
      }

      // Opportunist, Nostradamus, Bonus, Cursed
      const journeyPredictions = predictionsByJourney[key] || []
      const myJourneyPredictions = journeyPredictions.filter((p: any) => p.user_id === userId)
      let correctResults = 0
      let exactScores = 0
      let lastCorrectPred: any = null
      let lastExactPred: any = null

      for (const pred of myJourneyPredictions) {
        const match = getMatch(pred.imported_matches)
        if (!match) continue

        const predResult = pred.predicted_home_score > pred.predicted_away_score ? 'HOME' :
                          pred.predicted_home_score < pred.predicted_away_score ? 'AWAY' : 'DRAW'
        const actualResult = match.home_score > match.away_score ? 'HOME' :
                            match.home_score < match.away_score ? 'AWAY' : 'DRAW'

        const isExact = pred.predicted_home_score === match.home_score &&
                        pred.predicted_away_score === match.away_score
        const isCorrect = predResult === actualResult

        if (isExact) {
          exactScores++
          lastExactPred = { pred, match }
        }
        if (isCorrect) {
          correctResults++
          lastCorrectPred = { pred, match }
        }

        // Bonus trophies
        if (bonusMatchIds.has(pred.match_id)) {
          if (isCorrect && !hasBonusProfiteer) {
            trophiesToUnlock['bonus_profiteer'] = match.utc_date
            triggerMatches['bonus_profiteer'] = buildTriggerMatch(pred, match)
            hasBonusProfiteer = true
          }
          if (isExact && !hasBonusOptimizer) {
            trophiesToUnlock['bonus_optimizer'] = match.utc_date
            triggerMatches['bonus_optimizer'] = buildTriggerMatch(pred, match)
            hasBonusOptimizer = true
          }
        }
      }

      if (!hasOpportunist && correctResults >= 2 && lastCorrectPred) {
        trophiesToUnlock['opportunist'] = meta.latestDate
        triggerMatches['opportunist'] = buildTriggerMatch(lastCorrectPred.pred, lastCorrectPred.match)
        hasOpportunist = true
      }
      if (!hasNostradamus && exactScores >= 2 && lastExactPred) {
        trophiesToUnlock['nostradamus'] = meta.latestDate
        triggerMatches['nostradamus'] = buildTriggerMatch(lastExactPred.pred, lastExactPred.match)
        hasNostradamus = true
      }
      if (!hasCursed && myJourneyPredictions.length > 0 && correctResults === 0) {
        trophiesToUnlock['cursed'] = meta.latestDate
        const trigger = getLastMatchTrigger(key, userId)
        if (trigger) triggerMatches['cursed'] = trigger
        hasCursed = true
      }
    }

    // --- TROPHÉES TOURNOI COMPLET ---
    if (isTournamentFinished && totalCompletedJourneys === totalJourneys && totalJourneys >= 2) {
      const lastKey = `${tournament.ending_matchday}`
      const lastDate = journeyMeta[lastKey]?.latestDate || new Date().toISOString()

      // Ultra-dominator
      if (!existing.has('ultra_dominator') && firstPlaceCount === totalJourneys) {
        trophiesToUnlock['ultra_dominator'] = lastDate
        const trigger = getLastMatchTrigger(lastKey, userId)
        if (trigger) triggerMatches['ultra_dominator'] = trigger
      }

      // Poulidor
      if (!existing.has('poulidor') && firstPlaceCount === 0) {
        trophiesToUnlock['poulidor'] = lastDate
        const trigger = getLastMatchTrigger(lastKey, userId)
        if (trigger) triggerMatches['poulidor'] = trigger
      }
    }

    // --- TROPHÉES DE FIN DE TOURNOI ---
    if (isTournamentFinished) {
      let hasTournamentWinner = existing.has('tournament_winner')
      let hasLegend = existing.has('legend')
      let hasAbyssal = existing.has('abyssal')

      if (!hasTournamentWinner || !hasLegend || !hasAbyssal) {
        // Vérifier que toutes les journées sont terminées
        let allMatchesComplete = true
        for (let matchday = tournament.starting_matchday; matchday <= tournament.ending_matchday; matchday++) {
          if (!journeyRankings[`${matchday}`]) {
            allMatchesComplete = false
            break
          }
        }

        if (allMatchesComplete) {
          // Calculer les points totaux
          const totalPointsByUser: Record<string, number> = {}
          for (const uid of allParticipantIds) {
            totalPointsByUser[uid] = 0
          }

          for (let matchday = tournament.starting_matchday; matchday <= tournament.ending_matchday; matchday++) {
            const ranking = journeyRankings[`${matchday}`]
            if (!ranking) continue
            for (const [uid, pts] of Object.entries(ranking)) {
              totalPointsByUser[uid] = (totalPointsByUser[uid] || 0) + pts
            }
          }

          const sortedByPoints = Object.entries(totalPointsByUser)
            .sort(([, a], [, b]) => b - a)

          const [firstUserId, firstPoints] = sortedByPoints[0] || []
          const [, secondPoints] = sortedByPoints[1] || [null, -1]
          const [lastUserId, lastPoints] = sortedByPoints[sortedByPoints.length - 1] || []
          const [, secondLastPoints] = sortedByPoints[sortedByPoints.length - 2] || [null, Infinity]

          const lastKey = `${tournament.ending_matchday}`
          const latestDate = journeyMeta[lastKey]?.latestDate || new Date().toISOString()
          const lastTrigger = getLastMatchTrigger(lastKey, userId)

          // Tournament Winner
          if (!hasTournamentWinner && firstUserId === userId && firstPoints > secondPoints) {
            trophiesToUnlock['tournament_winner'] = latestDate
            if (lastTrigger) triggerMatches['tournament_winner'] = lastTrigger
          }

          // Legend
          if (!hasLegend && firstUserId === userId && firstPoints > secondPoints && allParticipantIds.length > 10) {
            trophiesToUnlock['legend'] = latestDate
            if (lastTrigger) triggerMatches['legend'] = lastTrigger
          }

          // Abyssal
          if (!hasAbyssal && lastUserId === userId && lastPoints < secondLastPoints && allParticipantIds.length > 1) {
            trophiesToUnlock['abyssal'] = latestDate
            if (lastTrigger) triggerMatches['abyssal'] = lastTrigger
          }
        }
      }
    }

    // Filtrer les trophées qui sont déjà existants (double sécurité)
    const newTrophies: string[] = []
    const trophyDates: Record<string, string> = {}
    const finalTriggerMatches: Record<string, TriggerMatchInfo> = {}
    for (const [type, date] of Object.entries(trophiesToUnlock)) {
      if (!existing.has(type)) {
        newTrophies.push(type)
        trophyDates[type] = date
        if (triggerMatches[type]) {
          finalTriggerMatches[type] = triggerMatches[type]
        }
      }
    }

    results.set(userId, { newTrophies, trophyDates, trophyTriggerMatches: finalTriggerMatches })
  }

  return results
}
