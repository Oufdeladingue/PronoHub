import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

/**
 * Renumérote les journées d'une compétition custom de façon contiguë (1..N) dans l'ordre
 * chronologique des semaines (week_start). Appelé après création/suppression pour que les
 * numéros se suivent toujours, même après un saut de semaine, une suppression ou une insertion.
 * Renumérotation en 2 passes (valeurs temporaires) pour ne pas violer UNIQUE(comp, matchday_number).
 * Met aussi à jour total_matchdays.
 */
async function resequenceMatchdays(admin: ReturnType<typeof createAdminClient>, competitionId: string) {
  const { data: mds } = await admin
    .from('custom_competition_matchdays')
    .select('id, matchday_number, week_start')
    .eq('custom_competition_id', competitionId)
    .order('week_start', { ascending: true })

  const list = mds || []
  // Maj du compteur total
  await admin.from('custom_competitions').update({ total_matchdays: list.length }).eq('id', competitionId)

  const changed = list
    .map((m, i) => ({ id: m.id, want: i + 1, current: m.matchday_number }))
    .filter(t => t.current !== t.want)
  if (changed.length === 0) return

  // Pass 1 : numéros temporaires (offset) pour éviter toute collision sur la contrainte UNIQUE
  for (const t of changed) {
    await admin.from('custom_competition_matchdays').update({ matchday_number: 100000 + t.want }).eq('id', t.id)
  }
  // Pass 2 : numéros finaux 1..N
  for (const t of changed) {
    await admin.from('custom_competition_matchdays').update({ matchday_number: t.want }).eq('id', t.id)
  }
}

// GET - Récupérer les journées d'une compétition custom
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Vérifier que l'utilisateur est admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Récupérer les journées avec le nombre de matchs
    const { data: matchdays, error } = await supabase
      .from('custom_competition_matchdays')
      .select(`
        *,
        matches:custom_competition_matches(count)
      `)
      .eq('custom_competition_id', id)
      .order('matchday_number', { ascending: true })

    if (error) {
      console.error('Error fetching matchdays:', error)
      return NextResponse.json({ error: 'Failed to fetch matchdays' }, { status: 500 })
    }

    // Pour chaque journée, vérifier si tous les matchs sont terminés
    const formattedMatchdays = await Promise.all((matchdays || []).map(async (md) => {
      const matchesCount = md.matches?.[0]?.count || 0

      // Si pas de matchs, ne pas considérer comme terminée
      if (matchesCount === 0) {
        return {
          ...md,
          matchesCount,
          allMatchesFinished: false
        }
      }

      // Récupérer les matchs de cette journée avec leur statut via imported_matches
      const { data: customMatches } = await supabase
        .from('custom_competition_matches')
        .select('football_data_match_id')
        .eq('custom_matchday_id', md.id)

      if (!customMatches || customMatches.length === 0) {
        return {
          ...md,
          matchesCount,
          allMatchesFinished: false
        }
      }

      const footballDataIds = customMatches
        .map(m => m.football_data_match_id)
        .filter(id => id !== null)

      if (footballDataIds.length === 0) {
        return {
          ...md,
          matchesCount,
          allMatchesFinished: false
        }
      }

      // Vérifier le statut de chaque match
      const { data: importedMatches } = await supabase
        .from('imported_matches')
        .select('status')
        .in('football_data_match_id', footballDataIds)

      const allFinished = importedMatches &&
        importedMatches.length === footballDataIds.length &&
        importedMatches.every(m => m.status === 'FINISHED')

      return {
        ...md,
        matchesCount,
        allMatchesFinished: allFinished || false
      }
    }))

    return NextResponse.json({
      success: true,
      matchdays: formattedMatchdays
    })
  } catch (error: any) {
    console.error('Error in matchdays GET:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Créer une nouvelle journée
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Vérifier que l'utilisateur est admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { week_start, week_end, matchday_number } = body

    if (!week_start || !week_end) {
      return NextResponse.json({ error: 'Dates de début et fin requises' }, { status: 400 })
    }

    // Déterminer le numéro de journée si non fourni
    let finalMatchdayNumber = matchday_number
    if (!finalMatchdayNumber) {
      const { data: lastMatchday } = await supabase
        .from('custom_competition_matchdays')
        .select('matchday_number')
        .eq('custom_competition_id', id)
        .order('matchday_number', { ascending: false })
        .limit(1)
        .single()

      finalMatchdayNumber = (lastMatchday?.matchday_number || 0) + 1
    }

    // Créer la journée
    const { data: matchday, error } = await supabase
      .from('custom_competition_matchdays')
      .insert({
        custom_competition_id: id,
        matchday_number: finalMatchdayNumber,
        week_start,
        week_end,
        status: 'draft',
        created_by: user.id
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Cette journée existe déjà' }, { status: 400 })
      }
      console.error('Error creating matchday:', error)
      return NextResponse.json({ error: 'Failed to create matchday' }, { status: 500 })
    }

    // Renumérotation contiguë par date (gère l'insertion d'une semaine entre deux journées)
    const adminSupabase = createAdminClient()
    await resequenceMatchdays(adminSupabase, id)

    return NextResponse.json({
      success: true,
      matchday,
      message: 'Journée créée'
    })
  } catch (error: any) {
    console.error('Error in matchdays POST:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Supprimer une journée
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: competitionId } = await params
    const supabase = await createClient()

    // Vérifier que l'utilisateur est admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const matchdayId = searchParams.get('matchdayId')

    if (!matchdayId) {
      return NextResponse.json({ error: 'ID de journée requis' }, { status: 400 })
    }

    // Utiliser le client admin (service role) pour bypass RLS sur les opérations de suppression
    const adminSupabase = createAdminClient()

    const { error, count } = await adminSupabase
      .from('custom_competition_matchdays')
      .delete({ count: 'exact' })
      .eq('id', matchdayId)

    if (error) {
      console.error('Error deleting matchday:', error)
      return NextResponse.json({ error: 'Failed to delete matchday' }, { status: 500 })
    }

    if (count === 0) {
      return NextResponse.json({ error: 'Journée introuvable' }, { status: 404 })
    }

    // Renumérotation contiguë par date après suppression (J1, J3 → J1, J2…)
    await resequenceMatchdays(adminSupabase, competitionId)

    return NextResponse.json({
      success: true,
      message: 'Journée supprimée'
    })
  } catch (error: any) {
    console.error('Error in matchdays DELETE:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
