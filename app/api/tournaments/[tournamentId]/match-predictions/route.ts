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

    // Récupérer tous les participants du tournoi
    const { data: participants, error: participantsError } = await supabase
      .from('tournament_participants')
      .select('user_id, profiles(username, avatar)')
      .eq('tournament_id', tournamentId)

    if (participantsError) throw participantsError
    if (!participants) {
      return NextResponse.json({ predictions: [] })
    }

    // Récupérer toutes les prédictions pour ce match
    const { data: predictions, error: predictionsError } = await supabase
      .from('predictions')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('match_id', matchId)

    if (predictionsError) throw predictionsError

    // Combiner les données
    const result = participants.map(participant => {
      const pred = predictions?.find(p => p.user_id === participant.user_id)
      return {
        user_id: participant.user_id,
        username: (participant.profiles as any)?.username || 'Inconnu',
        avatar: (participant.profiles as any)?.avatar || 'avatar1',
        predicted_home_score: pred?.predicted_home_score ?? null,
        predicted_away_score: pred?.predicted_away_score ?? null,
        has_prediction: !!pred && pred.predicted_home_score !== null && pred.predicted_away_score !== null
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
