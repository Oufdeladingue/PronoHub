import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { extractFootballDataScores, deriveLiveMinute } from '@/lib/football-data-score'

const FOOTBALL_DATA_API = 'https://api.football-data.org/v4'

export const dynamic = 'force-dynamic'
// Mode cycles=2 : un poll, pause 30s, un second poll → cadence 30s depuis un cron 1 min.
export const maxDuration = 60

/**
 * Poller LIVE léger et dédié.
 *
 * UN seul appel football-data `/matches?status=IN_PLAY,PAUSED` renvoie TOUS les matchs
 * en direct de notre abonnement (toutes compétitions, CDM incluse) — le nombre d'appels
 * ne dépend donc PAS du nombre de matchs. Met à jour uniquement les matchs live
 * (score, score à 90', minute, statut, vainqueur). Ne fait PAS de full-sync ni de
 * finalisation : c'est le rôle d'auto-update (cadence lente).
 *
 * Auth cron (Bearer CRON_SECRET). Service role (bypass RLS).
 */
async function pollOnce(
  supabase: ReturnType<typeof createAdminClient>,
  apiKey: string
): Promise<{ live: number; updated: number; sample: string[]; errors: string[] }> {
  const errors: string[] = []
  const sample: string[] = []

  let res: Response
  try {
    res = await fetch(`${FOOTBALL_DATA_API}/matches?status=IN_PLAY,PAUSED`, {
      headers: { 'X-Auth-Token': apiKey },
    })
  } catch (e: any) {
    return { live: 0, updated: 0, sample, errors: [`fetch: ${e.message}`] }
  }
  if (!res.ok) {
    return { live: 0, updated: 0, sample, errors: [`http ${res.status}`] }
  }

  const json = await res.json()
  const matches: any[] = json.matches || []
  let updated = 0

  for (const m of matches) {
    const sc = extractFootballDataScores(m.score)
    const winnerTeamId =
      sc.winnerSide === 'home' ? (m.homeTeam?.id ?? null)
      : sc.winnerSide === 'away' ? (m.awayTeam?.id ?? null)
      : null

    // Minute dérivée : football-data ne peuple pas son champ `minute` → on la calcule
    // depuis le coup d'envoi + le statut (+ halfTime pour fiabiliser la 2e période).
    const firstHalfDone = m.score?.halfTime?.home != null
    const minute = deriveLiveMinute(new Date(m.utcDate).getTime(), m.status, m.minute, firstHalfDone)

    // Ne jamais écraser un score existant avec null (football-data peut renvoyer null en plein live)
    const update: Record<string, any> = {
      status: m.status,
      live_minute: minute,
      last_updated_at: new Date().toISOString(),
    }
    if (sc.home_score != null) update.home_score = sc.home_score
    if (sc.away_score != null) update.away_score = sc.away_score
    if (sc.home_score_90 != null) update.home_score_90 = sc.home_score_90
    if (sc.away_score_90 != null) update.away_score_90 = sc.away_score_90
    if (winnerTeamId != null) update.winner_team_id = winnerTeamId

    const { error } = await supabase
      .from('imported_matches')
      .update(update)
      .eq('football_data_match_id', m.id)

    if (error) errors.push(`${m.id}: ${error.message}`)
    else {
      updated++
      sample.push(`${m.homeTeam?.name} ${sc.home_score ?? '-'}-${sc.away_score ?? '-'} ${m.awayTeam?.name} [${m.status} ${minute ?? '∅'}']`)
    }
  }

  return { live: matches.length, updated, sample, errors }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.FOOTBALL_DATA_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Football Data API key not configured' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  // cycles=2 + interval 30s → un poll toutes les 30s sur 1 min (pour un cron 1 min)
  const cycles = Math.min(2, Math.max(1, parseInt(searchParams.get('cycles') || '1')))
  const intervalMs = 30_000

  const supabase = createAdminClient()
  const results: Awaited<ReturnType<typeof pollOnce>>[] = []
  for (let i = 0; i < cycles; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, intervalMs))
    results.push(await pollOnce(supabase, apiKey))
  }

  const last = results[results.length - 1]
  return NextResponse.json({
    success: results.every((r) => r.errors.length === 0),
    cycles,
    live: last.live,
    updated: results.reduce((a, r) => a + r.updated, 0),
    sample: last.sample,
    errors: results.flatMap((r) => r.errors),
  })
}
