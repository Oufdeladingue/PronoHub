import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { assertCron } from '@/lib/cron-auth'

/**
 * Cron de nettoyage des comptes FANTÔMES GÉO-BLOQUÉS : un visiteur d'un pays hors zones ouvertes
 * clique « continuer avec Google » → Supabase crée le compte et pose `last_sign_in_at` à l'échange
 * OAuth → PUIS notre contrôle géo le bloque (`signOut`) AVANT qu'il ne charge l'app → `last_seen_at`
 * reste NULL. Résultat : compte vide « Jamais connecté », irrécupérable (pays fermé).
 *
 * Critère CIBLÉ (signature du géo-blocage, pour ne PAS toucher les autres cas) :
 *  - `last_sign_in_at` POSÉ (échange OAuth réussi) — distingue du bug rate-limit (users de pays
 *    autorisés, bloqués AVANT l'échange → last_sign_in NULL → ÉPARGNÉS ici).
 *  - `profiles.last_seen_at` NULL (n'a jamais chargé l'app).
 *  - créé depuis > 3 jours.
 *  - AUCUN tournoi (ni créateur, ni participant).
 *  - `?dryRun=1` : prévisualise sans supprimer.
 *
 * Auth : Bearer CRON_SECRET.
 */
const GRACE_MS = 3 * 24 * 60 * 60 * 1000

export async function GET(request: Request) {
  const denied = assertCron(request)
  if (denied) return denied

  const dryRun = new URL(request.url).searchParams.get('dryRun') === '1'
  const supabase = createAdminClient()
  const cutoffMs = Date.now() - GRACE_MS

  // 1. Tous les comptes auth → garder ceux avec last_sign_in_at POSÉ (OAuth réussi) et anciens
  const authUsers: Array<{ id: string; email?: string; created_at: string; last_sign_in_at?: string | null }> = []
  for (let page = 1; page <= 80; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const batch = data?.users || []
    authUsers.push(...(batch as any))
    if (batch.length < 200) break
  }
  const signature = authUsers.filter(
    (u) => u.last_sign_in_at && new Date(u.created_at).getTime() < cutoffMs
  )
  if (signature.length === 0) {
    return NextResponse.json({ success: true, dryRun, candidates: 0, deleted: 0 })
  }

  const chunk = <T,>(arr: T[], n: number) =>
    Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n))

  // 2. Parmi eux, garder ceux dont le profil n'a JAMAIS été vu (last_seen_at NULL)
  const sigIds = signature.map((u) => u.id)
  const neverSeen = new Set<string>()
  for (const part of chunk(sigIds, 300)) {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .in('id', part)
      .is('last_seen_at', null)
    for (const r of data || []) neverSeen.add(r.id)
  }

  // 3. Exclure toute activité de tournoi (créateur OU participant)
  const active = new Set<string>()
  const ghostIds = sigIds.filter((id) => neverSeen.has(id))
  for (const part of chunk(ghostIds, 300)) {
    const [{ data: creators }, { data: participants }] = await Promise.all([
      supabase.from('tournaments').select('creator_id').in('creator_id', part),
      supabase.from('tournament_participants').select('user_id').in('user_id', part),
    ])
    for (const r of creators || []) active.add(r.creator_id)
    for (const r of participants || []) active.add(r.user_id)
  }

  const byId = Object.fromEntries(signature.map((u) => [u.id, u]))
  const toDelete = ghostIds.filter((id) => !active.has(id)).map((id) => byId[id])

  if (dryRun) {
    return NextResponse.json({
      success: true,
      dryRun: true,
      candidates: toDelete.length,
      sample: toDelete.slice(0, 25).map((u) => ({ email: u.email, created_at: u.created_at })),
    })
  }

  let deleted = 0
  const errors: string[] = []
  for (const u of toDelete) {
    const { error: delErr } = await supabase.auth.admin.deleteUser(u.id)
    if (delErr) errors.push(`${u.email}: ${delErr.message}`)
    else deleted++
  }
  console.log(`[CLEANUP-GHOSTS] ${deleted} fantômes géo-bloqués supprimés (${errors.length} erreurs)`)
  return NextResponse.json({ success: true, dryRun: false, deleted, errors: errors.length ? errors.slice(0, 20) : undefined })
}
