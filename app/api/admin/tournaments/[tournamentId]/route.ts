import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
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

    // Lancer en parallèle: compétition, stats participants, et créateur
    const adminClient = createAdminClient()

    const [competitionResult, participantsDetails, creatorProfile] = await Promise.all([
      // Compétition
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
          : Promise.resolve({ data: null, error: null }),

      // Calculer les statistiques dynamiquement (points, rangs, nombre de pronos)
      calculateTournamentStats({
        supabase: adminClient,
        tournamentId,
        includeDetailedStats: false
      }),

      // Créateur
      tournament.creator_id
        ? supabase
            .from('profiles')
            .select('username')
            .eq('id', tournament.creator_id)
            .single()
            .then(res => res.data)
        : Promise.resolve(null)
    ])

    // Récupérer les achats d'accès stats pour ce tournoi
    const participantIds = participantsDetails.map(p => p.user_id)

    // Récupérer les achats stats_access_tournament pour ce tournoi + stats_access_lifetime
    const { data: statsAccessPurchases } = await adminClient
      .from('tournament_purchases')
      .select('user_id, purchase_type')
      .in('user_id', participantIds)
      .in('purchase_type', ['stats_access_tournament', 'stats_access_lifetime'])
      .eq('status', 'completed')

    // Filtrer: stats_access_tournament doit correspondre à ce tournamentId
    const { data: tournamentStatsPurchases } = await adminClient
      .from('tournament_purchases')
      .select('user_id')
      .in('user_id', participantIds)
      .eq('purchase_type', 'stats_access_tournament')
      .eq('tournament_id', tournamentId)
      .eq('status', 'completed')

    // Créer un map des accès stats par user
    const statsAccessMap = new Map<string, 'lifetime' | 'tournament'>()

    // D'abord les lifetime (priorité)
    for (const purchase of (statsAccessPurchases || [])) {
      if (purchase.purchase_type === 'stats_access_lifetime') {
        statsAccessMap.set(purchase.user_id, 'lifetime')
      }
    }

    // Ensuite les tournament-specific (si pas déjà lifetime)
    for (const purchase of (tournamentStatsPurchases || [])) {
      if (!statsAccessMap.has(purchase.user_id)) {
        statsAccessMap.set(purchase.user_id, 'tournament')
      }
    }

    // Enrichir les participants avec l'info stats access
    const participantsWithStatsAccess = participantsDetails.map(p => ({
      ...p,
      has_stats_access: statsAccessMap.has(p.user_id),
      stats_access_type: statsAccessMap.get(p.user_id) || null
    }))

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

    // Username du créateur (déjà récupéré en parallèle)
    const creatorUsername = creatorProfile?.username || 'Inconnu'

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
        participants: participantsWithStatsAccess,
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
