import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProductConfig, ExtensionProduct } from '@/lib/stripe-products'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-11-17.clover'
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { productType, tournamentId } = body as {
      productType: ExtensionProduct
      tournamentId?: string
    }

    if (!productType) {
      return NextResponse.json(
        { error: 'Type de produit manquant' },
        { status: 400 }
      )
    }

    // Vérifier que tournamentId est fourni pour les produits qui en ont besoin
    if (productType !== 'stats_option' && !tournamentId) {
      return NextResponse.json(
        { error: 'ID du tournoi manquant' },
        { status: 400 }
      )
    }

    // Vérifier que l'utilisateur est bien admin du tournoi (sauf pour stats_option)
    if (tournamentId) {
      const { data: tournament, error: tournamentError } = await supabase
        .from('tournaments')
        .select('creator_id')
        .eq('id', tournamentId)
        .single()

      if (tournamentError || !tournament) {
        return NextResponse.json(
          { error: 'Tournoi non trouvé' },
          { status: 404 }
        )
      }

      if (tournament.creator_id !== user.id) {
        return NextResponse.json(
          { error: 'Vous devez être créateur du tournoi' },
          { status: 403 }
        )
      }
    }

    // Récupérer la config du produit
    const product = getProductConfig(productType)

    // Mapper les produits d'extension vers les types d'achat
    const purchaseTypeMap: Record<ExtensionProduct, string> = {
      duration_extension: 'duration_extension',
      player_extension: 'player_extension',
      stats_option: 'stats_access_lifetime'
    }

    const purchaseType = purchaseTypeMap[productType]

    // URLs de succès et d'annulation
    const successUrl = tournamentId
      ? `${process.env.NEXT_PUBLIC_APP_URL}/tournaments/${tournamentId}?payment=success&type=${productType}`
      : `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?payment=success&type=${productType}`

    const cancelUrl = tournamentId
      ? `${process.env.NEXT_PUBLIC_APP_URL}/tournaments/${tournamentId}?payment=cancelled`
      : `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?payment=cancelled`

    // Créer l'enregistrement d'achat dans la base (status: pending)
    const { data: purchase, error: purchaseError } = await supabase
      .from('tournament_purchases')
      .insert({
        user_id: user.id,
        purchase_type: purchaseType,
        amount: product.price / 100, // Convertir centimes en euros
        currency: product.currency,
        status: 'pending',
        used: false,
        tournament_id: tournamentId || null
      })
      .select()
      .single()

    if (purchaseError || !purchase) {
      console.error('Erreur création purchase:', purchaseError)
      return NextResponse.json(
        { error: 'Erreur lors de la création de l\'achat' },
        { status: 500 }
      )
    }

    // Créer la session Stripe
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price: product.priceId,
          quantity: 1
        }
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        user_id: user.id,
        purchase_type: purchaseType,
        tournament_id: tournamentId || '',
        product_type: productType,
        purchase_id: purchase.id
      }
    })

    // Mettre à jour le purchase avec le session ID
    await supabase
      .from('tournament_purchases')
      .update({ stripe_checkout_session_id: session.id })
      .eq('id', purchase.id)

    return NextResponse.json({ sessionId: session.id, url: session.url })
  } catch (error) {
    console.error('Erreur création session Stripe:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création de la session de paiement' },
      { status: 500 }
    )
  }
}
