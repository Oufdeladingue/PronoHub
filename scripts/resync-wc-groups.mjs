// Resynchronise les groupes (poules) de la Coupe du Monde après la migration add_group_name.sql
//   - imported_matches.group_name  (depuis /competitions/2000/matches, champ `group`)
//   - competition_standings        (tous les groupes, avec group_name)
// Usage: node scripts/resync-wc-groups.mjs [competitionId]   (défaut 2000 = WC)
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '..', '.env.local') })

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const K = process.env.FOOTBALL_DATA_API_KEY
const API = 'https://api.football-data.org/v4'
const COMP = parseInt(process.argv[2] || '2000')

// 1) Groupes sur les matchs
const mr = await fetch(`${API}/competitions/${COMP}/matches`, { headers: { 'X-Auth-Token': K } })
if (!mr.ok) { console.error(`API matches KO: ${mr.status}`); process.exit(1) }
const matches = (await mr.json()).matches || []
let mUpd = 0
for (const m of matches) {
  if (!m.group) continue
  const { error } = await s.from('imported_matches').update({ group_name: m.group }).eq('football_data_match_id', m.id)
  if (error) { console.error('update match KO:', error.message); process.exit(1) }
  mUpd++
}
console.log(`✅ imported_matches.group_name: ${mUpd} matchs mis à jour`)

// 2) Classements de tous les groupes
const sr = await fetch(`${API}/competitions/${COMP}/standings`, { headers: { 'X-Auth-Token': K } })
if (!sr.ok) { console.error(`API standings KO: ${sr.status}`); process.exit(1) }
const groups = ((await sr.json()).standings || []).filter(g => g.type === 'TOTAL' && Array.isArray(g.table))
const rows = groups.flatMap(g => g.table
  .filter(t => t.team?.id != null)
  .map(t => ({
    competition_id: COMP, team_id: t.team.id, team_name: t.team.name, team_crest: t.team.crest,
    group_name: g.group || null, position: t.position, played_games: t.playedGames,
    won: t.won, draw: t.draw, lost: t.lost, goals_for: t.goalsFor, goals_against: t.goalsAgainst,
    goal_difference: t.goalDifference, points: t.points, form: t.form || null, updated_at: new Date().toISOString()
  })))
const { error: upErr } = await s.from('competition_standings').upsert(rows, { onConflict: 'competition_id,team_id' })
if (upErr) { console.error('upsert standings KO:', upErr.message); process.exit(1) }
console.log(`✅ competition_standings: ${rows.length} équipes sur ${groups.length} groupes`)
console.log('Terminé.')
