import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { patchStaleScoresWithApiFootball } from '@/lib/api-football-fallback'

/**
 * Endpoint pour lancer manuellement le fallback API-Football
 * GET ou POST /api/football/fallback-scores?force=true
 *
 * Force le fallback même si le cooldown n'est pas passé (bypass via ?force=true)
 */
export async function GET(request: Request) {
  return handleFallback(request)
}

export async function POST(request: Request) {
  return handleFallback(request)
}

async function handleFallback(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const force = searchParams.get('force') === 'true'

    // Si force, reset le timestamp de dernière exécution
    if (force) {
      const supabase = createAdminClient()
      await supabase
        .from('admin_settings')
        .delete()
        .eq('setting_key', 'api_football_last_fallback_run')

      console.log('[FALLBACK] Force mode: cooldown reset')
    }

    const startTime = Date.now()
    const result = await patchStaleScoresWithApiFootball()
    const executionTimeMs = Date.now() - startTime

    return NextResponse.json({
      ...result,
      executionTimeMs,
      forced: force,
    })
  } catch (error: any) {
    console.error('[FALLBACK] Error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
