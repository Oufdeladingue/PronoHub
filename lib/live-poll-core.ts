import { createAdminClient } from '@/lib/supabase/server'
import { extractFootballDataScores, deriveLiveMinute } from '@/lib/football-data-score'

const FOOTBALL_DATA_API = 'https://api.football-data.org/v4'
// Statuts "en direct" (inclut les phases KO : prolongations + tirs au but).
const LIVE_STATUSES = 'IN_PLAY,PAUSED,EXTRA_TIME,PENALTY_SHOOTOUT'
const LIVE_STATUS_LIST = ['IN_PLAY', 'PAUSED', 'EXTRA_TIME', 'PENALTY_SHOOTOUT']
const MATCH_MAX_MS = 2 * 60 * 60 * 1000 + 15 * 60 * 1000 // 2h15 (temps réglementaire large)
const KNOCKOUT_MAX_MS = 3.5 * 60 * 60 * 1000 // 3h30 : couvre prolongations + tirs au but
const FETCH_TIMEOUT_MS = 15_000 // < intervalle 30s → un tick reste borné

export interface LivePollResult {
  ok: boolean
  skipped?: string
  live: number
  updated: number
  finalized: number
  sample: string[]
  errors: string[]
}

type Supa = ReturnType<typeof createAdminClient>

/** Faut-il faire tourner le poll ? Vrai si (a) un match a son coup d'envoi récent/imminent
 *  OU (b) un match est resté "en direct" en base (à mettre à jour / finaliser). Sans (b),
 *  un match coincé hors de la fenêtre temps ne serait jamais finalisé. */
async function shouldPoll(supabase: Supa): Promise<boolean> {
  const lo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
  const hi = new Date(Date.now() + 10 * 60 * 1000).toISOString()
  const { data: timeWin } = await supabase
    .from('imported_matches')
    .select('id')
    .gte('utc_date', lo)
    .lte('utc_date', hi)
    .limit(1)
  if (timeWin && timeWin.length) return true
  // Filet : un match resté "en direct" en base garde le poller actif jusqu'à finalisation.
  const { data: stuck } = await supabase
    .from('imported_matches')
    .select('id')
    .in('status', LIVE_STATUS_LIST)
    .limit(1)
  return !!(stuck && stuck.length)
}

/** Met à jour les matchs en direct (score, score 90', minute dérivée, statut, vainqueur). */
async function updateLive(supabase: Supa, matches: any[]): Promise<{ updated: number; sample: string[]; errors: string[] }> {
  const errors: string[] = []
  const sample: string[] = []
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
    else {
      updated++
      sample.push(`${m.homeTeam?.name} ${sc.home_score ?? '-'}-${sc.away_score ?? '-'} ${m.awayTeam?.name} [${m.status} ${minute ?? '∅'}']`)
    }
  }
  return { updated, sample, errors }
}

/** Finalise les matchs restés "en direct" en base mais disparus du live football-data (terminés).
 *  Garde anti-transitoire : on ne finalise qu'un match clairement avancé. Les phases KO
 *  (prolongations / tirs au but) ne sont JAMAIS finalisées sur une simple disparition du feed —
 *  uniquement via un plafond temps très large (3h30) — pour ne pas couper un suivi de TAB sur un
 *  trou réseau ponctuel de la source. */
async function finalizeEnded(supabase: Supa, liveIds: Set<number>): Promise<number> {
  const { data: ours } = await supabase
    .from('imported_matches')
    .select('id, football_data_match_id, live_minute, utc_date, status')
    .in('status', LIVE_STATUS_LIST)
  const now = Date.now()
  let finalized = 0
  for (const m of ours || []) {
    if (m.football_data_match_id != null && liveIds.has(m.football_data_match_id)) continue // toujours en direct
    const koAge = now - new Date(m.utc_date).getTime()
    const isKnockout = m.status === 'EXTRA_TIME' || m.status === 'PENALTY_SHOOTOUT'
    const looksOver = isKnockout
      ? koAge > KNOCKOUT_MAX_MS
      : (m.live_minute ?? 0) >= 85 || koAge > MATCH_MAX_MS
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
 * Gardé léger : ne fait rien si aucun match n'est en cours / coincé. Le fetch est borné (15s).
 *
 * Appelé par la boucle interne du serveur (instrumentation.ts, toutes les 30s) ET par la route
 * /api/football/live-poll (déclencheur manuel / de secours).
 */
export async function runLivePoll(): Promise<LivePollResult> {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY
  if (!apiKey) return { ok: false, skipped: 'no-key', live: 0, updated: 0, finalized: 0, sample: [], errors: [] }

  const supabase = createAdminClient()

  if (!(await shouldPoll(supabase))) {
    return { ok: true, skipped: 'no-window', live: 0, updated: 0, finalized: 0, sample: [], errors: [] }
  }

  let matches: any[] = []
  try {
    const res = await fetch(`${FOOTBALL_DATA_API}/matches?status=${LIVE_STATUSES}`, {
      headers: { 'X-Auth-Token': apiKey },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!res.ok) return { ok: false, skipped: `http-${res.status}`, live: 0, updated: 0, finalized: 0, sample: [], errors: [`http ${res.status}`] }
    const json = await res.json()
    matches = Array.isArray(json.matches) ? json.matches : []
  } catch (e: any) {
    return { ok: false, skipped: 'fetch-error', live: 0, updated: 0, finalized: 0, sample: [], errors: [`fetch: ${e?.message || e}`] }
  }

  const { updated, sample, errors } = await updateLive(supabase, matches)
  const finalized = await finalizeEnded(supabase, new Set(matches.map((m) => m.id)))
  return { ok: true, live: matches.length, updated, finalized, sample, errors }
}
