import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { TournamentType, PRICES, TOURNAMENT_RULES } from '@/types/monetization'

// =====================================================
// Système de création de tournoi v2
// =====================================================
// FREE-KICK: Gratuit, max 2 actifs, 5 joueurs, 10 journées
// ONE-SHOT: 4.99€, 10 joueurs, durée illimitée
// ELITE: 9.99€, 20 joueurs, durée illimitée
// PLATINIUM: 6.99€/personne, 11-30 joueurs
// =====================================================

interface TournamentTypeResult {
  canCreate: boolean;
  requiresPayment: boolean;
  paymentAmount: number;
  tournamentType: TournamentType;
  maxPlayers: number;
  maxMatchdays: number | null;
  reason: string;
}

// Vérifier si l'utilisateur peut créer un tournoi FREE
async function canCreateFreeTournament(supabase: any, userId: string): Promise<{
  canCreate: boolean;
  currentCount: number;
}> {
  // Compter les tournois FREE actifs (non legacy) où l'utilisateur participe avec slot gratuit
  const { data: participations } = await supabase
    .from('tournament_participants')
    .select(`
      tournament_id,
      invite_type,
      tournaments!inner (
        id,
        tournament_type,
        status,
        is_legacy
      )
    `)
    .eq('user_id', userId)

  const freeCount = (participations || []).filter((p: any) =>
    p.tournaments &&
    (p.tournaments.tournament_type === 'free' || !p.tournaments.tournament_type) &&
    ['warmup', 'active', 'pending'].includes(p.tournaments.status) &&
    !p.tournaments.is_legacy &&
    (p.invite_type === 'free' || !p.invite_type)
  ).length

  return {
    canCreate: freeCount < PRICES.FREE_MAX_TOURNAMENTS,
    currentCount: freeCount
  }
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
      drawWithDefaultPredictionPoints,
      tournamentType: requestedType // Type demandé par l'utilisateur (free, oneshot, elite, platinium)
    } = body

    // Validation de base
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

    // Déterminer le type de tournoi
    const tournamentType: TournamentType = requestedType || 'free'
    const rules = TOURNAMENT_RULES[tournamentType]

    // Vérification des quotas selon le type
    if (tournamentType === 'free') {
      const { canCreate, currentCount } = await canCreateFreeTournament(supabase, user.id)
      if (!canCreate) {
        return NextResponse.json({
          success: false,
          error: `Vous avez atteint votre quota de ${PRICES.FREE_MAX_TOURNAMENTS} tournois gratuits actifs (${currentCount}/${PRICES.FREE_MAX_TOURNAMENTS}). Passez à One-Shot ou Elite Team pour créer plus de tournois.`,
          needsUpgrade: true,
          quotaExceeded: true,
          currentCount,
          maxCount: PRICES.FREE_MAX_TOURNAMENTS
        }, { status: 403 })
      }
    }

    // Pour les tournois payants (oneshot, elite, platinium), verifier le credit disponible
    let usedPurchaseId: string | null = null
    let prepaidSlotsToAdd = 0 // Nombre de places prepayees (pour platinium_group)
    let usedPurchaseType: string | null = null

    if (['oneshot', 'elite', 'platinium'].includes(tournamentType)) {
      const { use_credit } = body

      if (!use_credit) {
        // Retourner les infos de prix pour acheter un credit
        return NextResponse.json({
          success: false,
          requiresPayment: true,
          tournamentType,
          paymentAmount: rules.creationPrice,
          maxPlayers: rules.maxPlayers,
          message: `La creation d'un tournoi ${tournamentType} necessite un credit. Achetez-en un sur la page Pricing.`
        }, { status: 402 })
      }

      // Pour Platinium, verifier d'abord s'il y a un credit groupe (11 places)
      if (tournamentType === 'platinium') {
        const { data: groupCredit } = await supabase
          .from('tournament_purchases')
          .select('id, slots_included')
          .eq('user_id', user.id)
          .eq('purchase_type', 'platinium_group')
          .eq('status', 'completed')
          .eq('used', false)
          .order('created_at', { ascending: true })
          .limit(1)
          .single()

        if (groupCredit) {
          usedPurchaseId = groupCredit.id
          usedPurchaseType = 'platinium_group'
          // Le createur utilise 1 place, les autres sont prepayees pour les invites
          prepaidSlotsToAdd = (groupCredit.slots_included || 11) - 1
        }
      }

      // Si pas de credit groupe trouve, chercher un credit solo
      if (!usedPurchaseId) {
        const { data: availableCredit } = await supabase
          .from('tournament_purchases')
          .select('id')
          .eq('user_id', user.id)
          .eq('purchase_type', 'tournament_creation')
          .eq('tournament_subtype', tournamentType)
          .eq('status', 'completed')
          .eq('used', false)
          .order('created_at', { ascending: true })
          .limit(1)
          .single()

        if (!availableCredit) {
          return NextResponse.json({
            success: false,
            error: `Aucun credit ${tournamentType} disponible. Achetez-en un sur la page Pricing.`,
            requiresPayment: true,
            tournamentType,
            paymentAmount: rules.creationPrice
          }, { status: 402 })
        }

        usedPurchaseId = availableCredit.id
        usedPurchaseType = 'tournament_creation'
      }
    }

    // Limiter maxPlayers selon le type de tournoi
    const effectiveMaxPlayers = Math.min(maxPlayers || rules.maxPlayers, rules.maxPlayers)

    // Limiter numMatchdays pour les tournois FREE
    let effectiveMatchdays = numMatchdays
    if (tournamentType === 'free' && rules.maxMatchdays) {
      effectiveMatchdays = Math.min(numMatchdays, rules.maxMatchdays)
    }

    // Créer le tournoi
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
        num_matchdays: effectiveMatchdays,
        matchdays_count: effectiveMatchdays,
        max_matchdays: rules.maxMatchdays, // Limite de journées (null = illimité)
        all_matchdays: allMatchdays,
        bonus_match_enabled: bonusMatchEnabled,
        creator_id: user.id,
        original_creator_id: user.id,
        status: 'pending',
        current_participants: 1,
        scoring_exact_score: 3,
        scoring_correct_winner: 1,
        scoring_correct_goal_difference: 2,
        scoring_default_prediction_max: drawWithDefaultPredictionPoints || 1,
        tournament_type: tournamentType,
        is_legacy: false, // Nouveau tournoi = pas legacy
        duration_extended: false,
        players_extended: 0,
        prepaid_slots_remaining: prepaidSlotsToAdd // Places prepayees pour les invites (platinium_group)
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

    // Ajouter le créateur comme premier participant (capitaine)
    const isPlatiniumGroup = usedPurchaseType === 'platinium_group'
    const { error: playerError } = await supabase
      .from('tournament_participants')
      .insert({
        tournament_id: tournament.id,
        user_id: user.id,
        participant_role: 'captain',
        invite_type: isPlatiniumGroup ? 'prepaid_slot' : 'free', // Le créateur utilise une place du groupe si platinium_group
        has_paid: ['oneshot', 'elite', 'platinium'].includes(tournamentType),
        amount_paid: isPlatiniumGroup ? PRICES.PLATINIUM_PARTICIPATION : rules.creationPrice,
        paid_by_creator: isPlatiniumGroup // Le createur a paye sa propre place via le groupe
      })

    if (playerError) {
      console.error('Error adding participant:', playerError)
      // On continue quand même, le tournoi est créé
    }

    // Créer les journées du tournoi
    const journeys = []
    for (let i = 1; i <= effectiveMatchdays; i++) {
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
      // On continue quand meme, le tournoi est cree
    }

    // Marquer le credit comme utilise si applicable
    if (usedPurchaseId) {
      const { error: updateError } = await supabase
        .from('tournament_purchases')
        .update({
          used: true,
          used_at: new Date().toISOString(),
          used_for_tournament_id: tournament.id,
          tournament_id: tournament.id
        })
        .eq('id', usedPurchaseId)

      if (updateError) {
        console.error('Error marking credit as used:', updateError)
      }
    }

    return NextResponse.json({
      success: true,
      tournament,
      tournamentType,
      maxPlayers: effectiveMaxPlayers,
      maxMatchdays: rules.maxMatchdays
    })

  } catch (error: any) {
    console.error('Error in tournament creation:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
