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

    // 3. Récupérer les infos de la compétition (importée ou custom)
    let competition: { id: any, name: string, current_matchday: number | null, total_matchdays: number | null } | null = null
    let isCustomCompetition = false

    if (tournament.custom_competition_id) {
      // Compétition custom (Best of Week, etc.)
      console.log('[START] Looking for custom competition with ID:', tournament.custom_competition_id)
      isCustomCompetition = true

      const { data: customCompetition, error: customError } = await supabase
        .from('custom_competitions')
        .select('id, name')
        .eq('id', tournament.custom_competition_id)
        .single()

      if (customError || !customCompetition) {
        console.error('[START] Custom competition error:', customError)
        return NextResponse.json(
          {
            error: 'Custom competition not found',
            details: customError?.message,
            custom_competition_id: tournament.custom_competition_id
          },
          { status: 404 }
        )
      }

      // Pour les compétitions custom, récupérer les journées depuis custom_competition_matchdays
      const { data: matchdays } = await supabase
        .from('custom_competition_matchdays')
        .select('id, matchday_number, status')
        .eq('custom_competition_id', tournament.custom_competition_id)
        .order('matchday_number', { ascending: true })

      const totalMatchdays = matchdays?.length || 0
      const completedMatchdays = matchdays?.filter(m => m.status === 'completed').length || 0

      // Pour les compétitions custom, on utilise les vrais matchday_number (pas séquentiels à partir de 1)
      // On doit récupérer le premier matchday_number non complété
      const firstAvailableMatchday = matchdays?.find(m => m.status !== 'completed')
      const firstMatchdayNumber = firstAvailableMatchday?.matchday_number || matchdays?.[0]?.matchday_number || 1
      const lastMatchdayNumber = matchdays?.[matchdays.length - 1]?.matchday_number || totalMatchdays

      competition = {
        id: customCompetition.id,
        name: customCompetition.name,
        current_matchday: firstMatchdayNumber - 1, // Pour que starting_matchday = firstMatchdayNumber
        total_matchdays: lastMatchdayNumber // Utiliser le dernier matchday_number réel
      }

      console.log('[START] Custom competition found:', customCompetition.name, 'Total matchdays:', totalMatchdays, 'Completed:', completedMatchdays, 'First available:', firstMatchdayNumber, 'Last:', lastMatchdayNumber)
    } else if (tournament.competition_id) {
      // Compétition importée classique
      console.log('[START] Looking for competition with ID:', tournament.competition_id)

      const { data: importedCompetition, error: competitionError } = await supabase
        .from('competitions')
        .select('id, name, current_matchday, total_matchdays')
        .eq('id', tournament.competition_id)
        .single()

      if (competitionError) {
        console.error('[START] Competition error:', competitionError)
      }

      if (competitionError || !importedCompetition) {
        return NextResponse.json(
          {
            error: 'Competition not found',
            details: competitionError?.message,
            tournament_competition_id: tournament.competition_id
          },
          { status: 404 }
        )
      }

      // Trouver la première journée COMPLÈTEMENT jouable
      // Une journée est jouable si TOUS ses matchs ne sont pas encore clôturés (30min avant le premier match)
      const now = new Date()
      const closingBuffer = 30 * 60 * 1000 // 30 minutes en ms
      const closingTime = new Date(now.getTime() + closingBuffer).toISOString()

      // Récupérer tous les matchs futurs groupés par journée
      const { data: allFutureMatches } = await supabase
        .from('imported_matches')
        .select('matchday, utc_date')
        .eq('competition_id', tournament.competition_id)
        .order('matchday', { ascending: true })

      // Trouver la première journée où TOUS les matchs sont encore jouables
      let firstPlayableMatchday: number | null = null

      if (allFutureMatches && allFutureMatches.length > 0) {
        // Grouper les matchs par journée
        const matchesByMatchday: Record<number, string[]> = {}
        allFutureMatches.forEach(match => {
          if (!matchesByMatchday[match.matchday]) {
            matchesByMatchday[match.matchday] = []
          }
          matchesByMatchday[match.matchday].push(match.utc_date)
        })

        // Trouver la première journée où le premier match n'est pas encore clôturé
        const sortedMatchdays = Object.keys(matchesByMatchday).map(Number).sort((a, b) => a - b)

        for (const matchday of sortedMatchdays) {
          const matchDates = matchesByMatchday[matchday]
          // Trier les dates pour trouver le premier match de la journée
          const firstMatchDate = matchDates.sort()[0]

          // Si le premier match de cette journée n'est pas encore clôturé, c'est la journée de départ
          if (firstMatchDate > closingTime) {
            firstPlayableMatchday = matchday
            break
          }
        }
      }

      // Fallback sur current_matchday si aucune journée trouvée
      if (!firstPlayableMatchday) {
        firstPlayableMatchday = (importedCompetition.current_matchday || 0) + 1
      }

      // S'assurer que firstPlayableMatchday est défini (pour TypeScript)
      const safeFirstPlayableMatchday = firstPlayableMatchday ?? 1

      console.log('[START] Competition found:', importedCompetition.name,
        'Current matchday:', importedCompetition.current_matchday,
        'First fully playable matchday:', safeFirstPlayableMatchday)

      // On stocke firstPlayableMatchday - 1 pour que le calcul startingMatchday = current + 1 donne le bon résultat
      competition = {
        ...importedCompetition,
        current_matchday: safeFirstPlayableMatchday - 1
      }
    } else {
      return NextResponse.json(
        { error: 'Tournament has no competition associated' },
        { status: 400 }
      )
    }

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

    // 6b. Supprimer les équipes vides (si mode équipe activé)
    if (tournament.teams_enabled) {
      // Récupérer les équipes avec leurs membres
      const { data: teams } = await supabase
        .from('tournament_teams')
        .select('id, tournament_team_members(id)')
        .eq('tournament_id', tournamentId)

      if (teams) {
        const emptyTeamIds = teams
          .filter(t => !t.tournament_team_members || t.tournament_team_members.length === 0)
          .map(t => t.id)

        if (emptyTeamIds.length > 0) {
          console.log('[START] Deleting empty teams:', emptyTeamIds.length)
          await supabase
            .from('tournament_teams')
            .delete()
            .in('id', emptyTeamIds)
        }
      }
    }

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
