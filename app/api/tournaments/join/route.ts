import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { TournamentType, PRICES, InviteType } from '@/types/monetization'

// =====================================================
// Système de join tournoi v2
// =====================================================
// FREE-KICK: Max 2 tournois gratuits actifs par utilisateur
//   - Si quota atteint: slot payant à 0.99€
// ONE-SHOT/ELITE: 1 invitation gratuite max par utilisateur
//   - Si quota atteint: slot payant à 0.99€
// PLATINIUM: Participation payante 6.99€
// EVENT: 1 participation gratuite, puis 0.99€ par slot
// LEGACY: Pas de restrictions
// =====================================================

interface JoinTournamentRequest {
  inviteCode: string
  stripe_session_id?: string // Pour les paiements Stripe
  useSlotId?: string         // Pour utiliser un slot déjà acheté
}

interface JoinResult {
  canJoin: boolean
  requiresPayment: boolean
  paymentAmount: number
  paymentType: string
  inviteType: InviteType
  reason: string
  hasAvailableSlot?: boolean  // L'utilisateur a un slot acheté non utilisé
  availableSlotId?: string    // ID du slot disponible
  availableSlotsCount?: number // Nombre total de slots disponibles
}

// Vérifier si l'utilisateur peut rejoindre un tournoi
async function checkJoinEligibility(
  supabase: any,
  userId: string,
  tournament: any
): Promise<JoinResult> {
  const tournamentType = (tournament.tournament_type || 'free') as TournamentType

  // Tournoi LEGACY = pas de restrictions
  if (tournament.is_legacy) {
    return {
      canJoin: true,
      requiresPayment: false,
      paymentAmount: 0,
      paymentType: '',
      inviteType: 'free',
      reason: 'Tournoi legacy - accès libre'
    }
  }

  // Récupérer les participations de l'utilisateur
  const { data: participations } = await supabase
    .from('tournament_participants')
    .select(`
      tournament_id,
      invite_type,
      participant_role,
      tournaments!inner (
        id,
        tournament_type,
        status,
        is_legacy
      )
    `)
    .eq('user_id', userId)

  // Compter les tournois FREE-KICK actifs (non legacy)
  // Cette variable est utilisee pour FREE-KICK, ONE-SHOT et ELITE-TEAM
  const freekickCount = (participations || []).filter((p: any) =>
    p.tournaments &&
    (p.tournaments.tournament_type === 'free' || !p.tournaments.tournament_type) &&
    ['warmup', 'active', 'pending'].includes(p.tournaments.status) &&
    !p.tournaments.is_legacy
  ).length

  // Cas FREE-KICK
  // Regle: gratuit si freekick_count < 2, sinon 0.99€
  // SAUF s'il a un slot acheté non utilisé
  if (tournamentType === 'free') {
    if (freekickCount < PRICES.FREE_MAX_TOURNAMENTS) {
      return {
        canJoin: true,
        requiresPayment: false,
        paymentAmount: 0,
        paymentType: '',
        inviteType: 'free',
        reason: 'Slot gratuit disponible'
      }
    } else {
      // Vérifier si l'utilisateur a des slots achetés non utilisés
      const { data: availableSlots, count: slotsCount } = await supabase
        .from('tournament_purchases')
        .select('id', { count: 'exact' })
        .eq('user_id', userId)
        .eq('purchase_type', 'slot_invite')
        .eq('used', false)
        .eq('status', 'completed')
        .order('created_at', { ascending: true })

      if (availableSlots && availableSlots.length > 0) {
        // L'utilisateur a des slots disponibles
        return {
          canJoin: true,
          requiresPayment: true, // On garde true pour afficher la modale, mais avec l'option d'utiliser le slot
          paymentAmount: PRICES.SLOT_INVITE,
          paymentType: 'slot_invite',
          inviteType: 'paid_slot',
          reason: `Quota de ${PRICES.FREE_MAX_TOURNAMENTS} tournois gratuits atteint`,
          hasAvailableSlot: true,
          availableSlotId: availableSlots[0].id, // Prendre le premier (le plus ancien)
          availableSlotsCount: slotsCount || availableSlots.length
        }
      }

      return {
        canJoin: true,
        requiresPayment: true,
        paymentAmount: PRICES.SLOT_INVITE,
        paymentType: 'slot_invite',
        inviteType: 'paid_slot',
        reason: `Quota de ${PRICES.FREE_MAX_TOURNAMENTS} tournois gratuits atteint - slot payant à ${PRICES.SLOT_INVITE}€`
      }
    }
  }

  // Cas ONE-SHOT / ELITE-TEAM
  // Regle: gratuit si l'user n'est pas deja invite dans un tournoi premium actif
  // Sinon 0.99€ (evite que des users profitent d'invitations gratuites sans jamais payer)
  // SAUF s'il a un slot acheté non utilisé
  if (tournamentType === 'oneshot' || tournamentType === 'elite') {
    // Compter les tournois ONE-SHOT/ELITE actifs ou l'user est INVITE (pas createur)
    const premiumGuestCount = (participations || []).filter((p: any) =>
      p.tournaments &&
      ['oneshot', 'elite'].includes(p.tournaments.tournament_type) &&
      ['warmup', 'active', 'pending'].includes(p.tournaments.status) &&
      !p.tournaments.is_legacy &&
      p.participant_role !== 'captain' // Seulement les invites, pas les createurs
    ).length

    if (premiumGuestCount === 0) {
      return {
        canJoin: true,
        requiresPayment: false,
        paymentAmount: 0,
        paymentType: '',
        inviteType: 'premium_invite',
        reason: 'Premiere invitation gratuite'
      }
    } else {
      // Vérifier si l'utilisateur a des slots achetés non utilisés
      const { data: availableSlots, count: slotsCount } = await supabase
        .from('tournament_purchases')
        .select('id', { count: 'exact' })
        .eq('user_id', userId)
        .eq('purchase_type', 'slot_invite')
        .eq('used', false)
        .eq('status', 'completed')
        .order('created_at', { ascending: true })

      if (availableSlots && availableSlots.length > 0) {
        // L'utilisateur a des slots disponibles
        return {
          canJoin: true,
          requiresPayment: true, // On garde true pour afficher la modale, mais avec l'option d'utiliser le slot
          paymentAmount: PRICES.SLOT_INVITE,
          paymentType: 'slot_invite',
          inviteType: 'paid_slot',
          reason: `Vous êtes déjà invité dans ${premiumGuestCount} tournoi(s) premium`,
          hasAvailableSlot: true,
          availableSlotId: availableSlots[0].id,
          availableSlotsCount: slotsCount || availableSlots.length
        }
      }

      return {
        canJoin: true,
        requiresPayment: true,
        paymentAmount: PRICES.SLOT_INVITE,
        paymentType: 'slot_invite',
        inviteType: 'paid_slot',
        reason: `Vous etes deja invite dans ${premiumGuestCount} tournoi(s) premium - slot payant à ${PRICES.SLOT_INVITE}€`
      }
    }
  }

  // Cas PLATINIUM - verifier les places prepayees
  if (tournamentType === 'platinium') {
    // Verifier si le createur a des places prepayees disponibles
    const prepaidSlots = tournament.prepaid_slots_remaining || 0

    if (prepaidSlots > 0) {
      // Il y a des places prepayees disponibles - acces gratuit
      return {
        canJoin: true,
        requiresPayment: false,
        paymentAmount: 0,
        paymentType: '',
        inviteType: 'prepaid_slot' as InviteType,
        reason: 'Place prepayee par le createur disponible'
      }
    } else {
      // Pas de places prepayees - paiement requis
      return {
        canJoin: true,
        requiresPayment: true,
        paymentAmount: PRICES.PLATINIUM_PARTICIPATION,
        paymentType: 'platinium_participation',
        inviteType: 'paid_slot',
        reason: `Participation Platinium - ${PRICES.PLATINIUM_PARTICIPATION}€`
      }
    }
  }

  // Cas par défaut (enterprise ou autre)
  return {
    canJoin: true,
    requiresPayment: false,
    paymentAmount: 0,
    paymentType: '',
    inviteType: 'free',
    reason: 'OK'
  }
}

// Vérifier l'éligibilité pour un tournoi événement
async function checkEventJoinEligibility(
  supabase: any,
  userId: string,
  tournamentId: string
): Promise<JoinResult> {
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
      canJoin: true,
      requiresPayment: false,
      paymentAmount: 0,
      paymentType: '',
      inviteType: 'free',
      reason: 'Première participation événement gratuite'
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
      canJoin: true,
      requiresPayment: true,
      paymentAmount: 0.99,
      paymentType: 'event_slot',
      inviteType: 'paid_slot',
      reason: `Quota événement atteint (${activeEventCount}/1)`,
      hasAvailableSlot: true,
      availableSlotId: availableSlots[0].id,
      availableSlotsCount: slotsCount || availableSlots.length
    }
  }

  // Pas de slot disponible, paiement requis
  return {
    canJoin: true,
    requiresPayment: true,
    paymentAmount: 0.99,
    paymentType: 'event_slot',
    inviteType: 'paid_slot',
    reason: `Quota événement atteint (${activeEventCount}/1) - slot à 0.99€`
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: JoinTournamentRequest = await request.json()
    const { inviteCode, stripe_session_id, useSlotId } = body

    if (!inviteCode || inviteCode.length !== 8) {
      return NextResponse.json(
        { error: 'Code invalide (8 caractères requis)' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Récupérer l'utilisateur connecté
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Vous devez être connecté pour rejoindre un tournoi' },
        { status: 401 }
      )
    }

    // Chercher le tournoi avec ce code d'invitation
    const upperCode = inviteCode.toUpperCase()
    console.log('[JOIN] Searching for tournament with code:', upperCode)

    // Récupérer le tournoi par invite_code ou slug (sans jointure)
    const { data: tournamentData, error: searchError } = await supabase
      .from('tournaments')
      .select('id, name, slug, invite_code, status, max_players, creator_id, tournament_type, is_legacy, competition_id, custom_competition_id')
      .or(`invite_code.eq.${upperCode},slug.eq.${upperCode}`)
      .single()

    console.log('[JOIN] Tournament search result:', {
      found: !!tournamentData,
      tournamentName: tournamentData?.name,
      error: searchError?.message || 'none'
    })

    if (!tournamentData) {
      console.log('[JOIN] Tournament not found for code:', upperCode)
      return NextResponse.json(
        { error: 'Tournoi introuvable avec ce code' },
        { status: 404 }
      )
    }

    // Récupérer les infos de compétition séparément si nécessaire
    let competitionInfo: { id: number, is_event: boolean } | null = null
    if (tournamentData.competition_id) {
      const { data: compData } = await supabase
        .from('competitions')
        .select('id, is_event')
        .eq('id', tournamentData.competition_id)
        .single()
      competitionInfo = compData
    }

    // Construire l'objet tournament avec les infos de compétition
    const tournament = {
      ...tournamentData,
      competitions: competitionInfo
    }

    console.log('[JOIN] Tournament found:', { id: tournament.id, name: tournament.name, invite_code: tournament.invite_code, slug: tournament.slug, hasCompetition: !!competitionInfo })

    // Vérifier que le tournoi est en attente ou warmup
    if (!['pending', 'warmup'].includes(tournament.status)) {
      return NextResponse.json(
        { error: 'Ce tournoi a déjà commencé ou est terminé' },
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
      const tournamentSlug = `${tournament.name.toLowerCase().replace(/\s+/g, '-')}_${tournament.slug || tournament.invite_code}`
      return NextResponse.json({
        success: true,
        message: 'Vous participez déjà à ce tournoi',
        tournament: {
          id: tournament.id,
          slug: tournamentSlug
        }
      })
    }

    // Vérifier le nombre de participants
    const { count: participantCount } = await supabase
      .from('tournament_participants')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', tournament.id)

    if (participantCount && participantCount >= tournament.max_players) {
      return NextResponse.json(
        { error: 'Ce tournoi est complet' },
        { status: 400 }
      )
    }

    // Déterminer si c'est un tournoi événement
    const isEventTournament = tournament.competitions?.is_event === true

    // Vérifier l'éligibilité selon le type de tournoi
    const eligibility = isEventTournament
      ? await checkEventJoinEligibility(supabase, user.id, tournament.id)
      : await checkJoinEligibility(supabase, user.id, tournament)

    if (!eligibility.canJoin) {
      return NextResponse.json(
        { error: eligibility.reason },
        { status: 400 }
      )
    }

    // Si paiement requis
    if (eligibility.requiresPayment) {
      // Cas 1: Utilisation d'un slot existant
      if (useSlotId) {
        if (isEventTournament && eligibility.paymentType === 'event_slot') {
          // Vérifier et utiliser un slot événement
          const { data: eventSlot, error: eventSlotError } = await supabase
            .from('event_tournament_slots')
            .select('*')
            .eq('id', useSlotId)
            .eq('user_id', user.id)
            .eq('status', 'available')
            .single()

          if (eventSlotError || !eventSlot) {
            return NextResponse.json({
              success: false,
              error: 'Slot événement invalide ou déjà utilisé'
            }, { status: 400 })
          }

          // Marquer le slot événement comme utilisé
          const { error: updateError } = await supabase
            .from('event_tournament_slots')
            .update({
              status: 'used',
              used_at: new Date().toISOString(),
              tournament_id: tournament.id
            })
            .eq('id', useSlotId)

          if (updateError) {
            console.error('Error marking event slot as used:', updateError)
            return NextResponse.json({
              success: false,
              error: 'Erreur lors de l\'utilisation du slot événement'
            }, { status: 500 })
          }

          console.log(`[JOIN] Event slot ${useSlotId} used for tournament ${tournament.id} by user ${user.id}`)
        } else {
          // Vérifier que le slot appartient bien à l'utilisateur et n'est pas utilisé
          const { data: slot, error: slotError } = await supabase
            .from('tournament_purchases')
            .select('*')
            .eq('id', useSlotId)
            .eq('user_id', user.id)
            .eq('purchase_type', 'slot_invite')
            .eq('used', false)
            .eq('status', 'completed')
            .single()

          if (slotError || !slot) {
            return NextResponse.json({
              success: false,
              error: 'Slot invalide ou déjà utilisé'
            }, { status: 400 })
          }

          // Marquer le slot comme utilisé
          const { error: updateError } = await supabase
            .from('tournament_purchases')
            .update({
              used: true,
              tournament_id: tournament.id
            })
            .eq('id', useSlotId)

          if (updateError) {
            console.error('Error marking slot as used:', updateError)
            return NextResponse.json({
              success: false,
              error: 'Erreur lors de l\'utilisation du slot'
            }, { status: 500 })
          }

          console.log(`[JOIN] Slot ${useSlotId} used for tournament ${tournament.id} by user ${user.id}`)
        }
      }
      // Cas 2: Paiement Stripe
      else if (stripe_session_id) {
        if (isEventTournament && eligibility.paymentType === 'event_slot') {
          // Vérifier le paiement d'un slot événement
          const { data: eventSlot } = await supabase
            .from('event_tournament_slots')
            .select('*')
            .eq('stripe_session_id', stripe_session_id)
            .eq('user_id', user.id)
            .eq('status', 'available')
            .single()

          if (eventSlot) {
            // Marquer le slot comme utilisé immédiatement
            await supabase
              .from('event_tournament_slots')
              .update({
                status: 'used',
                used_at: new Date().toISOString(),
                tournament_id: tournament.id
              })
              .eq('id', eventSlot.id)
          }
        } else {
          // Vérifier le paiement classique
          const { data: purchase } = await supabase
            .from('tournament_purchases')
            .select('*')
            .eq('stripe_checkout_session_id', stripe_session_id)
            .eq('user_id', user.id)
            .eq('status', 'completed')
            .single()

          if (!purchase) {
            return NextResponse.json({
              success: false,
              error: 'Paiement non trouvé ou invalide'
            }, { status: 400 })
          }
        }
      }
      // Cas 3: Ni slot ni paiement - retourner les infos pour la modale
      else {
        return NextResponse.json({
          success: false,
          requiresPayment: true,
          paymentAmount: eligibility.paymentAmount,
          paymentType: eligibility.paymentType,
          tournamentId: tournament.id,
          tournamentName: tournament.name,
          message: eligibility.reason,
          hasAvailableSlot: eligibility.hasAvailableSlot || false,
          availableSlotId: eligibility.availableSlotId || null,
          availableSlotsCount: eligibility.availableSlotsCount || 0,
          isEventTournament: isEventTournament
        }, { status: 402 })
      }
    }

    // Note: La fonctionnalité prepaid_slots n'est pas encore implémentée en BDD
    // TODO: Ajouter la colonne prepaid_slots_remaining à la table tournaments si besoin

    // Ajouter l'utilisateur au tournoi
    // Note: On utilise uniquement les colonnes de base qui existent dans la table
    const { error: joinError } = await supabase
      .from('tournament_participants')
      .insert({
        tournament_id: tournament.id,
        user_id: user.id,
        joined_at: new Date().toISOString()
      })

    if (joinError) {
      console.error('Error joining tournament:', joinError)
      return NextResponse.json(
        { error: 'Erreur lors de l\'ajout au tournoi' },
        { status: 500 }
      )
    }

    // Construire le slug complet pour la redirection
    const tournamentSlug = `${tournament.name.toLowerCase().replace(/\s+/g, '-')}_${tournament.slug || tournament.invite_code}`

    return NextResponse.json({
      success: true,
      message: 'Vous avez rejoint le tournoi avec succès',
      tournament: {
        id: tournament.id,
        slug: tournamentSlug
      },
      inviteType: eligibility.inviteType
    })

  } catch (error: any) {
    console.error('Error in join tournament route:', error)
    return NextResponse.json(
      { error: error.message || 'Erreur serveur' },
      { status: 500 }
    )
  }
}
