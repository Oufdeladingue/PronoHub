import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PRICES } from '@/types/monetization'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Non authentifié' },
        { status: 401 }
      )
    }

    // =====================================================
    // OPTIMISATION: Toutes les requêtes en parallèle
    // Avant: 1 + 1 + N + 3 = ~15 requêtes pour 10 tournois
    // Après: 3 requêtes max en parallèle
    // =====================================================

    const [participationsResult, creditsResult, allParticipantsCountResult, eventSlotsResult, eventCompetitionsResult] = await Promise.all([
      // 1. Récupérer tous les tournois où l'utilisateur participe
      supabase
        .from('tournament_participants')
        .select(`
          id,
          user_id,
          tournament_id,
          participant_role,
          invite_type,
          tournaments (
            id,
            name,
            slug,
            tournament_type,
            status,
            max_players,
            competition_name,
            is_legacy,
            creator_id,
            competition_id
          )
        `)
        .eq('user_id', user.id),

      // 2. Récupérer TOUS les crédits en une seule requête
      supabase
        .from('tournament_purchases')
        .select('id, purchase_type, tournament_subtype, slots_included, created_at, amount, used, status')
        .eq('user_id', user.id)
        .eq('status', 'completed'),

      // 3. Récupérer le count de participants pour tous les tournois de l'utilisateur en une seule requête
      // On récupère tous les participants des tournois où l'utilisateur participe
      supabase
        .from('tournament_participants')
        .select('tournament_id'),

      // 4. Récupérer les slots événement de l'utilisateur
      supabase
        .from('event_tournament_slots')
        .select('id, status, purchased_at, used_at, tournament_id')
        .eq('user_id', user.id),

      // 5. Récupérer les IDs des compétitions événement (séparément car pas de FK)
      supabase
        .from('competitions')
        .select('id')
        .eq('is_event', true)
    ])

    const participations = participationsResult.data || []
    const allCredits = creditsResult.data || []

    if (participationsResult.error) {
      console.error('Error fetching participations:', participationsResult.error)
      return NextResponse.json(
        { success: false, error: 'Erreur lors de la récupération des données' },
        { status: 500 }
      )
    }

    // Extraire les IDs des compétitions événement
    const eventCompetitionIds = (eventCompetitionsResult.data || []).map((c: any) => c.id)

    // Extraire les IDs des tournois de l'utilisateur
    const userTournamentIds = participations
      .filter((p: any) => p.tournaments)
      .map((p: any) => p.tournaments.id)

    // Compter les participants par tournoi (calcul local)
    const participantCountByTournament: Record<string, number> = {}
    if (allParticipantsCountResult.data) {
      allParticipantsCountResult.data.forEach((p: any) => {
        if (userTournamentIds.includes(p.tournament_id)) {
          participantCountByTournament[p.tournament_id] = (participantCountByTournament[p.tournament_id] || 0) + 1
        }
      })
    }

    // Filtrer les tournois actifs (tous sauf completed)
    const activeTournaments = participations
      .filter((p: any) => p.tournaments && p.tournaments.status !== 'completed')
      .map((p: any) => {
        const isCaptain = p.participant_role === 'captain' || p.tournaments.creator_id === user.id
        // Vérifier si le tournoi est sur une compétition événement
        const isEventTournament = eventCompetitionIds.includes(p.tournaments.competition_id)
        return {
          id: p.tournaments.id,
          name: p.tournaments.name,
          slug: p.tournaments.slug,
          tournament_type: p.tournaments.tournament_type || 'free',
          status: p.tournaments.status,
          participant_role: isCaptain ? 'captain' : 'member',
          invite_type: p.invite_type || 'free',
          current_players: participantCountByTournament[p.tournaments.id] || 0,
          max_players: p.tournaments.max_players || 5,
          competition_name: p.tournaments.competition_name || 'N/A',
          is_legacy: p.tournaments.is_legacy || false,
          is_event: isEventTournament,
        }
      })

    // Calculer les quotas
    // Exclure les tournois événement du comptage Free-Kick
    const freeTournamentsActive = activeTournaments.filter(
      (t: any) => (t.tournament_type === 'free' || !t.tournament_type) && !t.is_event
    ).length

    // Tournois événement actifs
    const eventTournamentsActive = activeTournaments.filter(
      (t: any) => t.is_event === true
    ).length

    // Slots événement disponibles (achetés mais non utilisés)
    const eventSlots = eventSlotsResult.data || []
    const eventSlotsAvailable = eventSlots.filter((s: any) => s.status === 'available').length
    const eventSlotsUsed = eventSlots.filter((s: any) => s.status === 'used').length

    // L'utilisateur peut rejoindre un tournoi événement si:
    // - Il n'a pas encore utilisé son slot gratuit (eventTournamentsActive < 1)
    // - OU il a des slots événement achetés disponibles
    const canJoinEventFree = eventTournamentsActive < 1
    const canJoinEventWithSlot = eventSlotsAvailable > 0

    const premiumInvitesActive = activeTournaments.filter(
      (t: any) =>
        ['oneshot', 'elite'].includes(t.tournament_type) &&
        t.participant_role === 'member' &&
        !t.is_legacy
    ).length

    const totalAsCaptain = activeTournaments.filter((t: any) => t.participant_role === 'captain').length

    // Calculer les crédits à partir des données récupérées (calcul local, pas de requête supplémentaire)
    const availableCredits = allCredits.filter((c: any) => !c.used)
    const usedCredits = allCredits.filter((c: any) => c.used)

    // Compter les crédits par type
    const credits = {
      oneshot: availableCredits.filter(
        (c: any) => c.purchase_type === 'tournament_creation' && c.tournament_subtype === 'oneshot'
      ).length,
      elite: availableCredits.filter(
        (c: any) => c.purchase_type === 'tournament_creation' && c.tournament_subtype === 'elite'
      ).length,
      platinium_solo: availableCredits.filter(
        (c: any) => c.purchase_type === 'platinium_participation'
      ).length,
      platinium_group: availableCredits.filter(
        (c: any) => c.purchase_type === 'platinium_group'
      ).reduce((sum: number, c: any) => sum + (c.slots_included || 11), 0),
      slot_invite: availableCredits.filter(
        (c: any) => c.purchase_type === 'slot_invite'
      ).length,
      duration_extension: availableCredits.filter(
        (c: any) => c.purchase_type === 'duration_extension'
      ).length,
      player_extension: availableCredits.filter(
        (c: any) => c.purchase_type === 'player_extension'
      ).length,
    }

    // Slots payants: total vs utilisés (calcul local)
    const allSlotInvites = allCredits.filter((c: any) => c.purchase_type === 'slot_invite')
    const paidSlotsTotal = allSlotInvites.length
    const paidSlotsUsed = allSlotInvites.filter((c: any) => c.used).length

    // Détails des crédits disponibles
    const creditDetails = availableCredits.map((c: any) => ({
      id: c.id,
      type: c.purchase_type,
      subtype: c.tournament_subtype,
      slots: c.slots_included,
      amount: c.amount,
      created_at: c.created_at,
    }))

    const data = {
      // Quotas
      free_tournaments_active: freeTournamentsActive,
      free_tournaments_max: PRICES.FREE_MAX_TOURNAMENTS,
      premium_invites_active: premiumInvitesActive,
      premium_invites_max: 1,
      can_create_free_tournament: freeTournamentsActive < PRICES.FREE_MAX_TOURNAMENTS,
      can_join_premium_free: premiumInvitesActive < 1,
      // Slots payants
      paid_slots_used: paidSlotsUsed,
      paid_slots_total: paidSlotsTotal,

      // Événement
      event_tournaments_active: eventTournamentsActive,
      event_tournaments_max: 1, // 1 gratuit
      event_slots_available: eventSlotsAvailable,
      event_slots_used: eventSlotsUsed,
      can_join_event_free: canJoinEventFree,
      can_join_event_with_slot: canJoinEventWithSlot,

      // Crédits disponibles
      credits,
      creditDetails,

      // Tournois actifs
      tournaments: activeTournaments,

      // Résumé
      total_active_tournaments: activeTournaments.length,
      total_as_captain: totalAsCaptain,
    }

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in zone-vip route:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
