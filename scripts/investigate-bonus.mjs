import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://txpmihreaxmtsxlgmdko.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function investigate() {
  // 1. Find the tournament
  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('*')
    .ilike('invite_code', '%HWSKAPCX%')

  console.log('Found tournaments:', tournaments?.map(t => t.slug))
  const tournament = tournaments?.[0]

  if (!tournament) {
    console.log('Tournament not found')
    return
  }

  console.log('=== TOURNAMENT ===')
  console.log('ID:', tournament.id)
  console.log('Name:', tournament.name)
  console.log('Slug:', tournament.slug)
  console.log('Competition ID:', tournament.competition_id)
  console.log('Custom Competition ID:', tournament.custom_competition_id)
  console.log('Starting matchday:', tournament.starting_matchday)
  console.log('Ending matchday:', tournament.ending_matchday)
  console.log('Early prediction bonus:', tournament.early_prediction_bonus)
  console.log('Start date:', tournament.start_date)
  console.log('Status:', tournament.status)

  // 2. Find Rom's user
  const { data: participants } = await supabase
    .from('tournament_participants')
    .select('user_id, profiles(username)')
    .eq('tournament_id', tournament.id)

  console.log('\n=== PARTICIPANTS ===')
  for (const p of participants) {
    console.log(`- ${p.profiles?.username} (${p.user_id})`)
  }

  const roms = participants.find(p => p.profiles?.username?.toLowerCase().includes('rom'))
  if (!roms) {
    console.log('Rom not found')
    return
  }
  console.log('\nRom user_id:', roms.user_id)

  // 3. Check if custom or standard
  const isCustom = !!tournament.custom_competition_id
  console.log('\n=== MATCHDAYS ===')
  console.log('Is custom:', isCustom)

  let startMd = tournament.starting_matchday
  let endMd = tournament.ending_matchday

  if (isCustom) {
    const { data: customMds } = await supabase
      .from('custom_competition_matchdays')
      .select('id, matchday_number')
      .eq('custom_competition_id', tournament.custom_competition_id)
      .order('matchday_number', { ascending: true })

    console.log('Custom matchdays:', customMds?.map(m => m.matchday_number))
    if (customMds?.length > 0) {
      startMd = customMds[0].matchday_number
      endMd = customMds[customMds.length - 1].matchday_number
    }
  }

  console.log('Matchday range:', startMd, '-', endMd)
  const allMatchdays = Array.from({ length: endMd - startMd + 1 }, (_, i) => startMd + i)

  // 4. Get matches per matchday and their status
  if (!isCustom) {
    for (const md of allMatchdays) {
      const { data: matches } = await supabase
        .from('imported_matches')
        .select('id, matchday, home_score, away_score, status, utc_date, home_team, away_team')
        .eq('competition_id', tournament.competition_id)
        .eq('matchday', md)
        .order('utc_date', { ascending: true })

      if (!matches || matches.length === 0) {
        console.log(`\nMatchday ${md}: NO MATCHES`)
        continue
      }

      const finished = matches.filter(m => m.home_score !== null && m.away_score !== null)
      const allFinished = finished.length === matches.length

      // Filter by tournament start date
      const startDate = tournament.start_date ? new Date(tournament.start_date) : null
      const matchesAfterStart = startDate
        ? matches.filter(m => new Date(m.utc_date) >= startDate)
        : matches
      const finishedAfterStart = startDate
        ? finished.filter(m => new Date(m.utc_date) >= startDate)
        : finished

      console.log(`\nMatchday ${md}: ${matches.length} matches, ${finished.length} finished, ALL finished: ${allFinished}`)
      console.log(`  After start date filter: ${matchesAfterStart.length} matches, ${finishedAfterStart.length} finished`)

      for (const m of matches) {
        const afterStart = startDate ? new Date(m.utc_date) >= startDate : true
        console.log(`  ${m.home_team} ${m.home_score ?? '?'}-${m.away_score ?? '?'} ${m.away_team} | ${m.status} | ${m.utc_date} | afterStart: ${afterStart}`)
      }
    }
  } else {
    // Custom competition
    const { data: customMds } = await supabase
      .from('custom_competition_matchdays')
      .select('id, matchday_number')
      .eq('custom_competition_id', tournament.custom_competition_id)

    const mdMap = {}
    customMds?.forEach(md => { mdMap[md.id] = md.matchday_number })

    const { data: customMatches } = await supabase
      .from('custom_competition_matches')
      .select('id, custom_matchday_id, football_data_match_id, cached_utc_date, cached_status')
      .in('custom_matchday_id', customMds?.map(md => md.id) || [])

    // Get imported matches
    const fdIds = customMatches?.map(m => m.football_data_match_id).filter(Boolean)
    const { data: importedMatches } = await supabase
      .from('imported_matches')
      .select('id, football_data_match_id, home_score, away_score, status, utc_date, home_team, away_team')
      .in('football_data_match_id', fdIds)

    const imMap = {}
    importedMatches?.forEach(im => { imMap[im.football_data_match_id] = im })

    for (const md of allMatchdays) {
      const mdMatches = customMatches?.filter(cm => mdMap[cm.custom_matchday_id] === md) || []
      if (mdMatches.length === 0) {
        console.log(`\nMatchday ${md}: NO MATCHES`)
        continue
      }

      const enriched = mdMatches.map(cm => {
        const im = imMap[cm.football_data_match_id]
        return {
          id: im?.id || cm.id,
          matchday: md,
          home_score: im?.home_score ?? null,
          away_score: im?.away_score ?? null,
          status: im?.status || 'SCHEDULED',
          utc_date: im?.utc_date || cm.cached_utc_date,
          home_team: im?.home_team || '?',
          away_team: im?.away_team || '?'
        }
      })

      const finished = enriched.filter(m => m.home_score !== null && m.away_score !== null)
      const allFinished = finished.length === enriched.length

      const startDate = tournament.start_date ? new Date(tournament.start_date) : null
      const matchesAfterStart = startDate
        ? enriched.filter(m => new Date(m.utc_date) >= startDate)
        : enriched
      const finishedAfterStart = startDate
        ? finished.filter(m => new Date(m.utc_date) >= startDate)
        : finished

      console.log(`\nMatchday ${md}: ${enriched.length} matches, ${finished.length} finished, ALL finished: ${allFinished}`)
      console.log(`  After start date filter: ${matchesAfterStart.length} matches, ${finishedAfterStart.length} finished`)

      for (const m of enriched) {
        const afterStart = startDate ? new Date(m.utc_date) >= startDate : true
        console.log(`  ${m.home_team} ${m.home_score ?? '?'}-${m.away_score ?? '?'} ${m.away_team} | ${m.status} | ${m.utc_date} | afterStart: ${afterStart}`)
      }
    }
  }

  // 5. Check Rom's predictions
  console.log('\n=== ROM\'s PREDICTIONS ===')
  const { data: predictions } = await supabase
    .from('predictions')
    .select('match_id, predicted_home_score, predicted_away_score, is_default_prediction, created_at')
    .eq('tournament_id', tournament.id)
    .eq('user_id', roms.user_id)

  console.log('Total predictions:', predictions?.length)
  for (const p of (predictions || [])) {
    console.log(`  Match ${p.match_id}: ${p.predicted_home_score}-${p.predicted_away_score} | default: ${p.is_default_prediction} | created: ${p.created_at}`)
  }

  // 6. Check bonus matches
  console.log('\n=== BONUS MATCHES ===')
  const { data: bonusMatches } = await supabase
    .from('tournament_bonus_matches')
    .select('match_id, matchday')
    .eq('tournament_id', tournament.id)

  console.log('Bonus matches:', bonusMatches)
}

investigate().catch(console.error)
