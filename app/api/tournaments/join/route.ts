import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { TournamentType, PRICES, InviteType } from '@/types/monetization'
import { sendNewPlayerJoinedEmail } from '@/lib/email/send'

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

// Helper: Récupérer les slots disponibles d'un utilisateur (factorisé pour éviter duplication)
async function getAvailableSlots(supabase: any, userId: string) {
  return supabase
    .from('tournament_purchases')
    .select('id', { count: 'exact' })
    .eq('user_id', userId)
    .eq('purchase_type', 'slot_invite')
    .eq('used', false)
    .eq('status', 'completed')
    .order('created_at', { ascending: true })
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

  // OPTIMISATION: Récupérer participations ET slots disponibles en parallèle
  const [participationsRes, slotsRes] = await Promise.all([
    supabase
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
      .eq('user_id', userId),
    getAvailableSlots(supabase, userId)
  ])

  const participations = participationsRes.data
  const availableSlots = slotsRes.data
  const slotsCount = slotsRes.count

  // Compter les tournois FREE-KICK actifs (non legacy)
  const freekickCount = (participations || []).filter((p: any) =>
    p.tournaments &&
    (p.tournaments.tournament_type === 'free' || !p.tournaments.tournament_type) &&
    ['warmup', 'active', 'pending'].includes(p.tournaments.status) &&
    !p.tournaments.is_legacy
  ).length

  // Helper pour retourner le résultat avec slots disponibles
  const withSlotInfo = (result: JoinResult): JoinResult => {
    if (availableSlots && availableSlots.length > 0) {
      return {
        ...result,
        hasAvailableSlot: true,
        availableSlotId: availableSlots[0].id,
        availableSlotsCount: slotsCount || availableSlots.length
      }
    }
    return result
  }

  // Cas FREE-KICK
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
    }
    // Quota atteint - vérifier les slots
    return withSlotInfo({
      canJoin: true,
      requiresPayment: true,
      paymentAmount: PRICES.SLOT_INVITE,
      paymentType: 'slot_invite',
      inviteType: 'paid_slot',
      reason: `Quota de ${PRICES.FREE_MAX_TOURNAMENTS} tournois gratuits atteint - slot payant à ${PRICES.SLOT_INVITE}€`
    })
  }

  // Cas ONE-SHOT / ELITE-TEAM
  if (tournamentType === 'oneshot' || tournamentType === 'elite') {
    const premiumGuestCount = (participations || []).filter((p: any) =>
      p.tournaments &&
      ['oneshot', 'elite'].includes(p.tournaments.tournament_type) &&
      ['warmup', 'active', 'pending'].includes(p.tournaments.status) &&
      !p.tournaments.is_legacy &&
      p.participant_role !== 'captain'
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
    }
    // Déjà invité - vérifier les slots
    return withSlotInfo({
      canJoin: true,
      requiresPayment: true,
      paymentAmount: PRICES.SLOT_INVITE,
      paymentType: 'slot_invite',
      inviteType: 'paid_slot',
      reason: `Vous etes deja invite dans ${premiumGuestCount} tournoi(s) premium - slot payant à ${PRICES.SLOT_INVITE}€`
    })
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
      .select('id, name, slug, invite_code, status, max_players, creator_id, tournament_type, is_legacy, competition_id, custom_competition_id, prepaid_slots_remaining')
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

    // Préparer les données du participant avec le tracking de paiement
    const participantData: {
      tournament_id: string
      user_id: string
      joined_at: string
      invite_type: InviteType
      has_paid: boolean
      paid_by_creator: boolean
      amount_paid: number
    } = {
      tournament_id: tournament.id,
      user_id: user.id,
      joined_at: new Date().toISOString(),
      invite_type: eligibility.inviteType,
      has_paid: false,
      paid_by_creator: false,
      amount_paid: 0
    }

    // Si c'est une place prepayée Platinium, marquer comme payée par le créateur et décrémenter le compteur
    if (eligibility.inviteType === 'prepaid_slot' && tournament.tournament_type === 'platinium') {
      participantData.has_paid = true
      participantData.paid_by_creator = true
      participantData.amount_paid = 0 // Gratuit pour le participant

      // Décrémenter le compteur de places prepayées
      const { error: decrementError } = await supabase.rpc('use_prepaid_slot', {
        p_tournament_id: tournament.id,
        p_user_id: user.id
      })

      if (decrementError) {
        console.error('Error decrementing prepaid slots:', decrementError)
        // On continue quand même, le compteur sera peut-être désynchronisé mais le joueur peut rejoindre
      }
    }

    // Si le joueur a payé lui-même (Stripe ou slot acheté)
    if (eligibility.requiresPayment && (stripe_session_id || useSlotId)) {
      participantData.has_paid = true
      participantData.paid_by_creator = false
      participantData.amount_paid = eligibility.paymentAmount
    }

    // Ajouter l'utilisateur au tournoi
    const { error: joinError } = await supabase
      .from('tournament_participants')
      .insert(participantData)

    if (joinError) {
      console.error('Error joining tournament:', joinError)
      return NextResponse.json(
        { error: 'Erreur lors de l\'ajout au tournoi' },
        { status: 500 }
      )
    }

    // Envoyer un email au capitaine pour l'informer du nouveau joueur
    try {
      // Récupérer les infos du capitaine (créateur du tournoi)
      const { data: captain } = await supabase
        .from('profiles')
        .select('id, username, email')
        .eq('id', tournament.creator_id)
        .single()

      // Récupérer le username du nouveau joueur
      const { data: newPlayer } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single()

      // Récupérer tous les participants actuels (incluant le nouveau)
      const { data: allParticipants, count: currentCount } = await supabase
        .from('tournament_participants')
        .select(`
          user_id,
          profiles!inner (
            username
          )
        `, { count: 'exact' })
        .eq('tournament_id', tournament.id)

      // Récupérer le nom de la compétition
      let competitionName = 'Tournoi personnalisé'
      if (tournament.competition_id) {
        const { data: competition } = await supabase
          .from('competitions')
          .select('name')
          .eq('id', tournament.competition_id)
          .single()
        if (competition) competitionName = competition.name
      } else if (tournament.custom_competition_id) {
        const { data: customComp } = await supabase
          .from('custom_competitions')
          .select('name')
          .eq('id', tournament.custom_competition_id)
          .single()
        if (customComp) competitionName = customComp.name
      }

      // Envoyer l'email au capitaine (seulement si ce n'est pas lui qui rejoint)
      if (captain && captain.email && captain.id !== user.id) {
        const participantsList = (allParticipants || []).map((p: any) => ({
          username: p.profiles?.username || 'Joueur',
          isCaptain: p.user_id === tournament.creator_id
        }))

        const currentParticipants = currentCount || participantsList.length
        const canLaunch = currentParticipants >= 2 // Minimum 2 joueurs pour lancer

        await sendNewPlayerJoinedEmail(captain.email, {
          captainUsername: captain.username || 'Capitaine',
          tournamentName: tournament.name,
          tournamentSlug: `${tournament.name.toLowerCase().replace(/\s+/g, '-')}_${tournament.slug || tournament.invite_code}`,
          competitionName,
          newPlayerUsername: newPlayer?.username || 'Nouveau joueur',
          currentParticipants,
          maxParticipants: tournament.max_players,
          participants: participantsList,
          canLaunchTournament: canLaunch
        })

        console.log(`[JOIN] Email sent to captain ${captain.email} for new player ${newPlayer?.username}`)
      }
    } catch (emailError) {
      // Ne pas bloquer le join si l'email échoue
      console.error('[JOIN] Error sending email to captain:', emailError)
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
