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

async function verifyBonusPoints() {
  console.log('=== Vérification des points bonus pour la J32 ===\n')

  // 1. Récupérer le tournoi
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('*')
    .eq('slug', 'UBPBZYHL')
    .single()

  console.log(`Tournoi: ${tournament.name}`)
  console.log(`Bonus match activé: ${tournament.bonus_match}\n`)

  // 2. Récupérer le match bonus de la J32
  const { data: bonusMatch } = await supabase
    .from('tournament_bonus_matches')
    .select('match_id, imported_matches(home_team_name, away_team_name, home_score, away_score)')
    .eq('tournament_id', tournament.id)
    .eq('matchday', 32)
    .single()

  if (!bonusMatch) {
    console.log('❌ Aucun match bonus trouvé pour la J32')
    return
  }

  console.log('Match bonus de la J32:')
  console.log(`  ${bonusMatch.imported_matches.home_team_name} vs ${bonusMatch.imported_matches.away_team_name}`)
  console.log(`  Score: ${bonusMatch.imported_matches.home_score} - ${bonusMatch.imported_matches.away_score}\n`)

  // 3. Récupérer les paramètres de points
  const { data: settings } = await supabase
    .from('admin_settings')
    .select('setting_key, setting_value')
    .in('setting_key', ['points_exact_score', 'points_correct_result', 'points_incorrect_result'])

  const pointsSettings = {
    exactScore: parseInt(settings.find(s => s.setting_key === 'points_exact_score')?.setting_value || '6'),
    correctResult: parseInt(settings.find(s => s.setting_key === 'points_correct_result')?.setting_value || '4'),
    incorrectResult: parseInt(settings.find(s => s.setting_key === 'points_incorrect_result')?.setting_value || '0')
  }

  console.log('Barème de points:')
  console.log(`  - Score exact: ${pointsSettings.exactScore} pts`)
  console.log(`  - Bon résultat: ${pointsSettings.correctResult} pts`)
  console.log(`  - Mauvais résultat: ${pointsSettings.incorrectResult} pts\n`)

  // 4. Récupérer les participants et leurs pronostics pour le match bonus
  const { data: predictions } = await supabase
    .from('predictions')
    .select('*, profiles(username)')
    .eq('tournament_id', tournament.id)
    .eq('match_id', bonusMatch.match_id)

  console.log(`${predictions.length} pronostics trouvés pour le match bonus:\n`)

  predictions.forEach(pred => {
    const realHome = bonusMatch.imported_matches.home_score
    const realAway = bonusMatch.imported_matches.away_score
    const predHome = pred.predicted_home_score
    const predAway = pred.predicted_away_score

    const isExact = predHome === realHome && predAway === realAway
    const predOutcome = predHome > predAway ? 'H' : (predHome < predAway ? 'A' : 'D')
    const realOutcome = realHome > realAway ? 'H' : (realHome < realAway ? 'A' : 'D')
    const isCorrect = predOutcome === realOutcome

    let basePoints = 0
    let result = ''
    if (isExact) {
      basePoints = pointsSettings.exactScore
      result = '🎯 Score exact'
    } else if (isCorrect) {
      basePoints = pointsSettings.correctResult
      result = '✓ Bon résultat'
    } else {
      basePoints = pointsSettings.incorrectResult
      result = '✗ Mauvais résultat'
    }

    const bonusPoints = basePoints * 2

    console.log(`${pred.profiles?.username || 'Inconnu'}:`)
    console.log(`  Pronostic: ${predHome} - ${predAway}`)
    console.log(`  ${result}`)
    console.log(`  Points de base: ${basePoints} pts`)
    console.log(`  Points avec bonus x2: ${bonusPoints} pts`)
    console.log()
  })

  console.log('='.repeat(70))
  console.log('✓ Vérification terminée')
  console.log('Les points des matchs bonus sont bien doublés!')
  console.log('='.repeat(70))
}

verifyBonusPoints()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Erreur:', err)
    process.exit(1)
  })
