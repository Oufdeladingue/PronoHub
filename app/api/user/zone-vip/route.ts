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

    // Récupérer tous les tournois où l'utilisateur participe
    // Note: participant_role et invite_type peuvent ne pas exister encore (migration pas appliquée)
    const { data: participations, error: participationsError } = await supabase
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
          creator_id
        )
      `)
      .eq('user_id', user.id)

    if (participationsError) {
      console.error('Error fetching participations:', participationsError)
      return NextResponse.json(
        { success: false, error: 'Erreur lors de la récupération des données' },
        { status: 500 }
      )
    }

    // Filtrer les tournois actifs (pending, warmup ou active)
    const activeTournaments = (participations || [])
      .filter((p: any) => p.tournaments && ['pending', 'warmup', 'active'].includes(p.tournaments.status))
      .map((p: any) => {
        // Déterminer le rôle: utiliser participant_role si disponible, sinon vérifier creator_id
        const isCaptain = p.participant_role === 'captain' || p.tournaments.creator_id === user.id
        return {
          id: p.tournaments.id,
          name: p.tournaments.name,
          slug: p.tournaments.slug,
          tournament_type: p.tournaments.tournament_type || 'free',
          status: p.tournaments.status,
          participant_role: isCaptain ? 'captain' : 'member',
          invite_type: p.invite_type || 'free',
          current_players: 0, // Sera calculé ci-dessous
          max_players: p.tournaments.max_players || 5,
          competition_name: p.tournaments.competition_name || 'N/A',
          is_legacy: p.tournaments.is_legacy || false,
        }
      })

    // Compter le nombre de participants pour chaque tournoi
    for (const tournament of activeTournaments) {
      const { count } = await supabase
        .from('tournament_participants')
        .select('*', { count: 'exact', head: true })
        .eq('tournament_id', tournament.id)

      tournament.current_players = count || 0
    }

    // Calculer les quotas
    // Tournois FREE actifs (non legacy)
    const freeTournamentsActive = activeTournaments.filter(
      (t: any) => t.tournament_type === 'free' && !t.is_legacy
    ).length

    // Invitations premium gratuites utilisées (non legacy)
    const premiumInvitesActive = activeTournaments.filter(
      (t: any) =>
        ['oneshot', 'elite'].includes(t.tournament_type) &&
        t.participant_role === 'member' &&
        !t.is_legacy
    ).length

    // Nombre de tournois en tant que capitaine
    const totalAsCaptain = activeTournaments.filter((t: any) => t.participant_role === 'captain').length

    // Récupérer les crédits disponibles (achats non utilisés)
    const { data: availableCredits } = await supabase
      .from('tournament_purchases')
      .select('id, purchase_type, tournament_subtype, slots_included, created_at, amount')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .eq('used', false)

    // Compter les crédits par type
    const credits = {
      oneshot: (availableCredits || []).filter(
        (c: any) => c.purchase_type === 'tournament_creation' && c.tournament_subtype === 'oneshot'
      ).length,
      elite: (availableCredits || []).filter(
        (c: any) => c.purchase_type === 'tournament_creation' && c.tournament_subtype === 'elite'
      ).length,
      platinium_solo: (availableCredits || []).filter(
        (c: any) => c.purchase_type === 'platinium_participation'
      ).length,
      platinium_group: (availableCredits || []).filter(
        (c: any) => c.purchase_type === 'platinium_group'
      ).reduce((sum: number, c: any) => sum + (c.slots_included || 11), 0),
      slot_invite: (availableCredits || []).filter(
        (c: any) => c.purchase_type === 'slot_invite'
      ).length,
      duration_extension: (availableCredits || []).filter(
        (c: any) => c.purchase_type === 'duration_extension'
      ).length,
      player_extension: (availableCredits || []).filter(
        (c: any) => c.purchase_type === 'player_extension'
      ).length,
    }

    // Détails des crédits disponibles (pour affichage)
    const creditDetails = (availableCredits || []).map((c: any) => ({
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
