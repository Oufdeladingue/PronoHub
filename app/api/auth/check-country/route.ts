import { NextRequest, NextResponse } from 'next/server'
import { checkCountryAllowed } from '@/lib/geo'

/**
 * GET /api/auth/check-country
 * Vérifie si le pays de l'utilisateur (via IP + geoip-lite) est autorisé.
 * Fail-closed : si le pays est indétectable, l'inscription est bloquée.
 */
export async function GET(request: NextRequest) {
  const result = await checkCountryAllowed(request)
  return NextResponse.json(result)
}
