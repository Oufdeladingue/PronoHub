import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendTournamentStartedEmail, sendTournamentStartedAdminAlert } from '@/lib/email'
import { sendTournamentStarted } from '@/lib/notifications'

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
      const lastMatchdayNumber = matchdays?.[matchdays.length - 1]?.matchday_number || totalMatchdays

      // Récupérer les matchs custom pour trouver la première journée RÉELLEMENT jouable (basé sur les dates)
      const now = new Date()
      const closingBuffer = 30 * 60 * 1000 // 30 minutes en ms
      const closingTime = new Date(now.getTime() + closingBuffer).toISOString()

      // Récupérer tous les matchs custom avec leurs dates
      const matchdayIds = matchdays?.map(md => md.id) || []
      const { data: customMatches } = await supabase
        .from('custom_competition_matches')
        .select('custom_matchday_id, cached_utc_date')
        .in('custom_matchday_id', matchdayIds)

      // Créer un mapping matchday_id -> matchday_number
      const matchdayIdToNumber: Record<string, number> = {}
      matchdays?.forEach(md => { matchdayIdToNumber[md.id] = md.matchday_number })

      // Grouper les matchs par journée et trouver la première journée où le premier match n'est pas encore clôturé
      let firstPlayableMatchday: number | null = null

      if (customMatches && customMatches.length > 0) {
        const matchesByMatchday: Record<number, string[]> = {}
        customMatches.forEach(match => {
          const matchdayNumber = matchdayIdToNumber[match.custom_matchday_id]
          if (matchdayNumber) {
            if (!matchesByMatchday[matchdayNumber]) {
              matchesByMatchday[matchdayNumber] = []
            }
            if (match.cached_utc_date) {
              matchesByMatchday[matchdayNumber].push(match.cached_utc_date)
            }
          }
        })

        // Trouver la première journée où le premier match n'est pas encore clôturé
        const sortedMatchdays = Object.keys(matchesByMatchday).map(Number).sort((a, b) => a - b)

        for (const matchday of sortedMatchdays) {
          const matchDates = matchesByMatchday[matchday]
          if (matchDates.length === 0) continue
          // Trier les dates pour trouver le premier match de la journée
          const firstMatchDate = matchDates.sort()[0]

          // Si le premier match de cette journée n'est pas encore clôturé, c'est la journée de départ
          if (firstMatchDate > closingTime) {
            firstPlayableMatchday = matchday
            break
          }
        }
      }

      // Fallback sur la première journée non-completed si aucune journée trouvée par les dates
      if (!firstPlayableMatchday) {
        const firstAvailableMatchday = matchdays?.find(m => m.status !== 'completed')
        firstPlayableMatchday = firstAvailableMatchday?.matchday_number || matchdays?.[0]?.matchday_number || 1
      }

      competition = {
        id: customCompetition.id,
        name: customCompetition.name,
        current_matchday: (firstPlayableMatchday ?? 1) - 1, // Pour que starting_matchday = firstPlayableMatchday
        total_matchdays: lastMatchdayNumber // Utiliser le dernier matchday_number réel
      }

      console.log('[START] Custom competition found:', customCompetition.name, 'Total matchdays:', totalMatchdays, 'First playable:', firstPlayableMatchday, 'Last:', lastMatchdayNumber)
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

    // 9. Envoyer les emails et notifications aux participants (async, sans bloquer la réponse)
    sendTournamentLaunchNotifications(
      supabase,
      tournamentId,
      tournament,
      competition!,
      startingMatchday,
      endingMatchday,
      actualMatchdays
    ).catch(err => console.error('[START] Error sending launch notifications:', err))

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

// Fonction pour envoyer les emails et notifications de lancement
async function sendTournamentLaunchNotifications(
  supabase: any,
  tournamentId: string,
  tournament: any,
  competition: { id: any; name: string; current_matchday: number | null; total_matchdays: number | null },
  startingMatchday: number,
  endingMatchday: number,
  actualMatchdays: number
) {
  try {
    console.log('[START] Sending launch notifications for tournament:', tournament.name)

    // 1. Récupérer tous les participants avec leurs infos
    const { data: participants } = await supabase
      .from('tournament_participants')
      .select(`
        user_id,
        profiles!inner(id, email, username, notification_preferences)
      `)
      .eq('tournament_id', tournamentId)

    if (!participants || participants.length === 0) {
      console.log('[START] No participants found')
      return
    }

    // 2. Récupérer le capitaine
    const { data: captain } = await supabase
      .from('profiles')
      .select('id, email, username')
      .eq('id', tournament.captain_id)
      .single()

    // 3. Récupérer le premier match pour la date
    let firstMatchDate = 'À déterminer'
    let firstMatchDeadline = ''
    let totalMatches = 0

    if (tournament.competition_id) {
      // Compétition importée
      const { data: matches } = await supabase
        .from('imported_matches')
        .select('utc_date')
        .eq('competition_id', tournament.competition_id)
        .gte('matchday', startingMatchday)
        .lte('matchday', endingMatchday)
        .order('utc_date', { ascending: true })

      if (matches && matches.length > 0) {
        totalMatches = matches.length
        const firstMatch = new Date(matches[0].utc_date)
        const deadline = new Date(firstMatch.getTime() - 30 * 60 * 1000) // 30 min avant

        // Formater la date en français
        firstMatchDate = firstMatch.toLocaleDateString('fr-FR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          hour: '2-digit',
          minute: '2-digit'
        })
        // Mettre la première lettre en majuscule
        firstMatchDate = firstMatchDate.charAt(0).toUpperCase() + firstMatchDate.slice(1)

        firstMatchDeadline = deadline.toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit'
        })
      }
    } else if (tournament.custom_competition_id) {
      // Compétition custom - récupérer les matchdays puis les matchs
      const { data: matchdays } = await supabase
        .from('custom_competition_matchdays')
        .select('id')
        .eq('custom_competition_id', tournament.custom_competition_id)
        .gte('matchday_number', startingMatchday)
        .lte('matchday_number', endingMatchday)

      if (matchdays && matchdays.length > 0) {
        const matchdayIds = matchdays.map((md: any) => md.id)

        const { data: customMatches } = await supabase
          .from('custom_competition_matches')
          .select('cached_utc_date')
          .in('custom_matchday_id', matchdayIds)
          .not('cached_utc_date', 'is', null)
          .order('cached_utc_date', { ascending: true })

        if (customMatches && customMatches.length > 0) {
          totalMatches = customMatches.length
          const firstMatch = new Date(customMatches[0].cached_utc_date)
          const deadline = new Date(firstMatch.getTime() - 30 * 60 * 1000) // 30 min avant

          // Formater la date en français
          firstMatchDate = firstMatch.toLocaleDateString('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            hour: '2-digit',
            minute: '2-digit'
          })
          // Mettre la première lettre en majuscule
          firstMatchDate = firstMatchDate.charAt(0).toUpperCase() + firstMatchDate.slice(1)

          firstMatchDeadline = deadline.toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit'
          })
        }
      }
    }

    // 4. Préparer la liste des participants pour l'email
    const participantsList = participants.map((p: any) => ({
      username: p.profiles?.username || 'Joueur',
      isCaptain: p.user_id === tournament.captain_id
    }))

    // 5. Compter le nb de tournois actifs par participant (pour l'email)
    const participantTournamentCounts: Record<string, number> = {}
    for (const p of participants) {
      const { count } = await supabase
        .from('tournament_participants')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', p.user_id)
        .eq('tournaments.status', 'active')

      participantTournamentCounts[p.user_id] = count || 1
    }

    // 6. Envoyer l'email à chaque participant
    const emailPromises = participants.map(async (p: any) => {
      const profile = p.profiles
      if (!profile?.email) return

      // Vérifier les préférences de notification
      const prefs = profile.notification_preferences || {}
      if (prefs.email_tournament_started === false) {
        console.log('[START] Email disabled for user:', profile.username)
        return
      }

      try {
        await sendTournamentStartedEmail(profile.email, {
          username: profile.username || 'Champion',
          tournamentName: tournament.name,
          tournamentSlug: tournament.slug,
          competitionName: competition.name,
          isCustomCompetition: !!tournament.custom_competition_id,
          participants: participantsList,
          matchdayRange: {
            start: startingMatchday,
            end: endingMatchday,
            totalMatches
          },
          firstMatchDate,
          firstMatchDeadline,
          rules: {
            exactScore: tournament.points_exact_score || 3,
            correctResult: tournament.points_correct_result || 1,
            correctGoalDiff: tournament.points_goal_diff || 2,
            bonusMatchEnabled: tournament.bonus_match || false,
            earlyPredictionBonus: tournament.early_prediction_bonus || false,
            defaultPredictionMaxPoints: tournament.scoring_default_prediction_max ?? 1
          },
          userActiveTournaments: participantTournamentCounts[p.user_id] || 1
        })
        console.log('[START] Email sent to:', profile.email)
      } catch (err) {
        console.error('[START] Error sending email to', profile.email, err)
      }
    })

    await Promise.all(emailPromises)

    // 7. Envoyer l'email admin
    try {
      await sendTournamentStartedAdminAlert({
        tournamentName: tournament.name,
        tournamentType: tournament.type || 'free',
        competitionName: competition.name,
        captainUsername: captain?.username || 'Inconnu',
        captainEmail: captain?.email || 'N/A',
        participantsCount: participants.length,
        participants: participantsList,
        matchdayRange: {
          start: startingMatchday,
          end: endingMatchday,
          totalMatches
        },
        firstMatchDate,
        bonusEnabled: tournament.bonus_match || false,
        startedAt: new Date().toLocaleString('fr-FR', {
          dateStyle: 'full',
          timeStyle: 'short'
        })
      })
      console.log('[START] Admin alert sent')
    } catch (err) {
      console.error('[START] Error sending admin alert:', err)
    }

    // 8. Envoyer les notifications push
    try {
      await sendTournamentStarted(
        tournamentId,
        tournament.name,
        tournament.slug,
        tournament.captain_id
      )
      console.log('[START] Push notifications sent')
    } catch (err) {
      console.error('[START] Error sending push notifications:', err)
    }

    console.log('[START] All launch notifications sent successfully')
  } catch (error) {
    console.error('[START] Error in sendTournamentLaunchNotifications:', error)
  }
}
