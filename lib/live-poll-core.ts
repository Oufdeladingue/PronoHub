import { createAdminClient } from '@/lib/supabase/server'
import { extractFootballDataScores, deriveLiveMinute } from '@/lib/football-data-score'

const FOOTBALL_DATA_API = 'https://api.football-data.org/v4'
// Statuts "en direct" (inclut les phases KO : prolongations + tirs au but).
const LIVE_STATUSES = 'IN_PLAY,PAUSED,EXTRA_TIME,PENALTY_SHOOTOUT'
const MATCH_MAX_MS = 2 * 60 * 60 * 1000 + 15 * 60 * 1000 // 2h15

export interface LivePollResult {
  ok: boolean
  skipped?: string
  live: number
  updated: number
  finalized: number
  errors: string[]
}

type Supa = ReturnType<typeof createAdminClient>

/** Y a-t-il un match dans la fenêtre live (coup d'envoi dans les 3 dernières heures ou imminent) ?
 *  → évite de taper football-data pour rien quand aucun match n'est en cours. */
async function hasLiveWindow(supabase: Supa): Promise<boolean> {
  const lo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
  const hi = new Date(Date.now() + 10 * 60 * 1000).toISOString()
  const { data } = await supabase
    .from('imported_matches')
    .select('id')
    .gte('utc_date', lo)
    .lte('utc_date', hi)
    .limit(1)
  return !!(data && data.length > 0)
}

/** Met à jour les matchs en direct (score, score 90', minute dérivée, statut, vainqueur). */
async function updateLive(supabase: Supa, matches: any[]): Promise<{ updated: number; errors: string[] }> {
  const errors: string[] = []
  let updated = 0
  for (const m of matches) {
    const sc = extractFootballDataScores(m.score)
    const winnerTeamId =
      sc.winnerSide === 'home' ? (m.homeTeam?.id ?? null)
      : sc.winnerSide === 'away' ? (m.awayTeam?.id ?? null)
      : null
    const firstHalfDone = m.score?.halfTime?.home != null
    const minute = deriveLiveMinute(new Date(m.utcDate).getTime(), m.status, m.minute, firstHalfDone)

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

    const { error } = await supabase.from('imported_matches').update(update).eq('football_data_match_id', m.id)
    if (error) errors.push(`${m.id}: ${error.message}`)
    else updated++
  }
  return { updated, errors }
}

/** Finalise les matchs restés "en direct" en base mais disparus du live football-data (terminés)
 *  ET clairement avancés (minute ≥ 85 ou coup d'envoi > 2h15) → FINISHED. */
async function finalizeEnded(supabase: Supa, liveIds: Set<number>): Promise<number> {
  const { data: ours } = await supabase
    .from('imported_matches')
    .select('id, football_data_match_id, live_minute, utc_date')
    .in('status', ['IN_PLAY', 'PAUSED', 'EXTRA_TIME', 'PENALTY_SHOOTOUT'])
  const now = Date.now()
  let finalized = 0
  for (const m of ours || []) {
    if (m.football_data_match_id != null && liveIds.has(m.football_data_match_id)) continue
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

/**
 * UN passage du poller live : 1 appel football-data `/matches?status=...` (tous les matchs live)
 * → met à jour les matchs en direct + finalise ceux qui viennent de se terminer.
 * Gardé léger : ne fait rien si aucun match n'est dans la fenêtre live.
 *
 * Appelé par la boucle interne du serveur (instrumentation.ts, toutes les 30s) ET par la route
 * /api/football/live-poll (déclencheur manuel / de secours).
 */
export async function runLivePoll(): Promise<LivePollResult> {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY
  if (!apiKey) return { ok: false, skipped: 'no-key', live: 0, updated: 0, finalized: 0, errors: [] }

  const supabase = createAdminClient()

  if (!(await hasLiveWindow(supabase))) {
    return { ok: true, skipped: 'no-window', live: 0, updated: 0, finalized: 0, errors: [] }
  }

  let matches: any[] = []
  try {
    const res = await fetch(`${FOOTBALL_DATA_API}/matches?status=${LIVE_STATUSES}`, {
      headers: { 'X-Auth-Token': apiKey },
    })
    if (!res.ok) return { ok: false, skipped: `http-${res.status}`, live: 0, updated: 0, finalized: 0, errors: [`http ${res.status}`] }
    const json = await res.json()
    matches = Array.isArray(json.matches) ? json.matches : []
  } catch (e: any) {
    return { ok: false, skipped: 'fetch-error', live: 0, updated: 0, finalized: 0, errors: [`fetch: ${e?.message || e}`] }
  }

  const { updated, errors } = await updateLive(supabase, matches)
  const finalized = await finalizeEnded(supabase, new Set(matches.map((m) => m.id)))
  return { ok: true, live: matches.length, updated, finalized, errors }
}
