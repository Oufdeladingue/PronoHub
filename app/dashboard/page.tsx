import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Navigation from '@/components/Navigation'
import DashboardClient from '@/components/DashboardClient'
import { isSuperAdmin } from '@/lib/auth-helpers'
import { UserRole } from '@/types'

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

  // Récupérer la limite de tournois depuis les paramètres admin
  const { data: maxTournamentsSettings } = await supabase
    .from('admin_settings')
    .select('setting_value')
    .eq('setting_key', 'max_tournaments_per_user')
    .single()

  const maxTournaments = parseInt(maxTournamentsSettings?.setting_value || '3')

  // Récupérer les IDs des tournois auxquels l'utilisateur participe
  const { data: participations } = await supabase
    .from('tournament_participants')
    .select('tournament_id')
    .eq('user_id', user.id)

  const tournamentIds = participations?.map(p => p.tournament_id) || []
  const currentTournamentCount = tournamentIds.length
  const hasReachedLimit = currentTournamentCount >= maxTournaments

  // Récupérer les détails des tournois
  const { data: userTournaments } = await supabase
    .from('tournaments')
    .select('id, name, slug, invite_code, competition_id, competition_name, creator_id, status, max_participants, max_players, starting_matchday, ending_matchday')
    .in('id', tournamentIds)

  // Récupérer les IDs de compétitions
  const competitionIds = userTournaments?.map((t: any) => t.competition_id).filter(Boolean) || []

  // Récupérer les emblèmes des compétitions
  let competitionsMap: Record<number, string> = {}
  if (competitionIds.length > 0) {
    const { data: competitions } = await supabase
      .from('competitions')
      .select('id, emblem')
      .in('id', competitionIds)

    if (competitions) {
      competitionsMap = competitions.reduce((acc: any, comp: any) => {
        acc[comp.id] = comp.emblem
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
      emblem: competitionsMap[t.competition_id],
      isCaptain: t.creator_id === user.id,
      journeyInfo: journeyInfo[t.id] || null,
      nextMatchDate: nextMatchDates[t.id] || null
    }

    console.log(`[DASHBOARD] Tournament ${t.name}:`, {
      status: t.status,
      journeyInfo: journeyInfo[t.id],
      nextMatchDate: nextMatchDates[t.id]
    })

    return tournamentData
  })

  return (
    <>
      <Navigation
        username={profile?.username || 'utilisateur'}
        userAvatar={profile?.avatar || 'avatar1'}
        context="app"
      />
      <DashboardClient
        username={profile?.username || 'utilisateur'}
        avatar={profile?.avatar || 'avatar1'}
        isSuper={isSuper}
        hasReachedLimit={hasReachedLimit}
        currentTournamentCount={currentTournamentCount}
        maxTournaments={maxTournaments}
        tournaments={tournaments}
      />
    </>
  )
}
