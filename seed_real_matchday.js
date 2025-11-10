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
      const h = Math.max(homeScore + Math.floor(Math.random() * 2) - 1, awayScore + 1)
      const a = Math.max(awayScore - Math.floor(Math.random() * 2), 0)
      return { home: h, away: a }
    } else if (draw) {
      // Match nul, on donne un autre match nul
      const score = Math.floor(Math.random() * 4)
      return { home: score, away: score }
    } else {
      // Victoire extérieur
      const h = Math.max(homeScore - Math.floor(Math.random() * 2), 0)
      const a = Math.max(awayScore + Math.floor(Math.random() * 2) - 1, homeScore + 1)
      return { home: h, away: a }
    }
  } else {
    // Mauvais résultat
    return { home: randomScore(), away: randomScore() }
  }
}

async function seedRealMatchday() {
  console.log('=== Création de données de test avec la journée 32 (réelle) ===\n')

  const testMatchday = 32

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

  // 2. Mettre à jour le tournoi pour inclure la journée 32
  console.log('\n2. Mise à jour du tournoi pour inclure la J32...')
  const { error: updateError } = await supabase
    .from('tournaments')
    .update({
      starting_matchday: 32,
      ending_matchday: 38
    })
    .eq('id', tournament.id)

  if (updateError) {
    console.error('❌ Erreur lors de la mise à jour du tournoi:', updateError.message)
    return
  }

  console.log('✓ Tournoi mis à jour (J32 à J38)')

  // 3. Récupérer les participants
  console.log('\n3. Récupération des participants...')
  const { data: participants, error: participantsError } = await supabase
    .from('tournament_participants')
    .select('user_id, profiles(username)')
    .eq('tournament_id', tournament.id)

  if (participantsError || !participants || participants.length === 0) {
    console.error('❌ Aucun participant trouvé')
    return
  }

  console.log(`✓ ${participants.length} participants trouvés`)

  // 4. Récupérer les matchs de la J32 avec leurs vrais scores
  console.log('\n4. Récupération des matchs de la J32...')
  const { data: matches, error: matchesError } = await supabase
    .from('imported_matches')
    .select('*')
    .eq('competition_id', tournament.competition_id)
    .eq('matchday', testMatchday)

  if (matchesError || !matches || matches.length === 0) {
    console.error('❌ Aucun match trouvé pour la J32')
    return
  }

  console.log(`✓ ${matches.length} matchs trouvés`)

  // 5. Vérifier et afficher les vrais scores
  console.log('\n5. Scores réels de la J32:')
  const matchScores = new Map()
  let finishedCount = 0

  for (const match of matches) {
    if (match.home_score !== null && match.away_score !== null) {
      matchScores.set(match.id, { homeScore: match.home_score, awayScore: match.away_score })
      console.log(`✓ ${match.home_team_name} ${match.home_score} - ${match.away_score} ${match.away_team_name}`)
      finishedCount++

      // S'assurer que le match est marqué comme terminé
      if (!match.finished) {
        await supabase
          .from('imported_matches')
          .update({ finished: true, status: 'FINISHED' })
          .eq('id', match.id)
      }
    } else {
      console.log(`⚠️  ${match.home_team_name} vs ${match.away_team_name} - Pas encore de score`)
    }
  }

  if (finishedCount === 0) {
    console.error('\n❌ Aucun match terminé trouvé pour la J32')
    console.log('Les matchs de la J32 n\'ont probablement pas encore eu lieu ou les scores ne sont pas importés.')
    return
  }

  console.log(`\n✓ ${finishedCount} matchs terminés avec scores`)

  // 6. Supprimer les anciens pronostics de test s'ils existent
  console.log('\n6. Nettoyage des anciens pronostics...')
  const matchIds = matches.map(m => m.id)
  await supabase
    .from('predictions')
    .delete()
    .eq('tournament_id', tournament.id)
    .in('match_id', matchIds)

  console.log('✓ Anciens pronostics supprimés')

  // 7. Créer des pronostics pour chaque participant (seulement pour les matchs terminés)
  console.log('\n7. Création des pronostics pour les participants...')
  const predictions = []

  for (const participant of participants) {
    const accuracy = 0.3 + Math.random() * 0.5
    console.log(`\n  ${participant.profiles?.username || 'Inconnu'} (précision: ${(accuracy * 100).toFixed(0)}%)`)

    let exactScores = 0
    let correctResults = 0
    let totalPoints = 0

    for (const match of matches) {
      const realScore = matchScores.get(match.id)
      if (!realScore) continue // Skip les matchs sans score

      const prediction = generatePrediction(realScore.homeScore, realScore.awayScore, accuracy)

      predictions.push({
        user_id: participant.user_id,
        tournament_id: tournament.id,
        match_id: match.id,
        predicted_home_score: prediction.home,
        predicted_away_score: prediction.away
      })

      // Calculer les points pour affichage
      const isExact = prediction.home === realScore.homeScore && prediction.away === realScore.awayScore
      const predOutcome = prediction.home > prediction.away ? 'H' : (prediction.home < prediction.away ? 'A' : 'D')
      const realOutcome = realScore.homeScore > realScore.awayScore ? 'H' : (realScore.homeScore < realScore.awayScore ? 'A' : 'D')
      const isCorrect = predOutcome === realOutcome

      if (isExact) {
        exactScores++
        totalPoints += 6 // points_exact_score = 6
      } else if (isCorrect) {
        correctResults++
        totalPoints += 4 // points_correct_result = 4
      }

      const icon = isExact ? '🎯' : (isCorrect ? '✓' : '✗')
      console.log(`    ${icon} ${match.home_team_name.substring(0, 15).padEnd(15)} ${prediction.home}-${prediction.away} (réel: ${realScore.homeScore}-${realScore.awayScore})`)
    }

    console.log(`    → ${exactScores} scores exacts, ${correctResults} bons résultats, ${totalPoints} points`)
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

  console.log(`✓ ${predictions.length} pronostics créés`)

  // 9. Résumé
  console.log('\n' + '='.repeat(70))
  console.log('✓ DONNÉES DE TEST CRÉÉES AVEC SUCCÈS')
  console.log('='.repeat(70))
  console.log(`\nTournoi: ${tournament.name}`)
  console.log(`Journée utilisée: J${testMatchday} (avec vrais résultats)`)
  console.log(`Matchs terminés: ${finishedCount}`)
  console.log(`Participants: ${participants.length}`)
  console.log(`Pronostics créés: ${predictions.length}`)
  console.log(`\nConsultez le classement sur:`)
  console.log(`http://localhost:3000/vestiaire/${tournament.slug}/opposition`)
  console.log(`\nPour nettoyer: node cleanup_test_data.js`)
}

seedRealMatchday()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Erreur:', err)
    process.exit(1)
  })
