require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function triggerTrophyDetection() {
  try {
    // Trouver l'utilisateur Rom's
    const { data: user } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', "Rom's")
      .single()

    console.log('Utilisateur ID:', user.id)

    // Simuler la détection de l'opportuniste trophy
    const { data: predictions } = await supabase
      .from('predictions')
      .select('id, predicted_home_score, predicted_away_score, match_id, tournament_id')
      .eq('user_id', user.id)

    console.log('Total predictions:', predictions.length)

    const matchIds = predictions.map(p => p.match_id).filter(Boolean)

    const { data: matches, error: matchError } = await supabase
      .from('imported_matches')
      .select('id, home_score, away_score, status, finished, matchday, utc_date')
      .in('id', matchIds)

    console.log('Total matches found:', matches?.length || 0)
    if (matchError) {
      console.error('Error fetching matches:', matchError)
      return
    }

    const matchesMap = {}
    matches.forEach(match => {
      matchesMap[match.id] = match
    })

    const predictionsByMatchday = {}

    for (const pred of predictions) {
      const match = matchesMap[pred.match_id]
      if (!match || (match.status !== 'FINISHED' && match.finished !== true)) continue
      if (match.home_score === null || match.away_score === null) continue

      const key = `${pred.tournament_id}_${match.matchday}`
      if (!predictionsByMatchday[key]) predictionsByMatchday[key] = []

      predictionsByMatchday[key].push({
        pred_home: pred.predicted_home_score,
        pred_away: pred.predicted_away_score,
        actual_home: match.home_score,
        actual_away: match.away_score,
        utc_date: match.utc_date
      })
    }

    console.log('\nAnalyzing matchdays...')
    const trophies = []

    for (const [key, matchdayPreds] of Object.entries(predictionsByMatchday)) {
      let correctResults = 0
      let exactScores = 0
      let latestMatchDate = matchdayPreds[0]?.utc_date

      for (const p of matchdayPreds) {
        if (p.utc_date && (!latestMatchDate || p.utc_date > latestMatchDate)) {
          latestMatchDate = p.utc_date
        }
      }

      for (const p of matchdayPreds) {
        const predResult = p.pred_home > p.pred_away ? 'HOME' : p.pred_home < p.pred_away ? 'AWAY' : 'DRAW'
        const actualResult = p.actual_home > p.actual_away ? 'HOME' : p.actual_home < p.actual_away ? 'AWAY' : 'DRAW'

        const isExact = p.pred_home === p.actual_home && p.pred_away === p.actual_away
        const isCorrect = predResult === actualResult

        if (isExact) exactScores++
        if (isCorrect) correctResults++
      }

      console.log(`  ${key}: ${correctResults} correct results, ${exactScores} exact scores`)

      if (correctResults >= 2) {
        trophies.push({ type: 'opportunist', unlocked_at: latestMatchDate })
        console.log(`    → Opportunist trophy earned! Date: ${latestMatchDate}`)
      }
      if (exactScores >= 2) {
        trophies.push({ type: 'nostradamus', unlocked_at: latestMatchDate })
        console.log(`    → Nostradamus trophy earned! Date: ${latestMatchDate}`)
      }
    }

    console.log(`\nTotal trophies to unlock: ${trophies.length}`)

    // Dédupliquer
    const uniqueTrophies = {}
    for (const trophy of trophies) {
      if (!uniqueTrophies[trophy.type]) {
        uniqueTrophies[trophy.type] = trophy
      }
    }

    console.log(`Unique trophies: ${Object.keys(uniqueTrophies).length}`)

    // Insérer dans la base de données
    for (const trophy of Object.values(uniqueTrophies)) {
      console.log(`\nInserting ${trophy.type} with date ${trophy.unlocked_at}...`)

      const { data, error } = await supabase
        .from('user_trophies')
        .upsert({
          user_id: user.id,
          trophy_type: trophy.type,
          unlocked_at: trophy.unlocked_at,
          is_new: true
        }, {
          onConflict: 'user_id,trophy_type',
          ignoreDuplicates: true
        })
        .select()

      if (error) {
        console.error(`Error inserting ${trophy.type}:`, error)
      } else {
        console.log(`✓ ${trophy.type} trophy unlocked!`)
      }
    }

    // Vérifier les trophées finaux
    const { data: finalTrophies } = await supabase
      .from('user_trophies')
      .select('*')
      .eq('user_id', user.id)
      .order('unlocked_at', { ascending: false })

    console.log('\n=== FINAL TROPHIES ===')
    finalTrophies.forEach(t => {
      console.log(`- ${t.trophy_type}: ${t.unlocked_at} ${t.is_new ? '(NEW)' : ''}`)
    })

  } catch (error) {
    console.error('Error:', error)
  }
}

triggerTrophyDetection()
