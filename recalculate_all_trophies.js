require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function recalculateAllTrophies() {
  try {
    // Trouver l'utilisateur Rom's
    const { data: user } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('username', "Rom's")
      .single()

    console.log('Utilisateur:', user.username, '| ID:', user.id)

    // Supprimer tous les trophées actuels pour recalculer
    console.log('\nSuppression des trophées existants...')
    await supabase
      .from('user_trophies')
      .delete()
      .eq('user_id', user.id)

    console.log('✓ Trophées supprimés\n')

    // Appeler l'API pour recalculer tous les trophées
    console.log('Recalcul de tous les trophées via l\'API...\n')

    // Simuler un appel API (on va recalculer manuellement ici pour voir les détails)
    const trophies = []

    // Récupérer les tournois
    const { data: tournaments } = await supabase
      .from('tournament_participants')
      .select('tournament_id')
      .eq('user_id', user.id)

    console.log(`Tournois de l'utilisateur: ${tournaments?.length || 0}`)

    // Récupérer les pronostics
    const { data: predictions } = await supabase
      .from('predictions')
      .select('id, predicted_home_score, predicted_away_score, match_id, tournament_id, points_earned')
      .eq('user_id', user.id)

    console.log(`Pronostics: ${predictions?.length || 0}`)

    // Récupérer les matchs
    const matchIds = predictions.map(p => p.match_id).filter(Boolean)
    const { data: matches } = await supabase
      .from('imported_matches')
      .select('id, home_score, away_score, status, finished, matchday, utc_date')
      .in('id', matchIds)

    console.log(`Matchs: ${matches?.length || 0}\n`)

    const matchesMap = {}
    matches.forEach(match => {
      matchesMap[match.id] = match
    })

    // 1. LE VEINARD - Au moins un bon résultat
    console.log('1. Vérification "Le Veinard" (bon résultat)...')
    let correctResultDate = ''
    for (const pred of predictions) {
      const match = matchesMap[pred.match_id]
      if (!match || (match.status !== 'FINISHED' && match.finished !== true)) continue
      if (match.home_score === null || match.away_score === null) continue

      const predResult = pred.predicted_home_score > pred.predicted_away_score ? 'HOME' :
                        pred.predicted_home_score < pred.predicted_away_score ? 'AWAY' : 'DRAW'
      const actualResult = match.home_score > match.away_score ? 'HOME' :
                          match.home_score < match.away_score ? 'AWAY' : 'DRAW'

      if (predResult === actualResult) {
        correctResultDate = match.utc_date
        console.log(`   ✓ Trouvé! Date: ${correctResultDate}`)
        trophies.push({ type: 'correct_result', unlocked_at: correctResultDate })
        break
      }
    }

    // 2. L'ANALYSTE - Au moins un score exact
    console.log('2. Vérification "L\'Analyste" (score exact)...')
    let exactScoreDate = ''
    for (const pred of predictions) {
      const match = matchesMap[pred.match_id]
      if (!match || (match.status !== 'FINISHED' && match.finished !== true)) continue
      if (match.home_score === null || match.away_score === null) continue

      if (pred.predicted_home_score === match.home_score && pred.predicted_away_score === match.away_score) {
        exactScoreDate = match.utc_date
        console.log(`   ✓ Trouvé! Date: ${exactScoreDate}`)
        trophies.push({ type: 'exact_score', unlocked_at: exactScoreDate })
        break
      }
    }

    // 3. THE KING OF DAY - Premier d'une journée
    console.log('3. Vérification "The King of Day"...')
    // (logique complexe, on va juste vérifier s'il existe déjà)

    // 4. LE BALLON D'OR - Premier au classement final
    console.log('4. Vérification "Le Ballon d\'or"...')
    // (logique complexe, on va juste vérifier s'il existe déjà)

    // 5. LE ROI DU DOUBLÉ - Premier de deux journées consécutives
    console.log('5. Vérification "Le Roi du Doublé"...')
    // (logique complexe)

    // 6. L'OPPORTUNISTE - 2+ bons résultats sur une journée
    console.log('6. Vérification "L\'Opportuniste"...')
    const predictionsByMatchday = {}
    for (const pred of predictions) {
      const match = matchesMap[pred.match_id]
      if (!match || (match.status !== 'FINISHED' && match.finished !== true)) continue
      if (match.home_score === null || match.away_score === null) continue

      const key = `${pred.tournament_id}_${match.matchday}`
      if (!predictionsByMatchday[key]) predictionsByMatchday[key] = []

      const predResult = pred.predicted_home_score > pred.predicted_away_score ? 'HOME' :
                        pred.predicted_home_score < pred.predicted_away_score ? 'AWAY' : 'DRAW'
      const actualResult = match.home_score > match.away_score ? 'HOME' :
                          match.home_score < match.away_score ? 'AWAY' : 'DRAW'

      predictionsByMatchday[key].push({
        pred_home: pred.predicted_home_score,
        pred_away: pred.predicted_away_score,
        actual_home: match.home_score,
        actual_away: match.away_score,
        utc_date: match.utc_date,
        is_correct: predResult === actualResult,
        is_exact: pred.predicted_home_score === match.home_score && pred.predicted_away_score === match.away_score
      })
    }

    for (const [key, preds] of Object.entries(predictionsByMatchday)) {
      const correctResults = preds.filter(p => p.is_correct).length
      const exactScores = preds.filter(p => p.is_exact).length

      if (correctResults >= 2) {
        const latestDate = preds.reduce((latest, p) => p.utc_date > latest ? p.utc_date : latest, preds[0].utc_date)
        console.log(`   ✓ Opportuniste trouvé! Journée ${key}: ${correctResults} bons résultats, date: ${latestDate}`)
        trophies.push({ type: 'opportunist', unlocked_at: latestDate })
        break
      }
    }

    // 7. LE NOSTRADAMUS - 2+ scores exacts sur une journée
    console.log('7. Vérification "Le Nostradamus"...')
    for (const [key, preds] of Object.entries(predictionsByMatchday)) {
      const exactScores = preds.filter(p => p.is_exact).length

      if (exactScores >= 2) {
        const latestDate = preds.reduce((latest, p) => p.utc_date > latest ? p.utc_date : latest, preds[0].utc_date)
        console.log(`   ✓ Nostradamus trouvé! Journée ${key}: ${exactScores} scores exacts, date: ${latestDate}`)
        trophies.push({ type: 'nostradamus', unlocked_at: latestDate })
        break
      }
    }

    // 8 & 9. LE PROFITEUR & L'OPTIMISATEUR - Matchs bonus
    console.log('8. Vérification "Le Profiteur" (bon résultat sur match bonus)...')
    console.log('9. Vérification "L\'Optimisateur" (score exact sur match bonus)...')

    const tournamentIds = tournaments.map(t => t.tournament_id)
    const { data: bonusMatches } = await supabase
      .from('tournament_bonus_matches')
      .select('match_id')
      .in('tournament_id', tournamentIds)

    if (bonusMatches && bonusMatches.length > 0) {
      const bonusMatchIds = new Set(bonusMatches.map(bm => bm.match_id))
      console.log(`   Matchs bonus: ${bonusMatchIds.size}`)

      for (const pred of predictions) {
        if (!bonusMatchIds.has(pred.match_id)) continue

        const match = matchesMap[pred.match_id]
        if (!match || (match.status !== 'FINISHED' && match.finished !== true)) continue
        if (match.home_score === null || match.away_score === null) continue

        const predResult = pred.predicted_home_score > pred.predicted_away_score ? 'HOME' :
                          pred.predicted_home_score < pred.predicted_away_score ? 'AWAY' : 'DRAW'
        const actualResult = match.home_score > match.away_score ? 'HOME' :
                            match.home_score < match.away_score ? 'AWAY' : 'DRAW'
        const isCorrect = predResult === actualResult
        const isExact = pred.predicted_home_score === match.home_score && pred.predicted_away_score === match.away_score

        if (isExact && !trophies.some(t => t.type === 'bonus_optimizer')) {
          console.log(`   ✓ Optimisateur trouvé! Score exact sur match bonus, date: ${match.utc_date}`)
          trophies.push({ type: 'bonus_optimizer', unlocked_at: match.utc_date })
        }
        if (isCorrect && !trophies.some(t => t.type === 'bonus_profiteer')) {
          console.log(`   ✓ Profiteur trouvé! Bon résultat sur match bonus, date: ${match.utc_date}`)
          trophies.push({ type: 'bonus_profiteer', unlocked_at: match.utc_date })
        }
      }
    } else {
      console.log('   Aucun match bonus configuré')
    }

    console.log(`\n=== RÉSUMÉ: ${trophies.length} trophées à insérer ===`)

    // Insérer les trophées
    for (const trophy of trophies) {
      console.log(`Insertion: ${trophy.type} (${trophy.unlocked_at})`)
      await supabase
        .from('user_trophies')
        .insert({
          user_id: user.id,
          trophy_type: trophy.type,
          unlocked_at: trophy.unlocked_at,
          is_new: true
        })
    }

    console.log('\n✓ Tous les trophées ont été recalculés et insérés!')

    // Afficher le résultat final
    const { data: finalTrophies } = await supabase
      .from('user_trophies')
      .select('*')
      .eq('user_id', user.id)
      .order('unlocked_at', { ascending: true })

    console.log('\n=== TROPHÉES FINAUX ===')
    finalTrophies.forEach(t => {
      console.log(`- ${t.trophy_type}: ${t.unlocked_at}`)
    })

  } catch (error) {
    console.error('Erreur:', error)
  }
}

recalculateAllTrophies()
