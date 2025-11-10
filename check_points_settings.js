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

async function checkPointsSettings() {
  console.log('=== Vérification des paramètres de points ===\n')

  // 1. Vérifier admin_settings
  console.log('1. Vérification de la table admin_settings:')
  const { data: adminSettings, error: adminError } = await supabase
    .from('admin_settings')
    .select('*')

  if (adminError) {
    console.error('Erreur:', adminError.message)
  } else {
    console.log('Nombre de paramètres:', adminSettings.length)
    console.log('Paramètres:')
    adminSettings.forEach(setting => {
      console.log(`  - ${setting.setting_key}: ${setting.setting_value}`)
    })
  }

  // 2. Vérifier points_settings (si la table existe)
  console.log('\n2. Vérification de la table points_settings:')
  const { data: pointsSettings, error: pointsError } = await supabase
    .from('points_settings')
    .select('*')

  if (pointsError) {
    console.error('Erreur (la table n\'existe probablement pas):', pointsError.message)
  } else {
    console.log('Nombre de paramètres:', pointsSettings.length)
    console.log('Paramètres:')
    pointsSettings.forEach(setting => {
      console.log(`  - ${JSON.stringify(setting)}`)
    })
  }

  // 3. Vérifier les colonnes de la table tournaments
  console.log('\n3. Vérification d\'un tournoi:')
  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments')
    .select('*')
    .limit(1)
    .single()

  if (tournamentError) {
    console.error('Erreur:', tournamentError.message)
  } else {
    console.log('Colonnes du tournoi:')
    Object.keys(tournament).forEach(key => {
      if (key.includes('point') || key.includes('score')) {
        console.log(`  - ${key}: ${tournament[key]}`)
      }
    })
  }
}

checkPointsSettings()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Erreur:', err)
    process.exit(1)
  })
