/**
 * Rate limiting simple en mémoire
 * Note: En production avec plusieurs instances, utiliser Redis (Upstash)
 * Pour Vercel avec une seule instance, cette solution fonctionne
 */

interface RateLimitEntry {
  count: number
  resetTime: number
}

// Store en mémoire - réinitialisé à chaque déploiement
const rateLimitStore = new Map<string, RateLimitEntry>()

// Nettoyage périodique des entrées expirées
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key)
    }
  }
}, 60000) // Nettoyer chaque minute

interface RateLimitConfig {
  /** Nombre maximum de requêtes */
  limit: number
  /** Fenêtre de temps en millisecondes */
  windowMs: number
}

interface RateLimitResult {
  success: boolean
  remaining: number
  resetTime: number
}

/**
 * Vérifie et incrémente le rate limit pour une clé donnée
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now()
  const entry = rateLimitStore.get(key)

  // Nouvelle entrée ou entrée expirée
  if (!entry || entry.resetTime < now) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetTime: now + config.windowMs,
    }
    rateLimitStore.set(key, newEntry)
    return {
      success: true,
      remaining: config.limit - 1,
      resetTime: newEntry.resetTime,
    }
  }

  // Incrémenter le compteur
  entry.count++

  // Vérifier si limite atteinte
  if (entry.count > config.limit) {
    return {
      success: false,
      remaining: 0,
      resetTime: entry.resetTime,
    }
  }

  return {
    success: true,
    remaining: config.limit - entry.count,
    resetTime: entry.resetTime,
  }
}

/**
 * Configurations prédéfinies par type d'endpoint
 */
export const RATE_LIMITS = {
  // Login: 5 tentatives par minute par IP
  login: { limit: 5, windowMs: 60 * 1000 },
  // API générale: 100 requêtes par minute par IP
  api: { limit: 100, windowMs: 60 * 1000 },
  // Création de ressources: 10 par minute par utilisateur
  create: { limit: 10, windowMs: 60 * 1000 },
  // Stripe checkout: 3 par minute par utilisateur
  checkout: { limit: 3, windowMs: 60 * 1000 },
}

/**
 * Extrait l'IP du client depuis les headers
 * Priorité : Cloudflare > x-forwarded-for > x-real-ip > fallback
 */
export function getClientIP(request: Request): string {
  // Cloudflare fournit la vraie IP du client
  const cfIP = request.headers.get('cf-connecting-ip')
  if (cfIP) {
    return cfIP
  }
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  const realIP = request.headers.get('x-real-ip')
  if (realIP) {
    return realIP
  }
  return '127.0.0.1'
}
