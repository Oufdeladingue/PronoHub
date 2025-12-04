import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// PATCH - Modifier une équipe (nom, avatar)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tournamentId: string; teamId: string }> }
) {
  try {
    const { tournamentId, teamId } = await params
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // Vérifier que l'utilisateur est le créateur du tournoi
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('creator_id, status')
      .eq('id', tournamentId)
      .single()

    if (!tournament || tournament.creator_id !== user.id) {
      return NextResponse.json({ error: 'Seul le capitaine peut modifier les équipes' }, { status: 403 })
    }

    if (tournament.status === 'active' || tournament.status === 'completed') {
      return NextResponse.json({ error: 'Le tournoi est déjà lancé' }, { status: 400 })
    }

    const body = await request.json()
    const { name, avatar } = body

    const updateData: Record<string, any> = {}

    if (name !== undefined) {
      if (name.trim().length === 0) {
        return NextResponse.json({ error: 'Le nom de l\'équipe est requis' }, { status: 400 })
      }
      if (name.length > 15) {
        return NextResponse.json({ error: 'Le nom ne peut pas dépasser 15 caractères' }, { status: 400 })
      }
      updateData.name = name.trim()
    }

    if (avatar !== undefined) {
      updateData.avatar = avatar
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Aucune modification fournie' }, { status: 400 })
    }

    updateData.updated_at = new Date().toISOString()

    const { data: team, error: updateError } = await supabase
      .from('tournament_teams')
      .update(updateData)
      .eq('id', teamId)
      .eq('tournament_id', tournamentId)
      .select()
      .single()

    if (updateError) {
      if (updateError.code === '23505') {
        return NextResponse.json({ error: 'Une équipe avec ce nom existe déjà' }, { status: 400 })
      }
      console.error('Error updating team:', updateError)
      return NextResponse.json({ error: 'Erreur lors de la modification' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      team: {
        id: team.id,
        name: team.name,
        avatar: team.avatar
      }
    })

  } catch (error) {
    console.error('Error updating team:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE - Supprimer une équipe
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ tournamentId: string; teamId: string }> }
) {
  try {
    const { tournamentId, teamId } = await params
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // Vérifier que l'utilisateur est le créateur du tournoi
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('creator_id, status')
      .eq('id', tournamentId)
      .single()

    if (!tournament || tournament.creator_id !== user.id) {
      return NextResponse.json({ error: 'Seul le capitaine peut supprimer les équipes' }, { status: 403 })
    }

    if (tournament.status === 'active' || tournament.status === 'completed') {
      return NextResponse.json({ error: 'Le tournoi est déjà lancé' }, { status: 400 })
    }

    // Supprimer l'équipe (les membres seront supprimés en cascade)
    const { error: deleteError } = await supabase
      .from('tournament_teams')
      .delete()
      .eq('id', teamId)
      .eq('tournament_id', tournamentId)

    if (deleteError) {
      console.error('Error deleting team:', deleteError)
      return NextResponse.json({ error: 'Erreur lors de la suppression' }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error deleting team:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
