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

async function applyMigrations() {
  console.log('=== Application des migrations ===\n')

  const migrationsDir = path.join(__dirname, 'supabase', 'migrations')
  const migrationFiles = [
    'add_match_results_and_bonus.sql',
    'add_bonus_match_to_tournaments.sql'
  ]

  for (const file of migrationFiles) {
    const filePath = path.join(migrationsDir, file)

    if (!fs.existsSync(filePath)) {
      console.error(`❌ Fichier non trouvé: ${file}`)
      continue
    }

    console.log(`\n📄 Application de ${file}...`)
    const sql = fs.readFileSync(filePath, 'utf-8')

    // Diviser le SQL en commandes individuelles (séparées par des points-virgules)
    const commands = sql
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'))

    for (const command of commands) {
      try {
        const { error } = await supabase.rpc('exec_sql', { sql_query: command })

        if (error) {
          // Essayer d'exécuter via une autre méthode si exec_sql n'existe pas
          console.log('   Tentative d\'exécution directe...')
          // Note: Supabase JS ne permet pas d'exécuter du DDL directement
          // Il faut utiliser l'API REST ou l'interface Supabase
          console.log('   ⚠️  Cette commande doit être exécutée manuellement dans Supabase:')
          console.log('   ' + command.substring(0, 100) + (command.length > 100 ? '...' : ''))
        } else {
          console.log('   ✓ Commande exécutée')
        }
      } catch (err) {
        console.log('   ⚠️  Cette commande doit être exécutée manuellement dans Supabase:')
        console.log('   ' + command.substring(0, 100) + (command.length > 100 ? '...' : ''))
      }
    }
  }

  console.log('\n\n=== Instructions ===')
  console.log('Les migrations SQL ne peuvent pas être appliquées automatiquement via le client Supabase.')
  console.log('Veuillez suivre ces étapes:')
  console.log('\n1. Allez sur: https://supabase.com/dashboard/project/txpmihreaxmtsxlgmdko/sql/new')
  console.log('2. Copiez et exécutez le contenu de: supabase/migrations/add_match_results_and_bonus.sql')
  console.log('3. Puis copiez et exécutez: supabase/migrations/add_bonus_match_to_tournaments.sql')
  console.log('\nOu bien, utilisez la méthode ci-dessous si vous avez psql installé.')
}

applyMigrations()
  .then(() => {
    console.log('\n✓ Script terminé')
    process.exit(0)
  })
  .catch(err => {
    console.error('Erreur:', err)
    process.exit(1)
  })
