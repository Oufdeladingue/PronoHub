import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Sauvegarde de pronostics — utilisée par navigator.sendBeacon() au refresh/fermeture de page
 * pour persister les éditions encore en attente d'auto-enregistrement (sinon perdues).
 * Upsert atomique sur la contrainte UNIQUE (tournament_id, user_id, match_id).
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const tournamentId: string | undefined = body?.tournamentId
    const predictions: any[] = Array.isArray(body?.predictions) ? body.predictions : []
    if (!tournamentId || predictions.length === 0) {
      return NextResponse.json({ error: 'bad request' }, { status: 400 })
    }

    const rows = predictions
      .filter((p) => p && typeof p.matchId === 'string' && Number.isFinite(Number(p.home)) && Number.isFinite(Number(p.away)))
      .map((p) => ({
        tournament_id: tournamentId,
        user_id: user.id,
        match_id: p.matchId,
        predicted_home_score: Number(p.home),
        predicted_away_score: Number(p.away),
      }))

    if (rows.length === 0) {
      return NextResponse.json({ saved: 0 })
    }

    const { error } = await supabase
      .from('predictions')
      .upsert(rows, { onConflict: 'tournament_id,user_id,match_id' })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ saved: rows.length })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 })
  }
}
