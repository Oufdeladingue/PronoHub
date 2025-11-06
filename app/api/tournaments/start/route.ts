import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface StartTournamentRequest {
  tournamentId: string
  adjustMatchdays?: boolean  // Si true, ajuste automatiquement au nombre de journées restantes
}

export async function POST(request: NextRequest) {
  try {
    const body: StartTournamentRequest = await request.json()
    const { tournamentId, adjustMatchdays = false } = body

    if (!tournamentId) {
      return NextResponse.json(
        { error: 'Tournament ID is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // 1. Récupérer le tournoi
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', tournamentId)
      .single()

    if (tournamentError || !tournament) {
      return NextResponse.json(
        { error: 'Tournament not found' },
        { status: 404 }
      )
    }

    // 2. Vérifier que le tournoi est en attente
    if (tournament.status !== 'pending') {
      return NextResponse.json(
        { error: `Tournament is already ${tournament.status}` },
        { status: 400 }
      )
    }

    // 3. Récupérer les infos de la compétition
    console.log('[START] Looking for competition with ID:', tournament.competition_id)

    const { data: competition, error: competitionError } = await supabase
      .from('competitions')
      .select('id, name, current_matchday, total_matchdays')
      .eq('id', tournament.competition_id)
      .single()

    if (competitionError) {
      console.error('[START] Competition error:', competitionError)
    }

    if (competitionError || !competition) {
      return NextResponse.json(
        {
          error: 'Competition not found',
          details: competitionError?.message,
          tournament_competition_id: tournament.competition_id
        },
        { status: 404 }
      )
    }

    console.log('[START] Competition found:', competition.name, 'Current matchday:', competition.current_matchday)

    // 4. Calculer le nombre de journées restantes
    const remainingMatchdays = competition.total_matchdays
      ? competition.total_matchdays - (competition.current_matchday || 0)
      : null

    const plannedMatchdays = tournament.planned_matchdays || tournament.num_matchdays

    // 5. Vérifier s'il y a un problème de journées insuffisantes
    if (remainingMatchdays !== null && remainingMatchdays < plannedMatchdays) {
      // Pas assez de journées restantes
      if (!adjustMatchdays) {
        // Retourner une réponse avec options pour l'utilisateur
        return NextResponse.json({
          warning: true,
          message: `Il ne reste que ${remainingMatchdays} journée(s) de championnat. Vous aviez prévu ${plannedMatchdays} tours.`,
          remainingMatchdays,
          plannedMatchdays,
          currentMatchday: competition.current_matchday,
          totalMatchdays: competition.total_matchdays,
          options: {
            adjustTours: remainingMatchdays,
            keepPlanned: plannedMatchdays,
            canAdjust: remainingMatchdays > 0
          }
        }, { status: 200 })
      }
    }

    // 6. Calculer les journées à utiliser
    const actualMatchdays = adjustMatchdays && remainingMatchdays !== null && remainingMatchdays < plannedMatchdays
      ? remainingMatchdays
      : plannedMatchdays

    const startingMatchday = (competition.current_matchday || 0) + 1
    const endingMatchday = startingMatchday + actualMatchdays - 1

    // Générer le snapshot des journées
    const matchdaySnapshot = Array.from(
      { length: actualMatchdays },
      (_, i) => startingMatchday + i
    )

    // 7. Démarrer le tournoi avec les données de tracking
    const { error: updateError } = await supabase
      .from('tournaments')
      .update({
        status: 'active',
        start_date: new Date().toISOString(),
        actual_matchdays: actualMatchdays,
        starting_matchday: startingMatchday,
        ending_matchday: endingMatchday,
        matchday_snapshot: matchdaySnapshot,
        updated_at: new Date().toISOString()
      })
      .eq('id', tournamentId)

    if (updateError) {
      console.error('Error starting tournament:', updateError)
      return NextResponse.json(
        { error: 'Failed to start tournament', details: updateError.message },
        { status: 500 }
      )
    }

    // 8. Récupérer le tournoi mis à jour
    const { data: updatedTournament } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', tournamentId)
      .single()

    return NextResponse.json({
      success: true,
      message: 'Tournament started successfully',
      tournament: updatedTournament,
      matchdayInfo: {
        planned: plannedMatchdays,
        actual: actualMatchdays,
        starting: startingMatchday,
        ending: endingMatchday,
        snapshot: matchdaySnapshot,
        adjusted: actualMatchdays < plannedMatchdays
      }
    })

  } catch (error: any) {
    console.error('Error in start tournament route:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
