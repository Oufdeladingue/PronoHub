import { NextResponse } from 'next/server'
import { stripe, isStripeEnabled } from '@/lib/stripe'

/**
 * Route de test pour vérifier la configuration du webhook Stripe
 * Accessible à : /api/stripe/webhook-test
 */
export async function GET() {
  const checks = {
    stripeEnabled: isStripeEnabled,
    stripeInstance: !!stripe,
    webhookSecretConfigured: !!process.env.STRIPE_WEBHOOK_SECRET,
    supabaseUrlConfigured: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseServiceRoleConfigured: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  }

  const allChecksPass = Object.values(checks).every(Boolean)

  return NextResponse.json({
    status: allChecksPass ? 'OK' : 'CONFIGURATION_ERROR',
    checks,
    message: allChecksPass
      ? 'Webhook configuration is valid'
      : 'Some required environment variables are missing',
    timestamp: new Date().toISOString(),
  }, {
    status: allChecksPass ? 200 : 500
  })
}
