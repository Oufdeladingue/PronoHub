import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth-helpers'
import { UserRole } from '@/types'
import { calculateTournamentStats } from '@/lib/calculate-tournament-stats'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  try {
    const { tournamentId } = await params
    const supabase = await createClient()

    // Vérifier que l'utilisateur est super admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!isSuperAdmin(profile?.role as UserRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Récupérer le tournoi avec tous ses champs
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', tournamentId)
      .single()

    if (tournamentError || !tournament) {
      return NextResponse.json({ error: 'Tournoi non trouvé' }, { status: 404 })
    }

    // Récupérer la compétition
    const competitionResult = tournament.custom_competition_id
      ? await supabase
          .from('custom_competitions')
          .select('name, code, custom_emblem_white, custom_emblem_color')
          .eq('id', tournament.custom_competition_id)
          .single()
      : tournament.competition_id
        ? await supabase
            .from('competitions')
            .select('name, code, emblem')
            .eq('id', tournament.competition_id)
            .single()
        : { data: null, error: null }

    // Calculer les statistiques dynamiquement (points, rangs, nombre de pronos)
    const participantsDetails = await calculateTournamentStats({
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      tournamentId,
      includeDetailedStats: false
    })

    // Compter le total de prédictions enregistrées
    const totalPredictions = participantsDetails.reduce((sum, p) => sum + p.predictions_count, 0)

    // Compétition
    const competition = competitionResult.data as any
    const competitionInfo = competition ? {
      name: competition.name,
      code: competition.code,
      emblem: competition.emblem || competition.custom_emblem_color || null,
      is_custom: !!tournament.custom_competition_id
    } : null

    // Récupérer le username du créateur
    let creatorUsername = 'Inconnu'
    if (tournament.creator_id) {
      const { data: creatorProfile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', tournament.creator_id)
        .single()
      creatorUsername = creatorProfile?.username || 'Inconnu'
    }

    return NextResponse.json({
      success: true,
      tournament: {
        id: tournament.id,
        name: tournament.name,
        slug: tournament.slug,
        status: tournament.status,
        tournament_type: tournament.tournament_type,
        created_at: tournament.created_at,
        creator_username: creatorUsername,
        starting_matchday: tournament.starting_matchday,
        ending_matchday: tournament.ending_matchday,
        planned_matchdays: tournament.planned_matchdays,
        actual_matchdays: tournament.actual_matchdays,
        scoring_exact_score: tournament.scoring_exact_score ?? 3,
        scoring_correct_winner: tournament.scoring_correct_winner ?? 1,
        scoring_draw_with_default_prediction: tournament.scoring_draw_with_default_prediction ?? 0,
        teams_enabled: tournament.teams_enabled || false,
        bonus_match_enabled: tournament.bonus_match_enabled || false,
        early_prediction_bonus: tournament.early_prediction_bonus || false,
        all_matchdays: tournament.all_matchdays || false,
        max_participants: tournament.max_players || tournament.max_participants,
        invite_code: tournament.invite_code,
        competition: competitionInfo,
        participants: participantsDetails,
        total_predictions: totalPredictions
      }
    })

  } catch (error: any) {
    console.error('Error fetching tournament detail:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
