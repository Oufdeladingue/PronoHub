import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe, getBaseUrl } from '@/lib/stripe'

// GET /api/stripe/portal
// Redirige vers le portail client Stripe pour gérer l'abonnement
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

    // Récupérer le customer ID
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .not('stripe_customer_id', 'is', null)
      .single()

    if (!subscription?.stripe_customer_id) {
      return NextResponse.json(
        { success: false, error: 'Aucun abonnement trouvé' },
        { status: 404 }
      )
    }

    // Créer une session de portail client
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${getBaseUrl()}/dashboard/settings`,
    })

    return NextResponse.json({
      success: true,
      url: portalSession.url,
    })

  } catch (error: any) {
    console.error('Stripe portal error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Erreur lors de l\'accès au portail' },
      { status: 500 }
    )
  }
}
