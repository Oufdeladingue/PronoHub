import { NextResponse, NextRequest } from 'next/server'
import { getClientIP } from '@/lib/rate-limit'

/**
 * POST /api/auth/verify-turnstile
 * Vérifie un token Cloudflare Turnstile côté serveur.
 */
export async function POST(request: NextRequest) {
  try {
    const secretKey = process.env.TURNSTILE_SECRET_KEY
    if (!secretKey) {
      // Turnstile non configuré — laisser passer
      return NextResponse.json({ success: true })
    }

    const { token } = await request.json()

    if (!token) {
      return NextResponse.json({ success: false, error: 'Token manquant' }, { status: 400 })
    }

    const clientIP = getClientIP(request)

    const formData = new URLSearchParams()
    formData.append('secret', secretKey)
    formData.append('response', token)
    formData.append('remoteip', clientIP)

    const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    })

    const outcome = await result.json()

    if (!outcome.success) {
      console.warn('[Turnstile] Verification failed:', outcome['error-codes'])
      return NextResponse.json({ success: false, error: 'Vérification échouée' }, { status: 403 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Turnstile] Error:', error)
    // Fail-open : en cas d'erreur, on laisse passer
    return NextResponse.json({ success: true })
  }
}
