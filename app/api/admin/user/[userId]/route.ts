import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth-helpers'
import { UserRole } from '@/types'

interface PurchaseDetail {
  id: string
  purchase_type: string
  tournament_subtype: string | null
  amount: number
  status: string
  created_at: string
  tournament_name?: string
}

interface TrophyInfo {
  trophy_type: string
  unlocked_at: string
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params
    const supabase = await createClient()
    const adminClient = createAdminClient()

    // Vérifier que l'utilisateur est super admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!isSuperAdmin(profile?.role as UserRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Lancer toutes les requêtes en parallèle
    const [
      userProfileResult,
      tournamentsCountResult,
      purchasesResult,
      trophiesResult,
      authUserResult
    ] = await Promise.all([
      // 1. Profil utilisateur
      adminClient
        .from('profiles')
        .select('id, username, avatar, created_at, role')
        .eq('id', userId)
        .single(),

      // 2. Compter les tournois par statut
      adminClient
        .from('tournament_participants')
        .select(`
          tournament_id,
          tournaments!inner(status)
        `)
        .eq('user_id', userId),

      // 3. Achats
      adminClient
        .from('tournament_purchases')
        .select(`
          id,
          purchase_type,
          tournament_subtype,
          amount,
          status,
          created_at,
          tournament_id,
          tournaments(name)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),

      // 4. Trophées
      adminClient
        .from('user_trophies')
        .select('trophy_type, unlocked_at')
        .eq('user_id', userId)
        .order('unlocked_at', { ascending: false }),

      // 5. Email via auth (admin only)
      adminClient.auth.admin.getUserById(userId)
    ])

    if (userProfileResult.error || !userProfileResult.data) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 })
    }

    const userProfile = userProfileResult.data

    // Compter les tournois par statut
    const tournaments = tournamentsCountResult.data || []
    const tournamentStats = {
      total: tournaments.length,
      active: tournaments.filter((t: any) => t.tournaments?.status === 'active').length,
      finished: tournaments.filter((t: any) => t.tournaments?.status === 'finished').length,
      draft: tournaments.filter((t: any) => t.tournaments?.status === 'draft').length
    }

    // Traiter les achats
    const purchases = purchasesResult.data || []
    const completedPurchases = purchases.filter((p: any) => p.status === 'completed')

    // Calculer les crédits par catégorie
    const creditsMap: Record<string, number> = {}
    const purchaseDetails: PurchaseDetail[] = []
    let totalSpent = 0

    for (const purchase of completedPurchases) {
      const type = purchase.purchase_type
      const subtype = purchase.tournament_subtype

      // Comptabiliser par type
      if (type === 'tournament_creation') {
        const key = subtype || 'free_kick'
        creditsMap[key] = (creditsMap[key] || 0) + 1
      } else if (type === 'participant_slot') {
        creditsMap['slots'] = (creditsMap['slots'] || 0) + 1
      } else if (type === 'stats_access_tournament') {
        creditsMap['stats_tournament'] = (creditsMap['stats_tournament'] || 0) + 1
      } else if (type === 'stats_access_lifetime') {
        creditsMap['stats_lifetime'] = (creditsMap['stats_lifetime'] || 0) + 1
      }

      // Total dépensé
      if (purchase.amount > 0) {
        totalSpent += purchase.amount
      }

      // Détail des achats
      purchaseDetails.push({
        id: purchase.id,
        purchase_type: purchase.purchase_type,
        tournament_subtype: purchase.tournament_subtype,
        amount: purchase.amount,
        status: purchase.status,
        created_at: purchase.created_at,
        tournament_name: (purchase.tournaments as any)?.name || undefined
      })
    }

    // Trophées
    const trophies: TrophyInfo[] = (trophiesResult.data || []).map((t: any) => ({
      trophy_type: t.trophy_type,
      unlocked_at: t.unlocked_at
    }))

    // Email (depuis auth)
    const email = authUserResult.data?.user?.email || null

    return NextResponse.json({
      success: true,
      user: {
        id: userProfile.id,
        username: userProfile.username,
        avatar: userProfile.avatar,
        email,
        created_at: userProfile.created_at,
        role: userProfile.role,
        tournaments: tournamentStats,
        credits: creditsMap,
        purchases: {
          total: completedPurchases.length,
          totalSpent,
          details: purchaseDetails.slice(0, 20) // Limiter à 20 derniers
        },
        trophies
      }
    })

  } catch (error: any) {
    console.error('Error fetching user detail:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
