import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Sauvegarde de pronostics côté serveur.
 *
 * POURQUOI une route serveur : la policy RLS UPDATE de `predictions` bloque silencieusement
 * les mises à jour (0 ligne modifiée, sans erreur) → impossible de ré-éditer un prono en
 * écriture directe depuis le client. On authentifie l'utilisateur (cookie web / Bearer mobile)
 * puis on écrit via le client admin (service-role) qui contourne la RLS. La deadline est
 * vérifiée côté serveur (anti-triche) et la contrainte UNIQUE empêche les doublons.
 *
 * Utilisée par le bouton Enregistrer / l'auto-save (via fetchWithAuth) ET par sendBeacon
 * (cookies) au refresh.
 */
const LOCK_BEFORE_KICKOFF_MS = 30 * 60 * 1000

export async function POST(request: Request) {
  try {
    // Auth (cookie web ou Bearer Capacitor) — createClient gère les deux
    const authClient = await createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const tournamentId: string | undefined = body?.tournamentId
    const predictions: any[] = Array.isArray(body?.predictions) ? body.predictions : []
    if (!tournamentId || predictions.length === 0) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
    }

    const valid = predictions.filter(
      (p) => p && typeof p.matchId === 'string' &&
        Number.isFinite(Number(p.home)) && Number.isFinite(Number(p.away))
    )
    if (valid.length === 0) {
      return NextResponse.json({ saved: 0, locked: 0 })
    }

    const admin = createAdminClient()

    // Vérifier la deadline : on n'enregistre pas un match déjà commencé (anti-triche serveur)
    const matchIds = [...new Set(valid.map((p) => p.matchId))]
    const { data: matches } = await admin
      .from('imported_matches')
      .select('id, utc_date')
      .in('id', matchIds)
    const kickoffById = new Map((matches || []).map((m) => [m.id, new Date(m.utc_date).getTime()]))
    const now = Date.now()

    let saved = 0
    let locked = 0
    const errors: string[] = []

    for (const p of valid) {
      const kickoff = kickoffById.get(p.matchId)
      if (kickoff != null && now >= kickoff - LOCK_BEFORE_KICKOFF_MS) {
        locked++
        continue
      }
      // Upsert via service-role → contourne la RLS UPDATE défaillante, atomique (UNIQUE)
      const { error } = await admin
        .from('predictions')
        .upsert({
          tournament_id: tournamentId,
          user_id: user.id,
          match_id: p.matchId,
          predicted_home_score: Number(p.home),
          predicted_away_score: Number(p.away),
        }, { onConflict: 'tournament_id,user_id,match_id' })
      if (error) errors.push(`${p.matchId}: ${error.message}`)
      else saved++
    }

    return NextResponse.json({ saved, locked, errors: errors.length ? errors : undefined })
  } catch (e: any) {
    console.error('[predictions/save] error:', e)
    return NextResponse.json({ error: e?.message || 'Erreur serveur' }, { status: 500 })
  }
}
