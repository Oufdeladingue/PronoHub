import { NextResponse } from 'next/server'
import { stripe, isStripeEnabled } from '@/lib/stripe'
import { timingSafeEqual } from 'crypto'

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

/**
 * Route de test pour vérifier la configuration du webhook Stripe
 * Accessible à : /api/stripe/webhook-test
 */
export async function GET(request: Request) {
  // Protéger avec CRON_SECRET (timing-safe)
  const authHeader = request.headers.get('authorization') || ''
  const expected = `Bearer ${process.env.CRON_SECRET}`
  if (!safeCompare(authHeader, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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
