import { SupabaseClient } from '@supabase/supabase-js'
import type { TargetingFilters } from './email-templates'

/**
 * Calcule les destinataires d'une communication selon les filtres de ciblage
 */
export async function calculateRecipients(
  supabase: SupabaseClient,
  filters: TargetingFilters
): Promise<Array<{ id: string; email: string; fcm_token: string | null; username: string }>> {
  console.log('[Targeting] Starting calculation with filters:', JSON.stringify(filters))

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

  // FCM token - si les deux sont cochés, on ne filtre pas (= tous les users)
  if (filters.hasFcmToken && !filters.hasNoFcmToken) {
    query = query.not('fcm_token', 'is', null)
  } else if (filters.hasNoFcmToken && !filters.hasFcmToken) {
    query = query.is('fcm_token', null)
  }
  // Si les deux sont cochés ou aucun, on ne filtre pas

  const { data: profiles, error } = await query

  if (error || !profiles) {
    console.error('[Targeting] Error fetching profiles:', error)
    return []
  }

  console.log('[Targeting] Initial profiles count:', profiles.length)

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

  // Filtre tournoi actif - si les deux sont cochés, on ne filtre pas
  if ((filters.hasActiveTournament || filters.hasNoActiveTournament) &&
      !(filters.hasActiveTournament && filters.hasNoActiveTournament)) {
    const userIds = filteredProfiles.map(p => p.id)

    // Récupérer tous les tournois qui ne sont pas terminés (= actifs ou en attente)
    const { data: activeTournaments } = await supabase
      .from('tournaments')
      .select('id')
      .neq('status', 'completed')

    const activeTournamentIds = activeTournaments?.map(t => t.id) || []

    console.log('[Targeting] Active/Pending tournaments:', activeTournamentIds.length)
    console.log('[Targeting] Active tournament IDs:', activeTournamentIds)

    // Si aucun tournoi actif, on a directement la réponse
    let usersWithActiveTournament = new Set<string>()

    if (activeTournamentIds.length > 0) {
      // Ensuite récupérer les membres de ces tournois
      const { data: memberships } = await supabase
        .from('tournament_members')
        .select('user_id')
        .in('user_id', userIds)
        .in('tournament_id', activeTournamentIds)

      console.log('[Targeting] Memberships found:', memberships?.length || 0)

      usersWithActiveTournament = new Set(
        memberships?.map(m => m.user_id) || []
      )
    } else {
      console.log('[Targeting] No active tournaments, all users have no active tournament')
    }

    console.log('[Targeting] Users with active tournament:', usersWithActiveTournament.size)

    if (filters.hasActiveTournament && !filters.hasNoActiveTournament) {
      // Seulement ceux avec tournoi actif
      filteredProfiles = filteredProfiles.filter(p =>
        usersWithActiveTournament.has(p.id)
      )
      console.log('[Targeting] After hasActiveTournament filter:', filteredProfiles.length)
    } else if (filters.hasNoActiveTournament && !filters.hasActiveTournament) {
      // Seulement ceux sans tournoi actif
      filteredProfiles = filteredProfiles.filter(p =>
        !usersWithActiveTournament.has(p.id)
      )
      console.log('[Targeting] After hasNoActiveTournament filter:', filteredProfiles.length)
    }
    // Si les deux sont cochés, on ne filtre pas (tous les users)
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

  console.log('[Targeting] Final filtered profiles count:', filteredProfiles.length)

  return filteredProfiles
}
