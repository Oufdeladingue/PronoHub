import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { calculateTrophiesForTournament } from '@/lib/trophy-calculator'

// GET - Lecture simple des trophées depuis la BDD (rapide)
export async function GET(request: Request) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Non authentifié' },
        { status: 401 }
      )
    }

    // Récupérer simplement les trophées stockés en BDD
    const { data: userTrophies } = await supabase
      .from('user_trophies')
      .select('*')
      .eq('user_id', user.id)
      .order('unlocked_at', { ascending: false })

    const hasNewTrophies = userTrophies?.some(t => t.is_new) || false

    return NextResponse.json({
      success: true,
      trophies: userTrophies || [],
      hasNewTrophies
    })

  } catch (error: any) {
    console.error('Error fetching user trophies:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}

// PUT - Recalcul des trophées de l'utilisateur.
// IMPORTANT : délègue à `calculateTrophiesForTournament` (lib/trophy-calculator.ts) — la MÊME
// logique que le cron check-trophies — pour garantir une SOURCE UNIQUE de vérité. L'ancienne
// implémentation maison divergeait (pas de mapping custom-competition, égalités comptées comme
// "premier", état partagé entre tournois) et réattribuait des trophées à tort.
export async function PUT(request: Request) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Non authentifié' },
        { status: 401 }
      )
    }

    // Tournois où l'utilisateur participe (lignes complètes nécessaires au calculateur)
    const { data: parts } = await supabase
      .from('tournament_participants')
      .select('tournament_id, tournaments!inner(*)')
      .eq('user_id', user.id)

    const getJoined = (d: any) => (Array.isArray(d) ? d[0] : d)
    const seen = new Set<string>()
    const tournaments: any[] = []
    for (const p of parts || []) {
      const t = getJoined((p as any).tournaments)
      if (t && !seen.has(t.id)) {
        seen.add(t.id)
        tournaments.push(t)
      }
    }

    let newTrophiesCount = 0

    for (const tournament of tournaments) {
      // Les tournois custom peuvent avoir starting/ending_matchday null (résolus dans le calculateur)
      if (!tournament.starting_matchday && !tournament.custom_competition_id) continue

      const { data: allP } = await supabase
        .from('tournament_participants')
        .select('user_id')
        .eq('tournament_id', tournament.id)
      const participantIds = (allP || []).map((p: any) => p.user_id)
      if (participantIds.length === 0) continue

      const results = await calculateTrophiesForTournament(supabase, tournament, participantIds)
      const r = results.get(user.id)
      if (!r || r.newTrophies.length === 0) continue

      const trophiesToInsert = r.newTrophies.map(type => ({
        user_id: user.id,
        trophy_type: type,
        unlocked_at: r.trophyDates[type],
        is_new: true
      }))

      const { error: insertError } = await supabase
        .from('user_trophies')
        .upsert(trophiesToInsert, {
          onConflict: 'user_id,trophy_type',
          ignoreDuplicates: true
        })

      if (!insertError) newTrophiesCount += r.newTrophies.length
    }

    const { data: userTrophies } = await supabase
      .from('user_trophies')
      .select('*')
      .eq('user_id', user.id)
      .order('unlocked_at', { ascending: false })

    const hasNewTrophies = userTrophies?.some(t => t.is_new) || false

    return NextResponse.json({
      success: true,
      trophies: userTrophies || [],
      hasNewTrophies,
      newTrophiesUnlocked: newTrophiesCount
    })

  } catch (error: any) {
    console.error('Error recalculating user trophies:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}

// POST - Marquer les trophées comme vus
export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Non authentifié' },
        { status: 401 }
      )
    }

    // Marquer tous les trophées comme vus
    const result = await supabase
      .from('user_trophies')
      .update({ is_new: false })
      .eq('user_id', user.id)
      .eq('is_new', true)

    return NextResponse.json({
      success: true
    })

  } catch (error: any) {
    console.error('Error marking trophies as seen:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
