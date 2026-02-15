/**
 * Détection d'emails jetables/temporaires.
 * Utilise le package `disposable-email-domains` (121 500+ domaines).
 */
import domains from 'disposable-email-domains'

const DISPOSABLE_SET = new Set(domains)

/**
 * Vérifie si un email utilise un domaine jetable
 */
export function isDisposableEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase()
  return domain ? DISPOSABLE_SET.has(domain) : false
}
