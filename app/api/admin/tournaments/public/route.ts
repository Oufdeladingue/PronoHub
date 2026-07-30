import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth-helpers'
import { UserRole } from '@/types'

/**
 * POST /api/admin/tournaments/public — crée un TOURNOI PUBLIC (super_admin only).
 * Basé sur une compétition custom. is_public=true, capacité illimitée (type enterprise + bypass
 * dans le join), rejoignable même en cours. Le créateur (admin) est ajouté comme premier participant.
 * Body : { name, customCompetitionId }
 */
function genSlug(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  let s = ''
  for (let i = 0; i < 8; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)]
  return s
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!isSuperAdmin(profile?.role as UserRole)) {
    return NextResponse.json({ error: 'Réservé au super admin' }, { status: 403 })
  }

  const { name, customCompetitionId } = await request.json().catch(() => ({}))
  if (!name || !customCompetitionId) {
    return NextResponse.json({ error: 'name et customCompetitionId requis' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Compétition custom (nom + nb de journées)
  const { data: comp } = await admin
    .from('custom_competitions')
    .select('name, total_matchdays')
    .eq('id', customCompetitionId)
    .maybeSingle()
  if (!comp) return NextResponse.json({ error: 'Compétition custom introuvable' }, { status: 404 })

  // Slug unique (8 maj)
  let slug = ''
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = genSlug()
    const { data: exists } = await admin.from('tournaments').select('id').eq('slug', candidate).maybeSingle()
    if (!exists) { slug = candidate; break }
  }
  if (!slug) return NextResponse.json({ error: 'Impossible de générer un slug' }, { status: 500 })

  const { data: tournament, error: tErr } = await admin
    .from('tournaments')
    .insert({
      name,
      slug,
      invite_code: slug,
      competition_name: comp.name,
      custom_competition_id: customCompetitionId,
      competition_id: null,
      is_public: true,
      tournament_type: 'enterprise',
      max_players: 1000000, // illimité en pratique (le join bypasse ce plafond pour is_public)
      max_participants: 1000000,
      num_matchdays: comp.total_matchdays || 1,
      matchdays_count: comp.total_matchdays || 1,
      all_matchdays: true,
      bonus_match: false,
      early_prediction_bonus: false,
      bonus_qualified: false,
      creator_id: user.id,
      original_creator_id: user.id,
      status: 'pending',
      current_participants: 1,
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

  if (tErr || !tournament) {
    return NextResponse.json({ error: tErr?.message || 'Création échouée' }, { status: 500 })
  }

  // Admin = premier participant (capitaine)
  await admin.from('tournament_participants').insert({
    tournament_id: tournament.id,
    user_id: user.id,
    participant_role: 'captain',
    invite_type: 'free',
  })

  return NextResponse.json({
    success: true,
    tournament: { id: tournament.id, slug: tournament.slug },
    publicUrl: `/tournoi-public/${tournament.slug}`,
  })
}
