import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET - Récupérer toutes les compétitions custom
export async function GET() {
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

    // Récupérer les compétitions custom avec le nombre de journées
    const { data: competitions, error } = await supabase
      .from('custom_competitions')
      .select(`
        *,
        matchdays:custom_competition_matchdays(count)
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching custom competitions:', error)
      return NextResponse.json({ error: 'Failed to fetch competitions' }, { status: 500 })
    }

    // Formater les données
    const formattedCompetitions = competitions?.map(comp => ({
      ...comp,
      matchdaysCount: comp.matchdays?.[0]?.count || 0
    })) || []

    return NextResponse.json({
      success: true,
      competitions: formattedCompetitions
    })
  } catch (error: any) {
    console.error('Error in custom-competitions GET:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Créer une nouvelle compétition custom
export async function POST(request: Request) {
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

    const body = await request.json()
    const { name, code, description, competition_type, matches_per_matchday, season } = body

    if (!name || !code) {
      return NextResponse.json({ error: 'Nom et code requis' }, { status: 400 })
    }

    // Créer la compétition
    const { data: competition, error } = await supabase
      .from('custom_competitions')
      .insert({
        name,
        code: code.toUpperCase(),
        description,
        competition_type: competition_type || 'best_of_week',
        matches_per_matchday: matches_per_matchday || 8,
        season: season || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
        is_active: true,
        created_by: user.id
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Ce code existe déjà' }, { status: 400 })
      }
      console.error('Error creating custom competition:', error)
      return NextResponse.json({ error: 'Failed to create competition' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      competition,
      message: `Compétition "${name}" créée avec succès`
    })
  } catch (error: any) {
    console.error('Error in custom-competitions POST:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH - Mettre à jour une compétition custom (is_active, description, etc.)
export async function PATCH(request: Request) {
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

    const body = await request.json()
    const { id, is_active, description } = body

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    // Construire l'objet de mise à jour dynamiquement
    const updateData: Record<string, any> = {}
    let message = 'Compétition mise à jour'

    if (typeof is_active === 'boolean') {
      updateData.is_active = is_active
      message = `Compétition ${is_active ? 'activée' : 'désactivée'}`
    }

    if (description !== undefined) {
      updateData.description = description
      message = 'Description mise à jour'
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Aucune donnée à mettre à jour' }, { status: 400 })
    }

    const { data: competition, error } = await supabase
      .from('custom_competitions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating custom competition:', error)
      return NextResponse.json({ error: 'Failed to update competition' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      competition,
      message
    })
  } catch (error: any) {
    console.error('Error in custom-competitions PATCH:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Supprimer une compétition custom
export async function DELETE(request: Request) {
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
    const competitionId = searchParams.get('id')

    if (!competitionId) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const { error } = await supabase
      .from('custom_competitions')
      .delete()
      .eq('id', competitionId)

    if (error) {
      console.error('Error deleting custom competition:', error)
      return NextResponse.json({ error: 'Failed to delete competition' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Compétition supprimée'
    })
  } catch (error: any) {
    console.error('Error in custom-competitions DELETE:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
