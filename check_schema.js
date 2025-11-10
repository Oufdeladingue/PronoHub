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

async function checkSchema() {
  console.log('=== Vérification du schéma de la base de données ===\n')

  // 1. Vérifier les colonnes de imported_matches
  console.log('1. Colonnes de imported_matches:')
  const { data: match, error: matchError } = await supabase
    .from('imported_matches')
    .select('*')
    .limit(1)
    .single()

  if (matchError) {
    console.error('Erreur:', matchError.message)
  } else if (match) {
    console.log('Colonnes disponibles:', Object.keys(match).join(', '))
    console.log('\nColonnes liées aux résultats:')
    Object.keys(match).forEach(key => {
      if (key.includes('score') || key === 'finished' || key === 'status') {
        console.log(`  - ${key}: ${match[key]}`)
      }
    })
  }

  // 2. Vérifier si la table tournament_bonus_matches existe
  console.log('\n2. Vérification de tournament_bonus_matches:')
  const { data: bonusMatches, error: bonusError } = await supabase
    .from('tournament_bonus_matches')
    .select('*')
    .limit(1)

  if (bonusError) {
    console.error('Erreur (la table n\'existe probablement pas):', bonusError.message)
  } else {
    console.log('✓ La table tournament_bonus_matches existe')
    if (bonusMatches && bonusMatches.length > 0) {
      console.log('Colonnes:', Object.keys(bonusMatches[0]).join(', '))
    }
  }

  // 3. Vérifier les colonnes de tournaments
  console.log('\n3. Colonnes de tournaments (bonus_match):')
  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments')
    .select('*')
    .limit(1)
    .single()

  if (tournamentError) {
    console.error('Erreur:', tournamentError.message)
  } else if (tournament) {
    console.log('Colonne bonus_match:', tournament.bonus_match !== undefined ? '✓ Existe' : '✗ N\'existe pas')
    if (tournament.bonus_match !== undefined) {
      console.log('Valeur:', tournament.bonus_match)
    }
  }
}

checkSchema()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Erreur:', err)
    process.exit(1)
  })
