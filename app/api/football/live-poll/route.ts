import { NextResponse } from 'next/server'
import { runLivePoll } from '@/lib/live-poll-core'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Déclencheur MANUEL / de secours du poller live.
 *
 * Le poller PRINCIPAL est désormais une boucle interne au serveur Next (voir instrumentation.ts)
 * qui appelle football-data toutes les 30 s tant que l'app tourne — aucun cron, aucun pg_net,
 * aucun service externe. Cette route reste disponible pour déclencher un passage à la main
 * (debug, vérification) ou en secours. `cycles=2` = un poll, pause 30 s, un second poll.
 *
 * Auth cron (Bearer CRON_SECRET). Le cœur tourne en service role (bypass RLS).
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const cycles = Math.min(2, Math.max(1, parseInt(searchParams.get('cycles') || '1')))

  const results = []
  for (let i = 0; i < cycles; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 30_000))
    results.push(await runLivePoll())
  }

  const last = results[results.length - 1]
  return NextResponse.json({
    success: results.every((r) => r.errors.length === 0),
    cycles,
    live: last.live,
    updated: results.reduce((a, r) => a + r.updated, 0),
    finalized: results.reduce((a, r) => a + r.finalized, 0),
    skipped: last.skipped,
    errors: results.flatMap((r) => r.errors),
  })
}
