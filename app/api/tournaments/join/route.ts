import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Non authentifié' },
        { status: 401 }
      )
    }

    // Récupérer le code du tournoi
    const body = await request.json()
    const { code } = body

    if (!code || code.length !== 8) {
      return NextResponse.json(
        { success: false, error: 'Code invalide (8 caractères requis)' },
        { status: 400 }
      )
    }

    // Rechercher le tournoi par son code (slug ou invite_code)
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('*')
      .or(`slug.eq.${code},invite_code.eq.${code}`)
      .single()

    if (tournamentError || !tournament) {
      return NextResponse.json(
        { success: false, error: 'Tournoi introuvable avec ce code' },
        { status: 404 }
      )
    }

    // Vérifier que le tournoi n'est pas terminé
    if (tournament.status === 'finished') {
      return NextResponse.json(
        { success: false, error: 'Ce tournoi est terminé' },
        { status: 400 }
      )
    }

    // Vérifier si l'utilisateur participe déjà
    const { data: existingParticipation } = await supabase
      .from('tournament_participants')
      .select('id')
      .eq('tournament_id', tournament.id)
      .eq('user_id', user.id)
      .single()

    if (existingParticipation) {
      return NextResponse.json(
        { success: false, error: 'Vous participez déjà à ce tournoi' },
        { status: 400 }
      )
    }

    // Vérifier le nombre de tournois de l'utilisateur
    const { data: userTournaments } = await supabase
      .from('tournament_participants')
      .select('id')
      .eq('user_id', user.id)

    // Récupérer la limite depuis les paramètres admin
    const { data: maxTournamentsSettings } = await supabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'max_tournaments_per_user')
      .single()

    const maxTournaments = parseInt(maxTournamentsSettings?.setting_value || '3')
    const currentTournamentCount = userTournaments?.length || 0

    if (currentTournamentCount >= maxTournaments) {
      return NextResponse.json(
        { success: false, error: `Vous ne pouvez pas participer à plus de ${maxTournaments} tournois simultanément` },
        { status: 400 }
      )
    }

    // Vérifier si le tournoi est complet
    const maxPlayers = tournament.max_players || tournament.max_participants || 8
    const currentParticipants = tournament.current_participants || 0

    if (currentParticipants >= maxPlayers) {
      return NextResponse.json(
        { success: false, error: 'Ce tournoi est complet' },
        { status: 400 }
      )
    }

    // Vérifier si l'utilisateur a un profil
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json(
        { success: false, error: 'Profil utilisateur introuvable' },
        { status: 404 }
      )
    }

    // Ajouter l'utilisateur au tournoi
    const { error: participationError } = await supabase
      .from('tournament_participants')
      .insert({
        tournament_id: tournament.id,
        user_id: user.id
      })

    if (participationError) {
      console.error('Error adding participant:', participationError)
      return NextResponse.json(
        { success: false, error: 'Erreur lors de l\'inscription au tournoi' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      tournament: {
        id: tournament.id,
        name: tournament.name,
        slug: tournament.slug,
        invite_code: tournament.invite_code,
        competition_name: tournament.competition_name,
        status: tournament.status
      }
    })

  } catch (error: any) {
    console.error('Error in tournament join:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
