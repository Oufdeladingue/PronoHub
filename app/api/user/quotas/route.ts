import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { UserQuotas, TournamentTypeResult, ACCOUNT_LIMITS, PRICES } from '@/types/monetization'

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

// Calcul manuel des quotas basé sur les crédits achetés
// Plus d'abonnement premium - uniquement des achats de crédits par type
async function calculateQuotasManually(supabase: any, userId: string): Promise<UserQuotas> {
  // Récupérer le profil
  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', userId)
    .single()

  // Récupérer les crédits disponibles depuis la vue
  const { data: credits } = await supabase
    .from('user_available_credits')
    .select('*')
    .eq('user_id', userId)
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

  // Crédits disponibles par type
  const oneshotCredits = credits?.oneshot_credits || 0
  const eliteCredits = credits?.elite_credits || 0
  const platiniumCredits = (credits?.platinium_solo_credits || 0) + (credits?.platinium_group_slots || 0)

  // Compter les tournois one-shot actifs (ancienne logique pour compatibilité)
  const { count: oneshotActiveCount } = await supabase
    .from('user_oneshot_purchases')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'in_use')

  // Compter les comptes entreprise actifs
  const { count: enterpriseCount } = await supabase
    .from('enterprise_accounts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'active')

  // Déterminer si l'utilisateur peut créer un tournoi
  // Soit il a des crédits disponibles, soit il a encore des slots gratuits
  const hasCreationCredits = oneshotCredits > 0 || eliteCredits > 0 || platiniumCredits > 0
  const canCreateFree = freeParticipationCount < PRICES.FREE_MAX_TOURNAMENTS
  const canCreate = hasCreationCredits || canCreateFree

  return {
    user_id: userId,
    username: profile?.username || 'Unknown',
    subscription_status: 'none', // Plus d'abonnement premium
    subscription_type: null,
    subscription_expires_at: null,
    free_tournaments_active: freeParticipationCount,
    free_tournaments_max: PRICES.FREE_MAX_TOURNAMENTS,
    oneshot_tournaments_active: oneshotActiveCount || 0,
    oneshot_tournaments_max: 2,
    oneshot_slots_available: oneshotCredits, // Utilise les crédits one-shot
    premium_tournaments_active: 0, // Plus de concept premium
    premium_tournaments_max: 0,
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

// Calcul manuel du type de tournoi basé sur les crédits disponibles
// Priorité: Elite > Platinium > One-Shot > Gratuit
async function determineTournamentTypeManually(
  supabase: any,
  userId: string
): Promise<TournamentTypeResult> {
  // Récupérer les crédits disponibles depuis la vue
  const { data: credits } = await supabase
    .from('user_available_credits')
    .select('*')
    .eq('user_id', userId)
    .single()

  const oneshotCredits = credits?.oneshot_credits || 0
  const eliteCredits = credits?.elite_credits || 0
  const platiniumSoloCredits = credits?.platinium_solo_credits || 0
  const platiniumGroupSlots = credits?.platinium_group_slots || 0

  // Priorité 1: Elite Team (meilleur rapport qualité/prix)
  if (eliteCredits > 0) {
    return {
      tournament_type: 'elite',
      max_players: ACCOUNT_LIMITS.elite.maxPlayersPerTournament,
      reason: 'Crédit Elite Team disponible'
    }
  }

  // Priorité 2: Platinium
  if (platiniumSoloCredits > 0 || platiniumGroupSlots > 0) {
    return {
      tournament_type: 'platinium',
      max_players: ACCOUNT_LIMITS.platinium.maxPlayersPerTournament,
      reason: 'Crédit Platinium disponible'
    }
  }

  // Priorité 3: One-shot
  if (oneshotCredits > 0) {
    return {
      tournament_type: 'oneshot',
      max_players: ACCOUNT_LIMITS.oneshot.maxPlayersPerTournament,
      reason: 'Crédit One-Shot disponible'
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

  // Priorité 4: Gratuit (max FREE_MAX_TOURNAMENTS participations)
  if (freeParticipationCount < PRICES.FREE_MAX_TOURNAMENTS) {
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
    reason: 'Aucun slot disponible - achetez un crédit'
  }
}
