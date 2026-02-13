import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const start = Date.now()
  const checks: Record<string, { status: string; latency?: number }> = {}

  // Check Supabase connectivity
  try {
    const dbStart = Date.now()
    const supabase = createAdminClient()
    const { error } = await supabase.from('profiles').select('id').limit(1)
    checks.database = {
      status: error ? 'unhealthy' : 'healthy',
      latency: Date.now() - dbStart,
    }
  } catch {
    checks.database = { status: 'unhealthy' }
  }

  const allHealthy = Object.values(checks).every((c) => c.status === 'healthy')

  return NextResponse.json(
    {
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: allHealthy ? 200 : 503 }
  )
}
