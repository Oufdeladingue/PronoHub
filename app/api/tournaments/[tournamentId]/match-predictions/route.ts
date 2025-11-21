import { createClient as createServerClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  try {
    const { tournamentId } = await params
    const { searchParams } = new URL(request.url)
    const matchId = searchParams.get('matchId')

    if (!matchId) {
      return NextResponse.json(
        { error: 'matchId parameter is required' },
        { status: 400 }
      )
    }

    // Utiliser la clé service_role pour accéder à toutes les prédictions
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Récupérer tous les participants du tournoi (triés par ordre d'inscription)
    const { data: participants, error: participantsError } = await supabase
      .from('tournament_participants')
      .select('user_id, profiles(username, avatar), joined_at')
      .eq('tournament_id', tournamentId)
      .order('joined_at', { ascending: true })

    if (participantsError) throw participantsError
    if (!participants) {
      return NextResponse.json({ predictions: [] })
    }

    // Récupérer toutes les prédictions pour ce match
    const { data: predictions, error: predictionsError } = await supabase
      .from('predictions')
      .select('*, is_default_prediction')
      .eq('tournament_id', tournamentId)
      .eq('match_id', matchId)

    if (predictionsError) throw predictionsError

    // Récupérer les informations du match pour savoir s'il est terminé
    const { data: matchData } = await supabase
      .from('imported_matches')
      .select('status, finished, utc_date')
      .eq('id', matchId)
      .single()

    const matchHasStarted = matchData && new Date(matchData.utc_date) <= new Date()
    const matchIsFinished = matchData && (matchData.status === 'FINISHED' || matchData.finished === true)

    // Combiner les données
    // Si le match a commencé/est terminé et qu'un utilisateur n'a pas pronostiqué,
    // on lui attribue automatiquement un pronostic par défaut 0-0
    const result = participants.map(participant => {
      const pred = predictions?.find(p => p.user_id === participant.user_id)
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

    return NextResponse.json({ predictions: result })
  } catch (error: any) {
    console.error('Error fetching match predictions:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
