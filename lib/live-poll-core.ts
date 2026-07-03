import { createAdminClient } from '@/lib/supabase/server'
import { extractFootballDataScores, deriveLiveMinute } from '@/lib/football-data-score'

const FOOTBALL_DATA_API = 'https://api.football-data.org/v4'
// Statuts acceptés par football-data dans /matches?status= : UNIQUEMENT IN_PLAY et PAUSED (mi-temps).
// ⚠️ EXTRA_TIME / PENALTY_SHOOTOUT N'EXISTENT PAS dans l'enum football-data (les prolongations/TAB
// restent en IN_PLAY) → les mettre dans le filtre renvoie HTTP 400 et casse TOUT le live.
const FETCH_LIVE_STATUSES = 'IN_PLAY,PAUSED'
// Statuts "en direct" stockés en base (peut contenir EXTRA_TIME/PENALTY_SHOOTOUT venus d'autres sources).
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

// --- Ancrage de la minute live (en mémoire, process unique) ---
// football-data ne fournit PAS la minute (cf. football-data-score.ts) : seulement le statut + le
// score halfTime. La 1re période s'estime correctement depuis le coup d'envoi ; le vrai problème,
// c'est la 2e période (pause ~15 min + arrêts de jeu décalent l'estimation théorique). On ANCRE
// donc la 2e période sur sa reprise RÉELLEMENT observée au poll (transition PAUSED→IN_PLAY) →
// précision ~±30s (l'intervalle de poll). Repli sur deriveLiveMinute si la reprise n'a pas été
// observée (conteneur redémarré en pleine 2e MT, trou de feed). Clés = id football-data du match.
//
// NB : on ne poll QUE les statuts IN_PLAY/PAUSED → on ne voit jamais un match en TIMED, donc on ne
// peut pas ancrer le coup d'envoi sur transition ; la 1re MT reste estimée (suffisant), seule la
// 2e MT (le point sensible) est ancrée.
const secondHalfStartMs = new Map<number, number>()
const prevStatusById = new Map<number, string>()

/** Oublie les ancres des matchs qui ne sont plus dans le flux live (anti-fuite mémoire). */
function pruneAnchors(liveIds: Set<number>) {
  for (const id of prevStatusById.keys()) if (!liveIds.has(id)) prevStatusById.delete(id)
  for (const id of secondHalfStartMs.keys()) if (!liveIds.has(id)) secondHalfStartMs.delete(id)
}

/** Minute live : 2e période ancrée sur la reprise observée ; sinon estimation (deriveLiveMinute). */
function computeLiveMinute(m: any): number | null {
  const id: number = m.id
  const now = Date.now()
  const kickoffMs = new Date(m.utcDate).getTime()
  const prev = prevStatusById.get(id)
  // "Collant" : une fois la 2e MT ancrée, un trou de feed (halfTime qui redevient null) ne la défait pas.
  const inSecondHalf = m.score?.halfTime?.home != null || secondHalfStartMs.has(id)

  // Ancre la reprise réelle de la 2e période (mi-temps observée au poll précédent).
  if (m.status === 'IN_PLAY' && inSecondHalf && prev === 'PAUSED' && !secondHalfStartMs.has(id)) {
    secondHalfStartMs.set(id, now)
  }
  prevStatusById.set(id, m.status)

  if (m.status === 'PAUSED') return 45 // mi-temps
  if (m.status === 'IN_PLAY' && secondHalfStartMs.has(id)) {
    // Démarre à 46 (cohérent avec deriveMatchPhase `> 45` ⇒ "2e MT", et avec le repli max(46,…)).
    return Math.min(46 + Math.floor((now - secondHalfStartMs.get(id)!) / 60000), 90)
  }
  // Repli : 1re période estimée depuis le coup d'envoi, ou 2e MT non observée (restart/feed gap).
  return deriveLiveMinute(kickoffMs, m.status, m.minute, inSecondHalf)
}

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
    const minute = computeLiveMinute(m)

    const update: Record<string, any> = {
      status: m.status,
      live_minute: minute,
      last_updated_at: new Date().toISOString(),
    }
    if (sc.home_score != null) update.home_score = sc.home_score
    if (sc.away_score != null) update.away_score = sc.away_score
    if (sc.home_score_90 != null) update.home_score_90 = sc.home_score_90
    if (sc.away_score_90 != null) update.away_score_90 = sc.away_score_90
    // ⚠️ On ne pose JAMAIS winner_team_id pendant le live : le qualifié n'est réel/définitif qu'à la
    // fin COMPLÈTE du match (prolongations + TAB inclus). football-data peut renvoyer un `winner`
    // provisoire (équipe menant) pendant IN_PLAY → l'appliquer attribuerait un point qualifié
    // temporaire aux users. winner_team_id n'est donc posé qu'à la finalisation (finalizeEnded).

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
async function finalizeEnded(supabase: Supa, liveIds: Set<number>, apiKey: string): Promise<number> {
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

    // Récupère les données FINALES du match (score + vainqueur) AVANT de finaliser. Indispensable
    // pour les phases KO décidées en prolongation / tirs au but : le vainqueur n'est connu qu'à la
    // toute fin, APRÈS que le match a quitté le flux live → sans ce fetch, winner_team_id resterait
    // vide/faux jusqu'au refresh complet quotidien (= classements faux toute la nuit).
    const update: Record<string, any> = { status: 'FINISHED', finished: true, live_minute: null, last_updated_at: new Date().toISOString() }
    if (m.football_data_match_id != null) {
      try {
        const res = await fetch(`${FOOTBALL_DATA_API}/matches/${m.football_data_match_id}`, {
          headers: { 'X-Auth-Token': apiKey },
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        })
        if (res.ok) {
          const md = await res.json()
          // Si la source ne dit PAS encore FINISHED (trou de feed ponctuel, match en réalité encore
          // en cours), on NE finalise PAS prématurément → réessai au prochain tick (toutes les 30s).
          // Garde anti-blocage : passé le plafond dur (3h30), on finalise quand même au temps.
          if (md.status && md.status !== 'FINISHED' && md.status !== 'AWARDED' && koAge < KNOCKOUT_MAX_MS) continue
          const sc = extractFootballDataScores(md.score)
          const winnerTeamId =
            sc.winnerSide === 'home' ? (md.homeTeam?.id ?? null)
            : sc.winnerSide === 'away' ? (md.awayTeam?.id ?? null)
            : null
          if (sc.home_score != null) update.home_score = sc.home_score
          if (sc.away_score != null) update.away_score = sc.away_score
          if (sc.home_score_90 != null) update.home_score_90 = sc.home_score_90
          if (sc.away_score_90 != null) update.away_score_90 = sc.away_score_90
          if (winnerTeamId != null) update.winner_team_id = winnerTeamId
        }
        // res non-ok (rate limit / erreur) → on finalise quand même au temps (filet) ; le vainqueur
        // sera corrigé au refresh complet. Mieux vaut un match FINISHED qu'un live coincé.
      } catch {
        // réseau KO → finalisation au temps, sans vainqueur (corrigé au refresh complet quotidien).
      }
    }
    const { error } = await supabase.from('imported_matches').update(update).eq('id', m.id)
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

  // Heartbeat : preuve de vie de la boucle interne, lisible à tout moment (monitoring) sans logs
  // ni match live. Doit avancer ~toutes les 30 s tant que le serveur tourne.
  await supabase
    .from('admin_settings')
    .update({ setting_value: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('setting_key', 'live_poll_heartbeat')

  if (!(await shouldPoll(supabase))) {
    return { ok: true, skipped: 'no-window', live: 0, updated: 0, finalized: 0, sample: [], errors: [] }
  }

  let matches: any[] = []
  try {
    const res = await fetch(`${FOOTBALL_DATA_API}/matches?status=${FETCH_LIVE_STATUSES}`, {
      headers: { 'X-Auth-Token': apiKey },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!res.ok) return { ok: false, skipped: `http-${res.status}`, live: 0, updated: 0, finalized: 0, sample: [], errors: [`http ${res.status}`] }
    const json = await res.json()
    matches = Array.isArray(json.matches) ? json.matches : []
  } catch (e: any) {
    return { ok: false, skipped: 'fetch-error', live: 0, updated: 0, finalized: 0, sample: [], errors: [`fetch: ${e?.message || e}`] }
  }

  const liveIds = new Set<number>(matches.map((m) => m.id))
  const { updated, sample, errors } = await updateLive(supabase, matches)
  const finalized = await finalizeEnded(supabase, liveIds, apiKey)
  pruneAnchors(liveIds) // libère les ancres des matchs qui ne sont plus live
  return { ok: true, live: matches.length, updated, finalized, sample, errors }
}
