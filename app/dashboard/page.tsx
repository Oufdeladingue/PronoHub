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

  const hasChosenUsername = profile?.has_chosen_username === true

  // Mettre à jour la plateforme (fire-and-forget, pas de await)
  supabase.from('profiles').update({ last_platform: 'web' }).eq('id', user.id).then(() => {})

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
    // Un tournoi custom utilise toujours custom_competition_matchdays/matches, même s'il a starting/ending_matchday
    const standardTournaments = userTournaments.filter(t => !t.custom_competition_id)
    const customTournaments = userTournaments.filter(t => !!t.custom_competition_id)

    // BATCH UNIQUE: Récupérer toutes les données matchdays en parallèle
    const uniqueCompetitionIds = [...new Set(standardTournaments.map(t => t.competition_id).filter(Boolean))]
    const uniqueCustomCompIds = [...new Set(customTournaments.map(t => t.custom_competition_id).filter(Boolean))]

    // Préparer les requêtes
    // OPTIMISATION: 1 seule requête batch avec .in() au lieu de N requêtes individuelles
    // .limit(10000) pour couvrir toutes les compétitions (chaque compétition ~300-400 matchs)
    const importedMatchesPromise = uniqueCompetitionIds.length > 0
      ? supabase
          .from('imported_matches')
          .select('competition_id, matchday, stage, status, finished, utc_date')
          .in('competition_id', uniqueCompetitionIds)
          .limit(10000)
      : Promise.resolve({ data: [] })

    const customMatchdaysPromise = uniqueCustomCompIds.length > 0
      ? supabase
          .from('custom_competition_matchdays')
          .select('id, custom_competition_id, matchday_number, status')
          .in('custom_competition_id', uniqueCustomCompIds)
          .order('matchday_number', { ascending: true })
      : Promise.resolve({ data: [] })

    const customMatchesPromise = uniqueCustomCompIds.length > 0
      ? supabase
          .from('custom_competition_matches')
          .select('custom_matchday_id, cached_utc_date, football_data_match_id')
          .limit(5000)
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

    // Mapping stage → virtual matchday pour compétitions avec phases knockout (CL, EL, etc.)
    // Phases knockout avec leur offset (pour CL, EL, etc.)
    const KNOCKOUT_STAGE_OFFSET: Record<string, number> = {
      'PLAYOFFS': 8, 'LAST_16': 10, 'QUARTER_FINALS': 12,
      'SEMI_FINALS': 14, 'FINAL': 16
    }

    // Calculer virtual_matchday pour chaque match (gère les phases knockout)
    // Seules les phases knockout reconnues sont transformées, les autres gardent leur matchday
    for (const match of allImportedMatches) {
      const m = match as any
      const knockoutOffset = m.stage ? KNOCKOUT_STAGE_OFFSET[m.stage] : undefined
      if (knockoutOffset !== undefined) {
        m.virtual_matchday = knockoutOffset + (m.matchday || 1)
      } else {
        m.virtual_matchday = m.matchday
      }
    }

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

    // Récupérer le statut réel des matchs custom depuis imported_matches (via football_data_match_id)
    let customMatchStatusMap = new Map<number, { status: string, finished: boolean }>()
    const customFootballDataIds = [...new Set(allCustomMatches.map(m => m.football_data_match_id).filter(Boolean))]
    if (customFootballDataIds.length > 0) {
      const { data: customImportedMatches } = await supabase
        .from('imported_matches')
        .select('football_data_match_id, status, finished')
        .in('football_data_match_id', customFootballDataIds)
        .limit(10000)
      for (const m of customImportedMatches || []) {
        customMatchStatusMap.set(m.football_data_match_id, { status: m.status, finished: m.finished })
      }
    }

    const now = new Date()
    const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000)

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
        m => m.virtual_matchday >= startMatchday && m.virtual_matchday <= endMatchday
      )

      const matchdayMap = new Map<number, any[]>()
      for (const match of relevantMatches) {
        if (!matchdayMap.has(match.virtual_matchday)) matchdayMap.set(match.virtual_matchday, [])
        matchdayMap.get(match.virtual_matchday)!.push(match)
      }

      // Trouver la journée courante basée sur le calendrier (pas sur la complétion)
      // Une journée est "démarrée" si au moins un de ses matchs a une date dans le passé
      let highestStartedMatchday = startMatchday - 1
      let completedJourneys = 0
      for (const [matchday, matches] of matchdayMap) {
        // Vérifier si au moins un match de cette journée a démarré
        const hasStarted = matches.some((m: any) => m.utc_date && new Date(m.utc_date) <= now)
        if (hasStarted && matchday > highestStartedMatchday) {
          highestStartedMatchday = matchday
        }
        // Compter les journées complètement terminées
        const allFinished = matches.every((m: any) => m.status === 'FINISHED' || m.status === 'AWARDED' || m.finished === true)
        const allPast = !allFinished && matches.every((m: any) => m.utc_date && new Date(m.utc_date) < fourHoursAgo)
        if (allFinished || allPast) completedJourneys++
      }

      // currentNumber = position relative de la journée courante dans le tournoi
      const currentNumber = highestStartedMatchday >= startMatchday
        ? Math.min(highestStartedMatchday - startMatchday + 1, totalJourneys)
        : 1

      journeyInfo[tournament.id] = { total: totalJourneys, completed: completedJourneys, currentNumber }
    }

    // Calculer journeyInfo pour les tournois custom (via statut réel des matchs imported)
    for (const tournament of customTournaments) {
      let matchdays = customMatchdaysByCompetition.get(tournament.custom_competition_id) || []

      // Si le tournoi a des bornes starting/ending_matchday, filtrer les matchdays
      if (tournament.starting_matchday && tournament.ending_matchday) {
        matchdays = matchdays.filter(md =>
          md.matchday_number >= tournament.starting_matchday && md.matchday_number <= tournament.ending_matchday
        )
      }

      if (matchdays.length === 0) {
        journeyInfo[tournament.id] = { total: 0, completed: 0, currentNumber: 1 }
        continue
      }

      const totalJourneys = matchdays.length
      let highestStartedIndex = -1
      let completedJourneys = 0
      for (let i = 0; i < matchdays.length; i++) {
        const md = matchdays[i]
        const matches = customMatchesByMatchdayId.get(md.id) || []
        if (matches.length === 0) continue

        // Vérifier si au moins un match de cette journée a démarré
        const hasStarted = matches.some((m: any) => m.cached_utc_date && new Date(m.cached_utc_date) <= now)
        if (hasStarted && i > highestStartedIndex) {
          highestStartedIndex = i
        }

        const allFinished = matches.every((m: any) => {
          if (!m.football_data_match_id) return false
          const imported = customMatchStatusMap.get(m.football_data_match_id)
          return imported && (imported.status === 'FINISHED' || imported.finished === true)
        })
        const allPast = !allFinished && matches.every((m: any) => m.cached_utc_date && new Date(m.cached_utc_date) < fourHoursAgo)
        if (allFinished || allPast) completedJourneys++
      }

      // currentNumber = position 1-indexée de la journée courante
      const currentNumber = highestStartedIndex >= 0
        ? Math.min(highestStartedIndex + 1, totalJourneys)
        : 1

      journeyInfo[tournament.id] = { total: totalJourneys, completed: completedJourneys, currentNumber }
    }
  }

  // Récupérer le temps restant avant la prochaine journée pour les tournois en attente
  // OPTIMISATION: Réutiliser les données déjà fetchées (importedMatchesByCompetition, customMatchesByMatchdayId)
  const nextMatchDates: Record<string, string | null> = {}
  const pendingWarmupTournaments = (userTournaments || []).filter(t => t.status === 'pending' || t.status === 'warmup')
  const now = new Date()

  for (const t of pendingWarmupTournaments) {
    if (t.custom_competition_id) {
      // Tournoi custom - utiliser customMatchesByMatchdayId
      const matchdays = customMatchdaysByCompetition.get(t.custom_competition_id) || []
      let nextMatchDate: string | null = null

      for (const md of matchdays) {
        const matches = customMatchesByMatchdayId.get(md.id) || []
        for (const match of matches) {
          if (!match.cached_utc_date) continue
          const matchDate = new Date(match.cached_utc_date)
          if (matchDate > now && (!nextMatchDate || matchDate < new Date(nextMatchDate))) {
            nextMatchDate = match.cached_utc_date
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
      if (t.custom_competition_id) {
        // Tournoi custom - utiliser customMatchesByMatchdayId
        const matchdays = customMatchdaysByCompetition.get(t.custom_competition_id) || []
        let lastMatchDate: string | null = null
        for (const md of matchdays) {
          const matches = customMatchesByMatchdayId.get(md.id) || []
          for (const match of matches) {
            if (!match.cached_utc_date) continue
            if (!lastMatchDate || new Date(match.cached_utc_date) > new Date(lastMatchDate)) {
              lastMatchDate = match.cached_utc_date
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
          m => m.virtual_matchday >= startMatchday && m.virtual_matchday <= endMatchday
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
          hasChosenUsername={hasChosenUsername}
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
