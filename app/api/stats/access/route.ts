import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export type StatsAccessReason = 'admin' | 'elite' | 'platinium' | 'lifetime' | 'tournament' | 'none'

interface StatsAccessResponse {
  hasAccess: boolean
  reason: StatsAccessReason
}

/**
 * GET /api/stats/access?tournamentId=xxx
 * Vérifie si l'utilisateur a accès aux stats pour un tournoi
 *
 * Accès accordé si:
 * 1. User est super_admin
 * 2. Tournament.type = 'elite' OU 'platinium'
 * 3. User a purchase stats_access_lifetime (status=completed)
 * 4. User a purchase stats_access_tournament pour CE tournamentId (status=completed)
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const tournamentId = searchParams.get('tournamentId')

    if (!tournamentId) {
      return NextResponse.json(
        { error: 'tournamentId is required' },
        { status: 400 }
      )
    }

    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { hasAccess: false, reason: 'none' } as StatsAccessResponse,
        { status: 200 }
      )
    }

    // Exécuter les vérifications en parallèle pour optimiser les perfs
    const [profileResult, tournamentResult, lifetimePurchaseResult, tournamentPurchaseResult] = await Promise.all([
      // 1. Vérifier si super_admin
      supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single(),

      // 2. Vérifier le type de tournoi
      supabase
        .from('tournaments')
        .select('tournament_type')
        .eq('id', tournamentId)
        .single(),

      // 3. Vérifier achat lifetime
      supabase
        .from('tournament_purchases')
        .select('id')
        .eq('user_id', user.id)
        .eq('purchase_type', 'stats_access_lifetime')
        .eq('status', 'completed')
        .limit(1),

      // 4. Vérifier achat pour ce tournoi
      supabase
        .from('tournament_purchases')
        .select('id')
        .eq('user_id', user.id)
        .eq('tournament_id', tournamentId)
        .eq('purchase_type', 'stats_access_tournament')
        .eq('status', 'completed')
        .limit(1)
    ])

    // 1. Check super_admin
    if (profileResult.data?.role === 'super_admin') {
      return NextResponse.json({
        hasAccess: true,
        reason: 'admin'
      } as StatsAccessResponse)
    }

    // 2. Check tournament type (elite/platinium)
    const tournamentType = tournamentResult.data?.tournament_type
    if (tournamentType === 'elite') {
      return NextResponse.json({
        hasAccess: true,
        reason: 'elite'
      } as StatsAccessResponse)
    }
    if (tournamentType === 'platinium') {
      return NextResponse.json({
        hasAccess: true,
        reason: 'platinium'
      } as StatsAccessResponse)
    }

    // 3. Check lifetime purchase
    if (lifetimePurchaseResult.data && lifetimePurchaseResult.data.length > 0) {
      return NextResponse.json({
        hasAccess: true,
        reason: 'lifetime'
      } as StatsAccessResponse)
    }

    // 4. Check tournament-specific purchase
    if (tournamentPurchaseResult.data && tournamentPurchaseResult.data.length > 0) {
      return NextResponse.json({
        hasAccess: true,
        reason: 'tournament'
      } as StatsAccessResponse)
    }

    // Pas d'accès
    return NextResponse.json({
      hasAccess: false,
      reason: 'none'
    } as StatsAccessResponse)

  } catch (error) {
    console.error('Error checking stats access:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
