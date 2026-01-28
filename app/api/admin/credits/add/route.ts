import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse, NextRequest } from 'next/server'
import { isSuperAdmin } from '@/lib/auth-helpers'
import { UserRole } from '@/types'

const creditTypeConfig: Record<string, { purchaseType: string; amount: number; label: string; tournamentSubtype?: string; slotsIncluded?: number }> = {
  'slot_invite': {
    purchaseType: 'slot_invite',
    amount: 0.99,
    label: 'Slot Free-Kick'
  },
  'oneshot_creation': {
    purchaseType: 'tournament_creation',
    amount: 4.99,
    label: 'Crédit One-Shot',
    tournamentSubtype: 'oneshot'
  },
  'elite_creation': {
    purchaseType: 'tournament_creation',
    amount: 9.99,
    label: 'Crédit Elite',
    tournamentSubtype: 'elite'
  },
  'platinium_participation': {
    purchaseType: 'tournament_creation',
    amount: 6.99,
    label: 'Crédit Platinium',
    tournamentSubtype: 'platinium_solo'
  },
  'platinium_prepaid_11': {
    purchaseType: 'tournament_creation',
    amount: 69.20,
    label: 'Platinium Prepaid 11 joueurs',
    tournamentSubtype: 'platinium_group',
    slotsIncluded: 11
  },
  'duration_extension': {
    purchaseType: 'duration_extension',
    amount: 3.99,
    label: 'Extension Durée'
  },
  'stats_access_tournament': {
    purchaseType: 'stats_access_tournament',
    amount: 1.99,
    label: 'Stats Tournoi'
  },
  'stats_access_lifetime': {
    purchaseType: 'stats_access_lifetime',
    amount: 5.99,
    label: 'Stats à Vie'
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    // Vérifier l'authentification et les droits admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!isSuperAdmin(profile?.role as UserRole)) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const body = await request.json()
    const { userId, creditType, tournamentId } = body

    if (!userId || !creditType) {
      return NextResponse.json({ error: 'userId et creditType sont requis' }, { status: 400 })
    }

    // Pour stats_access_tournament, le tournamentId est requis
    if (creditType === 'stats_access_tournament' && !tournamentId) {
      return NextResponse.json({ error: 'tournamentId est requis pour stats_access_tournament' }, { status: 400 })
    }

    const config = creditTypeConfig[creditType]
    if (!config) {
      return NextResponse.json({ error: 'Type de crédit invalide' }, { status: 400 })
    }

    // Vérifier que l'utilisateur existe
    const { data: targetUser, error: userError } = await adminClient
      .from('profiles')
      .select('id, username')
      .eq('id', userId)
      .single()

    if (userError || !targetUser) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 })
    }

    // Créer l'entrée dans tournament_purchases
    const insertData: Record<string, unknown> = {
      user_id: userId,
      tournament_id: creditType === 'stats_access_tournament' ? tournamentId : null,
      purchase_type: config.purchaseType,
      amount: config.amount,
      currency: 'eur',
      status: 'completed',
      used: false,
      tournament_subtype: config.tournamentSubtype || null
    }

    if (config.slotsIncluded) {
      insertData.slots_included = config.slotsIncluded
    }

    const { data: purchase, error: purchaseError } = await adminClient
      .from('tournament_purchases')
      .insert(insertData)
      .select()
      .single()

    if (purchaseError) {
      console.error('Error creating purchase:', purchaseError)
      return NextResponse.json({ error: 'Erreur lors de la création du crédit' }, { status: 500 })
    }

    console.log(`[ADMIN] Crédit "${config.label}" ajouté pour ${targetUser.username} par admin ${user.id}`)

    return NextResponse.json({
      success: true,
      message: `Crédit "${config.label}" ajouté avec succès pour ${targetUser.username}`,
      purchase
    })

  } catch (error) {
    console.error('Error in admin add credit API:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
