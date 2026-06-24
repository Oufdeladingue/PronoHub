import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { calculateTrophiesForTournament } from '@/lib/trophy-calculator'

/**
 * Recalcul "vraie situation" des trophées.
 *
 * Rejoue la logique CORRIGÉE (calculateTrophiesForTournament avec ignoreExisting=true) sur TOUS
 * les tournois, agrège par utilisateur l'ensemble des trophées RÉELLEMENT mérités (union sur ses
 * tournois), puis compare à user_trophies.
 *
 * - GET (par défaut) = DRY-RUN : renvoie, par user, les trophées à RETIRER (présents à tort) et
 *   les MANQUANTS (mérités mais absents). Ne modifie rien.
 * - ?apply=revoke  : supprime les trophées présents à tort.
 * - ?apply=full    : supprime les présents à tort ET ajoute les manquants mérités.
 *
 * Sécurisé par CRON_SECRET (?secret=...).
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const provided = new URL(request.url).searchParams.get('secret')
  if (!cronSecret || provided !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apply = new URL(request.url).searchParams.get('apply') // 'revoke' | 'full' | null
  const supabase = createAdminClient()

  try {
    // 1. Tous les tournois
    const { data: tournaments } = await supabase.from('tournaments').select('*')
    if (!tournaments) return NextResponse.json({ error: 'no tournaments' }, { status: 500 })

    // 2. Set légitime de trophées par user (union sur tous ses tournois)
    const correctByUser = new Map<string, Set<string>>()

    for (const tournament of tournaments) {
      const { data: parts } = await supabase
        .from('tournament_participants')
        .select('user_id')
        .eq('tournament_id', tournament.id)
      const ids = (parts || []).map((p: any) => p.user_id)
      if (ids.length === 0) continue

      // ignoreExisting=true → renvoie l'ENSEMBLE des trophées mérités dans ce tournoi
      const results = await calculateTrophiesForTournament(supabase, tournament, ids, true)
      for (const [userId, r] of results) {
        if (!correctByUser.has(userId)) correctByUser.set(userId, new Set())
        const set = correctByUser.get(userId)!
        for (const t of r.newTrophies) set.add(t)
      }
    }

    // 3. Trophées actuellement en BDD par user
    const { data: current } = await supabase.from('user_trophies').select('id, user_id, trophy_type')
    const currentByUser = new Map<string, Map<string, string>>() // user -> (type -> row id)
    for (const row of current || []) {
      if (!currentByUser.has(row.user_id)) currentByUser.set(row.user_id, new Map())
      currentByUser.get(row.user_id)!.set(row.trophy_type, row.id)
    }

    // 4. Diff
    const allUserIds = new Set<string>([...correctByUser.keys(), ...currentByUser.keys()])
    const toRevoke: { user_id: string; trophy_type: string; row_id: string }[] = []
    const missing: { user_id: string; trophy_type: string }[] = []

    for (const userId of allUserIds) {
      const correct = correctByUser.get(userId) || new Set<string>()
      const cur = currentByUser.get(userId) || new Map<string, string>()
      // présents à tort
      for (const [type, rowId] of cur) {
        if (!correct.has(type)) toRevoke.push({ user_id: userId, trophy_type: type, row_id: rowId })
      }
      // mérités mais absents
      for (const type of correct) {
        if (!cur.has(type)) missing.push({ user_id: userId, trophy_type: type })
      }
    }

    // Noms d'utilisateurs pour lisibilité
    const involved = [...new Set([...toRevoke, ...missing].map(x => x.user_id))]
    const { data: profs } = involved.length
      ? await supabase.from('profiles').select('id, username').in('id', involved)
      : { data: [] }
    const nameOf: Record<string, string> = {}
    for (const p of profs || []) nameOf[p.id] = p.username

    const revokeByType: Record<string, number> = {}
    for (const r of toRevoke) revokeByType[r.trophy_type] = (revokeByType[r.trophy_type] || 0) + 1

    let applied = { revoked: 0, added: 0 }

    if (apply === 'revoke' || apply === 'full') {
      if (toRevoke.length > 0) {
        const ids = toRevoke.map(r => r.row_id)
        const { error } = await supabase.from('user_trophies').delete().in('id', ids)
        if (error) return NextResponse.json({ error: 'revoke failed: ' + error.message }, { status: 500 })
        applied.revoked = ids.length
      }
    }
    if (apply === 'full' && missing.length > 0) {
      const rows = missing.map(m => ({
        user_id: m.user_id,
        trophy_type: m.trophy_type,
        unlocked_at: new Date().toISOString(),
        is_new: false
      }))
      const { error } = await supabase
        .from('user_trophies')
        .upsert(rows, { onConflict: 'user_id,trophy_type', ignoreDuplicates: true })
      if (error) return NextResponse.json({ error: 'add failed: ' + error.message }, { status: 500 })
      applied.added = rows.length
    }

    return NextResponse.json({
      mode: apply ? `APPLIED (${apply})` : 'DRY-RUN',
      summary: {
        tournamentsScanned: tournaments.length,
        usersAffected: allUserIds.size,
        toRevokeCount: toRevoke.length,
        missingCount: missing.length,
        revokeByType,
      },
      toRevoke: toRevoke.map(r => ({ user: nameOf[r.user_id] || r.user_id, trophy: r.trophy_type })),
      missing: missing.map(m => ({ user: nameOf[m.user_id] || m.user_id, trophy: m.trophy_type })),
      applied,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
