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

    const valid = predictions.filter(
      (p) => p && typeof p.matchId === 'string' && Number.isFinite(Number(p.home)) && Number.isFinite(Number(p.away))
    )
    if (valid.length === 0) {
      return NextResponse.json({ saved: 0 })
    }

    // check-then-insert/update (pas d'upsert : un upsert exige la policy RLS INSERT même en
    // mise à jour, ce qui échoue pour un prono existant). Contrainte UNIQUE → pas de doublon.
    let saved = 0
    for (const p of valid) {
      const { data: existing } = await supabase
        .from('predictions')
        .select('id')
        .eq('tournament_id', tournamentId)
        .eq('user_id', user.id)
        .eq('match_id', p.matchId)
        .maybeSingle()

      if (existing) {
        const { error } = await supabase
          .from('predictions')
          .update({ predicted_home_score: Number(p.home), predicted_away_score: Number(p.away) })
          .eq('id', existing.id)
        if (!error) saved++
      } else {
        const { error } = await supabase
          .from('predictions')
          .insert({
            tournament_id: tournamentId,
            user_id: user.id,
            match_id: p.matchId,
            predicted_home_score: Number(p.home),
            predicted_away_score: Number(p.away),
          })
        if (!error) saved++
      }
    }
    return NextResponse.json({ saved })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 })
  }
}
