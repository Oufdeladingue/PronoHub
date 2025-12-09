import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET - Récupérer les demandes d'équipe d'un tournoi (pour le capitaine) ou ses propres demandes (pour un joueur)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  try {
    const { tournamentId } = await params
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // Vérifier que l'utilisateur est participant du tournoi
    const { data: participant } = await supabase
      .from('tournament_participants')
      .select('id')
      .eq('tournament_id', tournamentId)
      .eq('user_id', user.id)
      .single()

    if (!participant) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    // Récupérer les infos du tournoi
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('creator_id, status, teams_enabled')
      .eq('id', tournamentId)
      .single()

    const isCaptain = tournament?.creator_id === user.id

    // Récupérer les demandes
    let query = supabase
      .from('team_requests')
      .select('*')
      .eq('tournament_id', tournamentId)

    // Si pas capitaine, ne montrer que ses propres demandes
    if (!isCaptain) {
      query = query.eq('user_id', user.id)
    }

    const { data: requests, error: requestsError } = await query.order('created_at', { ascending: false })

    if (requestsError) {
      console.error('Error fetching team requests:', requestsError)
      return NextResponse.json({ error: 'Erreur lors de la récupération des demandes' }, { status: 500 })
    }

    // Charger les profils des utilisateurs qui ont fait des demandes
    const userIds = [...new Set((requests || []).map(r => r.user_id))]
    let profilesMap: Record<string, { username: string; avatar: string }> = {}

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar')
        .in('id', userIds)

      if (profiles) {
        profiles.forEach(p => {
          profilesMap[p.id] = { username: p.username || 'Inconnu', avatar: p.avatar || 'avatar1' }
        })
      }
    }

    // Charger les noms des équipes ciblées
    const teamIds = [...new Set((requests || []).filter(r => r.target_team_id).map(r => r.target_team_id))]
    let teamsMap: Record<string, { name: string; avatar: string }> = {}

    if (teamIds.length > 0) {
      const { data: teams } = await supabase
        .from('tournament_teams')
        .select('id, name, avatar')
        .in('id', teamIds)

      if (teams) {
        teams.forEach(t => {
          teamsMap[t.id] = { name: t.name, avatar: t.avatar }
        })
      }
    }

    // Formater les demandes
    const formattedRequests = (requests || []).map(r => ({
      id: r.id,
      userId: r.user_id,
      username: profilesMap[r.user_id]?.username || 'Inconnu',
      avatar: profilesMap[r.user_id]?.avatar || 'avatar1',
      requestType: r.request_type,
      status: r.status,
      message: r.message,
      captainResponse: r.captain_response,
      createdAt: r.created_at,
      processedAt: r.processed_at,
      // Pour les demandes de type 'join'
      targetTeamId: r.target_team_id,
      targetTeamName: r.target_team_id ? teamsMap[r.target_team_id]?.name : null,
      targetTeamAvatar: r.target_team_id ? teamsMap[r.target_team_id]?.avatar : null,
      // Pour les demandes de type 'suggest'
      suggestedTeamName: r.suggested_team_name,
      suggestedTeamAvatar: r.suggested_team_avatar
    }))

    // Compter les demandes en attente (pour le badge)
    const pendingCount = (requests || []).filter(r => r.status === 'pending').length

    return NextResponse.json({
      success: true,
      isCaptain,
      teamsEnabled: tournament?.teams_enabled || false,
      tournamentStatus: tournament?.status,
      requests: formattedRequests,
      pendingCount
    })

  } catch (error) {
    console.error('Error in team-requests API:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST - Créer une nouvelle demande d'équipe (postuler ou suggérer)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  try {
    const { tournamentId } = await params
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // Vérifier que l'utilisateur est participant du tournoi
    const { data: participant } = await supabase
      .from('tournament_participants')
      .select('id')
      .eq('tournament_id', tournamentId)
      .eq('user_id', user.id)
      .single()

    if (!participant) {
      return NextResponse.json({ error: 'Vous devez être participant du tournoi' }, { status: 403 })
    }

    // Vérifier le statut du tournoi
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('status, teams_enabled, creator_id')
      .eq('id', tournamentId)
      .single()

    if (tournament?.status !== 'pending') {
      return NextResponse.json({ error: 'Le tournoi est déjà commencé' }, { status: 400 })
    }

    if (!tournament?.teams_enabled) {
      return NextResponse.json({ error: 'Le mode équipe n\'est pas activé' }, { status: 400 })
    }

    // Le capitaine n'a pas besoin de faire des demandes
    if (tournament?.creator_id === user.id) {
      return NextResponse.json({ error: 'Le capitaine peut gérer les équipes directement' }, { status: 400 })
    }

    // Vérifier qu'il n'y a pas déjà une demande en attente
    const { data: existingRequest } = await supabase
      .from('team_requests')
      .select('id')
      .eq('tournament_id', tournamentId)
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .single()

    if (existingRequest) {
      return NextResponse.json({ error: 'Vous avez déjà une demande en attente' }, { status: 400 })
    }

    const body = await request.json()
    const { requestType, targetTeamId, suggestedTeamName, suggestedTeamAvatar, message } = body

    // Valider le type de demande
    if (!['join', 'suggest'].includes(requestType)) {
      return NextResponse.json({ error: 'Type de demande invalide' }, { status: 400 })
    }

    // Pour une demande de type 'join', vérifier que l'équipe cible existe
    if (requestType === 'join') {
      if (!targetTeamId) {
        return NextResponse.json({ error: 'Équipe cible requise' }, { status: 400 })
      }

      const { data: team } = await supabase
        .from('tournament_teams')
        .select('id')
        .eq('id', targetTeamId)
        .eq('tournament_id', tournamentId)
        .single()

      if (!team) {
        return NextResponse.json({ error: 'Équipe non trouvée' }, { status: 404 })
      }
    }

    // Pour une demande de type 'suggest', valider le nom suggéré
    if (requestType === 'suggest') {
      if (!suggestedTeamName || suggestedTeamName.trim().length === 0) {
        return NextResponse.json({ error: 'Nom d\'équipe requis' }, { status: 400 })
      }

      if (suggestedTeamName.length > 15) {
        return NextResponse.json({ error: 'Le nom ne peut pas dépasser 15 caractères' }, { status: 400 })
      }
    }

    // Créer la demande
    const { data: newRequest, error: createError } = await supabase
      .from('team_requests')
      .insert({
        tournament_id: tournamentId,
        user_id: user.id,
        request_type: requestType,
        target_team_id: requestType === 'join' ? targetTeamId : null,
        suggested_team_name: requestType === 'suggest' ? suggestedTeamName.trim() : null,
        suggested_team_avatar: requestType === 'suggest' ? (suggestedTeamAvatar || 'team1') : null,
        message: message || null,
        status: 'pending'
      })
      .select()
      .single()

    if (createError) {
      console.error('Error creating team request:', createError)
      return NextResponse.json({ error: 'Erreur lors de la création de la demande' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      request: newRequest
    })

  } catch (error) {
    console.error('Error creating team request:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE - Annuler sa propre demande en attente
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  try {
    const { tournamentId } = await params
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const requestId = searchParams.get('requestId')

    if (!requestId) {
      return NextResponse.json({ error: 'ID de demande requis' }, { status: 400 })
    }

    // Vérifier que la demande appartient à l'utilisateur et est en attente
    const { data: existingRequest } = await supabase
      .from('team_requests')
      .select('id, user_id, status')
      .eq('id', requestId)
      .eq('tournament_id', tournamentId)
      .single()

    if (!existingRequest) {
      return NextResponse.json({ error: 'Demande non trouvée' }, { status: 404 })
    }

    if (existingRequest.user_id !== user.id) {
      return NextResponse.json({ error: 'Vous ne pouvez annuler que vos propres demandes' }, { status: 403 })
    }

    if (existingRequest.status !== 'pending') {
      return NextResponse.json({ error: 'Seules les demandes en attente peuvent être annulées' }, { status: 400 })
    }

    // Supprimer la demande
    const { error: deleteError } = await supabase
      .from('team_requests')
      .delete()
      .eq('id', requestId)

    if (deleteError) {
      console.error('Error deleting team request:', deleteError)
      return NextResponse.json({ error: 'Erreur lors de la suppression' }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error deleting team request:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
