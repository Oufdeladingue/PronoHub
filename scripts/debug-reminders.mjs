import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const now = new Date()
const endOfDay = new Date(now)
endOfDay.setHours(23, 59, 59, 999)

// 1. Champion'sTest - matchdays CL
console.log('=== CHAMPION\'S TEST (comp_id=2001) ===')
const { data: clMatchdays } = await supabase
  .from('imported_matches')
  .select('matchday')
  .eq('competition_id', 2001)
  .order('matchday')
const uniqueMd = [...new Set((clMatchdays || []).map(m => m.matchday))].sort((a, b) => a - b)
console.log('Matchdays CL importés:', uniqueMd)
console.log('Tournoi range: J6-J17')
console.log('Matchs ce soir: J2 → HORS RANGE\n')

// 2. Le Roi Merlin - custom comp
console.log('=== LE ROI MERLIN (custom_comp) ===')
const customCompId = '56460cc5-b4db-4180-a8c6-a8fc826a561b'

const { data: customMatchdays } = await supabase
  .from('custom_competition_matchdays')
  .select('id, matchday_number, name')
  .eq('custom_competition_id', customCompId)
  .order('matchday_number')

console.log('Journées custom:')
for (const md of customMatchdays || []) {
  console.log(`  J${md.matchday_number} (${md.name || 'sans nom'}) id=${md.id}`)
}

const mdIds = (customMatchdays || []).map(md => md.id)
if (mdIds.length > 0) {
  const { data: customMatches } = await supabase
    .from('custom_competition_matches')
    .select('id, custom_matchday_id, football_data_match_id, imported_match_id')
    .in('custom_matchday_id', mdIds)

  const fdIds = (customMatches || []).map(m => m.football_data_match_id).filter(Boolean)

  const { data: importedTonight } = await supabase
    .from('imported_matches')
    .select('id, football_data_match_id, matchday, home_team_name, away_team_name, utc_date, status')
    .in('football_data_match_id', fdIds.length > 0 ? fdIds : [-1])
    .gte('utc_date', now.toISOString())
    .lte('utc_date', endOfDay.toISOString())

  console.log('\nMatchs custom CE SOIR:')
  if (!importedTonight || importedTonight.length === 0) {
    console.log('  AUCUN match custom ce soir!')

    // Debug: montrer les prochains matchs custom
    const { data: nextCustomMatches } = await supabase
      .from('imported_matches')
      .select('id, football_data_match_id, matchday, home_team_name, away_team_name, utc_date, status')
      .in('football_data_match_id', fdIds.length > 0 ? fdIds : [-1])
      .gte('utc_date', now.toISOString())
      .order('utc_date')
      .limit(5)

    console.log('\n  Prochains matchs custom:')
    for (const m of nextCustomMatches || []) {
      const cm = (customMatches || []).find(c => c.football_data_match_id === m.football_data_match_id)
      const md = cm ? (customMatchdays || []).find(d => d.id === cm.custom_matchday_id) : null
      console.log(`    J${md ? md.matchday_number : '?'} ${m.home_team_name} vs ${m.away_team_name} - ${m.utc_date}`)
    }
  } else {
    for (const m of importedTonight) {
      const cm = (customMatches || []).find(c => c.football_data_match_id === m.football_data_match_id)
      const md = cm ? (customMatchdays || []).find(d => d.id === cm.custom_matchday_id) : null
      console.log(`  J${md ? md.matchday_number : '?'} ${m.home_team_name} vs ${m.away_team_name} - ${m.utc_date}`)
    }
    console.log('\nTournoi range: J9-J18')

    // Vérifier si les matchdays sont dans la range
    const tonightCustomMds = importedTonight.map(m => {
      const cm = (customMatches || []).find(c => c.football_data_match_id === m.football_data_match_id)
      const md = cm ? (customMatchdays || []).find(d => d.id === cm.custom_matchday_id) : null
      return md ? md.matchday_number : null
    }).filter(Boolean)
    console.log('Matchdays custom ce soir:', [...new Set(tonightCustomMds)])
    console.log('Range tournoi: J9-J18')
    console.log('Dans la range?', tonightCustomMds.every(md => md >= 9 && md <= 18))
  }
}
