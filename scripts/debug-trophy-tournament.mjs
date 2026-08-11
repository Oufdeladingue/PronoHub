import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://txpmihreaxmtsxlgmdko.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4cG1paHJlYXhtdHN4bGdtZGtvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTU5MDIyNiwiZXhwIjoyMDc3MTY2MjI2fQ.so6lF4GH-DGbSr3EYmzxS24kRxTgzF7-aT3OV1o5QJQ'
)

// 1. Find the tournament
const { data: t } = await supabase
  .from('tournaments')
  .select('id, name, status, starting_matchday, ending_matchday, competition_id, custom_competition_id, invite_code')
  .eq('invite_code', 'HWSKAPCX')
  .single()

console.log('=== TOURNAMENT ===')
console.log(JSON.stringify(t, null, 2))

if (t?.custom_competition_id) {
  // 2. Get custom matchdays
  const { data: matchdays } = await supabase
    .from('custom_competition_matchdays')
    .select('id, matchday_number')
    .eq('custom_competition_id', t.custom_competition_id)
    .order('matchday_number', { ascending: true })

  console.log('\n=== CUSTOM MATCHDAYS ===')
  console.log(JSON.stringify(matchdays, null, 2))

  if (matchdays && matchdays.length > 0) {
    const matchdayIds = matchdays.map(m => m.id)
    const mdNumberMap = {}
    matchdays.forEach(m => { mdNumberMap[m.id] = m.matchday_number })

    // 3. Get custom matches with their imported match IDs
    const { data: customMatches } = await supabase
      .from('custom_competition_matches')
      .select('id, custom_matchday_id, football_data_match_id')
      .in('custom_matchday_id', matchdayIds)

    console.log('\n=== CUSTOM MATCHES (count) ===')
    console.log('Total:', customMatches?.length)

    if (customMatches) {
      // Show per matchday grouping
      for (const md of matchdays) {
        const mdMatches = customMatches.filter(cm => cm.custom_matchday_id === md.id)
        console.log(`\nMatchday ${md.matchday_number}: ${mdMatches.length} matches`)
      }

      // 4. Get the imported matches and their raw matchday values
      const fdIds = customMatches.map(m => m.football_data_match_id).filter(Boolean)
      const { data: importedMatches } = await supabase
        .from('imported_matches')
        .select('id, football_data_match_id, matchday, status, home_score, away_score, home_team_name, away_team_name')
        .in('football_data_match_id', fdIds)

      console.log('\n=== IMPORTED MATCHES matchday values (raw) ===')
      const rawMatchdays = new Set()
      importedMatches?.forEach(im => rawMatchdays.add(im.matchday))
      console.log('Unique raw matchdays:', [...rawMatchdays].sort((a, b) => a - b))

      // Show mapping: custom matchday number -> raw matchday values
      console.log('\n=== MAPPING: Custom Matchday -> Raw Matchdays ===')
      const importedMap = {}
      importedMatches?.forEach(im => { importedMap[im.football_data_match_id] = im })

      for (const md of matchdays) {
        const mdMatches = customMatches.filter(cm => cm.custom_matchday_id === md.id)
        const rawMds = new Set()
        for (const cm of mdMatches) {
          const im = importedMap[cm.football_data_match_id]
          if (im) rawMds.add(im.matchday)
        }
        console.log(`Custom J${md.matchday_number} -> Raw matchdays: [${[...rawMds]}]`)
      }
    }
  }
}

// 5. Check predictions for this tournament
const { data: predictions, count } = await supabase
  .from('predictions')
  .select('user_id, match_id', { count: 'exact' })
  .eq('tournament_id', t?.id)

console.log('\n=== PREDICTIONS ===')
console.log('Total predictions:', count)
const userPredCount = {}
predictions?.forEach(p => { userPredCount[p.user_id] = (userPredCount[p.user_id] || 0) + 1 })
console.log('Per user:', JSON.stringify(userPredCount, null, 2))
