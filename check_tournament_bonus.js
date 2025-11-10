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

async function checkTournamentBonus() {
  console.log('=== Vérification de l\'option bonus_match pour BrazilTest ===\n')

  // First, list all tournaments to see what we have
  console.log('Recherche de tous les tournois...\n')
  const { data: allTournaments, error: listError } = await supabase
    .from('tournaments')
    .select('id, name, slug, bonus_match')
    .order('created_at', { ascending: false })

  if (listError) {
    console.error('❌ Erreur lors de la liste:', listError.message)
    return
  }

  console.log(`✓ ${allTournaments.length} tournois trouvés:`)
  allTournaments.forEach(t => {
    console.log(`  - ${t.name} (${t.slug})`)
  })

  console.log('\n' + '='.repeat(70) + '\n')

  // Now try to find the BrazilTest tournament
  const tournament = allTournaments.find(t => t.slug === 'UBPBZYHL' || t.slug === 'braziltest_UBPBZYHL')

  if (!tournament) {
    console.log('❌ Tournoi BrazilTest non trouvé')
    return
  }

  console.log('✓ Tournoi trouvé:', tournament.name)
  console.log('  - ID:', tournament.id)
  console.log('  - Slug:', tournament.slug)
  console.log('  - Option bonus_match:', tournament.bonus_match !== undefined ? (tournament.bonus_match ? '✓ ACTIVÉE' : '✗ DÉSACTIVÉE') : '⚠️  Colonne inexistante')

  if (tournament.bonus_match !== undefined) {
    console.log('\nValeur brute:', tournament.bonus_match)
  }
}

checkTournamentBonus()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Erreur:', err)
    process.exit(1)
  })
