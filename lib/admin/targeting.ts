import { SupabaseClient } from '@supabase/supabase-js'
import type { TargetingFilters } from './email-templates'

/**
 * Calcule les destinataires d'une communication selon les filtres de ciblage
 */
export async function calculateRecipients(
  supabase: SupabaseClient,
  filters: TargetingFilters
): Promise<Array<{ id: string; email: string; fcm_token: string | null; username: string }>> {
  let query = supabase
    .from('profiles')
    .select('id, email, fcm_token, username, last_seen_at, created_at')
    .not('email', 'is', null)

  // Filtres de base
  if (filters.userIds && filters.userIds.length > 0) {
    query = query.in('id', filters.userIds)
  }

  if (filters.excludeUserIds && filters.excludeUserIds.length > 0) {
    query = query.not('id', 'in', `(${filters.excludeUserIds.join(',')})`)
  }

  // Dates d'inscription
  if (filters.registeredAfter) {
    query = query.gte('created_at', filters.registeredAfter)
  }

  if (filters.registeredBefore) {
    query = query.lte('created_at', filters.registeredBefore)
  }

  // FCM token
  if (filters.hasFcmToken) {
    query = query.not('fcm_token', 'is', null)
  }

  if (filters.hasNoFcmToken) {
    query = query.is('fcm_token', null)
  }

  const { data: profiles, error } = await query

  if (error || !profiles) {
    console.error('Error fetching profiles:', error)
    return []
  }

  // Filtres nécessitant des requêtes supplémentaires
  let filteredProfiles = profiles

  // Filtre inactivité
  if (filters.inactiveDays) {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - filters.inactiveDays)
    filteredProfiles = filteredProfiles.filter(p => {
      if (!p.last_seen_at) return true // Jamais connecté = inactif
      return new Date(p.last_seen_at) < cutoffDate
    })
  }

  // Filtre activité récente
  if (filters.activeDays) {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - filters.activeDays)
    filteredProfiles = filteredProfiles.filter(p => {
      if (!p.last_seen_at) return false
      return new Date(p.last_seen_at) >= cutoffDate
    })
  }

  // Filtre tournoi actif
  if (filters.hasActiveTournament || filters.hasNoActiveTournament) {
    const userIds = filteredProfiles.map(p => p.id)

    const { data: memberships } = await supabase
      .from('tournament_members')
      .select('user_id, tournaments(status)')
      .in('user_id', userIds)
      .eq('tournaments.status', 'active')

    const usersWithActiveTournament = new Set(
      memberships?.map(m => m.user_id) || []
    )

    if (filters.hasActiveTournament) {
      filteredProfiles = filteredProfiles.filter(p =>
        usersWithActiveTournament.has(p.id)
      )
    }

    if (filters.hasNoActiveTournament) {
      filteredProfiles = filteredProfiles.filter(p =>
        !usersWithActiveTournament.has(p.id)
      )
    }
  }

  // Filtre nombre minimum de pronostics
  if (filters.minPredictions) {
    const userIds = filteredProfiles.map(p => p.id)

    const { data: predictionCounts } = await supabase
      .from('predictions')
      .select('user_id')
      .in('user_id', userIds)
      .eq('is_default_prediction', false)

    const userPredictionCounts = new Map<string, number>()
    predictionCounts?.forEach(p => {
      userPredictionCounts.set(p.user_id, (userPredictionCounts.get(p.user_id) || 0) + 1)
    })

    filteredProfiles = filteredProfiles.filter(p => {
      const count = userPredictionCounts.get(p.id) || 0
      return count >= filters.minPredictions!
    })
  }

  // Filtre nombre minimum de tournois
  if (filters.minTournaments) {
    const userIds = filteredProfiles.map(p => p.id)

    const { data: membershipCounts } = await supabase
      .from('tournament_members')
      .select('user_id')
      .in('user_id', userIds)

    const userTournamentCounts = new Map<string, number>()
    membershipCounts?.forEach(m => {
      userTournamentCounts.set(m.user_id, (userTournamentCounts.get(m.user_id) || 0) + 1)
    })

    filteredProfiles = filteredProfiles.filter(p => {
      const count = userTournamentCounts.get(p.id) || 0
      return count >= filters.minTournaments!
    })
  }

  // Filtre trophées
  if (filters.hasTrophies) {
    const userIds = filteredProfiles.map(p => p.id)

    const { data: trophyData } = await supabase
      .from('user_trophies')
      .select('user_id')
      .in('user_id', userIds)
      .gt('unlocked_count', 0)

    const usersWithTrophies = new Set(
      trophyData?.map(t => t.user_id) || []
    )

    filteredProfiles = filteredProfiles.filter(p =>
      usersWithTrophies.has(p.id)
    )
  }

  return filteredProfiles
}
