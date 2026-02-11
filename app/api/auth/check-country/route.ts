import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { DEFAULT_ALLOWED_COUNTRIES, getCountryByCode } from '@/lib/countries'

/**
 * GET /api/auth/check-country
 * Vérifie si le pays de l'utilisateur (via IP) est autorisé pour l'inscription.
 * Utilise ip-api.com (gratuit, 45 req/min).
 */
export async function GET(request: NextRequest) {
  try {
    // Récupérer l'IP depuis les headers (reverse proxy / load balancer)
    const forwarded = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    const ip = forwarded?.split(',')[0]?.trim() || realIp || null

    // En local (127.0.0.1, ::1), autoriser par défaut
    if (!ip || ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') {
      return NextResponse.json({
        allowed: true,
        countryCode: 'FR',
        countryName: 'France',
        local: true,
      })
    }

    // Géolocaliser l'IP via ip-api.com
    const geoResponse = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,countryCode,country`,
      { next: { revalidate: 300 } } // Cache 5 min
    )

    if (!geoResponse.ok) {
      // En cas d'erreur API, autoriser par défaut (fail-open)
      return NextResponse.json({
        allowed: true,
        countryCode: null,
        countryName: null,
        error: 'Géolocalisation indisponible',
      })
    }

    const geoData = await geoResponse.json()

    if (geoData.status !== 'success') {
      return NextResponse.json({
        allowed: true,
        countryCode: null,
        countryName: null,
        error: 'Géolocalisation échouée',
      })
    }

    const countryCode = geoData.countryCode as string
    const countryName = geoData.country as string

    // Récupérer la liste des pays autorisés depuis admin_settings
    const supabase = createAdminClient()
    const { data: setting } = await supabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'allowed_countries')
      .single()

    let allowedCountries: string[]
    if (setting?.setting_value) {
      try {
        allowedCountries = JSON.parse(setting.setting_value)
      } catch {
        allowedCountries = DEFAULT_ALLOWED_COUNTRIES
      }
    } else {
      // Pas de config → utiliser les défauts
      allowedCountries = DEFAULT_ALLOWED_COUNTRIES
    }

    const allowed = allowedCountries.includes(countryCode)
    const country = getCountryByCode(countryCode)

    return NextResponse.json({
      allowed,
      countryCode,
      countryName: country?.name || countryName,
      countryFlag: country?.flag || null,
      ...(!allowed && {
        message: `PronoHub n'est pas encore disponible dans votre pays (${country?.flag || ''} ${country?.name || countryName}).`,
      }),
    })
  } catch (error: any) {
    // Fail-open : en cas d'erreur, autoriser
    return NextResponse.json({
      allowed: true,
      countryCode: null,
      countryName: null,
      error: error.message,
    })
  }
}
