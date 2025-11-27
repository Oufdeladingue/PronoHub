import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { TournamentType, ACCOUNT_LIMITS } from '@/types/monetization'

// Déterminer le type de tournoi selon les quotas utilisateur
// PREMIUM: basé sur les tournois CRÉÉS (original_creator_id)
// GRATUIT: basé sur les PARTICIPATIONS (count des tournament_participants)
async function determineTournamentType(supabase: any, userId: string): Promise<{
  tournamentType: TournamentType | null;
  maxPlayers: number;
  reason: string;
}> {
  // Vérifier abonnement actif
  const { data: subscription } = await supabase
    .from('user_subscriptions')
    .select('status')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single()

  // Compter tournois premium actifs CRÉÉS par cet utilisateur (original_creator_id)
  // On utilise original_creator_id car même après transfert de capitanat, le slot reste occupé
  const { count: premiumCount } = await supabase
    .from('tournaments')
    .select('*', { count: 'exact', head: true })
    .eq('original_creator_id', userId)
    .eq('tournament_type', 'premium')
    .neq('status', 'completed')

  // Priorité 1: Abonnement premium (max 5, 20 joueurs)
  if (subscription && (premiumCount || 0) < 5) {
    return { tournamentType: 'premium', maxPlayers: 20, reason: 'Slot premium' }
  }

  // Compter slots one-shot disponibles
  const { count: oneshotAvailable } = await supabase
    .from('user_oneshot_purchases')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'available')

  // Priorité 2: One-shot (20 joueurs)
  if ((oneshotAvailable || 0) > 0) {
    return { tournamentType: 'oneshot', maxPlayers: 20, reason: 'Slot one-shot' }
  }

  // GRATUIT: Compter les PARTICIPATIONS aux tournois gratuits actifs
  // Récupérer d'abord les IDs des tournois où l'utilisateur participe
  const { data: participations } = await supabase
    .from('tournament_participants')
    .select('tournament_id')
    .eq('user_id', userId)

  const tournamentIds = participations?.map((p: any) => p.tournament_id) || []

  // Compter combien de ces tournois sont gratuits et actifs
  let freeParticipationCount = 0
  if (tournamentIds.length > 0) {
    const { count } = await supabase
      .from('tournaments')
      .select('*', { count: 'exact', head: true })
      .in('id', tournamentIds)
      .eq('tournament_type', 'free')
      .neq('status', 'completed')

    freeParticipationCount = count || 0
  }

  // Priorité 3: Gratuit (max 3 participations, 8 joueurs)
  if (freeParticipationCount < 3) {
    return { tournamentType: 'free', maxPlayers: 8, reason: 'Slot gratuit' }
  }

  return { tournamentType: null, maxPlayers: 0, reason: 'Quota atteint - upgrade requis' }
}

// Utiliser un slot one-shot
async function useOneshotSlot(supabase: any, userId: string, tournamentId: string): Promise<boolean> {
  const { data: slot } = await supabase
    .from('user_oneshot_purchases')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'available')
    .order('purchased_at', { ascending: true })
    .limit(1)
    .single()

  if (!slot) return false

  await supabase
    .from('user_oneshot_purchases')
    .update({ status: 'in_use', tournament_id: tournamentId, used_at: new Date().toISOString() })
    .eq('id', slot.id)

  return true
}

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

    // Déterminer le type de tournoi selon les quotas
    const { tournamentType, maxPlayers: allowedMaxPlayers, reason } = await determineTournamentType(supabase, user.id)

    if (!tournamentType) {
      return NextResponse.json(
        { success: false, error: reason, needsUpgrade: true, quotaExceeded: true },
        { status: 403 }
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

    // Limiter maxPlayers selon le type de compte
    const effectiveMaxPlayers = Math.min(maxPlayers || allowedMaxPlayers, allowedMaxPlayers)

    // Créer le tournoi avec le type déterminé
    // original_creator_id garde en mémoire qui a créé le tournoi (pour le quota)
    // creator_id est le capitaine actuel (peut changer avec le transfert)
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .insert({
        name,
        slug,
        invite_code: slug,
        competition_id: parseInt(competitionId),
        competition_name: competitionName,
        max_players: effectiveMaxPlayers,
        max_participants: effectiveMaxPlayers,
        num_matchdays: numMatchdays,
        matchdays_count: numMatchdays,
        all_matchdays: allMatchdays,
        bonus_match_enabled: bonusMatchEnabled,
        creator_id: user.id,
        original_creator_id: user.id, // Garde en mémoire le créateur original pour les quotas
        status: 'pending',
        current_participants: 1,
        scoring_exact_score: 3,
        scoring_correct_winner: 1,
        scoring_correct_goal_difference: 2,
        scoring_default_prediction_max: drawWithDefaultPredictionPoints || 1,
        tournament_type: tournamentType
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

    // Si c'est un one-shot, utiliser le slot
    if (tournamentType === 'oneshot') {
      await useOneshotSlot(supabase, user.id, tournament.id)
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
