import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tournamentId = searchParams.get('tournamentId')

  if (!tournamentId) {
    return NextResponse.json({ error: 'Missing tournamentId' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  // Test 1: Récupérer toutes les prédictions
  const { data: allPredictions, error: allError } = await adminClient
    .from('predictions')
    .select('user_id, match_id, predicted_home_score, predicted_away_score, is_default_prediction')
    .eq('tournament_id', tournamentId)

  // Test 2: Récupérer les participants
  const { data: participants, error: participantsError } = await adminClient
    .from('tournament_participants')
    .select('user_id, joined_at, profiles(username, avatar)')
    .eq('tournament_id', tournamentId)

  // Test 3: Grouper par utilisateur
  const predsByUser = new Map<string, any[]>()
  for (const pred of (allPredictions || [])) {
    if (!predsByUser.has(pred.user_id)) {
      predsByUser.set(pred.user_id, [])
    }
    predsByUser.get(pred.user_id)!.push(pred)
  }

  const userStats = Array.from(predsByUser.entries()).map(([userId, preds]) => ({
    userId,
    username: participants?.find(p => p.user_id === userId)?.profiles?.username || 'Unknown',
    total: preds.length,
    nonDefault: preds.filter(p => !p.is_default_prediction).length
  }))

  return NextResponse.json({
    tournamentId,
    allPredictions: {
      count: allPredictions?.length || 0,
      error: allError,
      sample: allPredictions?.slice(0, 3)
    },
    participants: {
      count: participants?.length || 0,
      error: participantsError,
      data: participants
    },
    userStats
  })
}
