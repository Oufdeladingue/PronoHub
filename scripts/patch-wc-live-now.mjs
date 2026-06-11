// Patch ponctuel : écrit les scores live de la Coupe du Monde (comp 2000) en base
// depuis API-Football (endpoint live=all, accessible même en plan gratuit).
// Lecture API-Football + écriture imported_matches. Usage: node scripts/patch-wc-live-now.mjs
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '..', '.env.local') })

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const AF_KEY = process.env.API_FOOTBALL_KEY
const WC_COMP = 2000      // football-data World Cup competition id (en base)
const WC_LEAGUE = 1       // API-Football league id pour la Coupe du Monde

const STATUS_MAP = {
  'TBD': 'SCHEDULED', 'NS': 'SCHEDULED',
  '1H': 'IN_PLAY', 'HT': 'PAUSED', '2H': 'IN_PLAY', 'ET': 'IN_PLAY', 'BT': 'PAUSED', 'P': 'IN_PLAY', 'LIVE': 'IN_PLAY',
  'FT': 'FINISHED', 'AET': 'FINISHED', 'PEN': 'FINISHED', 'AWD': 'FINISHED', 'WO': 'FINISHED',
  'SUSP': 'SUSPENDED', 'INT': 'SUSPENDED', 'PST': 'POSTPONED', 'CANC': 'CANCELLED', 'ABD': 'CANCELLED',
}
const norm = (x) => (x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')

// 1) Matchs live de la CDM via API-Football
const r = await fetch(`https://v3.football.api-sports.io/fixtures?live=all&league=${WC_LEAGUE}`, {
  headers: { 'x-rapidapi-key': AF_KEY, 'x-rapidapi-host': 'v3.football.api-sports.io' },
})
const j = await r.json()
const live = j.response || []
console.log(`API-Football: ${live.length} match(s) live en CDM`)
if (live.length === 0) { console.log('Rien à patcher.'); process.exit(0) }

// 2) Lignes DB de la CDM non terminées
const { data: dbMatches } = await s
  .from('imported_matches')
  .select('id, football_data_match_id, home_team_name, away_team_name, utc_date, status, home_score, away_score, stage')
  .eq('competition_id', WC_COMP)
  .not('status', 'in', '("FINISHED","AWARDED")')

for (const f of live) {
  const homeAF = f.teams.home.name, awayAF = f.teams.away.name
  const koAF = new Date(f.fixture.date).getTime()
  const newStatus = STATUS_MAP[f.fixture.status.short] || 'SCHEDULED'
  const hs = f.goals.home, as = f.goals.away

  // Associer par équipes (normalisées) + coup d'envoi proche (±15 min)
  const candidates = (dbMatches || []).filter(m => {
    const teamsOk = norm(m.home_team_name) === norm(homeAF) && norm(m.away_team_name) === norm(awayAF)
    const timeOk = Math.abs(new Date(m.utc_date).getTime() - koAF) < 15 * 60 * 1000
    return teamsOk && timeOk
  })

  console.log(`\nLIVE: ${homeAF} ${hs}-${as} ${awayAF} [${f.fixture.status.short} → ${newStatus}] ${f.fixture.status.elapsed}'`)
  if (candidates.length !== 1) {
    console.log(`  ⚠️  ${candidates.length} ligne(s) DB correspondante(s) — non patché (sécurité)`)
    continue
  }
  const m = candidates[0]
  const update = { status: newStatus, finished: newStatus === 'FINISHED', home_score: hs, away_score: as, last_updated_at: new Date().toISOString() }
  const { error } = await s.from('imported_matches').update(update).eq('id', m.id)
  if (error) console.log(`  ❌ update KO: ${error.message}`)
  else console.log(`  ✅ ${m.home_team_name} v ${m.away_team_name}: ${m.status} ${m.home_score}-${m.away_score} → ${newStatus} ${hs}-${as}`)
}
console.log('\nTerminé.')
