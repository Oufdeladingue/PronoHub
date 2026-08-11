import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://txpmihreaxmtsxlgmdko.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const tournamentId = '2c8cb282-2600-48aa-963a-ce390128ba03'
const customCompId = '56460cc5-b4db-4180-a8c6-a8fc826a561b'
const romsId = '01b0ec3e-7f3d-458d-ba8d-9efae1c2bf06'

async function investigate() {
  // 1. Get custom matchdays
  const { data: customMds } = await supabase
    .from('custom_competition_matchdays')
    .select('id, matchday_number')
    .eq('custom_competition_id', customCompId)
    .order('matchday_number', { ascending: true })

  console.log('=== CUSTOM MATCHDAYS ===')
  for (const md of customMds || []) {
    console.log(`  Matchday ${md.matchday_number}: id=${md.id}`)
  }

  // 2. Get custom matches
  const matchdayIds = customMds?.map(md => md.id) || []
  const { data: customMatches, error: cmError } = await supabase
    .from('custom_competition_matches')
    .select('id, custom_matchday_id, football_data_match_id, cached_utc_date')
    .in('custom_matchday_id', matchdayIds)

  console.log('\n=== CUSTOM MATCHES ===')
  console.log('Total custom matches:', customMatches?.length, 'Error:', cmError)

  // Group by matchday
  const mdMap = {}
  customMds?.forEach(md => { mdMap[md.id] = md.matchday_number })

  const matchesByMd = {}
  for (const cm of (customMatches || [])) {
    const mdNum = mdMap[cm.custom_matchday_id]
    if (!matchesByMd[mdNum]) matchesByMd[mdNum] = []
    matchesByMd[mdNum].push(cm)
  }

  for (const [md, matches] of Object.entries(matchesByMd)) {
    console.log(`\nMatchday ${md}: ${matches.length} matches`)
    for (const m of matches) {
      console.log(`  CM: ${m.id} | fd_id: ${m.football_data_match_id} | status: ${m.cached_status} | date: ${m.cached_utc_date}`)
    }
  }

  // 3. Get the imported matches for these custom matches
  const fdIds = customMatches?.map(m => m.football_data_match_id).filter(Boolean) || []
  console.log('\n=== IMPORTED MATCHES (for custom competition) ===')
  console.log('Football data IDs to look up:', fdIds.length)

  if (fdIds.length > 0) {
    const { data: importedMatches } = await supabase
      .from('imported_matches')
      .select('id, football_data_match_id, home_score, away_score, status, utc_date, home_team, away_team, matchday')
      .in('football_data_match_id', fdIds)

    console.log('Imported matches found:', importedMatches?.length)

    // Map by fd_id
    const imMap = {}
    importedMatches?.forEach(im => { imMap[im.football_data_match_id] = im })

    // Show per matchday
    for (const [md, matches] of Object.entries(matchesByMd)) {
      console.log(`\nMatchday ${md}:`)
      for (const cm of matches) {
        const im = imMap[cm.football_data_match_id]
        if (im) {
          console.log(`  ${im.home_team} ${im.home_score ?? '?'}-${im.away_score ?? '?'} ${im.away_team} | status: ${im.status} | im.id: ${im.id} | im.matchday: ${im.matchday}`)
        } else {
          console.log(`  NO IMPORTED MATCH for fd_id: ${cm.football_data_match_id}`)
        }
      }
    }
  }

  // 4. Now simulate the rankings API logic for matchday 9 vs general
  console.log('\n\n=== SIMULATING RANKINGS API ===')

  // Tournament settings
  const startingMatchday = 9
  const endingMatchday = 18
  const startDate = new Date('2026-01-29T15:24:18.859+00:00')

  // Points settings
  const { data: pointsSettingsData } = await supabase
    .from('admin_settings')
    .select('setting_key, setting_value')
    .in('setting_key', ['points_exact_score', 'points_correct_result', 'points_incorrect_result'])

  const exactScoreSetting = pointsSettingsData?.find(s => s.setting_key === 'points_exact_score')
  const correctResultSetting = pointsSettingsData?.find(s => s.setting_key === 'points_correct_result')

  console.log('Points - exact:', exactScoreSetting?.setting_value, 'correct:', correctResultSetting?.setting_value)

  // For MATCHDAY 9 ONLY
  console.log('\n--- MATCHDAY 9 VIEW ---')
  await simulateRankings([9])

  // For GENERAL VIEW
  console.log('\n--- GENERAL VIEW ---')
  await simulateRankings(Array.from({ length: endingMatchday - startingMatchday + 1 }, (_, i) => startingMatchday + i))

  async function simulateRankings(matchdaysToCalculate) {
    console.log('matchdaysToCalculate:', matchdaysToCalculate)

    // Get custom matchdays for these
    const relevantMds = customMds?.filter(md => matchdaysToCalculate.includes(md.matchday_number)) || []
    const relevantMdIds = relevantMds.map(md => md.id)

    // Get custom matches for these matchdays
    const relevantCustomMatches = customMatches?.filter(cm => relevantMdIds.includes(cm.custom_matchday_id)) || []

    // Get imported matches
    const relevantFdIds = relevantCustomMatches.map(cm => cm.football_data_match_id).filter(Boolean)

    let importedMatches = []
    if (relevantFdIds.length > 0) {
      const { data } = await supabase
        .from('imported_matches')
        .select('id, football_data_match_id, home_score, away_score, status, utc_date, home_team, away_team')
        .in('football_data_match_id', relevantFdIds)
      importedMatches = data || []
    }

    const imMap = {}
    importedMatches.forEach(im => { imMap[im.football_data_match_id] = im })

    // Build allMatches and finishedMatches
    const allMatchesRaw = relevantCustomMatches.map(cm => {
      const im = imMap[cm.football_data_match_id]
      return {
        id: im?.id || cm.id,
        matchday: mdMap[cm.custom_matchday_id],
        utc_date: im?.utc_date || cm.cached_utc_date
      }
    })

    const finishedMatchesRaw = relevantCustomMatches
      .map(cm => {
        const im = imMap[cm.football_data_match_id]
        return {
          id: im?.id || cm.id,
          matchday: mdMap[cm.custom_matchday_id],
          utc_date: im?.utc_date || cm.cached_utc_date,
          home_score: im?.home_score ?? null,
          away_score: im?.away_score ?? null,
          status: im?.status || 'SCHEDULED',
          home_team: im?.home_team || '?',
          away_team: im?.away_team || '?'
        }
      })
      .filter(m => m.home_score !== null && m.away_score !== null)

    // Filter by start date
    const allMatches = allMatchesRaw.filter(m => new Date(m.utc_date) >= startDate)
    const finishedMatches = finishedMatchesRaw.filter(m => new Date(m.utc_date) >= startDate)

    console.log('allMatches:', allMatches.length)
    console.log('finishedMatches:', finishedMatches.length)

    // Show finished matches
    for (const m of finishedMatches) {
      console.log(`  Matchday ${m.matchday}: ${m.home_team} ${m.home_score}-${m.away_score} ${m.away_team} | id: ${m.id}`)
    }

    const finishedMatchesMap = new Map(finishedMatches.map(m => [m.id, m]))

    // Build matchIdsByMatchday (for early prediction bonus)
    const matchIdsByMatchday = {}
    for (const match of allMatches) {
      const md = match.matchday
      if (!matchIdsByMatchday[md]) matchIdsByMatchday[md] = []
      matchIdsByMatchday[md].push(match.id)
    }

    console.log('\nmatchIdsByMatchday:')
    for (const [md, ids] of Object.entries(matchIdsByMatchday)) {
      console.log(`  Matchday ${md}: ${ids.length} match IDs`)
    }

    // Get bonus match IDs
    const { data: bonusMatches } = await supabase
      .from('tournament_bonus_matches')
      .select('match_id, matchday')
      .eq('tournament_id', tournamentId)
      .in('matchday', matchdaysToCalculate)

    const bonusMatchIds = new Set(bonusMatches?.map(bm => bm.match_id) || [])
    console.log('\nBonus match IDs for these matchdays:', [...bonusMatchIds])

    // Get Rom's predictions
    const predictions = await supabase
      .from('predictions')
      .select('match_id, predicted_home_score, predicted_away_score, is_default_prediction, created_at')
      .eq('tournament_id', tournamentId)
      .eq('user_id', romsId)

    const userPredictions = predictions.data || []
    const predictionsMap = new Map(userPredictions.map(p => [p.match_id, p]))

    // Create all predictions (with defaults for missing)
    const allPredictions = finishedMatches.map(match => {
      const existing = predictionsMap.get(match.id)
      if (existing) return existing
      return {
        match_id: match.id,
        predicted_home_score: 0,
        predicted_away_score: 0,
        is_default_prediction: true,
        user_id: romsId,
        tournament_id: tournamentId
      }
    })

    // Calculate points
    let totalPoints = 0
    console.log('\nPoints calculation:')
    for (const pred of allPredictions) {
      const match = finishedMatchesMap.get(pred.match_id)
      if (!match) continue

      const isBonusMatch = bonusMatchIds.has(match.id)
      const isDefault = pred.is_default_prediction || false

      // Calculate points
      const isExactScore = pred.predicted_home_score === match.home_score && pred.predicted_away_score === match.away_score
      let isCorrectResult = false
      let points = 0

      if (isExactScore) {
        points = 3 * (isBonusMatch ? 2 : 1)
        isCorrectResult = true
      } else {
        const predOutcome = pred.predicted_home_score > pred.predicted_away_score ? 'HOME' : (pred.predicted_home_score < pred.predicted_away_score ? 'AWAY' : 'DRAW')
        const actualOutcome = match.home_score > match.away_score ? 'HOME' : (match.home_score < match.away_score ? 'AWAY' : 'DRAW')
        isCorrectResult = predOutcome === actualOutcome

        if (isDefault && pred.predicted_home_score === 0 && pred.predicted_away_score === 0 && actualOutcome === 'DRAW') {
          points = 1 * (isBonusMatch ? 2 : 1) // drawWithDefaultPrediction
        } else if (isCorrectResult) {
          points = 1 * (isBonusMatch ? 2 : 1)
        } else {
          points = 0
        }
      }

      totalPoints += points
      console.log(`  ${match.home_team} ${match.home_score}-${match.away_score} | Pred: ${pred.predicted_home_score}-${pred.predicted_away_score} | exact: ${isExactScore} | correct: ${isCorrectResult} | bonus: ${isBonusMatch} | default: ${isDefault} | pts: ${points}`)
    }

    console.log('Total match points:', totalPoints)

    // Calculate early prediction bonus
    let earlyBonus = 0
    console.log('\nEarly prediction bonus check:')
    for (const md of matchdaysToCalculate) {
      const matchIdsForDay = matchIdsByMatchday[md] || []
      if (matchIdsForDay.length === 0) {
        console.log(`  Matchday ${md}: no matches, skip`)
        continue
      }

      const allFinished = matchIdsForDay.every(mId => finishedMatchesMap.has(mId))
      if (!allFinished) {
        console.log(`  Matchday ${md}: not all finished (${matchIdsForDay.filter(id => finishedMatchesMap.has(id)).length}/${matchIdsForDay.length}), skip`)
        continue
      }

      let hasDefault = false
      for (const matchId of matchIdsForDay) {
        const pred = userPredictions.find(p => p.match_id === matchId)
        if (!pred || pred.is_default_prediction) {
          hasDefault = true
          console.log(`  Matchday ${md}: has default/missing prediction for match ${matchId}`)
          break
        }
      }

      if (!hasDefault) {
        earlyBonus += 1
        console.log(`  Matchday ${md}: BONUS +1`)
      }
    }

    console.log('\nEarly prediction bonus:', earlyBonus)
    console.log('TOTAL POINTS:', totalPoints + earlyBonus)
  }
}

investigate().catch(console.error)
