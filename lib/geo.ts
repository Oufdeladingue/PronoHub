import { createAdminClient } from '@/lib/supabase/server'
import { DEFAULT_ALLOWED_COUNTRIES, getCountryByCode } from '@/lib/countries'
import { getClientIP } from '@/lib/rate-limit'

/**
 * Détecte le pays d'une requête via geoip-lite (base locale, 0 appel réseau).
 * Retourne le code ISO 3166-1 alpha-2 ou null si indétectable.
 */
export function detectCountry(request: Request): string | null {
  try {
    const ip = getClientIP(request)
    if (!ip || ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') {
      return null // IP locale → indétectable
    }
    // Dynamic import pour éviter les problèmes de bundling edge
    const geoip = require('geoip-lite')
    const geo = geoip.lookup(ip)
    return geo?.country || null
  } catch {
    return null
  }
}

/**
 * Récupère la liste des pays autorisés depuis admin_settings.
 * Fallback sur DEFAULT_ALLOWED_COUNTRIES si pas de config.
 */
export async function getAllowedCountries(): Promise<string[]> {
  try {
    const supabase = createAdminClient()
    const { data: setting } = await supabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'allowed_countries')
      .single()

    if (setting?.setting_value) {
      const parsed = JSON.parse(setting.setting_value)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {
    // Fallback sur les défauts
  }
  return DEFAULT_ALLOWED_COUNTRIES
}

export interface CountryCheckResult {
  allowed: boolean
  countryCode: string | null
  countryName: string | null
  countryFlag: string | null
  message?: string
}

/**
 * Vérifie si le pays de la requête est autorisé.
 * Fail-closed : si le pays est indétectable, retourne `allowed: false`.
 * Exception : les IPs locales (dev) sont toujours autorisées.
 */
export async function checkCountryAllowed(request: Request): Promise<CountryCheckResult> {
  const ip = getClientIP(request)

  // En local → toujours autorisé
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') {
    return { allowed: true, countryCode: 'FR', countryName: 'France', countryFlag: '🇫🇷' }
  }

  const countryCode = detectCountry(request)

  // Fail-open : pays indétectable → autorisé (évite de bloquer des users légitimes)
  if (!countryCode) {
    return {
      allowed: true,
      countryCode: null,
      countryName: null,
      countryFlag: null,
    }
  }

  const allowedCountries = await getAllowedCountries()
  const allowed = allowedCountries.includes(countryCode)
  const country = getCountryByCode(countryCode)

  return {
    allowed,
    countryCode,
    countryName: country?.name || countryCode,
    countryFlag: country?.flag || null,
    ...(!allowed && {
      message: `PronoHub n'est pas encore disponible dans votre pays (${country?.flag || ''} ${country?.name || countryCode}).`,
    }),
  }
}
