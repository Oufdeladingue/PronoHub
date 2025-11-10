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

// Fonction de hash simple pour générer un seed reproductible
function hashString(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash)
}

// Fonction pour générer un match bonus de manière reproductible
function generateBonusMatch(tournamentId, matchday, availableMatches) {
  if (availableMatches.length === 0) {
    throw new Error('Aucun match disponible pour le match bonus')
  }
  const seed = hashString(`${tournamentId}-${matchday}`)
  const index = seed % availableMatches.length
  return availableMatches[index]
}

async function generateBonusMatches() {
  console.log('=== Génération des matchs bonus pour BrazilTest ===\n')

  // 1. Récupérer le tournoi
  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments')
    .select('*')
    .eq('slug', 'UBPBZYHL')
    .single()

  if (tournamentError || !tournament) {
    console.error('❌ Tournoi non trouvé')
    return
  }

  console.log(`✓ Tournoi trouvé: ${tournament.name}`)
  console.log(`  - ID: ${tournament.id}`)
  console.log(`  - Bonus match activé: ${tournament.bonus_match}`)
  console.log(`  - Journées: ${tournament.starting_matchday} à ${tournament.ending_matchday}\n`)

  if (!tournament.bonus_match) {
    console.log('⚠️  L\'option bonus_match n\'est pas activée pour ce tournoi')
    return
  }

  // 2. Supprimer les anciens matchs bonus s'ils existent
  console.log('Nettoyage des anciens matchs bonus...')
  await supabase
    .from('tournament_bonus_matches')
    .delete()
    .eq('tournament_id', tournament.id)

  console.log('✓ Anciens matchs bonus supprimés\n')

  // 3. Générer les matchs bonus pour chaque journée
  console.log('Génération des matchs bonus par journée:\n')
  const bonusMatches = []

  for (let matchday = tournament.starting_matchday; matchday <= tournament.ending_matchday; matchday++) {
    // Récupérer les matchs de cette journée
    const { data: matches } = await supabase
      .from('imported_matches')
      .select('id, home_team_name, away_team_name')
      .eq('competition_id', tournament.competition_id)
      .eq('matchday', matchday)

    if (!matches || matches.length === 0) {
      console.log(`  J${matchday}: ❌ Aucun match disponible`)
      continue
    }

    // Générer le match bonus pour cette journée
    const matchIds = matches.map(m => m.id)
    const bonusMatchId = generateBonusMatch(tournament.id, matchday, matchIds)
    const bonusMatch = matches.find(m => m.id === bonusMatchId)

    bonusMatches.push({
      tournament_id: tournament.id,
      matchday: matchday,
      match_id: bonusMatchId
    })

    console.log(`  J${matchday}: ✓ ${bonusMatch.home_team_name} vs ${bonusMatch.away_team_name}`)
  }

  // 4. Insérer tous les matchs bonus
  console.log('\nInsertion des matchs bonus en base de données...')
  const { error: insertError } = await supabase
    .from('tournament_bonus_matches')
    .insert(bonusMatches)

  if (insertError) {
    console.error('❌ Erreur lors de l\'insertion:', insertError.message)
    return
  }

  console.log(`✓ ${bonusMatches.length} matchs bonus créés avec succès\n`)

  console.log('='.repeat(70))
  console.log('✓ MATCHS BONUS GÉNÉRÉS AVEC SUCCÈS')
  console.log('='.repeat(70))
}

generateBonusMatches()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Erreur:', err)
    process.exit(1)
  })
