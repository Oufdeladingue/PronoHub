import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { extractFootballDataScores, deriveLiveMinute } from '@/lib/football-data-score'

const FOOTBALL_DATA_API = 'https://api.football-data.org/v4'
// Statuts considérés "en direct" (inclut les phases KO : prolongations + tirs au but).
const LIVE_STATUSES = 'IN_PLAY,PAUSED,EXTRA_TIME,PENALTY_SHOOTOUT'

export const dynamic = 'force-dynamic'
// Mode cycles=2 : un poll, pause 30s, un second poll → cadence 30s depuis un cron 1 min.
export const maxDuration = 60

/**
 * Poller LIVE léger et dédié.
 *
 * UN seul appel football-data `/matches?status=IN_PLAY,PAUSED,EXTRA_TIME,PENALTY_SHOOTOUT`
 * renvoie TOUS les matchs en direct de notre abonnement (toutes compétitions, CDM incluse)
 * — le nombre d'appels ne dépend donc PAS du nombre de matchs. Met à jour les matchs live
 * (score, score à 90', minute, statut, vainqueur) ET finalise ceux qui viennent de se
 * terminer (sinon le dernier match d'une fenêtre reste figé "en direct").
 *
 * Auth cron (Bearer CRON_SECRET). Service role (bypass RLS).
 */
async function pollOnce(
  supabase: ReturnType<typeof createAdminClient>,
  apiKey: string
): Promise<{ ok: boolean; live: number; updated: number; sample: string[]; errors: string[]; liveIds: number[] }> {
  const errors: string[] = []
  const sample: string[] = []

  let res: Response
  try {
    res = await fetch(`${FOOTBALL_DATA_API}/matches?status=${LIVE_STATUSES}`, {
      headers: { 'X-Auth-Token': apiKey },
    })
  } catch (e: any) {
    return { ok: false, live: 0, updated: 0, sample, errors: [`fetch: ${e.message}`], liveIds: [] }
  }
  if (!res.ok) {
    return { ok: false, live: 0, updated: 0, sample, errors: [`http ${res.status}`], liveIds: [] }
  }

  const json = await res.json()
  const matches: any[] = json.matches || []
  const liveIds: number[] = matches.map((m) => m.id)
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

  return { ok: true, live: matches.length, updated, sample, errors, liveIds }
}

/**
 * Finalise les matchs restés "en direct" en base mais qui ne sont PLUS dans le live football-data
 * (donc terminés). Sans ce filet, le dernier match d'une fenêtre reste figé "En direct" : le poller
 * ne le voit plus une fois passé FINISHED côté football-data, et le dispatcher arrête d'appeler
 * auto-update une fois la fenêtre close. Garde anti-transitoire : on ne finalise qu'un match
 * clairement avancé (minute ≥ 85 ou coup d'envoi > 2h15) — un match qui vient de démarrer et
 * disparaît brièvement du live n'est jamais finalisé à tort.
 */
async function finalizeEnded(
  supabase: ReturnType<typeof createAdminClient>,
  liveIds: Set<number>
): Promise<number> {
  const { data: ours } = await supabase
    .from('imported_matches')
    .select('id, football_data_match_id, live_minute, utc_date')
    .in('status', ['IN_PLAY', 'PAUSED', 'EXTRA_TIME', 'PENALTY_SHOOTOUT'])

  const now = Date.now()
  const MATCH_MAX_MS = 2 * 60 * 60 * 1000 + 15 * 60 * 1000 // 2h15
  let finalized = 0

  for (const m of ours || []) {
    if (m.football_data_match_id != null && liveIds.has(m.football_data_match_id)) continue // toujours en direct
    const looksOver = (m.live_minute ?? 0) >= 85 || now - new Date(m.utc_date).getTime() > MATCH_MAX_MS
    if (!looksOver) continue
    const { error } = await supabase
      .from('imported_matches')
      .update({ status: 'FINISHED', finished: true, live_minute: null, last_updated_at: new Date().toISOString() })
      .eq('id', m.id)
    if (!error) finalized++
  }
  return finalized
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
  // Finalisation : uniquement si le dernier fetch a réussi (sinon liveIds partiel → on risquerait
  // de finaliser à tort pendant une panne football-data).
  let finalized = 0
  if (last.ok) {
    finalized = await finalizeEnded(supabase, new Set(last.liveIds))
  }

  return NextResponse.json({
    success: results.every((r) => r.errors.length === 0),
    cycles,
    live: last.live,
    updated: results.reduce((a, r) => a + r.updated, 0),
    finalized,
    sample: last.sample,
    errors: results.flatMap((r) => r.errors),
  })
}
