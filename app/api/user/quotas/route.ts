import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { UserQuotas, TournamentTypeResult, ACCOUNT_LIMITS } from '@/types/monetization'

// GET /api/user/quotas
// Retourne les quotas de l'utilisateur connecté
export async function GET() {
  try {
    const supabase = await createClient()

    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Non authentifié' },
        { status: 401 }
      )
    }

    // Toujours utiliser le calcul manuel (plus fiable que la vue SQL)
    // La vue SQL compte les tournois premium par PARTICIPATION au lieu de CRÉATION
    const manualQuotas = await calculateQuotasManually(supabase, user.id)
    return NextResponse.json({
      success: true,
      quotas: manualQuotas,
      source: 'calculated'
    })

  } catch (error) {
    console.error('Error fetching user quotas:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}

// Calcul manuel des quotas (fallback si la vue n'existe pas)
// PREMIUM: basé sur les tournois CRÉÉS (original_creator_id)
// GRATUIT: basé sur les PARTICIPATIONS (count des tournament_participants)
async function calculateQuotasManually(supabase: any, userId: string): Promise<UserQuotas> {
  // Récupérer le profil
  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', userId)
    .single()

  // Vérifier abonnement actif
  const { data: subscription } = await supabase
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single()

  // GRATUIT: Compter les PARTICIPATIONS aux tournois gratuits actifs
  const { data: participations } = await supabase
    .from('tournament_participants')
    .select('tournament_id')
    .eq('user_id', userId)

  const tournamentIds = participations?.map((p: any) => p.tournament_id) || []

  let freeParticipationCount = 0
  if (tournamentIds.length > 0) {
    const { count } = await supabase
      .from('tournaments')
      .select('*', { count: 'exact', head: true })
      .in('id', tournamentIds)
      .eq('tournament_type', 'free')
      .neq('status', 'completed')

    freeParticipationCount = count || 0
  }

  // Compter les tournois one-shot actifs
  const { count: oneshotActiveCount } = await supabase
    .from('user_oneshot_purchases')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'in_use')

  // Compter les slots one-shot disponibles
  const { count: oneshotAvailableCount } = await supabase
    .from('user_oneshot_purchases')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'available')

  // PREMIUM: Compter les tournois premium CRÉÉS par l'utilisateur
  // On utilise original_creator_id en priorité, avec fallback sur creator_id pour les anciens tournois
  const { data: premiumWithOriginalCreator } = await supabase
    .from('tournaments')
    .select('id')
    .eq('original_creator_id', userId)
    .eq('tournament_type', 'premium')
    .neq('status', 'completed')

  // Fallback: tournois où creator_id = userId ET original_creator_id est NULL (anciens tournois)
  const { data: premiumWithCreatorFallback } = await supabase
    .from('tournaments')
    .select('id')
    .eq('creator_id', userId)
    .eq('tournament_type', 'premium')
    .is('original_creator_id', null)
    .neq('status', 'completed')

  // Combiner les deux listes en évitant les doublons
  const allPremiumCreated = [
    ...(premiumWithOriginalCreator || []),
    ...(premiumWithCreatorFallback || [])
  ]
  const uniquePremiumIds = new Set(allPremiumCreated.map(t => t.id))
  const premiumCount = uniquePremiumIds.size

  // Compter les comptes entreprise actifs
  const { count: enterpriseCount } = await supabase
    .from('enterprise_accounts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'active')

  const hasSubscription = subscription?.status === 'active'
  const premiumMax = hasSubscription ? 5 : 0

  // Déterminer si l'utilisateur peut créer/rejoindre un tournoi
  // GRATUIT: basé sur les PARTICIPATIONS (max 3)
  // PREMIUM: basé sur les CRÉATIONS (max 5)
  const canCreate =
    (hasSubscription && premiumCount < 5) ||
    (oneshotAvailableCount || 0) > 0 ||
    freeParticipationCount < 3

  return {
    user_id: userId,
    username: profile?.username || 'Unknown',
    subscription_status: subscription?.status || 'none',
    subscription_type: subscription?.subscription_type || null,
    subscription_expires_at: subscription?.current_period_end || null,
    free_tournaments_active: freeParticipationCount,
    free_tournaments_max: 3,
    oneshot_tournaments_active: oneshotActiveCount || 0,
    oneshot_tournaments_max: 2,
    oneshot_slots_available: oneshotAvailableCount || 0,
    premium_tournaments_active: premiumCount,
    premium_tournaments_max: premiumMax,
    enterprise_accounts_active: enterpriseCount || 0,
    can_create_tournament: canCreate,
  }
}

// POST /api/user/quotas/check-tournament-type
// Détermine le type de tournoi à créer
export async function POST() {
  try {
    const supabase = await createClient()

    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Non authentifié' },
        { status: 401 }
      )
    }

    // Utiliser la fonction SQL si disponible
    const { data: result, error: fnError } = await supabase
      .rpc('determine_tournament_type', { p_user_id: user.id })

    if (fnError) {
      // Fallback: calculer manuellement
      const manualResult = await determineTournamentTypeManually(supabase, user.id)
      return NextResponse.json({
        success: true,
        result: manualResult,
        source: 'calculated'
      })
    }

    const typedResult: TournamentTypeResult = result?.[0] || {
      tournament_type: null,
      max_players: 0,
      reason: 'Aucun slot disponible'
    }

    return NextResponse.json({
      success: true,
      result: typedResult,
      source: 'function'
    })

  } catch (error) {
    console.error('Error determining tournament type:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}

// Calcul manuel du type de tournoi
// PREMIUM: basé sur les tournois CRÉÉS (original_creator_id avec fallback creator_id)
// GRATUIT: basé sur les PARTICIPATIONS (count des tournament_participants)
async function determineTournamentTypeManually(
  supabase: any,
  userId: string
): Promise<TournamentTypeResult> {
  // Vérifier abonnement actif
  const { data: subscription } = await supabase
    .from('user_subscriptions')
    .select('status')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single()

  const hasSubscription = !!subscription

  // PREMIUM: Compter tournois premium CRÉÉS par l'utilisateur
  // On utilise original_creator_id en priorité, avec fallback sur creator_id pour les anciens tournois
  const { data: premiumWithOriginalCreator } = await supabase
    .from('tournaments')
    .select('id')
    .eq('original_creator_id', userId)
    .eq('tournament_type', 'premium')
    .neq('status', 'completed')

  const { data: premiumWithCreatorFallback } = await supabase
    .from('tournaments')
    .select('id')
    .eq('creator_id', userId)
    .eq('tournament_type', 'premium')
    .is('original_creator_id', null)
    .neq('status', 'completed')

  const allPremiumCreated = [
    ...(premiumWithOriginalCreator || []),
    ...(premiumWithCreatorFallback || [])
  ]
  const uniquePremiumIds = new Set(allPremiumCreated.map(t => t.id))
  const premiumCount = uniquePremiumIds.size

  // Priorité 1: Abonnement premium
  if (hasSubscription && premiumCount < 5) {
    return {
      tournament_type: 'premium',
      max_players: ACCOUNT_LIMITS.premium.maxPlayersPerTournament,
      reason: 'Slot abonnement premium utilisé'
    }
  }

  // Compter slots one-shot disponibles
  const { count: oneshotAvailable } = await supabase
    .from('user_oneshot_purchases')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'available')

  // Priorité 2: One-shot
  if ((oneshotAvailable || 0) > 0) {
    return {
      tournament_type: 'oneshot',
      max_players: ACCOUNT_LIMITS.oneshot.maxPlayersPerTournament,
      reason: 'Slot one-shot utilisé'
    }
  }

  // GRATUIT: Compter les PARTICIPATIONS aux tournois gratuits actifs
  const { data: participations } = await supabase
    .from('tournament_participants')
    .select('tournament_id')
    .eq('user_id', userId)

  const tournamentIds = participations?.map((p: any) => p.tournament_id) || []

  let freeParticipationCount = 0
  if (tournamentIds.length > 0) {
    const { count } = await supabase
      .from('tournaments')
      .select('*', { count: 'exact', head: true })
      .in('id', tournamentIds)
      .eq('tournament_type', 'free')
      .neq('status', 'completed')

    freeParticipationCount = count || 0
  }

  // Priorité 3: Gratuit (max 3 participations)
  if (freeParticipationCount < 3) {
    return {
      tournament_type: 'free',
      max_players: ACCOUNT_LIMITS.free.maxPlayersPerTournament,
      reason: 'Slot gratuit utilisé'
    }
  }

  // Aucun slot disponible
  return {
    tournament_type: null,
    max_players: 0,
    reason: 'Aucun slot disponible - upgrade requis'
  }
}
