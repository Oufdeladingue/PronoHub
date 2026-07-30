import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth-helpers'
import { UserRole } from '@/types'

/**
 * Gestion des TOURNOIS PUBLICS (super_admin only).
 * is_public est porté par le TOURNOI : une compétition (normale ou custom) peut héberger en parallèle
 * un tournoi public ET des tournois privés — aucune duplication ni conflit.
 *  - POST   { name, competitionId? , customCompetitionId?, numMatchdays? } → crée le tournoi public
 *  - GET    → liste les tournois publics
 *  - DELETE ?id=... → supprime un tournoi public
 */
function genSlug(): string {
  const a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  let s = ''
  for (let i = 0; i < 8; i++) s += a[Math.floor(Math.random() * a.length)]
  return s
}

async function requireSuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }) }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!isSuperAdmin(profile?.role as UserRole)) {
    return { error: NextResponse.json({ error: 'Réservé au super admin' }, { status: 403 }) }
  }
  return { user, admin: createAdminClient() }
}

export async function GET() {
  const ctx = await requireSuperAdmin()
  if (ctx.error) return ctx.error
  const { data: tournaments } = await ctx.admin
    .from('tournaments')
    .select('id, name, slug, status, competition_name, created_at')
    .eq('is_public', true)
    .order('created_at', { ascending: false })
  // Compter les joueurs
  const withCounts = await Promise.all(
    (tournaments || []).map(async (t) => {
      const { count } = await ctx.admin
        .from('tournament_participants')
        .select('*', { count: 'exact', head: true })
        .eq('tournament_id', t.id)
      return { ...t, players: count || 0, url: `/tournoi-public/${t.slug}` }
    })
  )
  return NextResponse.json({ success: true, tournaments: withCounts })
}

export async function POST(request: NextRequest) {
  const ctx = await requireSuperAdmin()
  if (ctx.error) return ctx.error
  const { user, admin } = ctx

  const { name, competitionId, customCompetitionId, numMatchdays } = await request.json().catch(() => ({}))
  if (!name || (!competitionId && !customCompetitionId)) {
    return NextResponse.json({ error: 'name + (competitionId OU customCompetitionId) requis' }, { status: 400 })
  }

  // Résoudre le nom de compétition + le nombre de journées
  let competitionName = 'Compétition'
  let mdCount = numMatchdays || null
  if (customCompetitionId) {
    const { data: c } = await admin.from('custom_competitions').select('name, total_matchdays').eq('id', customCompetitionId).maybeSingle()
    if (!c) return NextResponse.json({ error: 'Compétition custom introuvable' }, { status: 404 })
    competitionName = c.name
    mdCount = mdCount || c.total_matchdays || 1
  } else {
    const { data: c } = await admin.from('competitions').select('name, total_matchdays').eq('id', competitionId).maybeSingle()
    if (!c) return NextResponse.json({ error: 'Compétition introuvable' }, { status: 404 })
    competitionName = c.name
    mdCount = mdCount || c.total_matchdays || 38
  }

  // Slug unique
  let slug = ''
  for (let i = 0; i < 10; i++) {
    const cand = genSlug()
    const { data: exists } = await admin.from('tournaments').select('id').eq('slug', cand).maybeSingle()
    if (!exists) { slug = cand; break }
  }
  if (!slug) return NextResponse.json({ error: 'Slug indisponible' }, { status: 500 })

  const { data: tournament, error: tErr } = await admin
    .from('tournaments')
    .insert({
      name,
      slug,
      invite_code: slug,
      competition_name: competitionName,
      competition_id: customCompetitionId ? null : competitionId,
      custom_competition_id: customCompetitionId || null,
      is_public: true,
      tournament_type: 'enterprise',
      max_players: 1000000,
      max_participants: 1000000,
      num_matchdays: mdCount,
      matchdays_count: mdCount,
      all_matchdays: true,
      bonus_match: false,
      early_prediction_bonus: false,
      bonus_qualified: false,
      creator_id: user.id,
      original_creator_id: user.id,
      status: 'pending',
      current_participants: 0, // l'admin est propriétaire, PAS joueur → 0 participant au départ
      scoring_exact_score: 3,
      scoring_correct_winner: 1,
      scoring_correct_goal_difference: 2,
      scoring_default_prediction_max: 1,
      is_legacy: false,
      duration_extended: false,
      players_extended: 0,
    })
    .select('id, slug')
    .single()
  if (tErr || !tournament) return NextResponse.json({ error: tErr?.message || 'Création échouée' }, { status: 500 })

  // NB : on n'ajoute PAS l'admin comme participant — il est propriétaire (creator_id), pas joueur.
  // Le 1er vrai visiteur qui rejoint devient participant #1.

  return NextResponse.json({ success: true, tournament, publicUrl: `/tournoi-public/${tournament.slug}` })
}

export async function DELETE(request: NextRequest) {
  const ctx = await requireSuperAdmin()
  if (ctx.error) return ctx.error
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })
  // Sécurité : ne supprimer que si c'est bien un tournoi public
  const { data: t } = await ctx.admin.from('tournaments').select('id, is_public').eq('id', id).maybeSingle()
  if (!t || !t.is_public) return NextResponse.json({ error: 'Tournoi public introuvable' }, { status: 404 })
  const { error } = await ctx.admin.from('tournaments').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
