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

// Fonction pour générer un score aléatoire (0-5 buts)
function randomScore() {
  return Math.floor(Math.random() * 6)
}

async function updateJoueur2Predictions() {
  console.log('=== Mise à jour des pronostics de joueur2 pour la J32 ===\n')

  // 1. Récupérer le tournoi
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('*')
    .eq('slug', 'UBPBZYHL')
    .single()

  console.log(`✓ Tournoi: ${tournament.name}\n`)

  // 2. Récupérer joueur2
  const { data: user } = await supabase
    .from('profiles')
    .select('id, username')
    .eq('username', 'joueur2')
    .single()

  if (!user) {
    console.error('❌ joueur2 non trouvé')
    return
  }

  console.log(`✓ Utilisateur: ${user.username} (${user.id})\n`)

  // 3. Récupérer tous les matchs de la J32
  const { data: matches } = await supabase
    .from('imported_matches')
    .select('*')
    .eq('competition_id', tournament.competition_id)
    .eq('matchday', 32)
    .order('utc_date', { ascending: true })

  console.log(`✓ ${matches.length} matchs trouvés pour la J32\n`)

  // 4. Récupérer le match bonus
  const { data: bonusMatch } = await supabase
    .from('tournament_bonus_matches')
    .select('match_id')
    .eq('tournament_id', tournament.id)
    .eq('matchday', 32)
    .single()

  console.log(`✓ Match bonus: ${matches.find(m => m.id === bonusMatch.match_id)?.home_team_name} vs ${matches.find(m => m.id === bonusMatch.match_id)?.away_team_name}\n`)

  // 5. Supprimer les anciens pronostics de joueur2 pour la J32
  const matchIds = matches.map(m => m.id)
  await supabase
    .from('predictions')
    .delete()
    .eq('user_id', user.id)
    .eq('tournament_id', tournament.id)
    .in('match_id', matchIds)

  console.log('✓ Anciens pronostics supprimés\n')

  // 6. Créer les nouveaux pronostics
  console.log('Création des nouveaux pronostics:\n')
  const predictions = []

  for (const match of matches) {
    let predHome, predAway

    // Pour le match bonus SE Palmeiras vs Santos FC, mettre 2-0
    if (match.id === bonusMatch.match_id) {
      predHome = 2
      predAway = 0
      console.log(`  ⭐ ${match.home_team_name} vs ${match.away_team_name}`)
      console.log(`     Pronostic: ${predHome} - ${predAway} (MATCH BONUS - Score exact!)`)
      console.log(`     Score réel: ${match.home_score} - ${match.away_score}`)
    } else {
      // Pour les autres matchs, scores aléatoires
      predHome = randomScore()
      predAway = randomScore()
      console.log(`  ${match.home_team_name} vs ${match.away_team_name}`)
      console.log(`     Pronostic: ${predHome} - ${predAway}`)
      console.log(`     Score réel: ${match.home_score} - ${match.away_score}`)
    }

    predictions.push({
      user_id: user.id,
      tournament_id: tournament.id,
      match_id: match.id,
      predicted_home_score: predHome,
      predicted_away_score: predAway
    })

    console.log()
  }

  // 7. Insérer tous les pronostics
  const { error: insertError } = await supabase
    .from('predictions')
    .insert(predictions)

  if (insertError) {
    console.error('❌ Erreur lors de l\'insertion:', insertError.message)
    return
  }

  console.log('='.repeat(70))
  console.log('✓ PRONOSTICS CRÉÉS AVEC SUCCÈS')
  console.log('='.repeat(70))
  console.log(`\n${predictions.length} pronostics créés pour joueur2`)
  console.log(`Le match bonus (SE Palmeiras vs Santos FC) a le score exact: 2-0`)
  console.log(`Ce match devrait rapporter 10 points (5 pts x2 pour le bonus)`)
}

updateJoueur2Predictions()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Erreur:', err)
    process.exit(1)
  })
