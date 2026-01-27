import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth-helpers'
import { UserRole } from '@/types'

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

    // Requêtes parallèles : participants, prédictions, compétition
    const [participantsResult, predictionsResult, competitionResult] = await Promise.all([
      // Participants avec profils
      supabase
        .from('tournament_participants')
        .select('user_id, total_points, rank, joined_at')
        .eq('tournament_id', tournamentId)
        .order('rank', { ascending: true, nullsFirst: false }),

      // Nombre de prédictions par utilisateur
      supabase
        .from('predictions')
        .select('user_id')
        .eq('tournament_id', tournamentId),

      // Compétition (standard ou custom)
      tournament.custom_competition_id
        ? supabase
            .from('custom_competitions')
            .select('name, code, custom_emblem_white, custom_emblem_color')
            .eq('id', tournament.custom_competition_id)
            .single()
        : tournament.competition_id
          ? supabase
              .from('competitions')
              .select('name, code, emblem')
              .eq('id', tournament.competition_id)
              .single()
          : Promise.resolve({ data: null, error: null })
    ])

    const participants = participantsResult.data || []
    const predictions = predictionsResult.data || []

    // Compter les prédictions par user_id
    const predictionCounts: Record<string, number> = {}
    predictions.forEach((p: any) => {
      predictionCounts[p.user_id] = (predictionCounts[p.user_id] || 0) + 1
    })

    // Récupérer les profils des participants
    const userIds = participants.map((p: any) => p.user_id)
    let profilesMap: Record<string, { username: string; avatar: string }> = {}

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar')
        .in('id', userIds)

      ;(profiles || []).forEach((p: any) => {
        profilesMap[p.id] = { username: p.username, avatar: p.avatar }
      })
    }

    // Construire la liste des participants enrichie
    const participantsDetails = participants.map((p: any) => ({
      user_id: p.user_id,
      username: profilesMap[p.user_id]?.username || 'Inconnu',
      avatar: profilesMap[p.user_id]?.avatar || 'avatar1',
      total_points: p.total_points || 0,
      rank: p.rank,
      predictions_count: predictionCounts[p.user_id] || 0,
      joined_at: p.joined_at
    }))

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
      if (profilesMap[tournament.creator_id]) {
        creatorUsername = profilesMap[tournament.creator_id].username
      } else {
        const { data: creatorProfile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', tournament.creator_id)
          .single()
        creatorUsername = creatorProfile?.username || 'Inconnu'
      }
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
        scoring_correct_goal_difference: tournament.scoring_correct_goal_difference ?? 2,
        scoring_draw_with_default_prediction: tournament.scoring_draw_with_default_prediction ?? 1,
        teams_enabled: tournament.teams_enabled || false,
        bonus_match_enabled: tournament.bonus_match_enabled || false,
        early_prediction_bonus: tournament.early_prediction_bonus || false,
        all_matchdays: tournament.all_matchdays || false,
        max_participants: tournament.max_players || tournament.max_participants,
        invite_code: tournament.invite_code,
        competition: competitionInfo,
        participants: participantsDetails,
        total_predictions: predictions.length
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
