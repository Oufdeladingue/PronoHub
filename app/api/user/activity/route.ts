import { NextResponse, NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getClientIP } from '@/lib/rate-limit'

/**
 * POST /api/user/activity
 * Met à jour last_seen_at et le pays (via géolocalisation IP) pour l'utilisateur connecté.
 * Throttled côté client pour éviter trop de requêtes.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Détecter le pays via IP (non-bloquant : si geoip échoue, on continue)
    let country: string | null = null
    try {
      const clientIP = getClientIP(request)
      const geoip = await import('geoip-lite').then(m => m.default || m)
      const geo = geoip.lookup(clientIP)
      country = geo?.country || null
    } catch {
      // geoip-lite non disponible ou erreur — on continue sans le pays
    }

    // Mettre à jour last_seen_at + country
    const updateData: Record<string, any> = {
      last_seen_at: new Date().toISOString()
    }
    if (country) {
      updateData.country = country
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', user.id)

    if (updateError) {
      console.error('[Activity] Error updating last_seen_at:', updateError)
      return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Activity] Unexpected error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
