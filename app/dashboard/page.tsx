import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import Navigation from '@/components/Navigation'
import DashboardClient from '@/components/DashboardClient'
import { isSuperAdmin } from '@/lib/auth-helpers'
import { UserRole } from '@/types'
import { getAdminPath } from '@/lib/admin-path'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/auth/login')
  }

  // Récupérer le profil utilisateur
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const isSuper = isSuperAdmin(profile?.role as UserRole)

  // Récupérer les quotas utilisateur depuis le système de monétisation
  // Vérifier abonnement actif
  const { data: subscription } = await supabase
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  const hasSubscription = subscription?.status === 'active'

  // Récupérer les IDs des tournois auxquels l'utilisateur participe (pour l'affichage)
  const { data: participations } = await supabase
    .from('tournament_participants')
    .select('tournament_id')
    .eq('user_id', user.id)

  const tournamentIds = participations?.map(p => p.tournament_id) || []

  // QUOTAS GRATUIT: Compter les PARTICIPATIONS aux tournois gratuits actifs
  // Pour les tournois gratuits, c'est le nombre de participations qui compte (pas la création)
  const { data: participatedTournaments } = await supabase
    .from('tournaments')
    .select('id, tournament_type, competition_id')
    .in('id', tournamentIds.length > 0 ? tournamentIds : ['00000000-0000-0000-0000-000000000000'])
    .neq('status', 'completed')

  // Récupérer les IDs des compétitions événement pour identifier les tournois événement
  const participatedCompetitionIds = participatedTournaments?.map(t => t.competition_id).filter(Boolean) || []
  let eventCompetitionIds: string[] = []
  if (participatedCompetitionIds.length > 0) {
    const { data: eventCompetitions } = await supabase
      .from('competitions')
      .select('id')
      .in('id', participatedCompetitionIds)
      .eq('is_event', true)
    eventCompetitionIds = eventCompetitions?.map(c => c.id) || []
  }

  // Compter par type de tournoi parmi ceux auxquels l'utilisateur participe encore (non terminés)
  const freeTournamentsParticipating = participatedTournaments?.filter(t =>
    (t.tournament_type === 'free' || !t.tournament_type) &&
    !eventCompetitionIds.includes(t.competition_id)
  ).length || 0
  const oneshotCreated = participatedTournaments?.filter(t => t.tournament_type === 'oneshot').length || 0
  const eliteCreated = participatedTournaments?.filter(t => t.tournament_type === 'elite').length || 0
  const platiniumCreated = participatedTournaments?.filter(t => t.tournament_type === 'platinium').length || 0
  const premiumTournamentsCreated = participatedTournaments?.filter(t => t.tournament_type === 'premium').length || 0
  // Compter les tournois événement (compétitions avec is_event = true)
  const eventTournamentsParticipating = participatedTournaments?.filter(t =>
    eventCompetitionIds.includes(t.competition_id)
  ).length || 0

  // Compter les slots one-shot disponibles (legacy)
  const { count: oneshotSlotsAvailable } = await supabase
    .from('user_oneshot_purchases')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'available')

  // Récupérer les crédits disponibles depuis la vue user_available_credits
  const { data: userCredits } = await supabase
    .from('user_available_credits')
    .select('*')
    .eq('user_id', user.id)
    .single()

  const credits = {
    oneshot: userCredits?.oneshot_credits || 0,
    elite: userCredits?.elite_credits || 0,
    platinium_solo: userCredits?.platinium_solo_credits || 0,
    platinium_group_slots: userCredits?.platinium_group_slots || 0,
    slot_invite: userCredits?.slot_invite_credits || 0,
    duration_extension: userCredits?.duration_extension_credits || 0,
    player_extension: userCredits?.player_extension_credits || 0,
  }

  // Récupérer la limite de tournois Free-Kick depuis pricing_config
  const { data: pricingConfig } = await supabase
    .from('pricing_config')
    .select('config_value')
    .eq('config_key', 'free_max_tournaments')
    .eq('is_active', true)
    .single()

  const FREE_KICK_MAX = pricingConfig?.config_value || 2

  // Déterminer si l'utilisateur peut créer/rejoindre un tournoi
  // FREE-KICK (gratuit): basé sur les PARTICIPATIONS - même règle pour créer et rejoindre
  // PREMIUM: basé sur les CRÉATIONS (max 5)
  const canCreateFree = freeTournamentsParticipating < FREE_KICK_MAX
  const canJoinFree = freeTournamentsParticipating < FREE_KICK_MAX // Même règle que canCreateFree
  const canCreatePremium = hasSubscription && premiumTournamentsCreated < 5
  const canCreateOneshot = (oneshotSlotsAvailable || 0) > 0
  const canCreateTournament = canCreateFree || canCreatePremium || canCreateOneshot

  // Récupérer les détails des tournois où l'utilisateur participe
  const { data: userTournaments } = await supabase
    .from('tournaments')
    .select('id, name, slug, invite_code, competition_id, custom_competition_id, competition_name, creator_id, status, max_participants, max_players, starting_matchday, ending_matchday, tournament_type, num_matchdays, actual_matchdays')
    .in('id', tournamentIds)

  // Récupérer les tournois où l'utilisateur est le créateur original mais a quitté (n'est plus participant)
  // Ces tournois occupent toujours un slot mais l'utilisateur n'y a plus accès
  const { data: leftTournaments } = await supabase
    .from('tournaments')
    .select('id, name, slug, invite_code, competition_id, custom_competition_id, competition_name, creator_id, status, max_participants, max_players, starting_matchday, ending_matchday, tournament_type')
    .eq('original_creator_id', user.id)
    .neq('status', 'completed')
    .not('id', 'in', `(${tournamentIds.length > 0 ? tournamentIds.join(',') : '00000000-0000-0000-0000-000000000000'})`)

  // Récupérer les IDs de compétitions (inclure les tournois quittés aussi)
  const allTournamentsForCompetitions = [...(userTournaments || []), ...(leftTournaments || [])]
  const competitionIds = allTournamentsForCompetitions.map((t: any) => t.competition_id).filter(Boolean) || []
  const customCompetitionIds = allTournamentsForCompetitions.map((t: any) => t.custom_competition_id).filter(Boolean) || []

  // Récupérer les emblèmes des compétitions importées (y compris logos personnalisés)
  let competitionsMap: Record<number, { emblem: string, custom_emblem_white: string | null, custom_emblem_color: string | null }> = {}
  if (competitionIds.length > 0) {
    const { data: competitions } = await supabase
      .from('competitions')
      .select('id, emblem, custom_emblem_white, custom_emblem_color')
      .in('id', competitionIds)

    if (competitions) {
      competitionsMap = competitions.reduce((acc: any, comp: any) => {
        acc[comp.id] = {
          emblem: comp.emblem,
          custom_emblem_white: comp.custom_emblem_white,
          custom_emblem_color: comp.custom_emblem_color
        }
        return acc
      }, {})
    }
  }

  // Récupérer les emblèmes des compétitions custom (Best of Week, etc.)
  let customCompetitionsMap: Record<string, { name: string, custom_emblem_white: string | null, custom_emblem_color: string | null }> = {}
  if (customCompetitionIds.length > 0) {
    const { data: customCompetitions } = await supabase
      .from('custom_competitions')
      .select('id, name, custom_emblem_white, custom_emblem_color')
      .in('id', customCompetitionIds)

    if (customCompetitions) {
      customCompetitionsMap = customCompetitions.reduce((acc: any, comp: any) => {
        acc[comp.id] = {
          name: comp.name,
          custom_emblem_white: comp.custom_emblem_white,
          custom_emblem_color: comp.custom_emblem_color
        }
        return acc
      }, {})
    }
  }

  // Compter les participants réels pour chaque tournoi
  const participantCounts: Record<string, number> = {}
  for (const tournamentId of tournamentIds) {
    const { count } = await supabase
      .from('tournament_participants')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId)

    participantCounts[tournamentId] = count || 0
  }

  // Récupérer les informations sur les journées pour chaque tournoi
  const journeyInfo: Record<string, any> = {}
  for (const tournament of userTournaments || []) {
    let startMatchday = tournament.starting_matchday
    let endMatchday = tournament.ending_matchday

    // Vérifier si c'est un tournoi custom SANS starting/ending_matchday
    // (les tournois custom avec starting/ending_matchday utilisent la logique standard)
    const isCustomCompetition = !!tournament.custom_competition_id && (!startMatchday || !endMatchday)

    // Pour les tournois custom sans matchdays définis, récupérer les journées depuis custom_competition_matchdays
    if (isCustomCompetition) {
      const { data: customMatchdays, error: customMatchdaysError } = await supabase
        .from('custom_competition_matchdays')
        .select('id, matchday_number, start_date, end_date')
        .eq('custom_competition_id', tournament.custom_competition_id)
        .order('matchday_number', { ascending: true })

      console.log(`[DASHBOARD CUSTOM] Tournament ${tournament.name}:`, {
        custom_competition_id: tournament.custom_competition_id,
        matchdaysFound: customMatchdays?.length || 0,
        error: customMatchdaysError?.message || null
      })

      if (!customMatchdays || customMatchdays.length === 0) {
        journeyInfo[tournament.id] = {
          total: 0,
          completed: 0,
          currentNumber: 1
        }
        continue
      }

      const totalJourneys = customMatchdays.length
      const matchdayIds = customMatchdays.map(md => md.id)

      // Récupérer les matchs custom
      const { data: customMatches } = await supabase
        .from('custom_competition_matches')
        .select('custom_matchday_id, status, utc_date')
        .in('custom_matchday_id', matchdayIds)

      // Créer un mapping ID -> matchday_number
      const matchdayNumberMap: Record<string, number> = {}
      for (const md of customMatchdays) {
        matchdayNumberMap[md.id] = md.matchday_number
      }

      // Regrouper les matchs par journée
      const matchdayMap = new Map<number, Array<{ status: string, utc_date: string }>>()
      for (const match of customMatches || []) {
        const mdNumber = matchdayNumberMap[match.custom_matchday_id]
        if (mdNumber !== undefined) {
          if (!matchdayMap.has(mdNumber)) {
            matchdayMap.set(mdNumber, [])
          }
          matchdayMap.get(mdNumber)!.push(match)
        }
      }

      const now = new Date()
      let pendingJourneys = 0
      let completedJourneys = 0

      for (const [, matches] of matchdayMap) {
        const allFinished = matches.every(m => m.status === 'FINISHED')
        const allPending = matches.every(m => {
          const matchDate = new Date(m.utc_date)
          const isScheduled = m.status === 'SCHEDULED' || m.status === 'TIMED'
          return isScheduled && matchDate > now
        })

        if (allFinished) {
          completedJourneys++
        } else if (allPending) {
          pendingJourneys++
        }
      }

      const notYetImportedJourneys = totalJourneys - matchdayMap.size
      const currentNumber = Math.max(1, totalJourneys - pendingJourneys - notYetImportedJourneys)

      journeyInfo[tournament.id] = {
        total: totalJourneys,
        completed: completedJourneys,
        currentNumber: currentNumber
      }
      continue
    }

    // Tournois standards (non-custom)
    if (!startMatchday || !endMatchday) {
      journeyInfo[tournament.id] = {
        total: 0,
        completed: 0,
        currentNumber: 1
      }
      continue
    }

    // Nombre total de journées du tournoi
    // Le calcul starting/ending_matchday est le plus fiable car mis à jour au démarrage
    const totalJourneys = endMatchday - startMatchday + 1

    // Récupérer tous les matchs de la compétition dans la plage du tournoi
    const { data: allMatches } = await supabase
      .from('imported_matches')
      .select('matchday, status, finished, utc_date')
      .eq('competition_id', tournament.competition_id)
      .gte('matchday', startMatchday)
      .lte('matchday', endMatchday)

    // Regrouper les matchs par journée
    const matchdayMap = new Map<number, Array<{ status: string, finished: boolean, utc_date: string }>>()
    for (const match of allMatches || []) {
      if (!matchdayMap.has(match.matchday)) {
        matchdayMap.set(match.matchday, [])
      }
      matchdayMap.get(match.matchday)!.push(match)
    }

    // Calculer le statut des journées basé sur les matchs :
    // - "pending" : aucun match n'a commencé (tous SCHEDULED/TIMED avec date future)
    // - "active" : au moins un match a débuté mais pas tous terminés
    // - "completed" : tous les matchs sont terminés (FINISHED)
    const now = new Date()
    let pendingJourneys = 0
    let completedJourneys = 0

    for (const [, matches] of matchdayMap) {
      const allFinished = matches.every(m => m.status === 'FINISHED' || m.finished === true)
      const allPending = matches.every(m => {
        const matchDate = new Date(m.utc_date)
        const isScheduled = m.status === 'SCHEDULED' || m.status === 'TIMED'
        return isScheduled && matchDate > now
      })

      if (allFinished) {
        completedJourneys++
      } else if (allPending) {
        pendingJourneys++
      }
      // Sinon c'est "active" (en cours) - on ne compte pas
    }

    // Journées non encore importées (pour compétitions à élimination directe)
    // = total du tournoi - journées avec matchs importés
    const notYetImportedJourneys = totalJourneys - matchdayMap.size

    // La journée actuelle = total - journées à venir (pending + non importées)
    const currentNumber = Math.max(1, totalJourneys - pendingJourneys - notYetImportedJourneys)

    journeyInfo[tournament.id] = {
      total: totalJourneys,
      completed: completedJourneys,
      currentNumber: currentNumber
    }
  }

  // Récupérer le temps restant avant la prochaine journée pour les tournois en attente
  const nextMatchDates: Record<string, string | null> = {}
  for (const t of userTournaments || []) {
    if (t.status === 'pending' || t.status === 'warmup') {
      // Vérifier si c'est un tournoi custom
      if (t.custom_competition_id) {
        // Pour les tournois custom, récupérer via les matchdays avec jointure
        const { data: matchdaysWithMatches } = await supabase
          .from('custom_competition_matchdays')
          .select(`
            id,
            matchday_number,
            custom_competition_matches!inner(utc_date)
          `)
          .eq('custom_competition_id', t.custom_competition_id)
          .order('matchday_number', { ascending: true })

        // Trouver le premier match à venir
        let nextMatchDate: string | null = null
        const now = new Date()
        for (const md of matchdaysWithMatches || []) {
          const matches = (md as any).custom_competition_matches || []
          for (const match of matches) {
            const matchDate = new Date(match.utc_date)
            if (matchDate > now) {
              if (!nextMatchDate || matchDate < new Date(nextMatchDate)) {
                nextMatchDate = match.utc_date
              }
            }
          }
          if (nextMatchDate) break // On a trouvé dans la première journée avec match à venir
        }

        nextMatchDates[t.id] = nextMatchDate
      } else {
        // Récupérer le prochain match de la compétition standard (première journée à venir)
        const { data: matches, error: matchError } = await supabase
          .from('imported_matches')
          .select('utc_date, matchday')
          .eq('competition_id', t.competition_id)
          .gte('utc_date', new Date().toISOString())
          .order('matchday', { ascending: true })
          .order('utc_date', { ascending: true })
          .limit(1)

        if (!matchError && matches && matches.length > 0) {
          nextMatchDates[t.id] = matches[0].utc_date
        } else {
          nextMatchDates[t.id] = null
        }
      }
    }
  }

  // Récupérer le nombre de demandes d'équipe en attente pour les tournois dont l'utilisateur est capitaine
  const pendingTeamRequests: Record<string, number> = {}
  const userCreatedTournamentIds = (userTournaments || [])
    .filter((t: any) => t.creator_id === user.id && t.status === 'pending')
    .map((t: any) => t.id)

  if (userCreatedTournamentIds.length > 0) {
    const { data: teamRequests } = await supabase
      .from('team_requests')
      .select('tournament_id')
      .in('tournament_id', userCreatedTournamentIds)
      .eq('status', 'pending')

    // Compter les demandes par tournoi
    if (teamRequests) {
      for (const request of teamRequests) {
        pendingTeamRequests[request.tournament_id] = (pendingTeamRequests[request.tournament_id] || 0) + 1
      }
    }
  }

  // Récupérer la date du dernier match et les infos de classement pour les tournois terminés
  const lastMatchDates: Record<string, string | null> = {}
  const tournamentRankings: Record<string, { winner: string | null, userRank: number | null, totalParticipants: number }> = {}

  for (const t of userTournaments || []) {
    if (t.status === 'finished' || t.status === 'completed') {
      // Vérifier si le classement final est déjà stocké en BDD
      const { data: tournamentWithRankings } = await supabase
        .from('tournaments')
        .select('final_rankings')
        .eq('id', t.id)
        .single()

      if (tournamentWithRankings?.final_rankings && Array.isArray(tournamentWithRankings.final_rankings) && tournamentWithRankings.final_rankings.length > 0) {
        // Utiliser le classement final stocké
        const finalRankings = tournamentWithRankings.final_rankings as Array<{
          user_id: string
          username: string
          rank: number
          total_points: number
        }>

        const winner = finalRankings[0]?.username || null
        const userRanking = finalRankings.find(r => r.user_id === user.id)
        const userRank = userRanking?.rank || null

        tournamentRankings[t.id] = {
          winner,
          userRank,
          totalParticipants: finalRankings.length
        }
      } else {
        // Pas de final_rankings stocké - les données seront calculées quand l'utilisateur
        // visitera la page du tournoi. Pour le dashboard, on affiche des valeurs par défaut.
        tournamentRankings[t.id] = { winner: null, userRank: null, totalParticipants: 0 }
      }
    }
  }

  for (const t of userTournaments || []) {
    if (t.status === 'finished' || t.status === 'completed') {
      // Pour les compétitions custom, chercher dans custom_matches
      if (t.custom_competition_id) {
        const { data: customMatches, error: customMatchError } = await supabase
          .from('custom_matches')
          .select('utc_date')
          .eq('custom_competition_id', t.custom_competition_id)
          .order('utc_date', { ascending: false })
          .limit(1)

        if (!customMatchError && customMatches && customMatches.length > 0) {
          lastMatchDates[t.id] = customMatches[0].utc_date
        } else {
          lastMatchDates[t.id] = null
        }
      } else {
        // Pour les compétitions standard, chercher dans imported_matches
        const startMatchday = t.starting_matchday || 1
        const endMatchday = t.ending_matchday || 38

        const { data: matches, error: matchError } = await supabase
          .from('imported_matches')
          .select('utc_date')
          .eq('competition_id', t.competition_id)
          .gte('matchday', startMatchday)
          .lte('matchday', endMatchday)
          .order('utc_date', { ascending: false })
          .limit(1)

        if (!matchError && matches && matches.length > 0) {
          lastMatchDates[t.id] = matches[0].utc_date
        } else {
          lastMatchDates[t.id] = null
        }
      }
    }
  }

  // Formater les données pour un accès plus facile
  const tournaments = (userTournaments || []).map((t: any) => {
    // Créer le slug complet : nom-du-tournoi_CODE
    const tournamentSlug = `${t.name.toLowerCase().replace(/\s+/g, '-')}_${t.slug || t.invite_code}`

    // Récupérer les données de compétition (importée ou custom)
    const competitionData = competitionsMap[t.competition_id] || { emblem: null, custom_emblem_white: null, custom_emblem_color: null }
    const customCompetitionData = t.custom_competition_id ? customCompetitionsMap[t.custom_competition_id] : null

    // Pour les compétitions custom, utiliser leurs emblèmes
    const emblemData = customCompetitionData ? {
      emblem: null, // Pas d'emblème standard pour les compétitions custom
      custom_emblem_white: customCompetitionData.custom_emblem_white,
      custom_emblem_color: customCompetitionData.custom_emblem_color
    } : competitionData

    // Déterminer si c'est un tournoi événement
    const isEventTournament = eventCompetitionIds.includes(t.competition_id)

    const tournamentData = {
      id: t.id,
      name: t.name,
      slug: tournamentSlug,
      code: t.slug || t.invite_code,
      competition_id: t.competition_id,
      custom_competition_id: t.custom_competition_id, // ID de la compétition custom (Best of Week)
      competition_name: t.competition_name,
      creator_id: t.creator_id,
      status: t.status,
      current_participants: participantCounts[t.id] || 0,
      max_players: t.max_players || t.max_participants || 8,
      emblem: emblemData.emblem,
      custom_emblem_white: emblemData.custom_emblem_white,
      custom_emblem_color: emblemData.custom_emblem_color,
      isCaptain: t.creator_id === user.id,
      journeyInfo: journeyInfo[t.id] || null,
      nextMatchDate: nextMatchDates[t.id] || null,
      lastMatchDate: lastMatchDates[t.id] || null, // Date du dernier match pour tournois terminés
      tournament_type: t.tournament_type || 'free',
      is_event: isEventTournament, // Tournoi sur une compétition événement
      // Infos de classement pour tournois terminés
      winner: tournamentRankings[t.id]?.winner || null,
      userRank: tournamentRankings[t.id]?.userRank || null,
      totalParticipants: tournamentRankings[t.id]?.totalParticipants || 0,
      // Demandes d'équipe en attente (pour le capitaine)
      pendingTeamRequests: pendingTeamRequests[t.id] || 0
    }

    console.log(`[DASHBOARD] Tournament ${t.name}:`, {
      status: t.status,
      journeyInfo: journeyInfo[t.id],
      nextMatchDate: nextMatchDates[t.id]
    })

    return tournamentData
  })

  // Formater les tournois quittés (créateur original mais plus participant)
  const leftTournamentsList = (leftTournaments || []).map((t: any) => {
    // Récupérer les données de compétition (importée ou custom)
    const competitionData = competitionsMap[t.competition_id] || { emblem: null, custom_emblem_white: null, custom_emblem_color: null }
    const customCompetitionData = t.custom_competition_id ? customCompetitionsMap[t.custom_competition_id] : null

    // Pour les compétitions custom, utiliser leurs emblèmes
    const emblemData = customCompetitionData ? {
      emblem: null,
      custom_emblem_white: customCompetitionData.custom_emblem_white,
      custom_emblem_color: customCompetitionData.custom_emblem_color
    } : competitionData

    // Déterminer si c'est un tournoi événement
    const isEventTournament = eventCompetitionIds.includes(t.competition_id)

    return {
      id: t.id,
      name: t.name,
      competition_id: t.competition_id,
      custom_competition_id: t.custom_competition_id, // ID de la compétition custom (Best of Week)
      competition_name: t.competition_name,
      emblem: emblemData.emblem,
      custom_emblem_white: emblemData.custom_emblem_white,
      custom_emblem_color: emblemData.custom_emblem_color,
      tournament_type: t.tournament_type || 'free',
      is_event: isEventTournament, // Tournoi sur une compétition événement
      status: t.status,
      hasLeft: true // Marqueur pour indiquer que l'utilisateur a quitté ce tournoi
    }
  })

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation
        username={profile?.username || 'utilisateur'}
        userAvatar={profile?.avatar || 'avatar1'}
        context="app"
      />
      <Suspense fallback={<div className="flex-1 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div></div>}>
        <DashboardClient
          username={profile?.username || 'utilisateur'}
          avatar={profile?.avatar || 'avatar1'}
          isSuper={isSuper}
          canCreateTournament={canCreateTournament}
          hasSubscription={hasSubscription}
          quotas={{
            freeTournaments: freeTournamentsParticipating,
            freeTournamentsMax: FREE_KICK_MAX,
            canCreateFree,
            canJoinFree,
            // Compteurs par type de tournoi créé
            oneshotCreated,
            eliteCreated,
            platiniumCreated,
            // Tournois événement (compétitions occasionnelles)
            eventTournaments: eventTournamentsParticipating,
            // Legacy (à garder pour compatibilité)
            premiumTournaments: premiumTournamentsCreated,
            premiumTournamentsMax: hasSubscription ? 5 : 0,
            oneshotSlotsAvailable: oneshotSlotsAvailable || 0,
            canCreatePremium,
            canCreateOneshot,
          }}
          credits={credits}
          tournaments={tournaments}
          leftTournaments={leftTournamentsList}
          adminPath={getAdminPath()}
        />
      </Suspense>
    </div>
  )
}
