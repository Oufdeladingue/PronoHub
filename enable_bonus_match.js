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

async function enableBonusMatch() {
  console.log('=== Activation de l\'option bonus_match pour BrazilTest ===\n')

  const { data: tournament, error: fetchError } = await supabase
    .from('tournaments')
    .select('*')
    .eq('slug', 'UBPBZYHL')
    .single()

  if (fetchError) {
    console.error('❌ Erreur lors de la récupération du tournoi:', fetchError.message)
    return
  }

  console.log('✓ Tournoi trouvé:', tournament.name)
  console.log('  - État actuel bonus_match:', tournament.bonus_match)

  const { error: updateError } = await supabase
    .from('tournaments')
    .update({ bonus_match: true })
    .eq('id', tournament.id)

  if (updateError) {
    console.error('❌ Erreur lors de la mise à jour:', updateError.message)
    return
  }

  console.log('\n✓ Option bonus_match ACTIVÉE avec succès!')

  // Vérifier la mise à jour
  const { data: updatedTournament } = await supabase
    .from('tournaments')
    .select('bonus_match')
    .eq('id', tournament.id)
    .single()

  console.log('  - Nouvel état:', updatedTournament.bonus_match ? '✓ ACTIVÉE' : '✗ DÉSACTIVÉE')
}

enableBonusMatch()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Erreur:', err)
    process.exit(1)
  })
