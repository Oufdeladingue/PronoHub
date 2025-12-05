import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

    const formattedMatchdays = matchdays?.map(md => ({
      ...md,
      matchesCount: md.matches?.[0]?.count || 0
    })) || []

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

    // Mettre à jour le compteur de journées
    await supabase
      .from('custom_competitions')
      .update({ total_matchdays: finalMatchdayNumber })
      .eq('id', id)

    return NextResponse.json({
      success: true,
      matchday,
      message: `Journée ${finalMatchdayNumber} créée`
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

    const { error } = await supabase
      .from('custom_competition_matchdays')
      .delete()
      .eq('id', matchdayId)

    if (error) {
      console.error('Error deleting matchday:', error)
      return NextResponse.json({ error: 'Failed to delete matchday' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Journée supprimée'
    })
  } catch (error: any) {
    console.error('Error in matchdays DELETE:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
