import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { assertCron } from '@/lib/cron-auth'

/**
 * Cron de nettoyage des tournois ZOMBIES : tournois restés en `pending` (jamais lancés — encore en
 * phase d'inscription) dont la compétition support a une saison TERMINÉE → ils ne pourront plus
 * jamais démarrer (ex. tournois Coupe du Monde encore "en attente" après la fin de la WC).
 *
 * → Suppression TOTALE (le tournoi n'a aucune donnée de jeu : jamais démarré, 0 prono). La table
 *   `tournaments` a un ON DELETE CASCADE → participants/pronostics éventuels partent avec.
 *
 * Sécurités :
 *  - UNIQUEMENT status = 'pending' (jamais lancé). Les tournois actifs/terminés ne sont jamais touchés.
 *  - Uniquement si la saison de la compétition est finie depuis > GRACE (marge anti-transition).
 *  - `?dryRun=1` : prévisualise sans rien supprimer.
 *  - v1 : compétitions RÉGULIÈRES (competition_id) seulement. Les compétitions custom (BOTW) ne sont
 *    pas auto-nettoyées ici (logique de fin différente) — à traiter séparément si besoin.
 *
 * Auth : Bearer CRON_SECRET.
 */
const GRACE_MS = 7 * 24 * 60 * 60 * 1000 // 7 j après la fin de saison avant suppression

export async function GET(request: Request) {
  const denied = assertCron(request)
  if (denied) return denied

  const dryRun = new URL(request.url).searchParams.get('dryRun') === '1'
  const supabase = createAdminClient()

  // Tournois jamais lancés
  const { data: pending, error } = await supabase
    .from('tournaments')
    .select('id, name, slug, competition_id, custom_competition_id, created_at')
    .eq('status', 'pending')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Dates de fin de saison des compétitions référencées
  const compIds = Array.from(new Set((pending || []).map((t) => t.competition_id).filter(Boolean)))
  const compById: Record<number, { name: string; end: string | null }> = {}
  if (compIds.length) {
    const { data: comps } = await supabase
      .from('competitions')
      .select('id, name, current_season_end_date')
      .in('id', compIds)
    for (const c of comps || []) compById[c.id] = { name: c.name, end: c.current_season_end_date }
  }

  const cutoff = Date.now() - GRACE_MS
  const toDelete: { id: string; name: string; competition: string; seasonEnd: string | null }[] = []
  for (const t of pending || []) {
    if (!t.competition_id) continue // custom non géré ici (v1)
    const comp = compById[t.competition_id]
    if (comp?.end && new Date(comp.end).getTime() < cutoff) {
      toDelete.push({ id: t.id, name: t.name, competition: comp.name, seasonEnd: comp.end })
    }
  }

  let deleted = 0
  const errors: string[] = []
  if (!dryRun) {
    for (const t of toDelete) {
      // CASCADE → participants + pronostics supprimés automatiquement
      const { error: delErr } = await supabase.from('tournaments').delete().eq('id', t.id)
      if (delErr) errors.push(`${t.name}: ${delErr.message}`)
      else {
        deleted++
        console.log(`[CLEANUP-PENDING] Supprimé "${t.name}" (${t.competition}, saison finie ${t.seasonEnd})`)
      }
    }
  }

  return NextResponse.json({
    success: true,
    dryRun,
    pendingTotal: pending?.length || 0,
    candidates: toDelete.length,
    toDelete: toDelete.map((t) => ({ name: t.name, competition: t.competition, seasonEnd: t.seasonEnd })),
    deleted,
    errors: errors.length ? errors : undefined,
  })
}
