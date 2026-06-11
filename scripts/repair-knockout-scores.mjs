// Répare les scores des matchs à élimination directe terminés en prolongation / TAB.
// football-data met le score TAB INCLUS dans fullTime → on recalcule depuis regularTime
// (score à 90', base de calcul des points) et on exclut les TAB du score affiché.
// Lecture football-data + écriture imported_matches.
// Usage: node scripts/repair-knockout-scores.mjs           (dry-run)
//        node scripts/repair-knockout-scores.mjs --apply    (écrit)
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'; import { dirname, join } from 'path'
config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '.env.local') })

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const K = process.env.FOOTBALL_DATA_API_KEY
const DRY = !process.argv.includes('--apply')
const num = (v) => (typeof v === 'number' ? v : 0)

function extract(score) {
  const s = score || {}, ft = s.fullTime || {}, reg = s.regularTime, et = s.extraTime
  let home = ft.home ?? null, away = ft.away ?? null, h90 = null, a90 = null
  if (s.duration === 'PENALTY_SHOOTOUT') {
    home = reg ? num(reg.home) + num(et?.home) : ft.home ?? null
    away = reg ? num(reg.away) + num(et?.away) : ft.away ?? null
    h90 = reg?.home ?? null; a90 = reg?.away ?? null
  } else if (s.duration === 'EXTRA_TIME') {
    h90 = reg?.home ?? null; a90 = reg?.away ?? null
  }
  const winner = s.winner === 'HOME_TEAM' ? 'home' : s.winner === 'AWAY_TEAM' ? 'away' : null
  return { home, away, h90, a90, winner }
}

// 1) Compétitions ayant des matchs knockout terminés en base
const KO = ['PLAYOFFS', 'LAST_16', 'ROUND_OF_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'THIRD_PLACE', 'FINAL', 'LAST_32']
const { data: rows } = await s.from('imported_matches')
  .select('competition_id').eq('finished', true).in('stage', KO)
const compIds = [...new Set((rows || []).map(r => r.competition_id).filter(Boolean))]
console.log('Compétitions à scanner:', compIds)

let fixed = 0, checked = 0
for (const compId of compIds) {
  const r = await fetch(`https://api.football-data.org/v4/competitions/${compId}/matches`, { headers: { 'X-Auth-Token': K } })
  if (!r.ok) { console.log(`  comp ${compId}: API ${r.status}`); continue }
  const apiMatches = (await r.json()).matches || []
  const apiById = new Map(apiMatches.map(m => [m.id, m]))

  const { data: dbMatches } = await s.from('imported_matches')
    .select('id, football_data_match_id, home_team_name, away_team_name, home_team_id, away_team_id, stage, home_score, away_score, home_score_90, away_score_90, winner_team_id')
    .eq('competition_id', compId).eq('finished', true).in('stage', KO)

  for (const m of dbMatches || []) {
    const api = apiById.get(m.football_data_match_id)
    if (!api) continue
    const dur = api.score?.duration
    if (dur !== 'PENALTY_SHOOTOUT' && dur !== 'EXTRA_TIME') continue // seuls ET/TAB sont concernés
    checked++
    const e = extract(api.score)
    const winnerId = e.winner === 'home' ? m.home_team_id : e.winner === 'away' ? m.away_team_id : null
    const needs =
      m.home_score !== e.home || m.away_score !== e.away ||
      m.home_score_90 !== e.h90 || m.away_score_90 !== e.a90 ||
      m.winner_team_id !== winnerId

    console.log(`  [${dur}] ${m.home_team_name} v ${m.away_team_name}: DB ${m.home_score}-${m.away_score} (90'=${m.home_score_90}-${m.away_score_90}) → CORRECT ${e.home}-${e.away} (90'=${e.h90}-${e.a90}) winner=${winnerId} ${needs ? '⚠️ À CORRIGER' : '✓ ok'}`)

    if (needs && !DRY) {
      const { error } = await s.from('imported_matches').update({
        home_score: e.home, away_score: e.away,
        home_score_90: e.h90, away_score_90: e.a90,
        winner_team_id: winnerId, last_updated_at: new Date().toISOString(),
      }).eq('id', m.id)
      if (error) console.log(`     ❌ ${error.message}`); else { fixed++; console.log('     ✅ corrigé') }
    } else if (needs) fixed++
  }
}
console.log(`\n${DRY ? '🔎 DRY-RUN' : '💾 APPLIQUÉ'} — ${checked} match(s) ET/TAB vérifiés, ${fixed} ${DRY ? 'à corriger' : 'corrigés'}`)
if (DRY) console.log('Relancer avec --apply pour écrire.')
