import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// Client Supabase avec service role (bypass RLS)
const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    // Verifier si Stripe est configure
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: 'Stripe n\'est pas configure' },
        { status: 503 }
      )
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Non authentifie' },
        { status: 401 }
      )
    }

    const { session_id } = await request.json()

    if (!session_id) {
      return NextResponse.json(
        { error: 'session_id manquant' },
        { status: 400 }
      )
    }

    // Recuperer la session Stripe
    const session = await stripe.checkout.sessions.retrieve(session_id)

    if (!session) {
      return NextResponse.json(
        { error: 'Session non trouvee' },
        { status: 404 }
      )
    }

    // Verifier que la session appartient a l'utilisateur
    if (session.metadata?.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Session non autorisee' },
        { status: 403 }
      )
    }

    // Si le paiement n'est pas complete
    if (session.payment_status !== 'paid') {
      return NextResponse.json({
        success: false,
        status: session.payment_status,
        message: 'Paiement non complete'
      })
    }

    // Verifier si deja traite
    const { data: existingPurchase } = await supabaseAdmin
      .from('tournament_purchases')
      .select('status, tournament_id, purchase_type, tournament_subtype')
      .eq('stripe_checkout_session_id', session_id)
      .single()

    if (existingPurchase?.status === 'completed') {
      // Deja traite, retourner le succes
      return NextResponse.json({
        success: true,
        alreadyProcessed: true,
        purchaseType: existingPurchase.purchase_type,
        tournamentSubtype: existingPurchase.tournament_subtype,
        tournamentId: existingPurchase.tournament_id,
        message: 'Paiement deja traite'
      })
    }

    // Traiter le paiement - crediter l'achat
    const purchaseType = session.metadata?.purchase_type

    // Determiner le sous-type et le nombre de slots
    let tournamentSubtype: string | null = null
    let slotsIncluded = 1
    let purchaseTypeDb = purchaseType

    if (purchaseType === 'tournament_creation_oneshot') {
      tournamentSubtype = 'oneshot'
      purchaseTypeDb = 'tournament_creation'
    } else if (purchaseType === 'tournament_creation_elite') {
      tournamentSubtype = 'elite'
      purchaseTypeDb = 'tournament_creation'
    } else if (purchaseType === 'tournament_creation_platinium') {
      tournamentSubtype = 'platinium'
      purchaseTypeDb = 'tournament_creation'
    } else if (purchaseType === 'platinium_group_11') {
      tournamentSubtype = 'platinium'
      slotsIncluded = 11
      purchaseTypeDb = 'platinium_group'
    } else if (purchaseType === 'platinium_participation') {
      tournamentSubtype = 'platinium'
    }

    // Mettre a jour le statut de l'achat avec les credits
    const { error: updateError } = await supabaseAdmin
      .from('tournament_purchases')
      .update({
        status: 'completed',
        purchase_type: purchaseTypeDb,
        tournament_subtype: tournamentSubtype,
        slots_included: slotsIncluded,
        used: false, // Credit disponible
        stripe_payment_intent_id: session.payment_intent as string,
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_checkout_session_id', session_id)

    if (updateError) {
      console.error('Error updating purchase:', updateError)
    }

    // Determiner l'action suivante pour l'UI
    let nextAction = 'dashboard'
    let redirectUrl = '/dashboard'

    if (purchaseType?.startsWith('tournament_creation_') || purchaseType === 'platinium_group_11') {
      nextAction = 'create_tournament'
      redirectUrl = '/vestiaire/create'
    } else if (purchaseType === 'platinium_participation') {
      nextAction = 'join_platinium'
      redirectUrl = '/dashboard'
    } else if (purchaseType === 'slot_invite') {
      nextAction = 'join_tournament'
      redirectUrl = '/dashboard'
    } else if (purchaseType === 'duration_extension' || purchaseType === 'player_extension') {
      // Ces extensions sont liees a un tournoi specifique
      const tournamentId = session.metadata?.tournament_id
      if (tournamentId) {
        await handleExtension(purchaseType, tournamentId, session_id)
        redirectUrl = `/vestiaire/${tournamentId}`
      }
    }

    console.log('Payment verified - Credit added:', {
      userId: user.id,
      purchaseType: purchaseTypeDb,
      tournamentSubtype,
      slotsIncluded
    })

    return NextResponse.json({
      success: true,
      purchaseType: purchaseTypeDb,
      tournamentSubtype,
      slotsIncluded,
      nextAction,
      redirectUrl,
      message: 'Paiement verifie - Credit ajoute a votre compte'
    })

  } catch (error: unknown) {
    console.error('Error verifying session:', error)
    const errorMessage = error instanceof Error ? error.message : 'Erreur serveur'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

// Traiter les extensions (liees a un tournoi specifique)
async function handleExtension(
  purchaseType: string,
  tournamentId: string,
  sessionId: string
): Promise<void> {
  if (purchaseType === 'duration_extension') {
    await supabaseAdmin
      .from('tournaments')
      .update({
        duration_extended: true,
        max_matchdays: null,
      })
      .eq('id', tournamentId)

    // Marquer comme utilise
    await supabaseAdmin
      .from('tournament_purchases')
      .update({
        used: true,
        used_at: new Date().toISOString(),
        used_for_tournament_id: tournamentId,
        tournament_id: tournamentId,
      })
      .eq('stripe_checkout_session_id', sessionId)

    console.log('Duration extended for tournament:', tournamentId)
  } else if (purchaseType === 'player_extension') {
    const { data: tournament } = await supabaseAdmin
      .from('tournaments')
      .select('max_players, players_extended')
      .eq('id', tournamentId)
      .single()

    if (tournament) {
      await supabaseAdmin
        .from('tournaments')
        .update({
          max_players: tournament.max_players + 5,
          max_participants: tournament.max_players + 5,
          players_extended: (tournament.players_extended || 0) + 5,
        })
        .eq('id', tournamentId)

      // Marquer comme utilise
      await supabaseAdmin
        .from('tournament_purchases')
        .update({
          used: true,
          used_at: new Date().toISOString(),
          used_for_tournament_id: tournamentId,
          tournament_id: tournamentId,
        })
        .eq('stripe_checkout_session_id', sessionId)

      console.log('Players extended for tournament:', tournamentId)
    }
  }
}
