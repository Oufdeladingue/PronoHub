import { createClient as createServerClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * API optimisée pour charger TOUS les pronostics de TOUS les matchs d'une journée
 * en une seule requête. Remplace les appels individuels par match.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  try {
    const { tournamentId } = await params
    const { searchParams } = new URL(request.url)
    const matchIdsParam = searchParams.get('matchIds')

    if (!matchIdsParam) {
      return NextResponse.json(
        { error: 'matchIds parameter is required (comma-separated)' },
        { status: 400 }
      )
    }

    const matchIds = matchIdsParam.split(',').filter(id => id.trim())

    if (matchIds.length === 0) {
      return NextResponse.json({ predictions: {} })
    }

    // Utiliser la clé service_role pour accéder à toutes les prédictions
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Exécuter les 3 requêtes en PARALLÈLE au lieu de séquentiellement
    const [participantsResult, predictionsResult, matchesResult] = await Promise.all([
      // 1. Récupérer tous les participants du tournoi (triés par ordre d'inscription)
      supabase
        .from('tournament_participants')
        .select('user_id, profiles(username, avatar), joined_at')
        .eq('tournament_id', tournamentId)
        .order('joined_at', { ascending: true }),

      // 2. Récupérer TOUTES les prédictions pour TOUS les matchs demandés
      supabase
        .from('predictions')
        .select('*, is_default_prediction')
        .eq('tournament_id', tournamentId)
        .in('match_id', matchIds),

      // 3. Récupérer les informations de TOUS les matchs
      supabase
        .from('imported_matches')
        .select('id, status, finished, utc_date')
        .in('id', matchIds)
    ])

    if (participantsResult.error) throw participantsResult.error
    if (predictionsResult.error) throw predictionsResult.error
    if (matchesResult.error) throw matchesResult.error

    const participants = participantsResult.data || []
    const allPredictions = predictionsResult.data || []
    const matches = matchesResult.data || []

    // Créer un map pour accès rapide aux matchs
    const matchesMap = new Map(matches.map(m => [m.id, m]))

    // Organiser les résultats par matchId
    const result: Record<string, any[]> = {}

    for (const matchId of matchIds) {
      const matchData = matchesMap.get(matchId)
      const matchHasStarted = matchData && new Date(matchData.utc_date) <= new Date()
      const matchIsFinished = matchData && (matchData.status === 'FINISHED' || matchData.finished === true)

      // Filtrer les prédictions pour ce match
      const matchPredictions = allPredictions.filter(p => p.match_id === matchId)

      // Combiner les données pour chaque participant
      result[matchId] = participants.map(participant => {
        const pred = matchPredictions.find(p => p.user_id === participant.user_id)
        const hasPrediction = !!pred && pred.predicted_home_score !== null && pred.predicted_away_score !== null

        // Si l'utilisateur n'a pas de pronostic et que le match a commencé,
        // on applique le pronostic par défaut 0-0
        const shouldApplyDefault = !hasPrediction && (matchHasStarted || matchIsFinished)

        return {
          user_id: participant.user_id,
          username: (participant.profiles as any)?.username || 'Inconnu',
          avatar: (participant.profiles as any)?.avatar || 'avatar1',
          predicted_home_score: shouldApplyDefault ? 0 : (pred?.predicted_home_score ?? null),
          predicted_away_score: shouldApplyDefault ? 0 : (pred?.predicted_away_score ?? null),
          is_default_prediction: shouldApplyDefault ? true : (pred?.is_default_prediction ?? false),
          has_prediction: hasPrediction || shouldApplyDefault
        }
      })
    }

    return NextResponse.json({ predictions: result })
  } catch (error: any) {
    console.error('Error fetching matchday predictions:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
