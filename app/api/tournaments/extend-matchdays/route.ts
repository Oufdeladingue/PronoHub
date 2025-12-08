import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * API pour étendre le nombre de journées d'un tournoi custom (non free-kick)
 * POST /api/tournaments/extend-matchdays
 * Body: { tournamentId: string, additionalMatchdays: number }
 *
 * Conditions:
 * - Le tournoi doit avoir une custom_competition_id (pas une compétition standard)
 * - Le tournoi ne doit pas être de type 'free' (free-kick)
 * - Le tournoi doit être en status 'active' (déjà démarré)
 * - Le user doit être le créateur (capitaine)
 * - Le nombre de journées demandé ne doit pas dépasser les journées disponibles dans la compétition custom
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

    const { tournamentId, additionalMatchdays } = await request.json()

    if (!tournamentId) {
      return NextResponse.json(
        { success: false, error: 'ID du tournoi manquant' },
        { status: 400 }
      )
    }

    if (!additionalMatchdays || additionalMatchdays < 1) {
      return NextResponse.json(
        { success: false, error: 'Nombre de journées à ajouter invalide' },
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

    // Vérifier que l'utilisateur est le capitaine (créateur)
    if (tournament.creator_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Seul le capitaine peut étendre le tournoi' },
        { status: 403 }
      )
    }

    // Vérifier que c'est un tournoi custom (pas une compétition standard)
    if (!tournament.custom_competition_id) {
      return NextResponse.json(
        { success: false, error: 'Cette extension n\'est disponible que pour les tournois custom' },
        { status: 400 }
      )
    }

    // Vérifier que ce n'est pas un tournoi free-kick
    if (tournament.tournament_type === 'free') {
      return NextResponse.json(
        { success: false, error: 'Les tournois Free-Kick ne peuvent pas être étendus de cette manière' },
        { status: 400 }
      )
    }

    // Vérifier que le tournoi est actif
    if (tournament.status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Le tournoi doit être en cours pour être étendu' },
        { status: 400 }
      )
    }

    // Récupérer le nombre total de journées dans la compétition custom
    const { data: customCompMatchdays, error: matchdaysError } = await supabase
      .from('custom_competition_matchdays')
      .select('matchday_number')
      .eq('custom_competition_id', tournament.custom_competition_id)
      .order('matchday_number', { ascending: false })
      .limit(1)

    if (matchdaysError) {
      console.error('Error fetching custom competition matchdays:', matchdaysError)
      return NextResponse.json(
        { success: false, error: 'Erreur lors de la récupération des journées' },
        { status: 500 }
      )
    }

    const maxAvailableMatchday = customCompMatchdays?.[0]?.matchday_number || 0
    const currentEndMatchday = tournament.ending_matchday || tournament.num_matchdays || 0
    const newEndMatchday = currentEndMatchday + additionalMatchdays

    // Vérifier qu'on ne dépasse pas le nombre de journées disponibles
    if (newEndMatchday > maxAvailableMatchday) {
      return NextResponse.json(
        { success: false, error: `Impossible d'ajouter ${additionalMatchdays} journée(s). Maximum disponible: ${maxAvailableMatchday - currentEndMatchday}` },
        { status: 400 }
      )
    }

    // Calculer le nouveau nombre total de journées
    const newNumMatchdays = (tournament.num_matchdays || 0) + additionalMatchdays

    // Appliquer l'extension
    const { error: updateError } = await supabase
      .from('tournaments')
      .update({
        ending_matchday: newEndMatchday,
        num_matchdays: newNumMatchdays,
        matchdays_count: newNumMatchdays
      })
      .eq('id', tournamentId)

    if (updateError) {
      console.error('Error extending tournament matchdays:', updateError)
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
      const { error: journeysError } = await supabase
        .from('tournament_journeys')
        .insert(newJourneys)

      if (journeysError) {
        console.error('Error creating tournament journeys:', journeysError)
        // On ne fail pas la requête pour ça, les journées seront créées automatiquement si besoin
      }
    }

    return NextResponse.json({
      success: true,
      message: `Tournoi prolongé jusqu'à la journée ${newEndMatchday} !`,
      newEndMatchday,
      newNumMatchdays,
      additionalMatchdays
    })

  } catch (error: any) {
    console.error('Error in extend-matchdays:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/tournaments/extend-matchdays?tournamentId=xxx
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
      .select('id, tournament_type, status, num_matchdays, ending_matchday, starting_matchday, creator_id, custom_competition_id')
      .eq('id', tournamentId)
      .single()

    if (!tournament) {
      return NextResponse.json(
        { success: false, error: 'Tournoi non trouvé' },
        { status: 404 }
      )
    }

    // Si pas de custom_competition_id, pas d'extension possible
    if (!tournament.custom_competition_id) {
      return NextResponse.json({
        success: true,
        canExtend: false,
        reason: 'not_custom',
        isCaptain: tournament.creator_id === user.id
      })
    }

    // Si tournoi free-kick, pas d'extension via cette API
    if (tournament.tournament_type === 'free') {
      return NextResponse.json({
        success: true,
        canExtend: false,
        reason: 'free_kick',
        isCaptain: tournament.creator_id === user.id
      })
    }

    // Récupérer le nombre de journées disponibles dans la compétition custom
    const { data: customCompMatchdays } = await supabase
      .from('custom_competition_matchdays')
      .select('matchday_number')
      .eq('custom_competition_id', tournament.custom_competition_id)
      .order('matchday_number', { ascending: false })
      .limit(1)

    const maxAvailableMatchday = customCompMatchdays?.[0]?.matchday_number || 0
    const currentEndMatchday = tournament.ending_matchday || tournament.num_matchdays || 0

    // Le tournoi peut être étendu si:
    // - C'est un tournoi custom (vérifié ci-dessus)
    // - Ce n'est pas un free-kick (vérifié ci-dessus)
    // - Status active
    // - L'utilisateur est le capitaine
    // - Il reste des journées dans la compétition custom
    const canExtend = tournament.status === 'active' &&
      tournament.creator_id === user.id &&
      currentEndMatchday < maxAvailableMatchday

    return NextResponse.json({
      success: true,
      canExtend,
      isCaptain: tournament.creator_id === user.id,
      currentEndMatchday,
      maxAvailableMatchday,
      availableToAdd: Math.max(0, maxAvailableMatchday - currentEndMatchday),
      tournamentStatus: tournament.status
    })

  } catch (error: any) {
    console.error('Error in extend-matchdays GET:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
