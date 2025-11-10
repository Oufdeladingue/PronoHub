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

// Fonction pour générer un pronostic avec une chance de bon résultat
function generatePrediction(homeScore, awayScore, accuracy = 0.5) {
  const rand = Math.random()

  if (rand < accuracy * 0.3) {
    // 30% de chance de score exact (si accuracy = 1)
    return { home: homeScore, away: awayScore }
  } else if (rand < accuracy) {
    // 20% de chance de bon résultat mais pas score exact
    const homeWin = homeScore > awayScore
    const draw = homeScore === awayScore
    const awayWin = homeScore < awayScore

    if (homeWin) {
      // Victoire domicile, on donne un autre score avec victoire domicile
      return { home: homeScore + Math.floor(Math.random() * 2), away: awayScore - Math.floor(Math.random() * 2) }
    } else if (draw) {
      // Match nul, on donne un autre match nul
      const score = Math.floor(Math.random() * 4)
      return { home: score, away: score }
    } else {
      // Victoire extérieur
      return { home: homeScore - Math.floor(Math.random() * 2), away: awayScore + Math.floor(Math.random() * 2) }
    }
  } else {
    // Mauvais résultat
    return { home: randomScore(), away: randomScore() }
  }
}

async function seedTestData() {
  console.log('=== Création de données de test pour le classement ===\n')

  // 1. Trouver le tournoi BrazilTest
  console.log('1. Recherche du tournoi BrazilTest...')
  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments')
    .select('*')
    .ilike('name', '%brazil%test%')
    .single()

  if (tournamentError || !tournament) {
    console.error('❌ Tournoi BrazilTest non trouvé')
    return
  }

  console.log(`✓ Tournoi trouvé: ${tournament.name}`)
  console.log(`  - ID: ${tournament.id}`)
  console.log(`  - Competition: ${tournament.competition_id}`)
  console.log(`  - Journées: ${tournament.starting_matchday} à ${tournament.ending_matchday}`)

  // 2. Récupérer les participants
  console.log('\n2. Récupération des participants...')
  const { data: participants, error: participantsError } = await supabase
    .from('tournament_participants')
    .select('user_id, profiles(username)')
    .eq('tournament_id', tournament.id)

  if (participantsError || !participants || participants.length === 0) {
    console.error('❌ Aucun participant trouvé')
    return
  }

  console.log(`✓ ${participants.length} participants trouvés:`)
  participants.forEach(p => {
    console.log(`  - ${p.profiles?.username || 'Inconnu'}`)
  })

  // 3. Choisir une journée de test (la première journée du tournoi)
  const testMatchday = tournament.starting_matchday
  console.log(`\n3. Journée de test: J${testMatchday}`)

  // 4. Récupérer les matchs de cette journée
  console.log('\n4. Récupération des matchs de la journée...')
  const { data: matches, error: matchesError } = await supabase
    .from('imported_matches')
    .select('*')
    .eq('competition_id', tournament.competition_id)
    .eq('matchday', testMatchday)

  if (matchesError || !matches || matches.length === 0) {
    console.error('❌ Aucun match trouvé pour cette journée')
    return
  }

  console.log(`✓ ${matches.length} matchs trouvés`)

  // 5. Générer des scores pour les matchs et les marquer comme terminés
  console.log('\n5. Génération des scores réels pour les matchs...')
  const matchScores = new Map()

  for (const match of matches) {
    const homeScore = randomScore()
    const awayScore = randomScore()
    matchScores.set(match.id, { homeScore, awayScore })

    const { error: updateError } = await supabase
      .from('imported_matches')
      .update({
        home_score: homeScore,
        away_score: awayScore,
        finished: true,
        status: 'FINISHED'
      })
      .eq('id', match.id)

    if (updateError) {
      console.error(`❌ Erreur lors de la mise à jour du match ${match.home_team_name} vs ${match.away_team_name}:`, updateError.message)
    } else {
      console.log(`✓ ${match.home_team_name} ${homeScore} - ${awayScore} ${match.away_team_name}`)
    }
  }

  // 6. Supprimer les anciens pronostics de test s'ils existent
  console.log('\n6. Nettoyage des anciens pronostics de test...')
  const matchIds = matches.map(m => m.id)
  const { error: deleteError } = await supabase
    .from('predictions')
    .delete()
    .eq('tournament_id', tournament.id)
    .in('match_id', matchIds)

  if (deleteError) {
    console.log('⚠️  Erreur lors du nettoyage:', deleteError.message)
  } else {
    console.log('✓ Anciens pronostics supprimés')
  }

  // 7. Créer des pronostics pour chaque participant
  console.log('\n7. Création des pronostics pour les participants...')
  const predictions = []

  for (const participant of participants) {
    // Chaque participant a une "précision" différente (de 0.3 à 0.8)
    const accuracy = 0.3 + Math.random() * 0.5
    console.log(`\n  Participant: ${participant.profiles?.username || 'Inconnu'} (précision: ${(accuracy * 100).toFixed(0)}%)`)

    for (const match of matches) {
      const realScore = matchScores.get(match.id)
      const prediction = generatePrediction(realScore.homeScore, realScore.awayScore, accuracy)

      predictions.push({
        user_id: participant.user_id,
        tournament_id: tournament.id,
        match_id: match.id,
        predicted_home_score: prediction.home,
        predicted_away_score: prediction.away
      })

      console.log(`    ${match.home_team_name} ${prediction.home} - ${prediction.away} ${match.away_team_name} (réel: ${realScore.homeScore}-${realScore.awayScore})`)
    }
  }

  // 8. Insérer tous les pronostics
  console.log('\n8. Insertion des pronostics en base de données...')
  const { error: insertError } = await supabase
    .from('predictions')
    .insert(predictions)

  if (insertError) {
    console.error('❌ Erreur lors de l\'insertion des pronostics:', insertError.message)
    return
  }

  console.log(`✓ ${predictions.length} pronostics créés avec succès`)

  // 9. Résumé
  console.log('\n' + '='.repeat(60))
  console.log('✓ DONNÉES DE TEST CRÉÉES AVEC SUCCÈS')
  console.log('='.repeat(60))
  console.log(`\nTournoi: ${tournament.name}`)
  console.log(`Journée de test: J${testMatchday}`)
  console.log(`Nombre de matchs: ${matches.length}`)
  console.log(`Nombre de participants: ${participants.length}`)
  console.log(`Nombre de pronostics: ${predictions.length}`)
  console.log(`\nVous pouvez maintenant tester le classement sur:`)
  console.log(`http://localhost:3000/vestiaire/${tournament.slug}/opposition`)
  console.log('\nPour nettoyer les données de test, exécutez:')
  console.log('node cleanup_test_data.js')
}

seedTestData()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Erreur:', err)
    process.exit(1)
  })
