import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe, STRIPE_PRICES, getBaseUrl, isStripeEnabled } from '@/lib/stripe'
import { SubscriptionType } from '@/types/monetization'

type CheckoutType = 'subscription' | 'oneshot' | 'enterprise'

interface CheckoutRequest {
  type: CheckoutType
  subscriptionType?: SubscriptionType
  enterpriseData?: {
    companyName: string
    contactEmail: string
    maxParticipants: number
  }
}

export async function POST(request: Request) {
  try {
    // Vérifier si Stripe est configuré
    if (!isStripeEnabled() || !stripe) {
      return NextResponse.json(
        { success: false, error: 'Stripe n\'est pas configuré' },
        { status: 503 }
      )
    }

    const supabase = await createClient()

    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Non authentifié' },
        { status: 401 }
      )
    }

    const body: CheckoutRequest = await request.json()
    const { type, subscriptionType, enterpriseData } = body

    // Récupérer ou créer le customer Stripe
    let stripeCustomerId: string | null = null

    // Chercher un customer existant
    const { data: existingSubscription } = await supabase
      .from('user_subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .not('stripe_customer_id', 'is', null)
      .single()

    if (existingSubscription?.stripe_customer_id) {
      stripeCustomerId = existingSubscription.stripe_customer_id
    } else {
      // Créer un nouveau customer Stripe
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id,
        },
      })
      stripeCustomerId = customer.id
    }

    const baseUrl = getBaseUrl()
    let sessionConfig: any = {
      customer: stripeCustomerId,
      success_url: `${baseUrl}/dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/pricing?payment=cancelled`,
      metadata: {
        user_id: user.id,
        type,
      },
    }

    // Configuration selon le type d'achat
    if (type === 'subscription') {
      if (!subscriptionType || !['monthly', 'yearly'].includes(subscriptionType)) {
        return NextResponse.json(
          { success: false, error: 'Type d\'abonnement invalide' },
          { status: 400 }
        )
      }

      const priceId = subscriptionType === 'monthly'
        ? STRIPE_PRICES.subscription_monthly
        : STRIPE_PRICES.subscription_yearly

      sessionConfig = {
        ...sessionConfig,
        mode: 'subscription',
        line_items: [{
          price: priceId,
          quantity: 1,
        }],
        metadata: {
          ...sessionConfig.metadata,
          subscription_type: subscriptionType,
        },
      }
    } else if (type === 'oneshot') {
      sessionConfig = {
        ...sessionConfig,
        mode: 'payment',
        line_items: [{
          price: STRIPE_PRICES.oneshot,
          quantity: 1,
        }],
      }
    } else if (type === 'enterprise') {
      if (!enterpriseData?.companyName) {
        return NextResponse.json(
          { success: false, error: 'Données entreprise manquantes' },
          { status: 400 }
        )
      }

      sessionConfig = {
        ...sessionConfig,
        mode: 'payment',
        line_items: [{
          price: STRIPE_PRICES.enterprise,
          quantity: 1,
        }],
        metadata: {
          ...sessionConfig.metadata,
          company_name: enterpriseData.companyName,
          contact_email: enterpriseData.contactEmail || user.email,
          max_participants: enterpriseData.maxParticipants || 300,
        },
      }
    } else {
      return NextResponse.json(
        { success: false, error: 'Type d\'achat invalide' },
        { status: 400 }
      )
    }

    // Créer la session Stripe Checkout
    const session = await stripe.checkout.sessions.create(sessionConfig)

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      url: session.url,
    })

  } catch (error: any) {
    console.error('Stripe checkout error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Erreur lors de la création du paiement' },
      { status: 500 }
    )
  }
}
