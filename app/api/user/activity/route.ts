import { NextResponse, NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { detectCountry } from '@/lib/geo'

/**
 * POST /api/user/activity
 * Met à jour last_seen_at et le pays (via geoip-lite) pour l'utilisateur connecté.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Détecter le pays via geoip-lite (base locale, pas d'appel réseau)
    const country = detectCountry(request)

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
