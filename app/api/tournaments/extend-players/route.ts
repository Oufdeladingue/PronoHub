import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { PRICES } from '@/types/monetization'

/**
 * API pour étendre le nombre de joueurs d'un tournoi Free-Kick
 * POST /api/tournaments/extend-players
 * Body: { tournamentId: string }
 *
 * Conditions:
 * - Le tournoi doit être de type 'free'
 * - Le tournoi doit être en status 'pending' ou 'warmup' (pas encore démarré)
 * - Le user doit être le créateur (capitaine)
 * - Le tournoi ne doit pas avoir déjà été étendu (players_extended < 1)
 * - L'utilisateur doit avoir un crédit player_extension disponible
 */

export async function POST(request: NextRequest) {
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

    const { tournamentId } = await request.json()

    if (!tournamentId) {
      return NextResponse.json(
        { success: false, error: 'ID du tournoi manquant' },
        { status: 400 }
      )
    }

    // Récupérer le tournoi
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', tournamentId)
      .single()

    if (tournamentError || !tournament) {
      return NextResponse.json(
        { success: false, error: 'Tournoi non trouvé' },
        { status: 404 }
      )
    }

    // Vérifications
    // N'importe quel participant peut payer l'extension (pas seulement le capitaine)
    const { data: participant } = await supabase
      .from('tournament_participants')
      .select('id')
      .eq('tournament_id', tournamentId)
      .eq('user_id', user.id)
      .single()

    if (!participant) {
      return NextResponse.json(
        { success: false, error: 'Vous devez être participant du tournoi pour l\'étendre' },
        { status: 403 }
      )
    }

    if (tournament.tournament_type !== 'free') {
      return NextResponse.json(
        { success: false, error: 'Cette extension n\'est disponible que pour les tournois Free-Kick' },
        { status: 400 }
      )
    }

    if (!['pending', 'warmup'].includes(tournament.status)) {
      return NextResponse.json(
        { success: false, error: 'Le tournoi doit être en phase d\'échauffement pour étendre les places' },
        { status: 400 }
      )
    }

    // Vérifier si le tournoi a déjà été étendu
    const playersExtended = tournament.players_extended || 0
    if (playersExtended >= 1) {
      return NextResponse.json(
        { success: false, error: 'Le tournoi a déjà été étendu. Maximum 1 extension de joueurs par tournoi.' },
        { status: 400 }
      )
    }

    // Vérifier si l'utilisateur a un crédit player_extension disponible
    const { data: credit, error: creditError } = await supabase
      .from('tournament_purchases')
      .select('id')
      .eq('user_id', user.id)
      .eq('purchase_type', 'player_extension')
      .eq('status', 'completed')
      .eq('used', false)
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (creditError || !credit) {
      // Pas de crédit, retourner les infos pour le paiement
      return NextResponse.json({
        success: false,
        requiresPayment: true,
        paymentType: 'player_extension',
        paymentAmount: PRICES.PLAYER_EXTENSION,
        message: `L'extension de joueurs coûte ${PRICES.PLAYER_EXTENSION}€. Achetez un crédit pour débloquer +${PRICES.FREE_PLAYER_EXTENSION_AMOUNT} places.`,
        currentMaxPlayers: tournament.max_players,
        newMaxPlayers: tournament.max_players + PRICES.FREE_PLAYER_EXTENSION_AMOUNT
      }, { status: 402 })
    }

    // Appliquer l'extension
    const newMaxPlayers = tournament.max_players + PRICES.FREE_PLAYER_EXTENSION_AMOUNT

    const { error: updateError } = await supabase
      .from('tournaments')
      .update({
        max_players: newMaxPlayers,
        max_participants: newMaxPlayers,
        players_extended: playersExtended + 1
      })
      .eq('id', tournamentId)

    if (updateError) {
      console.error('Error extending tournament players:', updateError)
      return NextResponse.json(
        { success: false, error: 'Erreur lors de l\'extension du tournoi' },
        { status: 500 }
      )
    }

    // Marquer le crédit comme utilisé
    await supabase
      .from('tournament_purchases')
      .update({
        used: true,
        used_at: new Date().toISOString(),
        used_for_tournament_id: tournamentId,
        tournament_id: tournamentId
      })
      .eq('id', credit.id)

    return NextResponse.json({
      success: true,
      message: `Tournoi étendu ! Nouvelles places disponibles: ${newMaxPlayers}`,
      newMaxPlayers,
      playersExtended: playersExtended + 1
    })

  } catch (error: any) {
    console.error('Error in extend-players:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/tournaments/extend-players?tournamentId=xxx
 * Vérifie si l'extension est disponible et si l'utilisateur a un crédit
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Non authentifié' },
        { status: 401 }
      )
    }

    const tournamentId = request.nextUrl.searchParams.get('tournamentId')
    if (!tournamentId) {
      return NextResponse.json(
        { success: false, error: 'ID du tournoi manquant' },
        { status: 400 }
      )
    }

    // Récupérer le tournoi
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('id, tournament_type, status, max_players, players_extended, creator_id')
      .eq('id', tournamentId)
      .single()

    if (!tournament) {
      return NextResponse.json(
        { success: false, error: 'Tournoi non trouvé' },
        { status: 404 }
      )
    }

    // Vérifier si l'extension est possible (conditions du tournoi uniquement)
    const canExtend = tournament.tournament_type === 'free' &&
      ['pending', 'warmup'].includes(tournament.status) &&
      (tournament.players_extended || 0) < 1

    // Vérifier si l'utilisateur est le capitaine
    const isCaptain = tournament.creator_id === user.id

    // Vérifier si l'utilisateur a un crédit disponible
    const { count: creditsCount } = await supabase
      .from('tournament_purchases')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('purchase_type', 'player_extension')
      .eq('status', 'completed')
      .eq('used', false)

    return NextResponse.json({
      success: true,
      canExtend,
      isCaptain,
      hasCredit: (creditsCount || 0) > 0,
      creditsAvailable: creditsCount || 0,
      currentMaxPlayers: tournament.max_players,
      newMaxPlayers: tournament.max_players + PRICES.FREE_PLAYER_EXTENSION_AMOUNT,
      playersExtended: tournament.players_extended || 0,
      price: PRICES.PLAYER_EXTENSION,
      extensionAmount: PRICES.FREE_PLAYER_EXTENSION_AMOUNT
    })

  } catch (error: any) {
    console.error('Error in extend-players GET:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
