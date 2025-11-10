const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Lire le fichier .env.local
const envPath = path.join(__dirname, '.env.local')
const envContent = fs.readFileSync(envPath, 'utf-8')
const envVars = {}
envContent.split('\n').forEach(line => {
  const [key, ...values] = line.split('=')
  if (key && values.length) {
    envVars[key.trim()] = values.join('=').trim()
  }
})

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = envVars.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function calculateJoueur2Points() {
  console.log('=== Calcul des points de joueur2 pour la J32 ===\n')

  // 1. Récupérer le tournoi
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('*')
    .eq('slug', 'UBPBZYHL')
    .single()

  // 2. Récupérer joueur2
  const { data: user } = await supabase
    .from('profiles')
    .select('id, username')
    .eq('username', 'joueur2')
    .single()

  console.log(`Joueur: ${user.username}\n`)

  // 3. Récupérer les paramètres de points
  const { data: settings } = await supabase
    .from('admin_settings')
    .select('setting_key, setting_value')
    .in('setting_key', ['points_exact_score', 'points_correct_result', 'points_incorrect_result'])

  const pointsSettings = {
    exactScore: parseInt(settings.find(s => s.setting_key === 'points_exact_score')?.setting_value || '5'),
    correctResult: parseInt(settings.find(s => s.setting_key === 'points_correct_result')?.setting_value || '3'),
    incorrectResult: parseInt(settings.find(s => s.setting_key === 'points_incorrect_result')?.setting_value || '0')
  }

  // 4. Récupérer le match bonus
  const { data: bonusMatch } = await supabase
    .from('tournament_bonus_matches')
    .select('match_id')
    .eq('tournament_id', tournament.id)
    .eq('matchday', 32)
    .single()

  // 5. Récupérer les matchs et pronostics
  const { data: matches } = await supabase
    .from('imported_matches')
    .select('*')
    .eq('competition_id', tournament.competition_id)
    .eq('matchday', 32)
    .order('utc_date', { ascending: true })

  const { data: predictions } = await supabase
    .from('predictions')
    .select('*')
    .eq('user_id', user.id)
    .eq('tournament_id', tournament.id)
    .in('match_id', matches.map(m => m.id))

  // 6. Calculer les points pour chaque match
  let totalPoints = 0
  let exactScores = 0
  let correctResults = 0

  console.log('Détail des points par match:\n')

  for (const prediction of predictions) {
    const match = matches.find(m => m.id === prediction.match_id)
    const isBonus = match.id === bonusMatch.match_id

    const predHome = prediction.predicted_home_score
    const predAway = prediction.predicted_away_score
    const realHome = match.home_score
    const realAway = match.away_score

    const isExact = predHome === realHome && predAway === realAway
    const predOutcome = predHome > predAway ? 'H' : (predHome < predAway ? 'A' : 'D')
    const realOutcome = realHome > realAway ? 'H' : (realHome < realAway ? 'A' : 'D')
    const isCorrect = predOutcome === realOutcome

    let basePoints = 0
    let result = ''

    if (isExact) {
      basePoints = pointsSettings.exactScore
      result = '🎯 Score exact'
      exactScores++
    } else if (isCorrect) {
      basePoints = pointsSettings.correctResult
      result = '✓ Bon résultat'
      correctResults++
    } else {
      basePoints = pointsSettings.incorrectResult
      result = '✗ Mauvais résultat'
    }

    const finalPoints = isBonus ? basePoints * 2 : basePoints
    totalPoints += finalPoints

    console.log(`${match.home_team_name.substring(0, 20).padEnd(20)} ${realHome}-${realAway}`)
    console.log(`  Pronostic: ${predHome}-${predAway}`)
    console.log(`  ${result}`)
    console.log(`  Points: ${basePoints} pts${isBonus ? ' x2 (BONUS) = ' + finalPoints + ' pts' : ''}`)
    console.log()
  }

  console.log('='.repeat(70))
  console.log('RÉSUMÉ')
  console.log('='.repeat(70))
  console.log(`Scores exacts: ${exactScores}`)
  console.log(`Bons résultats: ${correctResults}`)
  console.log(`Total des points: ${totalPoints} pts`)
  console.log('='.repeat(70))
}

calculateJoueur2Points()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Erreur:', err)
    process.exit(1)
  })
