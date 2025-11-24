import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { stripe, isStripeEnabled } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'
// import Stripe from 'stripe' // Désactivé temporairement - à réactiver quand Stripe sera configuré

// Client Supabase avec service role pour les webhooks
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  // Vérifier si Stripe est configuré
  if (!isStripeEnabled() || !stripe) {
    return NextResponse.json(
      { error: 'Stripe n\'est pas configuré' },
      { status: 503 }
    )
  }

  const body = await request.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    )
  }

  let event: any // Stripe.Event - type désactivé temporairement

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message)
    return NextResponse.json(
      { error: `Webhook Error: ${err.message}` },
      { status: 400 }
    )
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object)
        break

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(event.data.object)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object)
        break

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object)
        break

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })

  } catch (error: any) {
    console.error('Webhook handler error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

// Handler: Checkout session completed
async function handleCheckoutCompleted(session: any) {
  const userId = session.metadata?.user_id
  const type = session.metadata?.type

  if (!userId || !type) {
    console.error('Missing metadata in checkout session')
    return
  }

  if (type === 'subscription') {
    // L'abonnement est géré par customer.subscription.created
    console.log('Subscription checkout completed, waiting for subscription event')
  } else if (type === 'oneshot') {
    // Créer le slot one-shot
    await supabaseAdmin.from('user_oneshot_purchases').insert({
      user_id: userId,
      status: 'available',
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: session.payment_intent as string,
      amount_paid: session.amount_total,
      currency: session.currency || 'eur',
    })
    console.log('One-shot slot created for user:', userId)
  } else if (type === 'enterprise') {
    // Créer le compte entreprise
    await supabaseAdmin.from('enterprise_accounts').insert({
      user_id: userId,
      company_name: session.metadata?.company_name || 'Entreprise',
      contact_email: session.metadata?.contact_email,
      max_participants: parseInt(session.metadata?.max_participants || '300'),
      status: 'active',
      stripe_payment_intent_id: session.payment_intent as string,
      amount_paid: session.amount_total,
      currency: session.currency || 'eur',
      valid_from: new Date().toISOString(),
    })
    console.log('Enterprise account created for user:', userId)
  }
}

// Handler: Subscription created or updated
async function handleSubscriptionUpdate(subscription: any) {
  const customerId = subscription.customer as string

  // Récupérer le customer pour avoir l'user_id
  const customer = await stripe!.customers.retrieve(customerId) as any
  const userId = customer.metadata?.supabase_user_id

  if (!userId) {
    console.error('No user_id found in customer metadata')
    return
  }

  const subscriptionType = subscription.items.data[0]?.price?.recurring?.interval === 'year'
    ? 'yearly'
    : 'monthly'

  // Upsert l'abonnement
  await supabaseAdmin.from('user_subscriptions').upsert({
    user_id: userId,
    subscription_type: subscriptionType,
    status: subscription.status === 'active' ? 'active' : 'past_due',
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    stripe_price_id: subscription.items.data[0]?.price?.id,
    current_period_start: new Date((subscription as any).current_period_start * 1000).toISOString(),
    current_period_end: new Date((subscription as any).current_period_end * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }, {
    onConflict: 'stripe_subscription_id',
  })

  console.log('Subscription updated for user:', userId, 'Status:', subscription.status)
}

// Handler: Subscription deleted/cancelled
async function handleSubscriptionDeleted(subscription: any) {
  await supabaseAdmin
    .from('user_subscriptions')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id)

  console.log('Subscription cancelled:', subscription.id)
}

// Handler: Payment failed
async function handlePaymentFailed(invoice: any) {
  const subscriptionId = (invoice as any).subscription as string

  if (subscriptionId) {
    await supabaseAdmin
      .from('user_subscriptions')
      .update({
        status: 'past_due',
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_subscription_id', subscriptionId)

    console.log('Payment failed for subscription:', subscriptionId)
  }
}
