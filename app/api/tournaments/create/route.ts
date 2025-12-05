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
// EVENT: 1 participation gratuite, puis 0.99€ par slot
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

// Vérifier si l'utilisateur peut participer à un tournoi événement (création = participation)
async function canCreateEventTournament(supabase: any, userId: string): Promise<{
  canCreate: boolean;
  currentCount: number;
  requiresPayment: boolean;
  hasAvailableSlot: boolean;
  availableSlotId: string | null;
  availableSlotsCount: number;
}> {
  // Compter les participations événement actives de l'utilisateur
  const { data: eventParticipations } = await supabase
    .from('tournament_participants')
    .select(`
      tournament_id,
      tournaments!inner (
        id,
        status,
        competition_id,
        competitions!inner (
          id,
          is_event
        )
      )
    `)
    .eq('user_id', userId)

  // Filtrer les participations événement actives
  const activeEventCount = (eventParticipations || []).filter((p: any) =>
    p.tournaments?.competitions?.is_event === true &&
    ['warmup', 'active', 'pending'].includes(p.tournaments.status)
  ).length

  // 1 participation gratuite autorisée
  if (activeEventCount < 1) {
    return {
      canCreate: true,
      currentCount: activeEventCount,
      requiresPayment: false,
      hasAvailableSlot: false,
      availableSlotId: null,
      availableSlotsCount: 0
    }
  }

  // Vérifier si l'utilisateur a des slots événement achetés
  const { data: availableSlots, count: slotsCount } = await supabase
    .from('event_tournament_slots')
    .select('id', { count: 'exact' })
    .eq('user_id', userId)
    .eq('status', 'available')
    .order('purchased_at', { ascending: true })

  if (availableSlots && availableSlots.length > 0) {
    return {
      canCreate: true,
      currentCount: activeEventCount,
      requiresPayment: true,
      hasAvailableSlot: true,
      availableSlotId: availableSlots[0].id,
      availableSlotsCount: slotsCount || availableSlots.length
    }
  }

  // Pas de slot disponible, paiement requis
  return {
    canCreate: true,
    currentCount: activeEventCount,
    requiresPayment: true,
    hasAvailableSlot: false,
    availableSlotId: null,
    availableSlotsCount: 0
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
      customCompetitionId, // ID de la compétition personnalisée (Best of Week)
      isCustomCompetition, // Flag pour indiquer que c'est une compétition personnalisée
      competitionName,
      maxPlayers,
      numMatchdays,
      allMatchdays,
      bonusMatchEnabled,
      earlyPredictionBonus, // Prime d'avant-match
      drawWithDefaultPredictionPoints,
      tournamentType: requestedType // Type demandé par l'utilisateur (free, oneshot, elite, platinium)
    } = body

    // Validation de base - soit competitionId soit customCompetitionId doit être présent
    if (!name || !slug || (!competitionId && !customCompetitionId) || !competitionName) {
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

    // Vérifier si la compétition est un événement (Coupe du Monde, Euro, etc.)
    let isEventCompetition = false
    if (competitionId && !isCustomCompetition) {
      const { data: competition } = await supabase
        .from('competitions')
        .select('is_event')
        .eq('id', parseInt(competitionId))
        .single()
      isEventCompetition = competition?.is_event === true
    }

    // Déterminer le type de tournoi
    const tournamentType: TournamentType = requestedType || 'free'
    const rules = TOURNAMENT_RULES[tournamentType]

    // Variables pour les slots événement
    let usedEventSlotId: string | null = null

    // Vérification des quotas pour les tournois événement
    if (isEventCompetition && tournamentType === 'free') {
      const { use_event_slot } = body
      const eventEligibility = await canCreateEventTournament(supabase, user.id)

      if (eventEligibility.requiresPayment) {
        // Quota atteint, vérifier si un slot est fourni
        if (use_event_slot && eventEligibility.hasAvailableSlot) {
          // Utiliser le slot événement
          usedEventSlotId = eventEligibility.availableSlotId
        } else if (!use_event_slot) {
          // Retourner les infos pour la modale de paiement
          return NextResponse.json({
            success: false,
            requiresPayment: true,
            isEventTournament: true,
            paymentAmount: 0.99,
            paymentType: 'event_slot',
            message: `Quota événement atteint (${eventEligibility.currentCount}/1). Achetez un slot à 0.99€ pour participer.`,
            hasAvailableSlot: eventEligibility.hasAvailableSlot,
            availableSlotId: eventEligibility.availableSlotId,
            availableSlotsCount: eventEligibility.availableSlotsCount
          }, { status: 402 })
        }
      }
    }
    // Vérification des quotas selon le type (non-événement)
    else if (tournamentType === 'free') {
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
    let usedPurchaseIds: string[] = [] // Liste des IDs de crédits utilisés
    let prepaidSlotsToAdd = 0 // Nombre de places prepayees (pour platinium)
    let usedPurchaseType: string | null = null

    if (['oneshot', 'elite', 'platinium'].includes(tournamentType)) {
      const { use_credit, prepaidSlots } = body

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

      // Pour Platinium, gérer les crédits solo multiples OU un crédit groupe
      if (tournamentType === 'platinium') {
        const requestedSlots = prepaidSlots || 1

        // D'abord, vérifier s'il y a un crédit groupe (11 places)
        const { data: groupCredit } = await supabase
          .from('tournament_purchases')
          .select('id, slots_included')
          .eq('user_id', user.id)
          .eq('purchase_type', 'tournament_creation')
          .eq('tournament_subtype', 'platinium_group')
          .eq('status', 'completed')
          .eq('used', false)
          .order('created_at', { ascending: true })
          .limit(1)
          .single()

        if (groupCredit) {
          // Utiliser le crédit groupe
          usedPurchaseIds = [groupCredit.id]
          usedPurchaseType = 'platinium_group'
          // Le createur utilise 1 place, les autres sont prepayees pour les invites
          prepaidSlotsToAdd = (groupCredit.slots_included || 11) - 1
        } else {
          // Pas de crédit groupe, chercher des crédits solo
          const { data: soloCredits } = await supabase
            .from('tournament_purchases')
            .select('id')
            .eq('user_id', user.id)
            .eq('purchase_type', 'tournament_creation')
            .eq('tournament_subtype', 'platinium_solo')
            .eq('status', 'completed')
            .eq('used', false)
            .order('created_at', { ascending: true })
            .limit(requestedSlots)

          if (!soloCredits || soloCredits.length === 0) {
            return NextResponse.json({
              success: false,
              error: `Aucun crédit Platinium disponible. Achetez-en un sur la page Pricing.`,
              requiresPayment: true,
              tournamentType,
              paymentAmount: rules.creationPrice
            }, { status: 402 })
          }

          if (soloCredits.length < requestedSlots) {
            return NextResponse.json({
              success: false,
              error: `Vous n'avez que ${soloCredits.length} crédit(s) Platinium mais vous en avez demandé ${requestedSlots}.`,
              requiresPayment: true,
              tournamentType,
              paymentAmount: rules.creationPrice
            }, { status: 402 })
          }

          // Utiliser les crédits solo demandés
          usedPurchaseIds = soloCredits.map(c => c.id)
          usedPurchaseType = 'platinium_solo'
          // Le créateur utilise 1 crédit pour lui, les autres sont pour les invités
          prepaidSlotsToAdd = requestedSlots - 1
        }
      } else {
        // Pour oneshot et elite, chercher un crédit solo
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

        usedPurchaseIds = [availableCredit.id]
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
    // Note: prepaid_slots_remaining sera ajouté quand la migration sera appliquée
    const tournamentData: Record<string, any> = {
      name,
      slug,
      invite_code: slug,
      competition_name: competitionName,
      max_players: effectiveMaxPlayers,
      max_participants: effectiveMaxPlayers,
      num_matchdays: effectiveMatchdays,
      matchdays_count: effectiveMatchdays,
      max_matchdays: rules.maxMatchdays, // Limite de journées (null = illimité)
      all_matchdays: allMatchdays,
      bonus_match: bonusMatchEnabled || false, // Match bonus (points x2)
      early_prediction_bonus: earlyPredictionBonus || false, // Prime d'avant-match
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
    }

    // Ajouter l'ID de compétition approprié selon le type
    if (isCustomCompetition && customCompetitionId) {
      // Pour les compétitions personnalisées (Best of Week)
      tournamentData.custom_competition_id = customCompetitionId
      tournamentData.competition_id = null // Pas de compétition importée
    } else {
      // Pour les compétitions importées classiques
      tournamentData.competition_id = parseInt(competitionId)
    }

    // Ajouter prepaid_slots_remaining seulement si > 0 (pour compatibilité)
    // La colonne sera ignorée si elle n'existe pas encore en BDD
    if (prepaidSlotsToAdd > 0) {
      tournamentData.prepaid_slots_remaining = prepaidSlotsToAdd
    }

    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .insert(tournamentData)
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
    // Pour les tournois payants où le créateur a utilisé un crédit, marquer comme payé
    const participantData: Record<string, any> = {
      tournament_id: tournament.id,
      user_id: user.id,
      participant_role: 'captain',
    }

    // Si le créateur a utilisé un crédit pour un tournoi Platinium, marquer sa place comme payée
    if (tournamentType === 'platinium' && usedPurchaseIds.length > 0) {
      participantData.has_paid = true
      participantData.paid_by_creator = false // C'est lui le créateur, il a payé pour lui-même
      participantData.amount_paid = PRICES.PLATINIUM_PARTICIPATION // 6.99€
      participantData.invite_type = 'paid_slot'
    }

    const { error: playerError } = await supabase
      .from('tournament_participants')
      .insert(participantData)

    if (playerError) {
      console.error('Error adding participant:', playerError)
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

    // Marquer les crédits comme utilisés si applicable
    if (usedPurchaseIds.length > 0) {
      const { error: updateError } = await supabase
        .from('tournament_purchases')
        .update({
          used: true,
          used_at: new Date().toISOString(),
          used_for_tournament_id: tournament.id,
          tournament_id: tournament.id
        })
        .in('id', usedPurchaseIds)

      if (updateError) {
        console.error('Error marking credits as used:', updateError)
      }
    }

    // Marquer le slot événement comme utilisé si applicable
    if (usedEventSlotId) {
      const { error: eventSlotError } = await supabase
        .from('event_tournament_slots')
        .update({
          status: 'used',
          used_at: new Date().toISOString(),
          tournament_id: tournament.id
        })
        .eq('id', usedEventSlotId)

      if (eventSlotError) {
        console.error('Error marking event slot as used:', eventSlotError)
      }
    }

    return NextResponse.json({
      success: true,
      tournament,
      tournamentType,
      maxPlayers: effectiveMaxPlayers,
      maxMatchdays: rules.maxMatchdays,
      isEventTournament: isEventCompetition
    })

  } catch (error: any) {
    console.error('Error in tournament creation:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
