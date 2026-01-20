import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe, isStripeEnabled, STRIPE_PRODUCTS, StripePurchaseType, getBaseUrl } from '@/lib/stripe'

interface CheckoutRequest {
  purchaseType: StripePurchaseType
  tournamentId?: string
  tournamentData?: {
    name: string
    slug: string
    competitionId: string
    competitionName: string
    maxPlayers: number
    numMatchdays: number
    allMatchdays: number[]
    bonusMatchEnabled: boolean
    drawWithDefaultPredictionPoints: number
  }
  inviteCode?: string
}

// Mapping entre purchaseType et config_key dans pricing_config
const PRICE_CONFIG_MAPPING: Record<string, string> = {
  tournament_creation_oneshot: 'oneshot_creation_price',
  tournament_creation_elite: 'elite_creation_price',
  tournament_creation_platinium: 'platinium_creation_price',
  slot_invite: 'slot_invite_price',
  duration_extension: 'duration_extension_price',
  player_extension: 'player_extension_price',
  platinium_participation: 'platinium_creation_price', // Meme prix que creation
  platinium_group_11: 'platinium_group', // Calcule dynamiquement
}

export async function POST(request: NextRequest) {
  try {
    // Vérifier si Stripe est configuré
    if (!isStripeEnabled || !stripe) {
      return NextResponse.json(
        { error: 'Stripe n\'est pas configuré' },
        { status: 503 }
      )
    }

    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Vous devez etre connecte pour effectuer un achat' },
        { status: 401 }
      )
    }

    const body: CheckoutRequest = await request.json()
    const { purchaseType, tournamentId, tournamentData, inviteCode } = body

    // Charger les prix depuis la BDD
    const { data: pricingConfig } = await supabase
      .from('pricing_config')
      .select('config_key, config_value')
      .eq('is_active', true)

    // Creer un map des prix
    const pricesMap = (pricingConfig || []).reduce((acc, item) => {
      acc[item.config_key] = item.config_value
      return acc
    }, {} as Record<string, number>)

    // Obtenir le prix dynamique
    let priceInCents: number
    const configKey = PRICE_CONFIG_MAPPING[purchaseType]

    if (purchaseType === 'platinium_group_11') {
      // Prix groupe = prix unitaire * taille groupe
      const unitPrice = pricesMap['platinium_creation_price'] || 6.99
      const groupSize = pricesMap['platinium_group_size'] || 11
      const discount = pricesMap['platinium_group_discount'] || 0
      priceInCents = Math.round(unitPrice * groupSize * (1 - discount / 100) * 100)
    } else if (configKey && pricesMap[configKey]) {
      priceInCents = Math.round(pricesMap[configKey] * 100)
    } else {
      // Fallback vers les constantes si pas trouve en BDD
      const product = STRIPE_PRODUCTS[purchaseType]
      if (!product) {
        return NextResponse.json(
          { error: 'Type d\'achat invalide' },
          { status: 400 }
        )
      }
      priceInCents = product.priceInCents
    }

    // Utiliser les constantes pour name/description
    const product = STRIPE_PRODUCTS[purchaseType]
    if (!product) {
      return NextResponse.json(
        { error: 'Type d\'achat invalide' },
        { status: 400 }
      )
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single()

    const metadata: Record<string, string> = {
      user_id: user.id,
      purchase_type: purchaseType,
    }

    if (tournamentId) {
      metadata.tournament_id = tournamentId
    }

    if (tournamentData) {
      metadata.tournament_data = JSON.stringify(tournamentData)
    }

    if (inviteCode) {
      metadata.invite_code = inviteCode
    }

    const baseUrl = getBaseUrl()
    let successUrl = `${baseUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`
    let cancelUrl = `${baseUrl}/payment/cancel`

    if (purchaseType.startsWith('tournament_creation_')) {
      successUrl = `${baseUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}&type=creation`
      cancelUrl = `${baseUrl}/pricing`
    } else if (purchaseType === 'platinium_participation' || purchaseType === 'platinium_group_11') {
      successUrl = `${baseUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}&type=platinium&mode=${purchaseType === 'platinium_group_11' ? 'group' : 'solo'}`
      cancelUrl = `${baseUrl}/pricing`
    } else if (inviteCode) {
      successUrl = `${baseUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}&type=join&code=${inviteCode}`
      cancelUrl = `${baseUrl}/dashboard`
    } else if (tournamentId) {
      successUrl = `${baseUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}&type=extension&tournament=${tournamentId}`
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: product.name,
              description: product.description,
            },
            unit_amount: priceInCents, // Prix dynamique depuis BDD
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: user.email,
      metadata,
      locale: 'fr',
    })

    let purchaseTypeDb = purchaseType as string
    if (purchaseType.startsWith('tournament_creation_')) {
      purchaseTypeDb = 'tournament_creation'
    } else if (purchaseType === 'platinium_group_11') {
      purchaseTypeDb = 'platinium_group'
    }

    // Extraire le sous-type du tournoi (oneshot, elite, platinium)
    let tournamentSubtype: string | null = null
    if (purchaseType.startsWith('tournament_creation_')) {
      tournamentSubtype = purchaseType.replace('tournament_creation_', '')
    }

    const { error: insertError } = await supabase
      .from('tournament_purchases')
      .insert({
        user_id: user.id,
        tournament_id: tournamentId || null,
        purchase_type: purchaseTypeDb,
        tournament_subtype: tournamentSubtype,
        amount: priceInCents / 100, // Prix dynamique depuis BDD
        currency: 'eur',
        stripe_checkout_session_id: session.id,
        status: 'pending',
        used: false,
      })

    if (insertError) {
      console.error('Error creating purchase record:', insertError)
    }

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      url: session.url,
    })
  } catch (error: unknown) {
    console.error('Error creating checkout session:', error)
    const errorMessage = error instanceof Error ? error.message : 'Erreur lors de la creation de la session de paiement'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
