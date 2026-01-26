import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { PRICES } from '@/types/monetization'

/**
 * API pour étendre la durée d'un tournoi Free-Kick
 * POST /api/tournaments/extend-duration
 * Body: { tournamentId: string, matchdaysToAdd?: number }
 *
 * Conditions:
 * - Le tournoi doit être de type 'free'
 * - Le tournoi doit être en status 'active' (déjà démarré)
 * - Le user doit être le créateur (capitaine)
 * - Le tournoi ne doit pas avoir déjà été étendu en durée (duration_extended = false)
 * - L'utilisateur doit avoir un crédit duration_extension disponible
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

    const { tournamentId, matchdaysToAdd } = await request.json()

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

    // Vérifications - N'importe quel participant peut payer l'extension
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

    if (tournament.status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Le tournoi doit être en cours pour étendre la durée' },
        { status: 400 }
      )
    }

    // Vérifier si le tournoi a encore de la marge pour être étendu
    // (il doit rester des journées après la fin prévue du tournoi)
    const currentEndMatchday = tournament.ending_matchday || tournament.num_matchdays

    // Récupérer les journées restantes de la compétition
    const { data: matchesData } = await supabase
      .from('imported_matches')
      .select('matchday')
      .eq('competition_id', tournament.competition_id)
      .gt('matchday', currentEndMatchday)
      .order('matchday', { ascending: false })
      .limit(1)

    const maxCompetitionMatchday = matchesData?.[0]?.matchday || currentEndMatchday

    if (currentEndMatchday >= maxCompetitionMatchday) {
      return NextResponse.json(
        { success: false, error: 'Le tournoi couvre déjà toutes les journées restantes de la compétition' },
        { status: 400 }
      )
    }

    // Vérifier si l'utilisateur a un crédit duration_extension disponible
    const { data: credit, error: creditError } = await supabase
      .from('tournament_purchases')
      .select('id')
      .eq('user_id', user.id)
      .eq('purchase_type', 'duration_extension')
      .eq('status', 'completed')
      .eq('used', false)
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (creditError || !credit) {
      // Pas de crédit, retourner les infos pour le paiement
      const maxPossible = Math.min(10, maxCompetitionMatchday - currentEndMatchday)
      return NextResponse.json({
        success: false,
        requiresPayment: true,
        paymentType: 'duration_extension',
        paymentAmount: PRICES.DURATION_EXTENSION,
        message: `L'extension de durée coûte ${PRICES.DURATION_EXTENSION}€. Achetez un crédit pour prolonger votre tournoi.`,
        currentEndMatchday,
        newEndMatchday: maxCompetitionMatchday,
        additionalMatchdays: maxCompetitionMatchday - currentEndMatchday,
        maxAdditional: maxPossible
      }, { status: 402 })
    }

    // Calculer le nombre de journées à ajouter
    const maxPossible = Math.min(10, maxCompetitionMatchday - currentEndMatchday)

    // Valider matchdaysToAdd
    if (matchdaysToAdd !== undefined) {
      if (!Number.isInteger(matchdaysToAdd) || matchdaysToAdd < 1 || matchdaysToAdd > maxPossible) {
        return NextResponse.json(
          { success: false, error: `Le nombre de journées doit être entre 1 et ${maxPossible}` },
          { status: 400 }
        )
      }
    }

    const additionalMatchdays = matchdaysToAdd || maxPossible
    const newEndMatchday = currentEndMatchday + additionalMatchdays
    const newNumMatchdays = (tournament.num_matchdays || tournament.matchdays_count) + additionalMatchdays

    // Appliquer l'extension
    const { error: updateError } = await supabase
      .from('tournaments')
      .update({
        ending_matchday: newEndMatchday,
        num_matchdays: newNumMatchdays,
        matchdays_count: newNumMatchdays,
        max_matchdays: null, // Retirer la limite de journées
        duration_extended: true
      })
      .eq('id', tournamentId)

    if (updateError) {
      console.error('Error extending tournament duration:', updateError)
      return NextResponse.json(
        { success: false, error: 'Erreur lors de l\'extension du tournoi' },
        { status: 500 }
      )
    }

    // Créer les nouvelles journées du tournoi
    const newJourneys = []
    const startingMatchday = tournament.starting_matchday || 1
    for (let i = currentEndMatchday + 1; i <= newEndMatchday; i++) {
      newJourneys.push({
        tournament_id: tournamentId,
        journey_number: i - startingMatchday + 1,
        status: 'pending'
      })
    }

    if (newJourneys.length > 0) {
      await supabase.from('tournament_journeys').insert(newJourneys)
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
      message: `Tournoi prolongé jusqu'à la journée ${newEndMatchday} !`,
      newEndMatchday,
      newNumMatchdays,
      additionalMatchdays
    })

  } catch (error: any) {
    console.error('Error in extend-duration:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/tournaments/extend-duration?tournamentId=xxx
 * Vérifie si l'extension est disponible et retourne les infos
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
      .select('id, tournament_type, status, num_matchdays, ending_matchday, starting_matchday, duration_extended, creator_id, competition_id, max_matchdays')
      .eq('id', tournamentId)
      .single()

    if (!tournament) {
      return NextResponse.json(
        { success: false, error: 'Tournoi non trouvé' },
        { status: 404 }
      )
    }

    // Récupérer la dernière journée de la compétition
    const { data: matchesData } = await supabase
      .from('imported_matches')
      .select('matchday')
      .eq('competition_id', tournament.competition_id)
      .order('matchday', { ascending: false })
      .limit(1)

    const maxCompetitionMatchday = matchesData?.[0]?.matchday || 38
    const currentEndMatchday = tournament.ending_matchday || (tournament.starting_matchday || 1) + (tournament.num_matchdays || 10) - 1

    // Le tournoi peut être étendu si:
    // - Type free
    // - Status active (demarre)
    // - Il reste des journees dans la competition
    console.log('[EXTEND-DURATION] Check conditions:', {
      tournament_type: tournament.tournament_type,
      status: tournament.status,
      currentEndMatchday,
      maxCompetitionMatchday,
      competition_id: tournament.competition_id
    })

    const canExtend = tournament.tournament_type === 'free' &&
      tournament.status === 'active' &&
      currentEndMatchday < maxCompetitionMatchday

    console.log('[EXTEND-DURATION] canExtend:', canExtend)

    // Verifier si l'utilisateur a un credit disponible
    const { count: creditsCount } = await supabase
      .from('tournament_purchases')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('purchase_type', 'duration_extension')
      .eq('status', 'completed')
      .eq('used', false)

    const totalRemaining = maxCompetitionMatchday - currentEndMatchday
    const maxAdditional = Math.min(10, totalRemaining)

    return NextResponse.json({
      success: true,
      canExtend,
      hasCredit: (creditsCount || 0) > 0,
      creditsAvailable: creditsCount || 0,
      currentEndMatchday,
      newEndMatchday: maxCompetitionMatchday,
      additionalMatchdays: totalRemaining,
      maxAdditional,
      durationExtended: tournament.duration_extended || false,
      maxMatchdays: tournament.max_matchdays,
      price: PRICES.DURATION_EXTENSION,
      isCaptain: tournament.creator_id === user.id
    })

  } catch (error: any) {
    console.error('Error in extend-duration GET:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
