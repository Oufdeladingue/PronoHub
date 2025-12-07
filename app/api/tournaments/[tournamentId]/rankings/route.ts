import { createClient as createServerClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { calculatePoints, calculateRankings, type PlayerStats } from '@/lib/scoring'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  try {
    // Utiliser la clé service_role pour accéder à toutes les données
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { searchParams } = new URL(request.url)
    const matchday = searchParams.get('matchday')

    const { tournamentId } = await params

    // =====================================================
    // OPTIMISATION: Requêtes initiales en parallèle
    // Avant: 3 requêtes séquentielles
    // Après: 3 requêtes en parallèle
    // =====================================================
    const [tournamentResult, pointsSettingsResult, participantsResult] = await Promise.all([
      // 1. Récupérer le tournoi et ses paramètres
      supabase
        .from('tournaments')
        .select('*')
        .eq('id', tournamentId)
        .single(),

      // 2. Récupérer les paramètres de points depuis admin_settings
      supabase
        .from('admin_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['points_exact_score', 'points_correct_result', 'points_incorrect_result']),

      // 3. Récupérer tous les participants
      supabase
        .from('tournament_participants')
        .select('user_id, profiles(username, avatar)')
        .eq('tournament_id', tournamentId)
    ])

    const { data: tournament, error: tournamentError } = tournamentResult
    const { data: pointsSettingsData } = pointsSettingsResult
    const { data: participants, error: participantsError } = participantsResult

    if (tournamentError || !tournament) {
      return NextResponse.json({ error: 'Tournoi non trouvé' }, { status: 404 })
    }

    if (participantsError || !participants) {
      return NextResponse.json({ error: 'Erreur lors de la récupération des participants' }, { status: 500 })
    }

    // 3. Déterminer les journées à prendre en compte
    let startMatchday = tournament.starting_matchday
    let endMatchday = tournament.ending_matchday

    // Pour les tournois custom, récupérer les journées depuis la compétition custom
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
      return NextResponse.json({ error: 'Le tournoi n\'a pas de journées définies' }, { status: 400 })
    }

    // Si une journée spécifique est demandée, ne calculer que pour cette journée
    const matchdaysToCalculate = matchday
      ? [parseInt(matchday)]
      : Array.from({ length: endMatchday - startMatchday + 1 }, (_, i) => startMatchday + i)

    // IMPORTANT: Filtrer les matchs qui ont eu lieu avant la date de démarrage du tournoi
    const tournamentStartDate = tournament.start_date ? new Date(tournament.start_date) : null

    let finishedMatchesRaw: any[] = []
    let allMatchesRaw: any[] = []
    let matchesError: any = null
    let allMatchesError: any = null

    // Déterminer si c'est un tournoi custom ou standard
    const isCustomCompetition = !!tournament.custom_competition_id
    console.log('[Rankings API] Tournament type:', isCustomCompetition ? 'CUSTOM' : 'STANDARD')
    console.log('[Rankings API] custom_competition_id:', tournament.custom_competition_id)
    console.log('[Rankings API] matchdaysToCalculate:', matchdaysToCalculate)

    if (isCustomCompetition) {
      // 4a. TOURNOI CUSTOM - Récupérer les matchs via custom_competition_matches
      // D'abord récupérer les matchdays correspondants
      const { data: matchdaysData } = await supabase
        .from('custom_competition_matchdays')
        .select('id, matchday_number')
        .eq('custom_competition_id', tournament.custom_competition_id)
        .in('matchday_number', matchdaysToCalculate)

      console.log('[Rankings API] matchdaysData:', matchdaysData)
      if (matchdaysData && matchdaysData.length > 0) {
        const matchdayIds = matchdaysData.map(md => md.id)
        const matchdayNumberMap: Record<string, number> = {}
        matchdaysData.forEach(md => { matchdayNumberMap[md.id] = md.matchday_number })
        console.log('[Rankings API] matchdayIds:', matchdayIds)

        // Récupérer les matchs custom
        const { data: customMatches, error: customMatchesError } = await supabase
          .from('custom_competition_matches')
          .select('id, custom_matchday_id, football_data_match_id, cached_utc_date')
          .in('custom_matchday_id', matchdayIds)

        console.log('[Rankings API] customMatches:', customMatches?.length, 'error:', customMatchesError)
        if (customMatchesError) {
          matchesError = customMatchesError
        } else if (customMatches) {
          // Récupérer les football_data_match_id pour chercher les scores dans imported_matches
          const footballDataIds = customMatches
            .map(m => m.football_data_match_id)
            .filter(id => id !== null)

          // Récupérer les scores depuis imported_matches via football_data_match_id
          // IMPORTANT: On récupère aussi l'id de imported_matches car c'est lui qui est utilisé
          // dans la table predictions (contrainte FK)
          const { data: importedMatches } = await supabase
            .from('imported_matches')
            .select('id, football_data_match_id, home_score, away_score, status, utc_date')
            .in('football_data_match_id', footballDataIds)

          const importedMatchesMap: Record<number, any> = {}
          importedMatches?.forEach(im => {
            importedMatchesMap[im.football_data_match_id] = im
          })

          // Transformer les matchs custom en format attendu
          // IMPORTANT: Utiliser l'ID de imported_matches (im.id) car c'est celui-ci
          // qui est utilisé dans la table predictions
          finishedMatchesRaw = customMatches
            .map(cm => {
              const im = importedMatchesMap[cm.football_data_match_id]
              return {
                // Utiliser l'ID de imported_matches pour matcher avec predictions
                id: im?.id || cm.id,
                matchday: matchdayNumberMap[cm.custom_matchday_id],
                utc_date: im?.utc_date || cm.cached_utc_date,
                home_score: im?.home_score ?? null,
                away_score: im?.away_score ?? null,
                status: im?.status || 'SCHEDULED'
              }
            })
            .filter(m => m.home_score !== null && m.away_score !== null)

          // Tous les matchs disponibles (pour calculer le total)
          allMatchesRaw = customMatches.map(cm => {
            const im = importedMatchesMap[cm.football_data_match_id]
            return {
              // Utiliser l'ID de imported_matches
              id: im?.id || cm.id,
              matchday: matchdayNumberMap[cm.custom_matchday_id],
              utc_date: im?.utc_date || cm.cached_utc_date
            }
          })
        }
      }
    } else {
      // 4b. TOURNOI STANDARD - Récupérer les matchs depuis imported_matches
      const { data: matchesData, error: mError } = await supabase
        .from('imported_matches')
        .select('*')
        .eq('competition_id', tournament.competition_id)
        .in('matchday', matchdaysToCalculate)
        .not('home_score', 'is', null)
        .not('away_score', 'is', null)

      matchesError = mError
      finishedMatchesRaw = matchesData || []

      // 5b. Récupérer tous les matchs disponibles
      const { data: allData, error: aError } = await supabase
        .from('imported_matches')
        .select('id, matchday, utc_date')
        .eq('competition_id', tournament.competition_id)
        .in('matchday', matchdaysToCalculate)

      allMatchesError = aError
      allMatchesRaw = allData || []
    }

    if (matchesError) {
      console.error('[Rankings] Erreur matchs:', matchesError)
      return NextResponse.json({ error: 'Erreur lors de la récupération des matchs' }, { status: 500 })
    }

    if (allMatchesError) {
      console.error('[Rankings] Erreur tous matchs:', allMatchesError)
      return NextResponse.json({ error: 'Erreur lors de la récupération des matchs disponibles' }, { status: 500 })
    }

    // Filtrer les matchs qui ont eu lieu AVANT la date de démarrage du tournoi
    // Ces matchs ne doivent pas compter (les joueurs n'ont pas pu pronostiquer)
    const finishedMatches = tournamentStartDate
      ? finishedMatchesRaw?.filter(m => {
          const matchDate = new Date(m.utc_date)
          return matchDate >= tournamentStartDate
        })
      : finishedMatchesRaw

    // Détecter s'il y a des matchs en cours
    const hasInProgressMatches = finishedMatches?.some(m =>
      m.status === 'IN_PLAY' || m.status === 'PAUSED'
    ) || false

    // Filtrer les matchs disponibles par date de démarrage du tournoi
    const allMatches = tournamentStartDate
      ? allMatchesRaw?.filter(m => {
          const matchDate = new Date(m.utc_date)
          return matchDate >= tournamentStartDate
        })
      : allMatchesRaw

    // 6. Récupérer les matchs bonus pour ce tournoi
    const { data: bonusMatches } = await supabase
      .from('tournament_bonus_matches')
      .select('match_id, matchday')
      .eq('tournament_id', tournamentId)
      .in('matchday', matchdaysToCalculate)

    const bonusMatchIds = new Set(bonusMatches?.map(bm => bm.match_id) || [])

    // 7. Récupérer les barèmes de points
    const exactScoreSetting = pointsSettingsData?.find(s => s.setting_key === 'points_exact_score')
    const correctResultSetting = pointsSettingsData?.find(s => s.setting_key === 'points_correct_result')
    const incorrectResultSetting = pointsSettingsData?.find(s => s.setting_key === 'points_incorrect_result')

    const pointsSettings = {
      exactScore: parseInt(exactScoreSetting?.setting_value || '3'),
      correctResult: parseInt(correctResultSetting?.setting_value || '1'),
      incorrectResult: parseInt(incorrectResultSetting?.setting_value || '0'),
      drawWithDefaultPrediction: tournament.scoring_draw_with_default_prediction || 1
    }

    // 8. Préparer les données pour le bonus "Prime d'avant-match"
    // Créer une map: journée -> premier match (date la plus tôt)
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

    // =====================================================
    // OPTIMISATION: Récupérer TOUTES les prédictions en une seule requête
    // Avant: N requêtes (une par participant)
    // Après: 1 seule requête pour tous les participants
    // =====================================================
    const allMatchIds = allMatches?.map(m => m.id) || []
    const matchIdsToQuery = allMatchIds.length > 0 ? allMatchIds : (finishedMatches?.map(m => m.id) || [])

    const { data: allPredictionsData } = await supabase
      .from('predictions')
      .select('user_id, match_id, predicted_home_score, predicted_away_score, is_default_prediction, created_at')
      .eq('tournament_id', tournamentId)
      .in('match_id', matchIdsToQuery.length > 0 ? matchIdsToQuery : ['00000000-0000-0000-0000-000000000000'])

    // Créer une Map des prédictions par utilisateur pour un accès O(1)
    const predictionsByUser = new Map<string, any[]>()
    for (const pred of (allPredictionsData || [])) {
      if (!predictionsByUser.has(pred.user_id)) {
        predictionsByUser.set(pred.user_id, [])
      }
      predictionsByUser.get(pred.user_id)!.push(pred)
    }

    // 9. Calculer les statistiques pour chaque joueur (sans requête supplémentaire)
    const playerStatsMap = new Map<string, Omit<PlayerStats, 'rank' | 'rankChange'>>()

    for (const participant of participants) {
      const userId = participant.user_id
      const username = (participant.profiles as any)?.username || 'Inconnu'
      const avatar = (participant.profiles as any)?.avatar || 'avatar1'

      // Récupérer les pronostics de ce joueur depuis la Map (pas de requête DB)
      const predictions = predictionsByUser.get(userId) || []

      // Créer une Map des pronostics existants pour un accès rapide
      const predictionsMap = new Map(predictions.map(p => [p.match_id, p]))

      // Créer des pronostics par défaut 0-0 pour les matchs où l'utilisateur n'a pas pronostiqué
      const allPredictions = (finishedMatches || []).map(match => {
        const existingPred = predictionsMap.get(match.id)
        if (existingPred) {
          return existingPred
        }
        // Créer un pronostic par défaut 0-0 pour ce match
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

      // Calculer les points pour chaque pronostic (y compris les par défaut)
      if (allPredictions && finishedMatches) {
        for (const prediction of allPredictions) {
          const match = finishedMatches.find(m => m.id === prediction.match_id)
          if (!match || match.home_score === null || match.away_score === null) continue

          // Vérifier si c'est un pronostic valide
          const isValidPrediction = prediction.predicted_home_score !== null &&
                                   prediction.predicted_away_score !== null

          if (!isValidPrediction) continue

          const isBonusMatch = bonusMatchIds.has(match.id)
          const isDefaultPrediction = prediction.is_default_prediction || false

          // Calculer les points avec la fonction dédiée
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

          const points = result.points
          const isExactScore = result.isExactScore
          const isCorrectResult = result.isCorrectResult

          // Incrémenter les stats uniquement pour les pronostics non par défaut
          if (!isDefaultPrediction) {
            matchesPlayed++
            if (isExactScore) exactScores++
            if (isCorrectResult) correctResults++
          }

          totalPoints += points
        }
      }

      // Calculer le bonus "Prime d'avant-match" si activé
      // Le joueur gagne +1 point par journée s'il a fait TOUS ses pronostics avant le premier match
      let earlyPredictionBonusPoints = 0
      if (tournament.early_prediction_bonus && predictions.length > 0) {
        // Créer une map des pronostics par match_id avec leur created_at
        const predictionsByMatch: Record<string, Date | null> = {}
        for (const pred of predictions) {
          if (!pred.is_default_prediction && pred.created_at) {
            predictionsByMatch[pred.match_id] = new Date(pred.created_at)
          }
        }

        // Pour chaque journée avec des matchs terminés, vérifier si tous les pronos ont été faits à temps
        for (const md of matchdaysToCalculate) {
          const matchIdsForDay = matchIdsByMatchday[md] || []
          const firstMatchTime = firstMatchByMatchday[md]

          if (!firstMatchTime || matchIdsForDay.length === 0) continue

          // Filtrer les matchs terminés de cette journée
          const finishedMatchIdsForDay = matchIdsForDay.filter(mId =>
            finishedMatches?.some(fm => fm.id === mId)
          )

          if (finishedMatchIdsForDay.length === 0) continue

          // Vérifier si TOUS les pronostics de cette journée ont été faits avant le premier match
          let allPredictionsOnTime = true
          for (const matchId of finishedMatchIdsForDay) {
            const predCreatedAt = predictionsByMatch[matchId]
            // Si pas de pronostic (sera default) ou pronostic fait après le premier match
            if (!predCreatedAt || predCreatedAt >= firstMatchTime) {
              allPredictionsOnTime = false
              break
            }
          }

          if (allPredictionsOnTime) {
            earlyPredictionBonusPoints += 1
          }
        }

        totalPoints += earlyPredictionBonusPoints
      }

      playerStatsMap.set(userId, {
        playerId: userId,
        playerName: username,
        avatar,
        totalPoints,
        exactScores,
        correctResults,
        matchesPlayed,
        matchesAvailable: finishedMatches?.length || 0,
        earlyPredictionBonus: earlyPredictionBonusPoints
      } as any)
    }

    // 10. Calculer les rangs
    const playersArray = Array.from(playerStatsMap.values())

    // Si on demande le classement général, calculer aussi le classement de la journée précédente
    let previousRankings: PlayerStats[] | undefined
    if (!matchday && startMatchday < endMatchday) {
      // Récupérer le classement à la journée précédente (dernière journée terminée)
      // Pour simplifier, on suppose que c'est la journée endMatchday - 1
      // Dans une vraie implémentation, il faudrait vérifier quelle est la dernière journée terminée
    }

    const rankings = calculateRankings(playersArray, previousRankings)

    return NextResponse.json({
      rankings,
      matchday: matchday ? parseInt(matchday) : null,
      pointsSettings,
      matchesFinished: finishedMatches?.length || 0,
      matchesTotal: allMatches?.length || 0,
      hasInProgressMatches
    })

  } catch (error: any) {
    console.error('[Rankings API] Erreur lors du calcul du classement:', error)
    console.error('[Rankings API] Stack:', error.stack)
    return NextResponse.json(
      { error: 'Erreur serveur', details: error.message },
      { status: 500 }
    )
  }
}
