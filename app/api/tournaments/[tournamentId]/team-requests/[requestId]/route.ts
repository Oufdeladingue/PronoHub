import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// PATCH - Traiter une demande d'équipe (approuver/rejeter) - Capitaine uniquement
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tournamentId: string; requestId: string }> }
) {
  try {
    const { tournamentId, requestId } = await params
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // Vérifier que l'utilisateur est le créateur du tournoi
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('creator_id, status, teams_enabled')
      .eq('id', tournamentId)
      .single()

    if (!tournament || tournament.creator_id !== user.id) {
      return NextResponse.json({ error: 'Seul le capitaine peut traiter les demandes' }, { status: 403 })
    }

    if (tournament.status !== 'pending') {
      return NextResponse.json({ error: 'Le tournoi est déjà commencé' }, { status: 400 })
    }

    // Récupérer la demande
    const { data: teamRequest } = await supabase
      .from('team_requests')
      .select('*')
      .eq('id', requestId)
      .eq('tournament_id', tournamentId)
      .single()

    if (!teamRequest) {
      return NextResponse.json({ error: 'Demande non trouvée' }, { status: 404 })
    }

    if (teamRequest.status !== 'pending') {
      return NextResponse.json({ error: 'Cette demande a déjà été traitée' }, { status: 400 })
    }

    const body = await request.json()
    const { action, targetTeamId, teamName, teamAvatar, captainResponse } = body

    // Valider l'action
    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Action invalide' }, { status: 400 })
    }

    if (action === 'reject') {
      // Simplement rejeter la demande
      const { error: updateError } = await supabase
        .from('team_requests')
        .update({
          status: 'rejected',
          captain_response: captainResponse || null,
          processed_at: new Date().toISOString()
        })
        .eq('id', requestId)

      if (updateError) {
        console.error('Error rejecting request:', updateError)
        return NextResponse.json({ error: 'Erreur lors du rejet' }, { status: 500 })
      }

      return NextResponse.json({ success: true, status: 'rejected' })
    }

    // Action = approve
    if (teamRequest.request_type === 'join') {
      // Approuver une demande de rejoindre une équipe existante
      const finalTeamId = targetTeamId || teamRequest.target_team_id

      // Vérifier que l'équipe cible existe
      const { data: targetTeam } = await supabase
        .from('tournament_teams')
        .select('id, name')
        .eq('id', finalTeamId)
        .eq('tournament_id', tournamentId)
        .single()

      if (!targetTeam) {
        return NextResponse.json({ error: 'Équipe cible non trouvée' }, { status: 404 })
      }

      // Retirer le joueur de son équipe actuelle s'il en a une
      await supabase
        .from('tournament_team_members')
        .delete()
        .eq('tournament_id', tournamentId)
        .eq('user_id', teamRequest.user_id)

      // Ajouter le joueur à l'équipe cible
      const { error: addMemberError } = await supabase
        .from('tournament_team_members')
        .insert({
          team_id: finalTeamId,
          user_id: teamRequest.user_id,
          tournament_id: tournamentId
        })

      if (addMemberError) {
        console.error('Error adding member to team:', addMemberError)
        return NextResponse.json({ error: 'Erreur lors de l\'ajout à l\'équipe' }, { status: 500 })
      }

      // Mettre à jour le statut de la demande
      const { error: updateError } = await supabase
        .from('team_requests')
        .update({
          status: 'approved',
          captain_response: captainResponse || null,
          processed_at: new Date().toISOString()
        })
        .eq('id', requestId)

      if (updateError) {
        console.error('Error updating request:', updateError)
      }

      return NextResponse.json({
        success: true,
        status: 'approved',
        teamId: finalTeamId,
        teamName: targetTeam.name
      })

    } else if (teamRequest.request_type === 'suggest') {
      // Approuver une suggestion de nouvelle équipe
      const finalTeamName = teamName || teamRequest.suggested_team_name
      const finalTeamAvatar = teamAvatar || teamRequest.suggested_team_avatar || 'team1'

      if (!finalTeamName) {
        return NextResponse.json({ error: 'Nom d\'équipe requis' }, { status: 400 })
      }

      // Créer la nouvelle équipe
      const { data: newTeam, error: createTeamError } = await supabase
        .from('tournament_teams')
        .insert({
          tournament_id: tournamentId,
          name: finalTeamName.trim().slice(0, 15),
          avatar: finalTeamAvatar
        })
        .select()
        .single()

      if (createTeamError) {
        if (createTeamError.code === '23505') {
          return NextResponse.json({ error: 'Une équipe avec ce nom existe déjà' }, { status: 400 })
        }
        console.error('Error creating team:', createTeamError)
        return NextResponse.json({ error: 'Erreur lors de la création de l\'équipe' }, { status: 500 })
      }

      // Retirer le joueur de son équipe actuelle s'il en a une
      await supabase
        .from('tournament_team_members')
        .delete()
        .eq('tournament_id', tournamentId)
        .eq('user_id', teamRequest.user_id)

      // Ajouter le demandeur à cette équipe
      const { error: addMemberError } = await supabase
        .from('tournament_team_members')
        .insert({
          team_id: newTeam.id,
          user_id: teamRequest.user_id,
          tournament_id: tournamentId
        })

      if (addMemberError) {
        console.error('Error adding member to new team:', addMemberError)
        // Supprimer l'équipe créée en cas d'erreur
        await supabase
          .from('tournament_teams')
          .delete()
          .eq('id', newTeam.id)
        return NextResponse.json({ error: 'Erreur lors de l\'ajout à l\'équipe' }, { status: 500 })
      }

      // Mettre à jour le statut de la demande
      const { error: updateError } = await supabase
        .from('team_requests')
        .update({
          status: 'approved',
          captain_response: captainResponse || null,
          processed_at: new Date().toISOString()
        })
        .eq('id', requestId)

      if (updateError) {
        console.error('Error updating request:', updateError)
      }

      return NextResponse.json({
        success: true,
        status: 'approved',
        teamId: newTeam.id,
        teamName: newTeam.name
      })
    }

    return NextResponse.json({ error: 'Type de demande non supporté' }, { status: 400 })

  } catch (error) {
    console.error('Error processing team request:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
