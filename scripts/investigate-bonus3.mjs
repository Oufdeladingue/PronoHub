import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://txpmihreaxmtsxlgmdko.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const romsId = '01b0ec3e-7f3d-458d-ba8d-9efae1c2bf06'
const tournamentId = '2c8cb282-2600-48aa-963a-ce390128ba03'

async function investigate() {
  // Check imported_matches with a few known fd_ids
  const testFdIds = [538030, 538032, 537630, 537043, 537052]
  console.log('=== Testing imported_matches lookup ===')

  for (const fdId of testFdIds) {
    const { data, error } = await supabase
      .from('imported_matches')
      .select('id, football_data_match_id, home_score, away_score, status, utc_date, home_team, away_team, matchday')
      .eq('football_data_match_id', fdId)

    console.log(`fd_id ${fdId}: data=${JSON.stringify(data)}, error=${JSON.stringify(error)}`)
  }

  // Also check what the predictions reference
  console.log('\n=== Checking predictions match_ids ===')
  const { data: predictions } = await supabase
    .from('predictions')
    .select('match_id, predicted_home_score, predicted_away_score, is_default_prediction')
    .eq('tournament_id', tournamentId)
    .eq('user_id', romsId)

  console.log('Rom predictions:', predictions?.length)

  // For each prediction, check what imported_match it references
  for (const pred of (predictions || [])) {
    const { data: match, error } = await supabase
      .from('imported_matches')
      .select('id, football_data_match_id, home_score, away_score, status, utc_date, home_team, away_team, matchday, competition_id')
      .eq('id', pred.match_id)
      .single()

    if (match) {
      console.log(`  Pred match_id=${pred.match_id} → ${match.home_team} ${match.home_score ?? '?'}-${match.away_score ?? '?'} ${match.away_team} | fd_id: ${match.football_data_match_id} | status: ${match.status} | matchday: ${match.matchday} | comp: ${match.competition_id}`)
    } else {
      console.log(`  Pred match_id=${pred.match_id} → NOT FOUND in imported_matches, error: ${JSON.stringify(error)}`)
    }
  }

  // Now let's directly call the rankings API endpoint for matchday 9 and general
  // by fetching the actual URLs
  console.log('\n=== Calling Rankings API ===')

  const md9Response = await fetch(`https://www.pronohub.club/api/tournaments/${tournamentId}/rankings?matchday=9`)
  const md9Data = await md9Response.json()

  console.log('\n--- Matchday 9 Rankings ---')
  for (const r of (md9Data.rankings || [])) {
    const bonus = r.earlyPredictionBonus !== undefined ? ` (early bonus: ${r.earlyPredictionBonus})` : ''
    console.log(`  #${r.rank} ${r.playerName}: ${r.totalPoints} pts | exact: ${r.exactScores} | correct: ${r.correctResults}${bonus}`)
  }

  const generalResponse = await fetch(`https://www.pronohub.club/api/tournaments/${tournamentId}/rankings`)
  const generalData = await generalResponse.json()

  console.log('\n--- General Rankings ---')
  for (const r of (generalData.rankings || [])) {
    const bonus = r.earlyPredictionBonus !== undefined ? ` (early bonus: ${r.earlyPredictionBonus})` : ''
    console.log(`  #${r.rank} ${r.playerName}: ${r.totalPoints} pts | exact: ${r.exactScores} | correct: ${r.correctResults}${bonus}`)
  }

  // Compare Rom's scores
  const romsMd9 = md9Data.rankings?.find(r => r.playerId === romsId)
  const romsGeneral = generalData.rankings?.find(r => r.playerId === romsId)

  console.log('\n=== ROM\'S COMPARISON ===')
  console.log('Matchday 9:', JSON.stringify(romsMd9, null, 2))
  console.log('General:', JSON.stringify(romsGeneral, null, 2))
  console.log('Difference:', (romsGeneral?.totalPoints || 0) - (romsMd9?.totalPoints || 0), 'pts')
}

investigate().catch(console.error)
