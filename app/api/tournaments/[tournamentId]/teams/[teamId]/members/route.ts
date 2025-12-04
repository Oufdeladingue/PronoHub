import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST - Ajouter un membre à une équipe
export async function POST(
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
      return NextResponse.json({ error: 'Seul le capitaine peut assigner les joueurs' }, { status: 403 })
    }

    if (tournament.status === 'active' || tournament.status === 'completed') {
      return NextResponse.json({ error: 'Le tournoi est déjà lancé' }, { status: 400 })
    }

    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json({ error: 'L\'ID du joueur est requis' }, { status: 400 })
    }

    // Vérifier que le joueur est participant du tournoi
    const { data: participant } = await supabase
      .from('tournament_participants')
      .select('id')
      .eq('tournament_id', tournamentId)
      .eq('user_id', userId)
      .single()

    if (!participant) {
      return NextResponse.json({ error: 'Ce joueur n\'est pas inscrit au tournoi' }, { status: 400 })
    }

    // Vérifier que l'équipe existe
    const { data: team } = await supabase
      .from('tournament_teams')
      .select('id')
      .eq('id', teamId)
      .eq('tournament_id', tournamentId)
      .single()

    if (!team) {
      return NextResponse.json({ error: 'Équipe non trouvée' }, { status: 404 })
    }

    // Supprimer le joueur de son équipe actuelle s'il en a une
    await supabase
      .from('tournament_team_members')
      .delete()
      .eq('tournament_id', tournamentId)
      .eq('user_id', userId)

    // Ajouter le joueur à la nouvelle équipe
    const { data: member, error: insertError } = await supabase
      .from('tournament_team_members')
      .insert({
        team_id: teamId,
        user_id: userId,
        tournament_id: tournamentId
      })
      .select('id, user_id, joined_at')
      .single()

    if (insertError) {
      console.error('Error adding member:', insertError)
      return NextResponse.json({ error: 'Erreur lors de l\'ajout du membre' }, { status: 500 })
    }

    // Récupérer le profil séparément
    const { data: profile } = await supabase
      .from('profiles')
      .select('username, avatar')
      .eq('id', userId)
      .single()

    return NextResponse.json({
      success: true,
      member: {
        id: member.id,
        userId: member.user_id,
        username: profile?.username || 'Inconnu',
        avatar: profile?.avatar || 'avatar1',
        joinedAt: member.joined_at
      }
    })

  } catch (error) {
    console.error('Error adding team member:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE - Retirer un membre d'une équipe
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
      return NextResponse.json({ error: 'Seul le capitaine peut retirer les joueurs' }, { status: 403 })
    }

    if (tournament.status === 'active' || tournament.status === 'completed') {
      return NextResponse.json({ error: 'Le tournoi est déjà lancé' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'L\'ID du joueur est requis' }, { status: 400 })
    }

    // Supprimer le membre de l'équipe
    const { error: deleteError } = await supabase
      .from('tournament_team_members')
      .delete()
      .eq('team_id', teamId)
      .eq('user_id', userId)
      .eq('tournament_id', tournamentId)

    if (deleteError) {
      console.error('Error removing member:', deleteError)
      return NextResponse.json({ error: 'Erreur lors du retrait du membre' }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error removing team member:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
