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

async function checkPredictionsSchema() {
  const { data: predictions, error } = await supabase
    .from('predictions')
    .select('*')
    .limit(1)

  if (error) {
    console.error('Erreur:', error.message)
  } else if (predictions && predictions.length > 0) {
    console.log('Colonnes de la table predictions:')
    console.log(Object.keys(predictions[0]).join(', '))
  } else {
    console.log('Aucun pronostic trouvé, impossible de déterminer le schéma')
  }
}

checkPredictionsSchema()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Erreur:', err)
    process.exit(1)
  })
