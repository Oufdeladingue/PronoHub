import { createClient as createServerClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { calculatePoints, calculateKnockoutPoints, getWinnerSide, calculateRankings, type PlayerStats } from '@/lib/scoring'
import { isKnockoutStage, type StageType } from '@/lib/stage-formatter'

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

    // Tournoi en attente → pas de calcul de points
    if (tournament.status === 'pending') {
      const emptyRankings = participants.map((p: any) => ({
        playerId: p.user_id,
        playerName: (p.profiles as any)?.username || 'Inconnu',
        avatar: (p.profiles as any)?.avatar || 'avatar1',
        totalPoints: 0,
        exactScores: 0,
        correctResults: 0,
        matchesPlayed: 0,
        matchesAvailable: 0,
        rank: null,
        predictionsCount: 0,
      }))
      return NextResponse.json({
        rankings: emptyRankings,
        matchdays: [],
        totalMatches: 0,
        finishedMatches: 0,
      })
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
    if (isCustomCompetition) {
      // 4a. TOURNOI CUSTOM - Récupérer les matchs via custom_competition_matches
      // D'abord récupérer les matchdays correspondants
      const { data: matchdaysData } = await supabase
        .from('custom_competition_matchdays')
        .select('id, matchday_number')
        .eq('custom_competition_id', tournament.custom_competition_id)
        .in('matchday_number', matchdaysToCalculate)

      if (matchdaysData && matchdaysData.length > 0) {
        const matchdayIds = matchdaysData.map(md => md.id)
        const matchdayNumberMap: Record<string, number> = {}
        matchdaysData.forEach(md => { matchdayNumberMap[md.id] = md.matchday_number })
        // Récupérer les matchs custom
        const { data: customMatches, error: customMatchesError } = await supabase
          .from('custom_competition_matches')
          .select('id, custom_matchday_id, football_data_match_id, cached_utc_date')
          .in('custom_matchday_id', matchdayIds)

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
            .select('id, football_data_match_id, home_score, away_score, home_score_90, away_score_90, winner_team_id, home_team_id, away_team_id, stage, status, utc_date')
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
                home_score_90: im?.home_score_90 ?? null,
                away_score_90: im?.away_score_90 ?? null,
                winner_team_id: im?.winner_team_id ?? null,
                home_team_id: im?.home_team_id ?? null,
                away_team_id: im?.away_team_id ?? null,
                stage: im?.stage ?? null,
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
      // Pour les compétitions knockout, les matchdays dans imported_matches sont 1-2 par stage
      // mais le tournoi utilise des virtual matchdays (ex: PLAYOFFS=9-10, LAST_16=11-12, etc.)
      const KNOCKOUT_STAGES_RANK = ['PLAYOFFS', 'LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'FINAL']
      const { data: knockoutCheck } = await supabase
        .from('imported_matches')
        .select('id')
        .eq('competition_id', tournament.competition_id)
        .in('stage', KNOCKOUT_STAGES_RANK)
        .limit(1)

      const hasKnockoutRank = knockoutCheck && knockoutCheck.length > 0

      if (hasKnockoutRank) {
        // Compétition avec knockout : charger tous les matchs et assigner les virtual matchdays
        const STAGE_ORDER: Record<string, number> = {
          'LEAGUE_STAGE': 0,
          'PLAYOFFS': 8,
          'LAST_16': 10,
          'QUARTER_FINALS': 12,
          'SEMI_FINALS': 14,
          'FINAL': 16
        }

        const [leagueResult, knockoutResult] = await Promise.all([
          supabase
            .from('imported_matches')
            .select('*')
            .eq('competition_id', tournament.competition_id)
            .not('stage', 'in', `(${KNOCKOUT_STAGES_RANK.map(s => `"${s}"`).join(',')})`)
            .gte('matchday', startMatchday)
            .lte('matchday', endMatchday),
          supabase
            .from('imported_matches')
            .select('*')
            .eq('competition_id', tournament.competition_id)
            .in('stage', KNOCKOUT_STAGES_RANK)
        ])

        const allCompMatches = [
          ...(leagueResult.data || []).map((m: any) => ({ ...m, matchday: m.matchday })),
          ...(knockoutResult.data || []).map((m: any) => ({
            ...m,
            matchday: (STAGE_ORDER[m.stage] || 8) + (m.matchday || 1)
          }))
        ]

        // Filtrer par virtual matchday range du tournoi
        const matchesInRange = allCompMatches.filter((m: any) => matchdaysToCalculate.includes(m.matchday))
        finishedMatchesRaw = matchesInRange.filter((m: any) => m.home_score !== null && m.away_score !== null)
        allMatchesRaw = matchesInRange.map((m: any) => ({ id: m.id, matchday: m.matchday, utc_date: m.utc_date }))
      } else {
        // Compétition classique (ligue): filtre par matchday standard
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

    // OPTIMISATION: Créer une Map pour accès O(1) au lieu de find() O(n)
    const finishedMatchesMap = new Map(
      (finishedMatches || []).map(m => [m.id, m])
    )

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
      .select('user_id, match_id, predicted_home_score, predicted_away_score, is_default_prediction, predicted_qualifier, created_at')
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
          // OPTIMISATION: Utiliser Map O(1) au lieu de find() O(n)
          const match = finishedMatchesMap.get(prediction.match_id)
          if (!match || match.home_score === null || match.away_score === null) continue

          // Vérifier si c'est un pronostic valide
          const isValidPrediction = prediction.predicted_home_score !== null &&
                                   prediction.predicted_away_score !== null

          if (!isValidPrediction) continue

          const isBonusMatch = bonusMatchIds.has(match.id)
          const isDefaultPrediction = prediction.is_default_prediction || false
          const isKnockout = match.stage && isKnockoutStage(match.stage as StageType)

          let points: number
          let isExactScore: boolean
          let isCorrectResult: boolean

          if (isKnockout && tournament.bonus_qualified) {
            // Match éliminatoire avec bonus qualifié activé
            const score90Home = match.home_score_90 != null ? match.home_score_90 : match.home_score
            const score90Away = match.away_score_90 != null ? match.away_score_90 : match.away_score
            const actualWinnerSide = getWinnerSide(match.winner_team_id, match.home_team_id, match.away_team_id)

            const result = calculateKnockoutPoints(
              {
                predictedHomeScore: prediction.predicted_home_score,
                predictedAwayScore: prediction.predicted_away_score
              },
              { homeScore: score90Home, awayScore: score90Away },
              prediction.predicted_qualifier || null,
              actualWinnerSide,
              pointsSettings,
              isBonusMatch,
              isDefaultPrediction,
              true // bonusQualifiedEnabled
            )
            points = result.points
            isExactScore = result.isExactScore
            isCorrectResult = result.isCorrectResult
          } else if (isKnockout) {
            // Match éliminatoire sans bonus qualifié — utiliser le score 90min quand même
            const score90Home = match.home_score_90 != null ? match.home_score_90 : match.home_score
            const score90Away = match.away_score_90 != null ? match.away_score_90 : match.away_score

            const result = calculatePoints(
              {
                predictedHomeScore: prediction.predicted_home_score,
                predictedAwayScore: prediction.predicted_away_score
              },
              { homeScore: score90Home, awayScore: score90Away },
              pointsSettings,
              isBonusMatch,
              isDefaultPrediction
            )
            points = result.points
            isExactScore = result.isExactScore
            isCorrectResult = result.isCorrectResult
          } else {
            // Match classique (ligue) — calcul standard
            const result = calculatePoints(
              {
                predictedHomeScore: prediction.predicted_home_score,
                predictedAwayScore: prediction.predicted_away_score
              },
              { homeScore: match.home_score, awayScore: match.away_score },
              pointsSettings,
              isBonusMatch,
              isDefaultPrediction
            )
            points = result.points
            isExactScore = result.isExactScore
            isCorrectResult = result.isCorrectResult
          }

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
      // Le joueur gagne +1 point par journée si TOUS les matchs sont terminés ET aucun pronostic par défaut
      let earlyPredictionBonusPoints = 0
      if (tournament.early_prediction_bonus && predictions.length > 0) {
        // Pour chaque journée, vérifier si tous les matchs sont terminés et aucun pronostic par défaut
        for (const md of matchdaysToCalculate) {
          const matchIdsForDay = matchIdsByMatchday[md] || []

          if (matchIdsForDay.length === 0) continue

          // Vérifier si TOUS les matchs de la journée sont terminés
          const allMatchesFinished = matchIdsForDay.every(mId => finishedMatchesMap.has(mId))

          if (!allMatchesFinished) continue

          // Vérifier si l'utilisateur a des pronostics par défaut pour cette journée
          let hasDefaultPrediction = false
          for (const matchId of matchIdsForDay) {
            const pred = predictions.find(p => p.match_id === matchId)
            if (!pred || pred.is_default_prediction) {
              hasDefaultPrediction = true
              break
            }
          }

          // Attribuer le bonus uniquement si aucun pronostic par défaut
          if (!hasDefaultPrediction) {
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
    if (!matchday) {
      // Trouver la dernière journée terminée (tous les matchs terminés)
      const journeysFinished: number[] = []
      for (const md of matchdaysToCalculate) {
        const matchesForDay = (allMatches || []).filter(m => m.matchday === md)
        const allFinished = matchesForDay.length > 0 && matchesForDay.every(m =>
          finishedMatchesMap.has(m.id)
        )
        if (allFinished) {
          journeysFinished.push(md)
        }
      }

      // S'il y a au moins 2 journées terminées, calculer le classement de l'avant-dernière
      if (journeysFinished.length >= 2) {
        const previousMatchday = journeysFinished[journeysFinished.length - 2]

        // Récupérer les matchs terminés jusqu'à la journée précédente (incluse)
        const previousFinishedMatches = (finishedMatches || []).filter(m =>
          m.matchday <= previousMatchday
        )

        // Créer une map pour un accès rapide
        const prevFinishedMatchesMap = new Map(previousFinishedMatches.map(m => [m.id, m]))

        // Recalculer les stats pour chaque joueur jusqu'à la journée précédente
        const previousPlayerStats = new Map<string, Omit<PlayerStats, 'rank' | 'rankChange'>>()

        for (const participant of participants) {
          const userId = participant.user_id
          const username = (participant.profiles as any)?.username || 'Inconnu'
          const avatar = (participant.profiles as any)?.avatar || 'avatar1'

          const predictions = predictionsByUser.get(userId) || []
          const predictionsMap = new Map(predictions.map(p => [p.match_id, p]))

          const allPrevPredictions = previousFinishedMatches.map(match => {
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

          let totalPoints = 0
          let exactScores = 0
          let correctResults = 0
          let matchesPlayed = 0

          for (const prediction of allPrevPredictions) {
            const match = prevFinishedMatchesMap.get(prediction.match_id)
            if (!match || match.home_score === null || match.away_score === null) continue

            const isValidPrediction = prediction.predicted_home_score !== null &&
                                     prediction.predicted_away_score !== null
            if (!isValidPrediction) continue

            const isBonusMatch = bonusMatchIds.has(match.id)
            const isDefaultPrediction = prediction.is_default_prediction || false

            const result = calculatePoints(
              { predictedHomeScore: prediction.predicted_home_score, predictedAwayScore: prediction.predicted_away_score },
              { homeScore: match.home_score, awayScore: match.away_score },
              pointsSettings,
              isBonusMatch,
              isDefaultPrediction
            )

            totalPoints += result.points
            if (result.isExactScore) exactScores++
            if (result.isCorrectResult) correctResults++
            matchesPlayed++
          }

          // Calculer le bonus "Prime d'avant-match" si activé pour la journée précédente
          let earlyPredictionBonusPoints = 0
          if (tournament.early_prediction_bonus && predictions.length > 0) {
            for (const md of matchdaysToCalculate) {
              if (md > previousMatchday) break // Seulement jusqu'à la journée précédente

              const matchIdsForDay = matchIdsByMatchday[md] || []
              if (matchIdsForDay.length === 0) continue

              const allMatchesFinished = matchIdsForDay.every(mId => prevFinishedMatchesMap.has(mId))
              if (!allMatchesFinished) continue

              let hasDefaultPrediction = false
              for (const matchId of matchIdsForDay) {
                const pred = predictions.find(p => p.match_id === matchId)
                if (!pred || pred.is_default_prediction) {
                  hasDefaultPrediction = true
                  break
                }
              }

              if (!hasDefaultPrediction) {
                earlyPredictionBonusPoints += 1
              }
            }
            totalPoints += earlyPredictionBonusPoints
          }

          previousPlayerStats.set(userId, {
            playerId: userId,
            playerName: username,
            avatar,
            totalPoints,
            exactScores,
            correctResults,
            matchesPlayed,
            matchesAvailable: previousFinishedMatches.length,
            earlyPredictionBonus: earlyPredictionBonusPoints
          } as any)
        }

        const prevPlayersArray = Array.from(previousPlayerStats.values())
        previousRankings = calculateRankings(prevPlayersArray)
      }
    }

    const rankings = calculateRankings(playersArray, previousRankings)

    // Vérifier si des journées du tournoi n'ont pas encore de matchs importés
    // (ex: phases éliminatoires pas encore commencées)
    const matchdaysWithMatches = new Set(allMatches?.map(m => m.matchday) || [])
    const hasPendingMatchdays = matchdaysToCalculate.some(md => !matchdaysWithMatches.has(md))

    return NextResponse.json({
      rankings,
      matchday: matchday ? parseInt(matchday) : null,
      pointsSettings,
      matchesFinished: finishedMatches?.length || 0,
      matchesTotal: allMatches?.length || 0,
      hasInProgressMatches,
      hasPendingMatchdays // true si des journées futures n'ont pas encore de matchs
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
