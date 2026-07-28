import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { assertCron } from '@/lib/cron-auth'

/**
 * Cron de nettoyage des tournois ZOMBIES : tournois restés en `pending` (jamais lancés — encore en
 * phase d'inscription) dont la compétition support est TERMINÉE → ils ne pourront plus jamais
 * démarrer (ex. tournois Coupe du Monde encore "en attente" après la fin de la WC, ou BOTW clôturé).
 *
 * → Remboursement des crédits éventuels (tournois payants jamais joués) PUIS suppression totale.
 *   La table `tournaments` a un ON DELETE CASCADE → participants/pronostics partent avec.
 *
 * Sécurités :
 *  - UNIQUEMENT status = 'pending' (jamais lancé). Les tournois actifs/terminés ne sont jamais touchés.
 *  - Compétition régulière : saison finie depuis > 7 j (marge anti-transition de saison).
 *  - Compétition custom (BOTW) : `is_active = false` (saison clôturée).
 *  - `?dryRun=1` : prévisualise sans rien supprimer/rembourser.
 *
 * Auth : Bearer CRON_SECRET.
 */
const GRACE_MS = 7 * 24 * 60 * 60 * 1000 // 7 j après la fin de saison (compétitions régulières)

interface Refund { creator: boolean; participants: number; eventSlots: number }

/** Restaure les crédits/slots d'un tournoi jamais joué avant sa suppression (répliqué de la route admin delete). */
async function refundTournament(supabase: any, t: { id: string; tournament_type: string | null; competition_id: number | null }): Promise<Refund> {
  const r: Refund = { creator: false, participants: 0, eventSlots: 0 }

  // 1) Crédit du créateur (tournois payants)
  if (['oneshot', 'elite', 'platinium'].includes(t.tournament_type || '')) {
    const { data: cp } = await supabase
      .from('tournament_purchases')
      .select('id')
      .eq('used_for_tournament_id', t.id)
      .eq('used', true)
      .maybeSingle()
    if (cp) {
      const { error } = await supabase.from('tournament_purchases')
        .update({ used: false, used_at: null, used_for_tournament_id: null, tournament_id: null })
        .eq('id', cp.id)
      if (!error) r.creator = true
    }
  }

  // 2) Crédits des participants ayant payé (slot invité / participation platinium)
  const { data: pps } = await supabase
    .from('tournament_purchases')
    .select('id')
    .eq('tournament_id', t.id)
    .eq('used', true)
    .in('purchase_type', ['slot_invite', 'platinium_participation'])
  for (const p of pps || []) {
    const { error } = await supabase.from('tournament_purchases')
      .update({ used: false, used_at: null, tournament_id: null })
      .eq('id', p.id)
    if (!error) r.participants++
  }

  // 3) Slots événement
  if (t.competition_id) {
    const { data: comp } = await supabase.from('competitions').select('is_event').eq('id', t.competition_id).maybeSingle()
    if (comp?.is_event) {
      const { data: slots } = await supabase
        .from('event_tournament_slots')
        .select('id')
        .eq('tournament_id', t.id)
        .eq('status', 'used')
      for (const sl of slots || []) {
        const { error } = await supabase.from('event_tournament_slots')
          .update({ status: 'available', used_at: null, tournament_id: null })
          .eq('id', sl.id)
        if (!error) r.eventSlots++
      }
    }
  }
  return r
}

export async function GET(request: Request) {
  const denied = assertCron(request)
  if (denied) return denied

  const dryRun = new URL(request.url).searchParams.get('dryRun') === '1'
  const supabase = createAdminClient()

  // Tournois jamais lancés
  const { data: pending, error } = await supabase
    .from('tournaments')
    .select('id, name, slug, tournament_type, competition_id, custom_competition_id, created_at')
    .eq('status', 'pending')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fin de saison des compétitions régulières
  const compIds = Array.from(new Set((pending || []).map((t) => t.competition_id).filter(Boolean)))
  const compById: Record<number, { name: string; end: string | null }> = {}
  if (compIds.length) {
    const { data: comps } = await supabase.from('competitions').select('id, name, current_season_end_date').in('id', compIds)
    for (const c of comps || []) compById[c.id] = { name: c.name, end: c.current_season_end_date }
  }
  // État des compétitions custom
  const customIds = Array.from(new Set((pending || []).map((t) => t.custom_competition_id).filter(Boolean)))
  const customById: Record<string, { name: string; is_active: boolean }> = {}
  if (customIds.length) {
    const { data: ccs } = await supabase.from('custom_competitions').select('id, name, is_active').in('id', customIds)
    for (const c of ccs || []) customById[c.id] = { name: c.name, is_active: c.is_active }
  }

  const cutoff = Date.now() - GRACE_MS
  const toDelete: any[] = []
  for (const t of pending || []) {
    let expired = false
    let label = ''
    if (t.competition_id) {
      const comp = compById[t.competition_id]
      if (comp?.end && new Date(comp.end).getTime() < cutoff) { expired = true; label = `${comp.name} (saison finie ${comp.end})` }
    } else if (t.custom_competition_id) {
      const cc = customById[t.custom_competition_id]
      if (cc && cc.is_active === false) { expired = true; label = `${cc.name} (clôturée)` }
    }
    if (expired) toDelete.push(t)
  }

  const results: any[] = []
  let deleted = 0
  const errors: string[] = []
  for (const t of toDelete) {
    if (dryRun) {
      results.push({ name: t.name, slug: t.slug, type: t.tournament_type, paid: ['oneshot', 'elite', 'platinium'].includes(t.tournament_type || '') })
      continue
    }
    // Rembourser d'abord (no-op pour les tournois gratuits sans achat), puis supprimer
    let refund: Refund = { creator: false, participants: 0, eventSlots: 0 }
    try { refund = await refundTournament(supabase, t) } catch (e: any) { errors.push(`refund ${t.name}: ${e.message}`) }
    const { error: delErr } = await supabase.from('tournaments').delete().eq('id', t.id)
    if (delErr) { errors.push(`delete ${t.name}: ${delErr.message}`); continue }
    deleted++
    results.push({ name: t.name, slug: t.slug, type: t.tournament_type, refund })
    console.log(`[CLEANUP-PENDING] Supprimé "${t.name}" (${t.slug}) — remboursement: créateur=${refund.creator}, participants=${refund.participants}, eventSlots=${refund.eventSlots}`)
  }

  return NextResponse.json({
    success: true,
    dryRun,
    pendingTotal: pending?.length || 0,
    candidates: toDelete.length,
    deleted,
    results,
    errors: errors.length ? errors : undefined,
  })
}
