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

    // Récupérer les données du tournoi
    const body = await request.json()
    const {
      name,
      slug,
      competitionId,
      competitionName,
      maxPlayers,
      numMatchdays,
      allMatchdays,
      bonusMatchEnabled,
      drawWithDefaultPredictionPoints
    } = body

    // Validation
    if (!name || !slug || !competitionId || !competitionName) {
      return NextResponse.json(
        { success: false, error: 'Données manquantes' },
        { status: 400 }
      )
    }

    // Vérifier que le slug n'existe pas déjà
    const { data: existingTournament } = await supabase
      .from('tournaments')
      .select('id')
      .eq('slug', slug)
      .single()

    if (existingTournament) {
      return NextResponse.json(
        { success: false, error: 'Ce code de tournoi existe déjà' },
        { status: 409 }
      )
    }

    // Créer le tournoi
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .insert({
        name,
        slug,
        invite_code: slug, // Pour compatibilité avec ancienne structure
        competition_id: parseInt(competitionId),
        competition_name: competitionName,
        max_players: maxPlayers,
        max_participants: maxPlayers, // Pour compatibilité avec ancienne structure
        num_matchdays: numMatchdays,
        matchdays_count: numMatchdays, // Pour compatibilité avec ancienne structure
        all_matchdays: allMatchdays,
        bonus_match_enabled: bonusMatchEnabled,
        creator_id: user.id,
        status: 'pending',
        current_participants: 1, // Le créateur
        scoring_exact_score: 3, // Valeurs par défaut
        scoring_correct_winner: 1,
        scoring_correct_goal_difference: 2,
        scoring_draw_with_default_prediction: drawWithDefaultPredictionPoints || 1
      })
      .select()
      .single()

    if (tournamentError) {
      console.error('Error creating tournament:', tournamentError)
      return NextResponse.json(
        { success: false, error: 'Erreur lors de la création du tournoi' },
        { status: 500 }
      )
    }

    // Vérifier si l'utilisateur a un profil
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      console.error('User has no profile, skipping participant insertion')
      return NextResponse.json({
        success: true,
        tournament,
        warning: 'Tournoi créé mais profil utilisateur manquant'
      })
    }

    // Ajouter le créateur comme premier participant
    const { error: playerError } = await supabase
      .from('tournament_participants')
      .insert({
        tournament_id: tournament.id,
        user_id: user.id
      })

    if (playerError) {
      console.error('Error adding participant:', playerError)
      // On continue quand même, le tournoi est créé
    }

    // Créer les journées du tournoi
    const journeys = []
    for (let i = 1; i <= numMatchdays; i++) {
      journeys.push({
        tournament_id: tournament.id,
        journey_number: i,
        status: 'pending'
      })
    }

    const { error: journeysError } = await supabase
      .from('tournament_journeys')
      .insert(journeys)

    if (journeysError) {
      console.error('Error creating tournament journeys:', journeysError)
      // On continue quand même, le tournoi est créé
    }

    return NextResponse.json({
      success: true,
      tournament
    })

  } catch (error: any) {
    console.error('Error in tournament creation:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
