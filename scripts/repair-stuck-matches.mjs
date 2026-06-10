import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
config({ path: join(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
const API_KEY = process.env.FOOTBALL_DATA_API_KEY
const API = 'https://api.football-data.org/v4'

const DRY_RUN = process.argv.includes('--apply') ? false : true
const COMPS = [2001] // Champions League

for (const compId of COMPS) {
  console.log(`\n===== Compétition ${compId} =====`)

  // 1) matchs bloqués en DB (non FINISHED/AWARDED)
  const { data: stuck } = await supabase
    .from('imported_matches')
    .select('id, football_data_match_id, matchday, status, home_team_name, away_team_name, home_score, away_score')
    .eq('competition_id', compId)
    .not('status', 'in', '("FINISHED","AWARDED")')

  console.log(`Matchs bloqués en DB: ${stuck?.length || 0}`)
  if (!stuck || stuck.length === 0) continue

  // 2) récupérer les vrais résultats depuis football-data.org
  const res = await fetch(`${API}/competitions/${compId}/matches`, { headers: { 'X-Auth-Token': API_KEY } })
  if (!res.ok) { console.error(`  ❌ API error ${res.status} ${res.statusText}`); continue }
  const json = await res.json()
  const apiById = new Map(json.matches.map(m => [m.id, m]))

  for (const m of stuck) {
    const api = apiById.get(m.football_data_match_id)
    if (!api) { console.log(`  ⚠️  ${m.home_team_name} v ${m.away_team_name}: introuvable dans l'API`); continue }
    const ft = api.score?.fullTime || {}
    console.log(`  J${m.matchday} ${m.home_team_name} v ${m.away_team_name}: DB[${m.status} ${m.home_score}-${m.away_score}] -> API[${api.status} ${ft.home}-${ft.away} winner=${api.score?.winner}]`)

    if ((api.status === 'FINISHED' || api.status === 'AWARDED') && ft.home != null && ft.away != null) {
      if (!DRY_RUN) {
        const { error } = await supabase.from('imported_matches').update({
          status: api.status,
          finished: true,
          home_score: ft.home,
          away_score: ft.away,
          winner: api.score?.winner ?? null,
          last_updated_at: new Date().toISOString(),
        }).eq('id', m.id)
        if (error) console.log(`     ❌ update: ${error.message}`); else console.log(`     ✅ mis à jour ${api.status} ${ft.home}-${ft.away}`)
      }
    } else {
      console.log(`     ⏭️  API ne confirme pas terminé (status=${api.status}) — non modifié`)
    }
  }
}

console.log(`\n${DRY_RUN ? '🔎 DRY-RUN (relancer avec --apply pour écrire)' : '💾 Modifications appliquées'}`)
