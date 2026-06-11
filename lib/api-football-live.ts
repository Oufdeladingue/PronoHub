/**
 * API-Football Live Fallback — Coupe du Monde
 *
 * football-data.org (tier gratuit) laisse les matchs de Coupe du Monde (compétition 2000)
 * en statut `TIMED` avec scores `null` même en plein match, et native-stats.org / TheSportsDB
 * ne couvrent pas la CDM. Résultat : aucun badge live, aucun score live, aucun point live.
 *
 * API-Football (api-sports.io) couvre la CDM en temps réel. Son endpoint `fixtures?live=all`
 * reste accessible même en plan GRATUIT (contrairement aux requêtes par saison, bloquées).
 * Ce helper récupère les matchs CDM en direct et patche imported_matches (statut + scores).
 *
 * IMPORTANT : doit s'exécuter APRÈS l'upsert football-data dans le même run d'auto-update,
 * sinon le statut `TIMED` de football-data réécrase le live (cf. auto-update/route.ts).
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/server'
import { transformStatus } from '@/lib/api-football-adapter'

const API_BASE = 'https://v3.football.api-sports.io'

// IDs football-data (en base) des compétitions à patcher via API-Football
const WC_COMPETITION_IDS = [2000]
// ID de league API-Football correspondant (Coupe du Monde = 1)
const WC_API_FOOTBALL_LEAGUE = 1

// Marge de sécurité sous la limite de 100 requêtes/jour du plan gratuit
const DAILY_QUOTA_CAP = 90

// Un match qui n'apparaît plus dans live=all et dont le coup d'envoi remonte à
// plus de 2h15 est considéré terminé (durée max d'un match réglementaire + marge).
const MATCH_DURATION_MS = 2 * 60 * 60 * 1000 + 15 * 60 * 1000

export interface ApiFootballLiveResult {
  patched: number
  finalized: number
  apiCalls: number
  skipped?: string
  errors: string[]
}

/** Normalise un nom d'équipe nationale pour le matching inter-fournisseurs. */
function normalize(name: string): string {
  return (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // accents
    .replace(/[^a-z0-9]/g, '')
    .trim()
}

// Alias pour les noms divergents entre football-data et API-Football (CDM)
const TEAM_ALIASES: Record<string, string> = {
  southkorea: 'korearepublic',
  korearepublic: 'southkorea',
  ir: 'iran',
  iranislamicrepublic: 'iran',
  usa: 'unitedstates',
  unitedstatesofamerica: 'unitedstates',
  ivorycoast: 'cotedivoire',
  capeverde: 'caboverde',
}

function teamsMatch(a: string, b: string): boolean {
  const na = normalize(a)
  const nb = normalize(b)
  if (na === nb) return true
  if (TEAM_ALIASES[na] === nb || TEAM_ALIASES[nb] === na) return true
  if (na.length >= 4 && nb.length >= 4 && (na.includes(nb) || nb.includes(na))) return true
  return false
}

/**
 * Patche les matchs CDM en direct depuis API-Football (endpoint live=all).
 * N'effectue AUCUN appel API si aucun match CDM n'est dans sa fenêtre de jeu
 * (coup d'envoi entre -4h et +10min), pour préserver le quota.
 */
export async function patchLiveWorldCupWithApiFootball(
  supabaseClient?: SupabaseClient
): Promise<ApiFootballLiveResult> {
  const supabase = supabaseClient || createAdminClient()
  const result: ApiFootballLiveResult = { patched: 0, finalized: 0, apiCalls: 0, errors: [] }

  const apiKey = process.env.API_FOOTBALL_KEY
  if (!apiKey) {
    result.skipped = 'no-api-key'
    return result
  }

  // 1. Candidats : matchs CDM "live à l'horloge" (coup d'envoi récent, pas encore FINISHED)
  const now = Date.now()
  const fourHoursAgo = new Date(now - 4 * 60 * 60 * 1000).toISOString()
  const tenMinAhead = new Date(now + 10 * 60 * 1000).toISOString()

  const { data: candidates, error: candErr } = await supabase
    .from('imported_matches')
    .select('id, football_data_match_id, competition_id, stage, home_team_id, away_team_id, home_team_name, away_team_name, utc_date, status, home_score, away_score, live_minute')
    .in('competition_id', WC_COMPETITION_IDS)
    .in('status', ['TIMED', 'IN_PLAY', 'PAUSED'])
    .gt('utc_date', fourHoursAgo)
    .lt('utc_date', tenMinAhead)

  if (candErr) {
    result.errors.push(`candidates: ${candErr.message}`)
    return result
  }
  if (!candidates || candidates.length === 0) {
    result.skipped = 'no-live-candidates'
    return result
  }

  // 2. Garde-fou quota (admin client → bypass RLS, comptage fiable en contexte cron)
  const today = new Date().toISOString().split('T')[0]
  const { count } = await supabase
    .from('api_request_logs')
    .select('*', { count: 'exact', head: true })
    .eq('request_date', today)
  if ((count || 0) >= DAILY_QUOTA_CAP) {
    result.skipped = `quota-cap (${count}/${DAILY_QUOTA_CAP})`
    return result
  }

  // 3. Un seul appel : tous les matchs CDM en direct
  const startedAt = Date.now()
  let liveFixtures: any[] = []
  let apiOk = false
  let statusCode: number | undefined
  try {
    const res = await fetch(`${API_BASE}/fixtures?live=all&league=${WC_API_FOOTBALL_LEAGUE}`, {
      headers: { 'x-rapidapi-key': apiKey, 'x-rapidapi-host': 'v3.football.api-sports.io' },
    })
    statusCode = res.status
    apiOk = res.ok
    if (res.ok) {
      const json = await res.json()
      liveFixtures = Array.isArray(json.response) ? json.response : []
    }
  } catch (e: any) {
    result.errors.push(`fetch: ${e.message}`)
  }
  result.apiCalls = 1

  // Logger l'appel pour le suivi de quota
  try {
    await supabase.from('api_request_logs').insert({
      request_date: today,
      endpoint: '/fixtures?live=all',
      competition_id: WC_API_FOOTBALL_LEAGUE,
      method: 'GET',
      status_code: statusCode,
      success: apiOk,
      response_time_ms: Date.now() - startedAt,
    })
  } catch {
    // logging best-effort
  }

  if (!apiOk) {
    result.skipped = `api-error (${statusCode})`
    return result
  }

  // 4. Associer chaque candidat à un match live, sinon finaliser si nécessaire
  for (const m of candidates) {
    const koTime = new Date(m.utc_date).getTime()

    const fixture = liveFixtures.find((f) => {
      const teamsOk =
        teamsMatch(m.home_team_name, f.teams?.home?.name) &&
        teamsMatch(m.away_team_name, f.teams?.away?.name)
      const timeOk = Math.abs(new Date(f.fixture?.date).getTime() - koTime) < 20 * 60 * 1000
      return teamsOk && timeOk
    })

    if (fixture) {
      const newStatus = transformStatus(fixture.fixture?.status?.short)
      // goals = score affiché en direct (inclut prolongations une fois jouées)
      const homeScore = fixture.goals?.home ?? null
      const awayScore = fixture.goals?.away ?? null
      // score.fulltime = score à l'issue du temps réglementaire (90 min, HORS prolongations/TAB).
      // Rempli par API-Football dès que le match entre en prolongation → base de calcul des
      // points pour les matchs à élimination directe (cf. home_score_90 dans OppositionClient).
      const ft = fixture.score?.fulltime || {}

      const update: Record<string, any> = {
        status: newStatus,
        finished: newStatus === 'FINISHED',
        home_score: homeScore,
        away_score: awayScore,
        last_updated_at: new Date().toISOString(),
      }
      // Score à 90 min (référence de points pour les phases à élimination directe)
      if (ft.home != null && ft.away != null) {
        update.home_score_90 = ft.home
        update.away_score_90 = ft.away
      }
      // Qualifié (bonus +1) : mapper le vainqueur API-Football sur les IDs football-data de la ligne
      if (fixture.teams?.home?.winner === true) update.winner_team_id = m.home_team_id
      else if (fixture.teams?.away?.winner === true) update.winner_team_id = m.away_team_id

      // Minute de jeu en direct (effacée une fois le match terminé)
      update.live_minute = newStatus === 'FINISHED' ? null : (fixture.fixture?.status?.elapsed ?? null)

      let { error } = await supabase.from('imported_matches').update(update).eq('id', m.id)
      // Repli si la colonne live_minute n'existe pas encore (migration non appliquée)
      if (error && /live_minute/i.test(error.message || '')) {
        delete update.live_minute
        ;({ error } = await supabase.from('imported_matches').update(update).eq('id', m.id))
      }
      if (error) result.errors.push(`update ${m.football_data_match_id}: ${error.message}`)
      else result.patched++
      continue
    }

    // Pas dans live=all : un match qu'on suivait en direct et qui en disparaît est terminé.
    // Déclencheurs : dernière minute connue >= 90 (fin de temps réglementaire / prolongations),
    // OU coup d'envoi > 2h15 (filet de sécurité si la minute manque). On conserve le dernier
    // score connu ; football-data corrige le score final si un but tardif a été manqué.
    const isLiveInDb = m.status === 'IN_PLAY' || m.status === 'PAUSED'
    const lastMinute = (m as any).live_minute ?? 0
    const looksOver = lastMinute >= 90 || now - koTime > MATCH_DURATION_MS
    if (isLiveInDb && looksOver) {
      let { error } = await supabase
        .from('imported_matches')
        .update({ status: 'FINISHED', finished: true, live_minute: null, last_updated_at: new Date().toISOString() })
        .eq('id', m.id)
      // Repli si la colonne live_minute n'existe pas encore
      if (error && /live_minute/i.test(error.message || '')) {
        ;({ error } = await supabase
          .from('imported_matches')
          .update({ status: 'FINISHED', finished: true, last_updated_at: new Date().toISOString() })
          .eq('id', m.id))
      }
      if (error) result.errors.push(`finalize ${m.football_data_match_id}: ${error.message}`)
      else result.finalized++
    }
  }

  return result
}
