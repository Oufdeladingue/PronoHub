import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { Suspense } from 'react'
import Navigation from '@/components/Navigation'
import DashboardClient from '@/components/DashboardClient'
import DashboardCapacitorWrapper from '@/components/DashboardCapacitorWrapper'
import { isSuperAdmin } from '@/lib/auth-helpers'
import { UserRole } from '@/types'
import { getAdminPath } from '@/lib/admin-path'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tableau de bord - PronoHub',
  description: 'Gérez vos tournois de pronostics, consultez vos performances et rejoignez de nouvelles compétitions sur PronoHub.',
  // Note: robots.txt bloque déjà /dashboard - pas besoin de robots meta
  // La meta description est importante pour l'accessibilité même si la page n'est pas indexée
}

// Détecter si la requête vient d'un WebView Android (Capacitor)
function isCapacitorRequest(userAgent: string | null): boolean {
  if (!userAgent) return false
  return /Android.*wv/.test(userAgent) || /; wv\)/.test(userAgent)
}

export default async function DashboardPage() {
  const headersList = await headers()
  const userAgent = headersList.get('user-agent')
  const isCapacitor = isCapacitorRequest(userAgent)

  // Dans Capacitor, utiliser le wrapper client qui chargera les données via API
  if (isCapacitor) {
    return <DashboardCapacitorWrapper />
  }

  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/auth/login')
  }

  // ========== GROUPE 1: Requêtes parallèles indépendantes ==========
  // Ces requêtes ne dépendent que de user.id, on les exécute en parallèle
  const [
    { data: profile },
    { data: subscription },
    { data: participations },
    { count: oneshotSlotsAvailable },
    { data: userCredits },
    { data: pricingConfig }
  ] = await Promise.all([
    // Profil utilisateur
    supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle(),
    // Abonnement actif
    supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle(),
    // Participations aux tournois
    supabase
      .from('tournament_participants')
      .select('tournament_id')
      .eq('user_id', user.id),
    // Slots one-shot disponibles (legacy)
    supabase
      .from('user_oneshot_purchases')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'available'),
    // Crédits disponibles
    supabase
      .from('user_available_credits')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle(),
    // Limite de tournois Free-Kick
    supabase
      .from('pricing_config')
      .select('config_value')
      .eq('config_key', 'free_max_tournaments')
      .eq('is_active', true)
      .maybeSingle()
  ])

  // Filet de sécurité : si un user OAuth n'a jamais choisi son username,
  // le rediriger vers choose-username (au cas où le callback aurait échoué)
  if (profile && profile.has_chosen_username === false) {
    redirect('/auth/choose-username')
  }

  const isSuper = isSuperAdmin(profile?.role as UserRole)
  const hasSubscription = subscription?.status === 'active'
  const tournamentIds = participations?.map(p => p.tournament_id) || []
  const FREE_KICK_MAX = pricingConfig?.config_value || 2

  const credits = {
    oneshot: userCredits?.oneshot_credits || 0,
    elite: userCredits?.elite_credits || 0,
    platinium_solo: userCredits?.platinium_solo_credits || 0,
    platinium_group_slots: userCredits?.platinium_group_slots || 0,
    slot_invite: userCredits?.slot_invite_credits || 0,
    duration_extension: userCredits?.duration_extension_credits || 0,
    player_extension: userCredits?.player_extension_credits || 0,
  }

  // ========== GROUPE 2+3: Requêtes dépendant des tournamentIds EN PARALLÈLE ==========
  // OPTIMISATION: Fusionner GROUPE 2 et GROUPE 3 en une seule Promise.all
  const [
    { data: participatedTournaments },
    { data: userTournaments },
    { data: leftTournaments }
  ] = await Promise.all([
    // QUOTAS GRATUIT: Compter les PARTICIPATIONS aux tournois gratuits actifs
    supabase
      .from('tournaments')
      .select('id, tournament_type, competition_id')
      .in('id', tournamentIds.length > 0 ? tournamentIds : ['00000000-0000-0000-0000-000000000000'])
      .neq('status', 'completed'),
    // Récupérer les détails des tournois où l'utilisateur participe
    supabase
      .from('tournaments')
      .select('id, name, slug, invite_code, competition_id, custom_competition_id, competition_name, creator_id, status, max_participants, max_players, starting_matchday, ending_matchday, tournament_type, num_matchdays, actual_matchdays')
      .in('id', tournamentIds),
    // Récupérer les tournois où l'utilisateur est le créateur original mais a quitté
    supabase
      .from('tournaments')
      .select('id, name, slug, invite_code, competition_id, custom_competition_id, competition_name, creator_id, status, max_participants, max_players, starting_matchday, ending_matchday, tournament_type')
      .eq('original_creator_id', user.id)
      .neq('status', 'completed')
      .not('id', 'in', `(${tournamentIds.length > 0 ? tournamentIds.join(',') : '00000000-0000-0000-0000-000000000000'})`)
  ])

  // Récupérer les IDs de compétitions (inclure les tournois quittés aussi)
  const allTournamentsForCompetitions = [...(userTournaments || []), ...(leftTournaments || [])]
  const competitionIds = allTournamentsForCompetitions.map((t: any) => t.competition_id).filter(Boolean) || []
  const customCompetitionIds = allTournamentsForCompetitions.map((t: any) => t.custom_competition_id).filter(Boolean) || []

  // Récupérer aussi les IDs des compétitions participées pour les événements
  const participatedCompetitionIds = participatedTournaments?.map(t => t.competition_id).filter(Boolean) || []
  // Fusionner tous les competitionIds pour une seule requête
  const allCompetitionIds = [...new Set([...competitionIds, ...participatedCompetitionIds])]

  // ========== GROUPE 4: Requêtes compétitions en parallèle ==========
  // OPTIMISATION: Récupérer emblèmes ET is_event en une seule requête
  let competitionsMap: Record<number, { emblem: string, custom_emblem_white: string | null, custom_emblem_color: string | null }> = {}
  let customCompetitionsMap: Record<string, { name: string, custom_emblem_white: string | null, custom_emblem_color: string | null }> = {}
  let eventCompetitionIds: string[] = []

  const competitionPromises: PromiseLike<any>[] = []

  if (allCompetitionIds.length > 0) {
    competitionPromises.push(
      supabase
        .from('competitions')
        .select('id, emblem, custom_emblem_white, custom_emblem_color, is_event')
        .in('id', allCompetitionIds)
        .then(({ data: competitions }) => {
          if (competitions) {
            competitionsMap = competitions.reduce((acc: any, comp: any) => {
              acc[comp.id] = {
                emblem: comp.emblem,
                custom_emblem_white: comp.custom_emblem_white,
                custom_emblem_color: comp.custom_emblem_color
              }
              return acc
            }, {})
            // Extraire les IDs des compétitions événement
            eventCompetitionIds = competitions
              .filter(c => c.is_event)
              .map(c => c.id)
          }
        })
    )
  }

  if (customCompetitionIds.length > 0) {
    competitionPromises.push(
      supabase
        .from('custom_competitions')
        .select('id, name, custom_emblem_white, custom_emblem_color')
        .in('id', customCompetitionIds)
        .then(({ data: customCompetitions }) => {
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
        })
    )
  }

  await Promise.all(competitionPromises)

  // ========== Calcul des quotas (après avoir récupéré eventCompetitionIds) ==========
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

  // Déterminer si l'utilisateur peut créer/rejoindre un tournoi
  // FREE-KICK (gratuit): basé sur les PARTICIPATIONS - même règle pour créer et rejoindre
  // PREMIUM: basé sur les CRÉATIONS (max 5)
  const canCreateFree = freeTournamentsParticipating < FREE_KICK_MAX
  const canJoinFree = freeTournamentsParticipating < FREE_KICK_MAX // Même règle que canCreateFree
  const canCreatePremium = hasSubscription && premiumTournamentsCreated < 5
  const canCreateOneshot = (oneshotSlotsAvailable || 0) > 0
  const canCreateTournament = canCreateFree || canCreatePremium || canCreateOneshot

  // Compter les participants réels pour chaque tournoi (1 seule requête batch au lieu de N)
  const participantCounts: Record<string, number> = {}
  if (tournamentIds.length > 0) {
    const { data: allParticipants } = await supabase
      .from('tournament_participants')
      .select('tournament_id')
      .in('tournament_id', tournamentIds)

    // Agréger côté client
    if (allParticipants) {
      for (const p of allParticipants) {
        participantCounts[p.tournament_id] = (participantCounts[p.tournament_id] || 0) + 1
      }
    }
    // S'assurer que tous les tournois ont un compteur (même à 0)
    for (const tid of tournamentIds) {
      if (!(tid in participantCounts)) {
        participantCounts[tid] = 0
      }
    }
  }

  // Récupérer les informations sur les journées pour chaque tournoi
  // OPTIMISATION: 1 requête batch par type (imported/custom) au lieu de N requêtes par tournoi
  const journeyInfo: Record<string, any> = {}

  // Déclarer les maps en dehors du bloc pour les réutiliser dans nextMatchDates
  let importedMatchesByCompetition = new Map<number, any[]>()
  let customMatchdaysByCompetition = new Map<string, any[]>()
  let customMatchesByMatchdayId = new Map<string, any[]>()

  if (userTournaments && userTournaments.length > 0) {
    // Séparer les tournois standards et custom
    const standardTournaments = userTournaments.filter(t =>
      !t.custom_competition_id || (t.starting_matchday && t.ending_matchday)
    )
    const customTournaments = userTournaments.filter(t =>
      t.custom_competition_id && (!t.starting_matchday || !t.ending_matchday)
    )

    // BATCH UNIQUE: Récupérer toutes les données matchdays en parallèle
    const uniqueCompetitionIds = [...new Set(standardTournaments.map(t => t.competition_id).filter(Boolean))]
    const uniqueCustomCompIds = [...new Set(customTournaments.map(t => t.custom_competition_id).filter(Boolean))]

    // Préparer les requêtes
    const importedMatchesPromise = uniqueCompetitionIds.length > 0
      ? supabase
          .from('imported_matches')
          .select('competition_id, matchday, status, finished, utc_date')
          .in('competition_id', uniqueCompetitionIds)
      : Promise.resolve({ data: [] })

    const customMatchdaysPromise = uniqueCustomCompIds.length > 0
      ? supabase
          .from('custom_competition_matchdays')
          .select('id, custom_competition_id, matchday_number, start_date, end_date')
          .in('custom_competition_id', uniqueCustomCompIds)
          .order('matchday_number', { ascending: true })
      : Promise.resolve({ data: [] })

    const customMatchesPromise = uniqueCustomCompIds.length > 0
      ? supabase
          .from('custom_competition_matches')
          .select('custom_matchday_id, status, utc_date')
      : Promise.resolve({ data: [] })

    // Exécuter toutes les requêtes en parallèle
    const [importedMatchesRes, customMatchdaysRes, customMatchesRes] = await Promise.all([
      importedMatchesPromise,
      customMatchdaysPromise,
      customMatchesPromise
    ])

    const allImportedMatches = importedMatchesRes.data || []
    const allCustomMatchdays = customMatchdaysRes.data || []
    // Filtrer les matchs pour ne garder que ceux des matchdays concernés
    const relevantMatchdayIds = new Set(allCustomMatchdays.map(md => md.id))
    const allCustomMatches = ((customMatchesRes.data || []) as any[]).filter(m => relevantMatchdayIds.has(m.custom_matchday_id))

    // Indexer les données pour un accès rapide (réutilisé dans nextMatchDates)
    for (const match of allImportedMatches) {
      if (!importedMatchesByCompetition.has(match.competition_id)) {
        importedMatchesByCompetition.set(match.competition_id, [])
      }
      importedMatchesByCompetition.get(match.competition_id)!.push(match)
    }

    for (const md of allCustomMatchdays) {
      if (!customMatchdaysByCompetition.has(md.custom_competition_id)) {
        customMatchdaysByCompetition.set(md.custom_competition_id, [])
      }
      customMatchdaysByCompetition.get(md.custom_competition_id)!.push(md)
    }

    for (const match of allCustomMatches) {
      if (!customMatchesByMatchdayId.has(match.custom_matchday_id)) {
        customMatchesByMatchdayId.set(match.custom_matchday_id, [])
      }
      customMatchesByMatchdayId.get(match.custom_matchday_id)!.push(match)
    }

    const now = new Date()

    // Calculer journeyInfo pour les tournois standards (sans requête supplémentaire)
    for (const tournament of standardTournaments) {
      const startMatchday = tournament.starting_matchday
      const endMatchday = tournament.ending_matchday

      if (!startMatchday || !endMatchday) {
        journeyInfo[tournament.id] = { total: 0, completed: 0, currentNumber: 1 }
        continue
      }

      const totalJourneys = endMatchday - startMatchday + 1
      const competitionMatches = importedMatchesByCompetition.get(tournament.competition_id) || []
      const relevantMatches = competitionMatches.filter(
        m => m.matchday >= startMatchday && m.matchday <= endMatchday
      )

      const matchdayMap = new Map<number, any[]>()
      for (const match of relevantMatches) {
        if (!matchdayMap.has(match.matchday)) matchdayMap.set(match.matchday, [])
        matchdayMap.get(match.matchday)!.push(match)
      }

      let pendingJourneys = 0, completedJourneys = 0
      for (const [, matches] of matchdayMap) {
        const allFinished = matches.every((m: any) => m.status === 'FINISHED' || m.finished === true)
        const allPending = matches.every((m: any) => {
          const matchDate = new Date(m.utc_date)
          return (m.status === 'SCHEDULED' || m.status === 'TIMED') && matchDate > now
        })
        if (allFinished) completedJourneys++
        else if (allPending) pendingJourneys++
      }

      const notYetImportedJourneys = totalJourneys - matchdayMap.size
      const currentNumber = Math.max(1, totalJourneys - pendingJourneys - notYetImportedJourneys)

      journeyInfo[tournament.id] = { total: totalJourneys, completed: completedJourneys, currentNumber }
    }

    // Calculer journeyInfo pour les tournois custom (sans requête supplémentaire)
    for (const tournament of customTournaments) {
      const matchdays = customMatchdaysByCompetition.get(tournament.custom_competition_id) || []

      if (matchdays.length === 0) {
        journeyInfo[tournament.id] = { total: 0, completed: 0, currentNumber: 1 }
        continue
      }

      const totalJourneys = matchdays.length
      const matchdayNumberMap: Record<string, number> = {}
      for (const md of matchdays) {
        matchdayNumberMap[md.id] = md.matchday_number
      }

      const matchdayMap = new Map<number, any[]>()
      for (const md of matchdays) {
        const matches = customMatchesByMatchdayId.get(md.id) || []
        for (const match of matches) {
          const mdNumber = matchdayNumberMap[md.id]
          if (mdNumber !== undefined) {
            if (!matchdayMap.has(mdNumber)) matchdayMap.set(mdNumber, [])
            matchdayMap.get(mdNumber)!.push(match)
          }
        }
      }

      let pendingJourneys = 0, completedJourneys = 0
      for (const [, matches] of matchdayMap) {
        const allFinished = matches.every((m: any) => m.status === 'FINISHED')
        const allPending = matches.every((m: any) => {
          const matchDate = new Date(m.utc_date)
          return (m.status === 'SCHEDULED' || m.status === 'TIMED') && matchDate > now
        })
        if (allFinished) completedJourneys++
        else if (allPending) pendingJourneys++
      }

      const notYetImportedJourneys = totalJourneys - matchdayMap.size
      const currentNumber = Math.max(1, totalJourneys - pendingJourneys - notYetImportedJourneys)

      journeyInfo[tournament.id] = { total: totalJourneys, completed: completedJourneys, currentNumber }
    }
  }

  // Récupérer le temps restant avant la prochaine journée pour les tournois en attente
  // OPTIMISATION: Réutiliser les données déjà fetchées (importedMatchesByCompetition, customMatchesByMatchdayId)
  const nextMatchDates: Record<string, string | null> = {}
  const pendingWarmupTournaments = (userTournaments || []).filter(t => t.status === 'pending' || t.status === 'warmup')
  const now = new Date()

  for (const t of pendingWarmupTournaments) {
    if (t.custom_competition_id && (!t.starting_matchday || !t.ending_matchday)) {
      // Tournoi custom - utiliser customMatchesByMatchdayId
      const matchdays = customMatchdaysByCompetition.get(t.custom_competition_id) || []
      let nextMatchDate: string | null = null

      for (const md of matchdays) {
        const matches = customMatchesByMatchdayId.get(md.id) || []
        for (const match of matches) {
          const matchDate = new Date(match.utc_date)
          if (matchDate > now && (!nextMatchDate || matchDate < new Date(nextMatchDate))) {
            nextMatchDate = match.utc_date
          }
        }
      }
      nextMatchDates[t.id] = nextMatchDate
    } else {
      // Tournoi standard - utiliser importedMatchesByCompetition
      const competitionMatches = importedMatchesByCompetition.get(t.competition_id) || []
      const futureMatches = competitionMatches
        .filter(m => new Date(m.utc_date) > now)
        .sort((a, b) => new Date(a.utc_date).getTime() - new Date(b.utc_date).getTime())

      nextMatchDates[t.id] = futureMatches[0]?.utc_date || null
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
  // OPTIMISATION: 1 batch pour les rankings au lieu de N requêtes, réutiliser importedMatchesByCompetition pour lastMatchDates
  const lastMatchDates: Record<string, string | null> = {}
  const tournamentRankings: Record<string, { winner: string | null, userRank: number | null, totalParticipants: number }> = {}
  const completedTournaments = (userTournaments || []).filter(t => t.status === 'finished' || t.status === 'completed')

  if (completedTournaments.length > 0) {
    const completedTournamentIds = completedTournaments.map(t => t.id)

    // BATCH: Récupérer tous les rankings en 1 seule requête
    const { data: tournamentsWithRankings } = await supabase
      .from('tournaments')
      .select('id, final_rankings')
      .in('id', completedTournamentIds)

    // Indexer les rankings par tournoi
    const rankingsMap = new Map<string, any>()
    for (const t of tournamentsWithRankings || []) {
      rankingsMap.set(t.id, t.final_rankings)
    }

    // Calculer rankings et lastMatchDates sans nouvelles requêtes
    for (const t of completedTournaments) {
      // Récupérer le classement depuis le batch
      const finalRankings = rankingsMap.get(t.id)
      let ranking = { winner: null as string | null, userRank: null as number | null, totalParticipants: 0 }
      if (finalRankings && Array.isArray(finalRankings) && finalRankings.length > 0) {
        const typedRankings = finalRankings as Array<{
          user_id: string; username: string; rank: number; total_points: number
        }>
        ranking = {
          winner: typedRankings[0]?.username || null,
          userRank: typedRankings.find(r => r.user_id === user.id)?.rank || null,
          totalParticipants: typedRankings.length
        }
      }
      tournamentRankings[t.id] = ranking

      // Réutiliser les données déjà fetchées pour lastMatchDates
      if (t.custom_competition_id && (!t.starting_matchday || !t.ending_matchday)) {
        // Tournoi custom - utiliser customMatchesByMatchdayId
        const matchdays = customMatchdaysByCompetition.get(t.custom_competition_id) || []
        let lastMatchDate: string | null = null
        for (const md of matchdays) {
          const matches = customMatchesByMatchdayId.get(md.id) || []
          for (const match of matches) {
            if (!lastMatchDate || new Date(match.utc_date) > new Date(lastMatchDate)) {
              lastMatchDate = match.utc_date
            }
          }
        }
        lastMatchDates[t.id] = lastMatchDate
      } else {
        // Tournoi standard - utiliser importedMatchesByCompetition
        const startMatchday = t.starting_matchday || 1
        const endMatchday = t.ending_matchday || 38
        const competitionMatches = importedMatchesByCompetition.get(t.competition_id) || []
        const relevantMatches = competitionMatches.filter(
          m => m.matchday >= startMatchday && m.matchday <= endMatchday
        )
        const lastMatch = relevantMatches.sort(
          (a, b) => new Date(b.utc_date).getTime() - new Date(a.utc_date).getTime()
        )[0]
        lastMatchDates[t.id] = lastMatch?.utc_date || null
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
    <div className="fixed inset-0 flex flex-col overflow-hidden">
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
