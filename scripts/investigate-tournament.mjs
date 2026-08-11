import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://txpmihreaxmtsxlgmdko.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4cG1paHJlYXhtdHN4bGdtZGtvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTU5MDIyNiwiZXhwIjoyMDc3MTY2MjI2fQ.so6lF4GH-DGbSr3EYmzxS24kRxTgzF7-aT3OV1o5QJQ'
)

const tournamentId = '79bcd4d1-eaba-4060-a29b-d399abbe8c44'
const customCompId = '56460cc5-b4db-4180-a8c6-a8fc826a561b'

// 1. Tournoi (all columns)
const { data: t } = await supabase.from('tournaments').select('*').eq('id', tournamentId).single()
console.log('=== TOURNOI ===')
console.log('status:', t?.status, '| starting_matchday:', t?.starting_matchday, '| ending_matchday:', t?.ending_matchday)
console.log('scoring_draw_with_default_prediction:', t?.scoring_draw_with_default_prediction)
console.log('scoring_default_prediction_max:', t?.scoring_default_prediction_max)

// 2. Matchdays
const { data: matchdays } = await supabase
  .from('custom_competition_matchdays')
  .select('id, matchday_number')
  .eq('custom_competition_id', customCompId)
  .order('matchday_number', { ascending: true })

if (matchdays && matchdays.length > 0) {
  const startMd = matchdays[0].matchday_number
  const endMd = matchdays[matchdays.length - 1].matchday_number
  console.log('\nMatchdays range:', startMd, 'to', endMd)

  const matchdayIds = matchdays.map(m => m.id)
  const mdNumberMap = {}
  matchdays.forEach(m => { mdNumberMap[m.id] = m.matchday_number })

  const { data: customMatches } = await supabase
    .from('custom_competition_matches')
    .select('id, custom_matchday_id, football_data_match_id, cached_utc_date')
    .in('custom_matchday_id', matchdayIds)

  if (customMatches) {
    const fdIds = customMatches.map(m => m.football_data_match_id).filter(Boolean)
    const { data: imported } = await supabase
      .from('imported_matches')
      .select('id, football_data_match_id, home_score, away_score, status, utc_date, home_team_name, away_team_name')
      .in('football_data_match_id', fdIds)

    const importedMap = {}
    if (imported) imported.forEach(im => { importedMap[im.football_data_match_id] = im })

    const allMatches = customMatches.map(cm => {
      const im = importedMap[cm.football_data_match_id]
      return {
        id: im?.id || cm.id,
        matchday: mdNumberMap[cm.custom_matchday_id],
        home_score: im?.home_score ?? null,
        away_score: im?.away_score ?? null,
        home_team: im?.home_team_name,
        away_team: im?.away_team_name
      }
    })

    const finished = allMatches.filter(m => m.home_score !== null && m.away_score !== null)
    console.log('Total matchs terminés:', finished.length)

    // Simulate scoring with default 0-0
    const drawDefault = t?.scoring_draw_with_default_prediction ?? 1
    let totalPts = 0
    let draws = []

    for (const m of finished) {
      // Default prediction: 0-0, isDefaultPrediction=true
      // scoring.ts logic:
      // - if isDefault && predicted 0-0 && actual is DRAW -> drawWithDefaultPrediction points
      // - if exact 0-0 -> BUT the special case above catches it FIRST (line 67-78)
      // - otherwise 0 pts
      if (m.home_score === m.away_score) {
        // It's a draw -> gives drawWithDefaultPrediction points
        totalPts += drawDefault
        draws.push(`J${m.matchday}: ${m.home_team} ${m.home_score}-${m.away_score} ${m.away_team} → ${drawDefault} pt`)
      }
    }

    console.log('\n=== MATCHS NULS (default 0-0 = draw correct) ===')
    draws.forEach(d => console.log(d))
    console.log('\nTotal draws:', draws.length)
    console.log('Points par nul (drawWithDefaultPrediction):', drawDefault)
    console.log('TOTAL POINTS CALCULÉS:', totalPts)
  }
}
