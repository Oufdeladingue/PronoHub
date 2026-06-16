import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'

/**
 * Authentification des crons (GitHub Actions → `Authorization: Bearer ${CRON_SECRET}`).
 *
 * - Comparaison à temps constant (évite l'oracle de timing sur le secret).
 * - Exige que CRON_SECRET soit défini ET non vide (sinon `Bearer undefined` passerait).
 */
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

/** true si l'en-tête Authorization correspond au secret de cron (timing-safe). */
export function isValidCronAuth(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = request.headers.get('authorization') || ''
  return safeEqual(header, `Bearer ${secret}`)
}

/**
 * À appeler en tête d'une route cron. Retourne une NextResponse d'erreur si l'accès est
 * refusé (500 si le secret n'est pas configuré, 401 sinon), ou null si l'accès est autorisé.
 */
export function assertCron(request: Request): NextResponse | null {
  if (!process.env.CRON_SECRET) {
    console.error('[CRON] CRON_SECRET non configuré')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }
  if (!isValidCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}
