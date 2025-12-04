import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET - Récupérer les équipes d'un tournoi
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

    // Récupérer les infos du tournoi (teams_enabled)
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('teams_enabled, creator_id, status')
      .eq('id', tournamentId)
      .single()

    // Récupérer les équipes avec leurs membres
    const { data: teams, error: teamsError } = await supabase
      .from('tournament_teams')
      .select(`
        id,
        name,
        avatar,
        created_at,
        tournament_team_members (
          id,
          user_id,
          joined_at
        )
      `)
      .eq('tournament_id', tournamentId)
      .order('created_at', { ascending: true })

    if (teamsError) {
      console.error('Error fetching teams:', teamsError)
      return NextResponse.json({ error: 'Erreur lors de la récupération des équipes' }, { status: 500 })
    }

    // Récupérer tous les user_ids des membres pour charger leurs profils
    const allUserIds = new Set<string>()
    ;(teams || []).forEach(team => {
      ;(team.tournament_team_members || []).forEach((member: any) => {
        allUserIds.add(member.user_id)
      })
    })

    // Charger les profils en une seule requête
    let profilesMap: Record<string, { username: string; avatar: string }> = {}
    if (allUserIds.size > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar')
        .in('id', Array.from(allUserIds))

      if (profiles) {
        profiles.forEach(p => {
          profilesMap[p.id] = { username: p.username || 'Inconnu', avatar: p.avatar || 'avatar1' }
        })
      }
    }

    // Formater les équipes
    const formattedTeams = (teams || []).map(team => ({
      id: team.id,
      name: team.name,
      avatar: team.avatar,
      members: (team.tournament_team_members || []).map((member: any) => ({
        id: member.id,
        userId: member.user_id,
        username: profilesMap[member.user_id]?.username || 'Inconnu',
        avatar: profilesMap[member.user_id]?.avatar || 'avatar1',
        joinedAt: member.joined_at
      }))
    }))

    return NextResponse.json({
      success: true,
      teamsEnabled: tournament?.teams_enabled || false,
      isCreator: tournament?.creator_id === user.id,
      tournamentStatus: tournament?.status,
      teams: formattedTeams
    })

  } catch (error) {
    console.error('Error in teams API:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST - Créer une nouvelle équipe
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

    // Vérifier que l'utilisateur est le créateur du tournoi
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('creator_id, status')
      .eq('id', tournamentId)
      .single()

    if (!tournament || tournament.creator_id !== user.id) {
      return NextResponse.json({ error: 'Seul le capitaine peut créer des équipes' }, { status: 403 })
    }

    if (tournament.status === 'active' || tournament.status === 'completed') {
      return NextResponse.json({ error: 'Le tournoi est déjà lancé' }, { status: 400 })
    }

    const body = await request.json()
    const { name, avatar } = body

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: 'Le nom de l\'équipe est requis' }, { status: 400 })
    }

    if (name.length > 15) {
      return NextResponse.json({ error: 'Le nom ne peut pas dépasser 15 caractères' }, { status: 400 })
    }

    // Créer l'équipe
    const { data: team, error: createError } = await supabase
      .from('tournament_teams')
      .insert({
        tournament_id: tournamentId,
        name: name.trim(),
        avatar: avatar || 'team1'
      })
      .select()
      .single()

    if (createError) {
      if (createError.code === '23505') {
        return NextResponse.json({ error: 'Une équipe avec ce nom existe déjà' }, { status: 400 })
      }
      console.error('Error creating team:', createError)
      return NextResponse.json({ error: 'Erreur lors de la création de l\'équipe' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      team: {
        id: team.id,
        name: team.name,
        avatar: team.avatar,
        members: []
      }
    })

  } catch (error) {
    console.error('Error creating team:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PATCH - Activer/désactiver le mode équipe
export async function PATCH(
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

    // Vérifier que l'utilisateur est le créateur du tournoi
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('creator_id, status, tournament_type')
      .eq('id', tournamentId)
      .single()

    if (!tournament || tournament.creator_id !== user.id) {
      return NextResponse.json({ error: 'Seul le capitaine peut modifier ce paramètre' }, { status: 403 })
    }

    if (tournament.status === 'active' || tournament.status === 'completed') {
      return NextResponse.json({ error: 'Le tournoi est déjà lancé' }, { status: 400 })
    }

    // Vérifier que c'est un tournoi Elite ou Platinium
    if (!['elite', 'platinium'].includes(tournament.tournament_type || '')) {
      return NextResponse.json({ error: 'Le mode équipe n\'est disponible que pour les tournois Elite et Platinium' }, { status: 400 })
    }

    const body = await request.json()
    const { teamsEnabled } = body

    // Mettre à jour le paramètre
    const { error: updateError } = await supabase
      .from('tournaments')
      .update({ teams_enabled: teamsEnabled })
      .eq('id', tournamentId)

    if (updateError) {
      console.error('Error updating teams_enabled:', updateError)
      return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 })
    }

    // Si désactivation, supprimer toutes les équipes
    if (!teamsEnabled) {
      await supabase
        .from('tournament_teams')
        .delete()
        .eq('tournament_id', tournamentId)
    }

    return NextResponse.json({
      success: true,
      teamsEnabled
    })

  } catch (error) {
    console.error('Error updating teams mode:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
