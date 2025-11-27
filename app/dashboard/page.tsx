import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
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
    .select('id, tournament_type')
    .in('id', tournamentIds.length > 0 ? tournamentIds : ['00000000-0000-0000-0000-000000000000'])
    .neq('status', 'completed')

  const freeTournamentsParticipating = participatedTournaments?.filter(t => t.tournament_type === 'free').length || 0

  // QUOTAS PREMIUM: Compter les tournois premium CRÉÉS par l'utilisateur
  // On utilise original_creator_id en priorité, avec fallback sur creator_id pour les anciens tournois
  // Cela empêche un utilisateur de créer des tournois à l'infini en transférant le capitanat

  // Récupérer les tournois premium où original_creator_id = user.id
  const { data: premiumWithOriginalCreator } = await supabase
    .from('tournaments')
    .select('id, tournament_type')
    .eq('original_creator_id', user.id)
    .eq('tournament_type', 'premium')
    .neq('status', 'completed')

  // Récupérer les tournois premium où creator_id = user.id ET original_creator_id est NULL (anciens tournois)
  const { data: premiumWithCreatorFallback } = await supabase
    .from('tournaments')
    .select('id, tournament_type')
    .eq('creator_id', user.id)
    .eq('tournament_type', 'premium')
    .is('original_creator_id', null)
    .neq('status', 'completed')

  // Combiner les deux listes (en évitant les doublons par ID)
  const allPremiumCreated = [
    ...(premiumWithOriginalCreator || []),
    ...(premiumWithCreatorFallback || [])
  ]
  const uniquePremiumCreated = allPremiumCreated.filter(
    (t, index, self) => index === self.findIndex(other => other.id === t.id)
  )
  const premiumTournamentsCreated = uniquePremiumCreated.length

  // Compter les slots one-shot disponibles
  const { count: oneshotSlotsAvailable } = await supabase
    .from('user_oneshot_purchases')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'available')

  // Déterminer si l'utilisateur peut créer/rejoindre un tournoi
  // GRATUIT: basé sur les PARTICIPATIONS (max 3)
  // PREMIUM: basé sur les CRÉATIONS (max 5)
  const canCreateFree = freeTournamentsParticipating < 3
  const canCreatePremium = hasSubscription && premiumTournamentsCreated < 5
  const canCreateOneshot = (oneshotSlotsAvailable || 0) > 0
  const canCreateTournament = canCreateFree || canCreatePremium || canCreateOneshot

  // Récupérer les détails des tournois où l'utilisateur participe
  const { data: userTournaments } = await supabase
    .from('tournaments')
    .select('id, name, slug, invite_code, competition_id, competition_name, creator_id, status, max_participants, max_players, starting_matchday, ending_matchday, tournament_type')
    .in('id', tournamentIds)

  // Récupérer les tournois où l'utilisateur est le créateur original mais a quitté (n'est plus participant)
  // Ces tournois occupent toujours un slot mais l'utilisateur n'y a plus accès
  const { data: leftTournaments } = await supabase
    .from('tournaments')
    .select('id, name, slug, invite_code, competition_id, competition_name, creator_id, status, max_participants, max_players, starting_matchday, ending_matchday, tournament_type')
    .eq('original_creator_id', user.id)
    .neq('status', 'completed')
    .not('id', 'in', `(${tournamentIds.length > 0 ? tournamentIds.join(',') : '00000000-0000-0000-0000-000000000000'})`)

  // Récupérer les IDs de compétitions (inclure les tournois quittés aussi)
  const allTournamentsForCompetitions = [...(userTournaments || []), ...(leftTournaments || [])]
  const competitionIds = allTournamentsForCompetitions.map((t: any) => t.competition_id).filter(Boolean) || []

  // Récupérer les emblèmes des compétitions (y compris logos personnalisés)
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
    const startMatchday = tournament.starting_matchday
    const endMatchday = tournament.ending_matchday

    if (!startMatchday || !endMatchday) {
      journeyInfo[tournament.id] = {
        total: 0,
        completed: 0,
        currentNumber: 1
      }
      continue
    }

    // Calculer le nombre total de journées du tournoi
    const totalJourneys = endMatchday - startMatchday + 1

    // Compter combien de journées sont terminées en vérifiant les matchs réels
    let completedJourneys = 0
    for (let matchday = startMatchday; matchday <= endMatchday; matchday++) {
      // Récupérer tous les matchs de cette journée
      const { data: matches } = await supabase
        .from('imported_matches')
        .select('status, finished')
        .eq('competition_id', tournament.competition_id)
        .eq('matchday', matchday)

      if (matches && matches.length > 0) {
        // Une journée est terminée si tous ses matchs sont terminés
        const allFinished = matches.every(m => m.status === 'FINISHED' || m.finished === true)
        if (allFinished) {
          completedJourneys++
        } else {
          // Dès qu'on trouve une journée non terminée, on s'arrête
          break
        }
      }
    }

    // La journée actuelle est la suivante après les journées complétées
    const currentNumber = Math.min(completedJourneys + 1, totalJourneys)

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
      // Récupérer le prochain match de la compétition (première journée à venir)
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

  // Formater les données pour un accès plus facile
  const tournaments = (userTournaments || []).map((t: any) => {
    // Créer le slug complet : nom-du-tournoi_CODE
    const tournamentSlug = `${t.name.toLowerCase().replace(/\s+/g, '-')}_${t.slug || t.invite_code}`

    const competitionData = competitionsMap[t.competition_id] || { emblem: null, custom_emblem_white: null, custom_emblem_color: null }

    const tournamentData = {
      id: t.id,
      name: t.name,
      slug: tournamentSlug,
      code: t.slug || t.invite_code,
      competition_id: t.competition_id,
      competition_name: t.competition_name,
      creator_id: t.creator_id,
      status: t.status,
      current_participants: participantCounts[t.id] || 0,
      max_players: t.max_players || t.max_participants || 8,
      emblem: competitionData.emblem,
      custom_emblem_white: competitionData.custom_emblem_white,
      custom_emblem_color: competitionData.custom_emblem_color,
      isCaptain: t.creator_id === user.id,
      journeyInfo: journeyInfo[t.id] || null,
      nextMatchDate: nextMatchDates[t.id] || null,
      tournament_type: t.tournament_type || 'free'
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
    const competitionData = competitionsMap[t.competition_id] || { emblem: null, custom_emblem_white: null, custom_emblem_color: null }

    return {
      id: t.id,
      name: t.name,
      competition_id: t.competition_id,
      competition_name: t.competition_name,
      emblem: competitionData.emblem,
      custom_emblem_white: competitionData.custom_emblem_white,
      custom_emblem_color: competitionData.custom_emblem_color,
      tournament_type: t.tournament_type || 'free',
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
      <DashboardClient
        username={profile?.username || 'utilisateur'}
        avatar={profile?.avatar || 'avatar1'}
        isSuper={isSuper}
        canCreateTournament={canCreateTournament}
        hasSubscription={hasSubscription}
        quotas={{
          freeTournaments: freeTournamentsParticipating,
          freeTournamentsMax: 3,
          premiumTournaments: premiumTournamentsCreated,
          premiumTournamentsMax: hasSubscription ? 5 : 0,
          oneshotSlotsAvailable: oneshotSlotsAvailable || 0,
          canCreateFree,
          canCreatePremium,
          canCreateOneshot,
        }}
        tournaments={tournaments}
        leftTournaments={leftTournamentsList}
        adminPath={getAdminPath()}
      />
    </div>
  )
}
