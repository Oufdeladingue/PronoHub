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

    // 1. Récupérer le tournoi et ses paramètres
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', tournamentId)
      .single()

    if (tournamentError || !tournament) {
      return NextResponse.json({ error: 'Tournoi non trouvé' }, { status: 404 })
    }

    // Récupérer les paramètres de points depuis admin_settings
    const { data: pointsSettingsData } = await supabase
      .from('admin_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['points_exact_score', 'points_correct_result', 'points_incorrect_result'])

    // 2. Récupérer tous les participants
    const { data: participants, error: participantsError } = await supabase
      .from('tournament_participants')
      .select('user_id, profiles(username, avatar)')
      .eq('tournament_id', tournamentId)

    if (participantsError || !participants) {
      return NextResponse.json({ error: 'Erreur lors de la récupération des participants' }, { status: 500 })
    }

    // 3. Déterminer les journées à prendre en compte
    const startMatchday = tournament.starting_matchday
    const endMatchday = tournament.ending_matchday

    if (!startMatchday || !endMatchday) {
      return NextResponse.json({ error: 'Le tournoi n\'a pas de journées définies' }, { status: 400 })
    }

    // Si une journée spécifique est demandée, ne calculer que pour cette journée
    const matchdaysToCalculate = matchday
      ? [parseInt(matchday)]
      : Array.from({ length: endMatchday - startMatchday + 1 }, (_, i) => startMatchday + i)

    // 4. Récupérer tous les matchs avec scores pour ces journées (terminés ou en cours)
    const { data: finishedMatches, error: matchesError } = await supabase
      .from('imported_matches')
      .select('*')
      .eq('competition_id', tournament.competition_id)
      .in('matchday', matchdaysToCalculate)
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)

    if (matchesError) {
      return NextResponse.json({ error: 'Erreur lors de la récupération des matchs' }, { status: 500 })
    }

    // Détecter s'il y a des matchs en cours
    const hasInProgressMatches = finishedMatches?.some(m =>
      m.status === 'IN_PLAY' || m.status === 'PAUSED'
    ) || false

    // 5. Récupérer tous les matchs disponibles (pour calculer matchesAvailable)
    const { data: allMatches, error: allMatchesError } = await supabase
      .from('imported_matches')
      .select('id, matchday')
      .eq('competition_id', tournament.competition_id)
      .in('matchday', matchdaysToCalculate)

    if (allMatchesError) {
      return NextResponse.json({ error: 'Erreur lors de la récupération des matchs disponibles' }, { status: 500 })
    }

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

    // 8. Calculer les statistiques pour chaque joueur
    const playerStatsMap = new Map<string, Omit<PlayerStats, 'rank' | 'rankChange'>>()

    for (const participant of participants) {
      const userId = participant.user_id
      const username = (participant.profiles as any)?.username || 'Inconnu'
      const avatar = (participant.profiles as any)?.avatar || 'avatar1'

      // Récupérer tous les pronostics du joueur pour ces journées
      const { data: predictions, error: predError } = await supabase
        .from('predictions')
        .select('*, is_default_prediction')
        .eq('user_id', userId)
        .eq('tournament_id', tournamentId)
        .in('match_id', finishedMatches?.map(m => m.id) || [])

      console.log(`[Rankings API] ${username}: ${predictions?.length || 0} predictions found`, predError)

      let totalPoints = 0
      let exactScores = 0
      let correctResults = 0
      let matchesPlayed = 0

      // Calculer les points pour chaque pronostic
      if (predictions && finishedMatches) {
        for (const prediction of predictions) {
          const match = finishedMatches.find(m => m.id === prediction.match_id)
          if (!match || match.home_score === null || match.away_score === null) continue

          // Vérifier si c'est un pronostic valide (pas le 0-0 par défaut non sauvegardé)
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

      playerStatsMap.set(userId, {
        playerId: userId,
        playerName: username,
        avatar,
        totalPoints,
        exactScores,
        correctResults,
        matchesPlayed,
        matchesAvailable: finishedMatches?.length || 0
      } as any)
    }

    // 9. Calculer les rangs
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
    console.error('Erreur lors du calcul du classement:', error)
    return NextResponse.json(
      { error: 'Erreur serveur', details: error.message },
      { status: 500 }
    )
  }
}
