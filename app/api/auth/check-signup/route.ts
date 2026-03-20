import { NextResponse, NextRequest } from 'next/server'
import { checkRateLimit, RATE_LIMITS, getClientIP } from '@/lib/rate-limit'
import { isDisposableEmail } from '@/lib/disposable-emails'

/**
 * POST /api/auth/check-signup
 * Pré-vérification avant inscription : rate limit + email jetable.
 * Appelé côté client AVANT supabase.auth.signUp().
 */
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    // Rate limit par IP
    const clientIP = getClientIP(request)
    const rateLimitResult = checkRateLimit(`signup:${clientIP}`, RATE_LIMITS.signup)

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { allowed: false, reason: 'Trop de tentatives d\'inscription. Réessayez plus tard.' },
        { status: 429 }
      )
    }

    // Vérification email jetable côté serveur (double protection)
    if (email && isDisposableEmail(email)) {
      return NextResponse.json(
        { allowed: false, reason: 'Les adresses email temporaires ne sont pas acceptées.' },
        { status: 400 }
      )
    }

    return NextResponse.json({ allowed: true })
  } catch {
    return NextResponse.json({ allowed: false, reason: 'Erreur de vérification.' }, { status: 500 })
  }
}
