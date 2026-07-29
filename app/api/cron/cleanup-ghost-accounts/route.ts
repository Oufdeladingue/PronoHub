import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { assertCron } from '@/lib/cron-auth'

/**
 * Cron de nettoyage des comptes FANTÔMES : comptes créés (généralement via un retour OAuth d'un
 * pays hors zones ouvertes) mais qui n'ont JAMAIS chargé l'app → `last_seen_at` NULL, aucun tournoi.
 * Supabase crée le compte à l'échange OAuth, AVANT le contrôle géo qui les bloque → ils laissent un
 * compte vide « Jamais connecté ». On les supprime pour garder la base propre.
 *
 * Sécurités (conservateur, ne touche jamais un vrai user) :
 *  - `last_seen_at` NULL (n'a jamais chargé l'app).
 *  - Créé depuis > 3 jours (marge : un vrai user récent aurait `last_seen_at` posé de toute façon).
 *  - AUCUN tournoi (ni créateur, ni participant).
 *  - `?dryRun=1` : prévisualise sans supprimer.
 *
 * Auth : Bearer CRON_SECRET.
 */
const GRACE_MS = 3 * 24 * 60 * 60 * 1000 // 3 jours

export async function GET(request: Request) {
  const denied = assertCron(request)
  if (denied) return denied

  const dryRun = new URL(request.url).searchParams.get('dryRun') === '1'
  const supabase = createAdminClient()
  const cutoff = new Date(Date.now() - GRACE_MS).toISOString()

  // 1. Candidats : jamais connectés + anciens
  const { data: candidates, error } = await supabase
    .from('profiles')
    .select('id, email, created_at')
    .is('last_seen_at', null)
    .lt('created_at', cutoff)
    .limit(5000)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!candidates || candidates.length === 0) {
    return NextResponse.json({ success: true, dryRun, candidates: 0, deleted: 0 })
  }

  const ids = candidates.map((c) => c.id)

  // 2. Exclure tous ceux qui ont la moindre activité de tournoi (créateur OU participant)
  const active = new Set<string>()
  const chunk = <T,>(arr: T[], n: number) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n))
  for (const part of chunk(ids, 300)) {
    const [{ data: creators }, { data: participants }] = await Promise.all([
      supabase.from('tournaments').select('creator_id').in('creator_id', part),
      supabase.from('tournament_participants').select('user_id').in('user_id', part),
    ])
    for (const r of creators || []) active.add(r.creator_id)
    for (const r of participants || []) active.add(r.user_id)
  }

  const toDelete = candidates.filter((c) => !active.has(c.id))

  if (dryRun) {
    return NextResponse.json({
      success: true,
      dryRun: true,
      candidates: candidates.length,
      excludedWithActivity: candidates.length - toDelete.length,
      toDelete: toDelete.length,
      sample: toDelete.slice(0, 20).map((c) => ({ email: c.email, created_at: c.created_at })),
    })
  }

  // 3. Suppression (cascade profiles via l'API admin)
  let deleted = 0
  const errors: string[] = []
  for (const c of toDelete) {
    const { error: delErr } = await supabase.auth.admin.deleteUser(c.id)
    if (delErr) errors.push(`${c.email}: ${delErr.message}`)
    else deleted++
  }

  console.log(`[CLEANUP-GHOSTS] ${deleted} comptes fantômes supprimés (${errors.length} erreurs)`)
  return NextResponse.json({
    success: true,
    dryRun: false,
    candidates: candidates.length,
    excludedWithActivity: candidates.length - toDelete.length,
    deleted,
    errors: errors.length ? errors.slice(0, 20) : undefined,
  })
}
