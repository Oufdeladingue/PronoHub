import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET - Lecture simple des trophées depuis la BDD (rapide)
export async function GET(request: Request) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Non authentifié' },
        { status: 401 }
      )
    }

    // Récupérer simplement les trophées stockés en BDD
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

// PUT - Recalcul complet des trophées (OPTIMISÉ)
export async function PUT(request: Request) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Non authentifié' },
        { status: 401 }
      )
    }

    // ============================================
    // ÉTAPE 1 : Charger TOUTES les données en parallèle (4 requêtes)
    // ============================================

    const [
      tournamentsResult,
      predictionsResult,
      existingTrophiesResult,
      bonusMatchesResult
    ] = await Promise.all([
      // Tous les tournois de l'utilisateur avec détails
      supabase
        .from('tournament_participants')
        .select(`
          tournament_id,
          user_id,
          total_points,
          tournaments!inner(
            id, status, starting_matchday, ending_matchday, competition_id
          )
        `)
        .eq('user_id', user.id),

      // Tous les pronostics avec matchs (jointure)
      supabase
        .from('predictions')
        .select(`
          id, user_id, predicted_home_score, predicted_away_score,
          match_id, points_earned, tournament_id,
          imported_matches!inner(
            id, home_score, away_score, status, finished, matchday, utc_date, competition_id
          )
        `)
        .eq('user_id', user.id),

      // Trophées existants de l'utilisateur
      supabase
        .from('user_trophies')
        .select('trophy_type')
        .eq('user_id', user.id),

      // Matchs bonus pour tous les tournois (sera filtré après)
      supabase
        .from('tournament_bonus_matches')
        .select('tournament_id, match_id')
    ])

    const userTournaments = tournamentsResult.data || []
    const userPredictions = predictionsResult.data || []
    const existingTrophyTypes = new Set((existingTrophiesResult.data || []).map(t => t.trophy_type))
    const allBonusMatches = bonusMatchesResult.data || []

    // Si pas de tournois, retourner les trophées existants
    if (userTournaments.length === 0) {
      const { data: userTrophies } = await supabase
        .from('user_trophies')
        .select('*')
        .eq('user_id', user.id)
        .order('unlocked_at', { ascending: false })

      return NextResponse.json({
        success: true,
        trophies: userTrophies || [],
        hasNewTrophies: false,
        newTrophiesUnlocked: 0
      })
    }

    // ============================================
    // ÉTAPE 2 : Charger les données des autres participants (1 requête batch)
    // ============================================

    const tournamentIds = userTournaments.map(t => t.tournament_id)

    // Charger TOUS les pronostics de TOUS les participants de ces tournois
    const { data: allPredictions } = await supabase
      .from('predictions')
      .select(`
        user_id, points_earned, tournament_id, match_id,
        imported_matches!inner(
          id, matchday, status, finished, home_score, away_score, utc_date, competition_id
        )
      `)
      .in('tournament_id', tournamentIds)

    // Charger tous les participants de ces tournois
    const { data: allParticipants } = await supabase
      .from('tournament_participants')
      .select('tournament_id, user_id, total_points')
      .in('tournament_id', tournamentIds)

    // ============================================
    // ÉTAPE 3 : Préparer les structures de données
    // ============================================

    // Map des matchs bonus par tournament_id
    const bonusMatchIds = new Set<string>()
    const tournamentIdSet = new Set(tournamentIds)
    allBonusMatches.forEach(bm => {
      if (tournamentIdSet.has(bm.tournament_id)) {
        bonusMatchIds.add(bm.match_id)
      }
    })

    // Map des tournois avec leurs infos
    const tournamentsMap: Record<string, any> = {}
    userTournaments.forEach(t => {
      tournamentsMap[t.tournament_id] = t.tournaments
    })

    // Grouper les participants par tournoi
    const participantsByTournament: Record<string, any[]> = {}
    allParticipants?.forEach(p => {
      if (!participantsByTournament[p.tournament_id]) {
        participantsByTournament[p.tournament_id] = []
      }
      participantsByTournament[p.tournament_id].push(p)
    })

    // Grouper les pronostics par tournoi/journée
    const predictionsByJourney: Record<string, any[]> = {}
    const matchesByJourney: Record<string, any[]> = {}

    allPredictions?.forEach(pred => {
      // imported_matches peut être un tableau ou un objet selon Supabase
      const matchData = pred.imported_matches
      const match = Array.isArray(matchData) ? matchData[0] : matchData
      if (!match) return

      const key = `${pred.tournament_id}_${match.matchday}`

      if (!predictionsByJourney[key]) {
        predictionsByJourney[key] = []
        matchesByJourney[key] = []
      }

      predictionsByJourney[key].push(pred)

      // Ajouter le match s'il n'existe pas déjà
      if (!matchesByJourney[key].some(m => m.id === match.id)) {
        matchesByJourney[key].push(match)
      }
    })

    // ============================================
    // ÉTAPE 4 : Calculer tous les trophées localement
    // ============================================

    const trophiesToUnlock: Record<string, string> = {} // type -> unlocked_at

    // Helper pour vérifier si une journée est terminée
    const isJourneyComplete = (matches: any[]) => {
      return matches.length > 0 && matches.every(m =>
        (m.status === 'FINISHED' || m.finished === true) &&
        m.home_score !== null &&
        m.away_score !== null
      )
    }

    // Helper pour calculer le classement d'une journée
    const getJourneyRanking = (predictions: any[], participants: any[]) => {
      const userPoints: Record<string, number> = {}

      // Initialiser tous les participants à 0
      participants.forEach(p => {
        userPoints[p.user_id] = 0
      })

      // Ajouter les points des pronostics
      predictions.forEach(pred => {
        if (userPoints[pred.user_id] !== undefined) {
          userPoints[pred.user_id] += pred.points_earned || 0
        }
      })

      return userPoints
    }

    // Helper pour trouver la date la plus récente
    const getLatestDate = (matches: any[]) => {
      return matches.reduce((latest, m) => {
        if (!latest || (m.utc_date && m.utc_date > latest)) return m.utc_date
        return latest
      }, null) || new Date().toISOString()
    }

    // --- TROPHÉE: correct_result & exact_score ---
    let hasCorrectResult = false
    let hasExactScore = false
    let correctResultDate = ''
    let exactScoreDate = ''

    userPredictions.forEach(pred => {
      const matchData = pred.imported_matches
      const match = Array.isArray(matchData) ? matchData[0] : matchData
      if (!match || (match.status !== 'FINISHED' && match.finished !== true)) return
      if (match.home_score === null || match.away_score === null) return

      const isExact = pred.predicted_home_score === match.home_score &&
                      pred.predicted_away_score === match.away_score

      if (isExact && !hasExactScore) {
        hasExactScore = true
        exactScoreDate = match.utc_date
      }

      const predResult = pred.predicted_home_score > pred.predicted_away_score ? 'HOME' :
                        pred.predicted_home_score < pred.predicted_away_score ? 'AWAY' : 'DRAW'
      const actualResult = match.home_score > match.away_score ? 'HOME' :
                          match.home_score < match.away_score ? 'AWAY' : 'DRAW'

      if (predResult === actualResult && !hasCorrectResult) {
        hasCorrectResult = true
        correctResultDate = match.utc_date
      }
    })

    if (hasCorrectResult && !existingTrophyTypes.has('correct_result')) {
      trophiesToUnlock['correct_result'] = correctResultDate
    }
    if (hasExactScore && !existingTrophyTypes.has('exact_score')) {
      trophiesToUnlock['exact_score'] = exactScoreDate
    }

    // --- TROPHÉES PAR JOURNÉE: king_of_day, double_king, opportunist, nostradamus, bonus ---
    let hasKingOfDay = existingTrophyTypes.has('king_of_day')
    let hasDoubleKing = existingTrophyTypes.has('double_king')
    let hasOpportunist = existingTrophyTypes.has('opportunist')
    let hasNostradamus = existingTrophyTypes.has('nostradamus')
    let hasBonusProfiteer = existingTrophyTypes.has('bonus_profiteer')
    let hasBonusOptimizer = existingTrophyTypes.has('bonus_optimizer')

    for (const tournamentId of tournamentIds) {
      const tournament = tournamentsMap[tournamentId]
      if (!tournament?.starting_matchday || !tournament?.ending_matchday) continue

      const participants = participantsByTournament[tournamentId] || []
      if (participants.length === 0) continue

      let consecutiveWins = 0

      for (let matchday = tournament.starting_matchday; matchday <= tournament.ending_matchday; matchday++) {
        const key = `${tournamentId}_${matchday}`
        const journeyPredictions = predictionsByJourney[key] || []
        const journeyMatches = matchesByJourney[key] || []

        if (!isJourneyComplete(journeyMatches)) {
          consecutiveWins = 0
          continue
        }

        const userPoints = getJourneyRanking(journeyPredictions, participants)
        const maxPoints = Math.max(...Object.values(userPoints))
        const myPoints = userPoints[user.id] || 0
        const latestDate = getLatestDate(journeyMatches)

        // Vérifier si l'utilisateur est premier
        const isFirst = myPoints === maxPoints
        const usersWithMax = Object.values(userPoints).filter(pts => pts === maxPoints).length
        const isSoleLeader = isFirst && (maxPoints > 0 || usersWithMax === 1)

        // King of Day
        if (!hasKingOfDay && isSoleLeader) {
          trophiesToUnlock['king_of_day'] = latestDate
          hasKingOfDay = true
        }

        // Double King
        if (isSoleLeader) {
          consecutiveWins++
          if (!hasDoubleKing && consecutiveWins >= 2) {
            trophiesToUnlock['double_king'] = latestDate
            hasDoubleKing = true
          }
        } else {
          consecutiveWins = 0
        }

        // Opportunist & Nostradamus & Bonus (analyser les pronostics de l'utilisateur pour cette journée)
        const myJourneyPredictions = journeyPredictions.filter(p => p.user_id === user.id)
        let correctResults = 0
        let exactScores = 0

        myJourneyPredictions.forEach(pred => {
          const matchData = pred.imported_matches
          const match = Array.isArray(matchData) ? matchData[0] : matchData
          if (!match) return

          const predResult = pred.predicted_home_score > pred.predicted_away_score ? 'HOME' :
                            pred.predicted_home_score < pred.predicted_away_score ? 'AWAY' : 'DRAW'
          const actualResult = match.home_score > match.away_score ? 'HOME' :
                              match.home_score < match.away_score ? 'AWAY' : 'DRAW'

          const isExact = pred.predicted_home_score === match.home_score &&
                          pred.predicted_away_score === match.away_score
          const isCorrect = predResult === actualResult

          if (isExact) exactScores++
          if (isCorrect) correctResults++

          // Bonus trophies
          if (bonusMatchIds.has(pred.match_id)) {
            if (isCorrect && !hasBonusProfiteer) {
              trophiesToUnlock['bonus_profiteer'] = match.utc_date
              hasBonusProfiteer = true
            }
            if (isExact && !hasBonusOptimizer) {
              trophiesToUnlock['bonus_optimizer'] = match.utc_date
              hasBonusOptimizer = true
            }
          }
        })

        if (!hasOpportunist && correctResults >= 2) {
          trophiesToUnlock['opportunist'] = latestDate
          hasOpportunist = true
        }
        if (!hasNostradamus && exactScores >= 2) {
          trophiesToUnlock['nostradamus'] = latestDate
          hasNostradamus = true
        }
      }
    }

    // --- TROPHÉE: tournament_winner ---
    if (!existingTrophyTypes.has('tournament_winner')) {
      const finishedTournaments = userTournaments.filter(t => t.tournaments.status === 'finished')

      for (const t of finishedTournaments) {
        const tournament = t.tournaments
        const participants = participantsByTournament[t.tournament_id] || []
        if (participants.length === 0) continue

        // Vérifier que tous les matchs du tournoi sont terminés
        let allMatchesComplete = true
        for (let matchday = tournament.starting_matchday; matchday <= tournament.ending_matchday; matchday++) {
          const key = `${t.tournament_id}_${matchday}`
          const journeyMatches = matchesByJourney[key] || []
          if (!isJourneyComplete(journeyMatches)) {
            allMatchesComplete = false
            break
          }
        }

        if (!allMatchesComplete) continue

        // Vérifier si l'utilisateur est premier
        const sortedParticipants = [...participants].sort((a, b) => b.total_points - a.total_points)
        if (sortedParticipants[0]?.user_id === user.id) {
          // Pas d'égalité avec le 2ème
          if (sortedParticipants.length === 1 ||
              sortedParticipants[0].total_points !== sortedParticipants[1].total_points) {
            // Trouver la date du dernier match
            const lastKey = `${t.tournament_id}_${tournament.ending_matchday}`
            const lastMatches = matchesByJourney[lastKey] || []
            trophiesToUnlock['tournament_winner'] = getLatestDate(lastMatches)
            break
          }
        }
      }
    }

    // ============================================
    // ÉTAPE 5 : Insérer les nouveaux trophées (1 requête batch)
    // ============================================

    const trophyTypes = Object.keys(trophiesToUnlock)
    let newTrophiesCount = 0

    if (trophyTypes.length > 0) {
      const trophiesToInsert = trophyTypes.map(type => ({
        user_id: user.id,
        trophy_type: type,
        unlocked_at: trophiesToUnlock[type],
        is_new: true
      }))

      const { error: insertError } = await supabase
        .from('user_trophies')
        .upsert(trophiesToInsert, {
          onConflict: 'user_id,trophy_type',
          ignoreDuplicates: true
        })

      if (!insertError) {
        newTrophiesCount = trophyTypes.length
      }
    }

    // ============================================
    // ÉTAPE 6 : Retourner les trophées
    // ============================================

    const { data: userTrophies } = await supabase
      .from('user_trophies')
      .select('*')
      .eq('user_id', user.id)
      .order('unlocked_at', { ascending: false })

    const hasNewTrophies = userTrophies?.some(t => t.is_new) || false

    return NextResponse.json({
      success: true,
      trophies: userTrophies || [],
      hasNewTrophies,
      newTrophiesUnlocked: newTrophiesCount
    })

  } catch (error: any) {
    console.error('Error recalculating user trophies:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}

// POST - Marquer les trophées comme vus
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
