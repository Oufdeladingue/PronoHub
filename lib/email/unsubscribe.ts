import crypto from 'crypto'

const SECRET = process.env.CRON_SECRET || process.env.RESEND_API_KEY || 'pronohub-unsubscribe-fallback'

/**
 * Génère un token HMAC pour valider les liens de désabonnement
 * Empêche les désabonnements non autorisés
 */
export function generateUnsubscribeToken(email: string): string {
  const hmac = crypto.createHmac('sha256', SECRET)
  hmac.update(email.toLowerCase())
  return hmac.digest('hex')
}

/**
 * Vérifie un token de désabonnement
 */
export function verifyUnsubscribeToken(email: string, token: string): boolean {
  const expected = generateUnsubscribeToken(email)
  if (expected.length !== token.length) return false
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))
}

/**
 * Génère l'URL de désabonnement pour un email donné
 */
export function getUnsubscribeUrl(email: string): string {
  const token = generateUnsubscribeToken(email)
  const params = new URLSearchParams({ email, token })
  return `https://www.pronohub.club/api/email/unsubscribe?${params.toString()}`
}
