/**
 * Script pour appliquer la migration add_stage_to_matches
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import path from 'path'
import fs from 'fs'

// Charger les variables d'environnement
config({ path: path.join(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables d\'environnement manquantes')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function applyMigration() {
  console.log('📊 Application de la migration add_stage_to_matches...\n')

  try {
    // Lire le fichier de migration
    const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', 'add_stage_to_matches.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8')

    // Extraire les commandes SQL (ignorer les commentaires)
    const sqlCommands = migrationSQL
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd && !cmd.startsWith('--') && !cmd.startsWith('/*'))

    console.log(`📝 ${sqlCommands.length} commandes SQL à exécuter\n`)

    // Exécuter chaque commande
    for (let i = 0; i < sqlCommands.length; i++) {
      const cmd = sqlCommands[i]
      if (!cmd) continue

      console.log(`⚙️  Commande ${i + 1}/${sqlCommands.length}:`)
      console.log(cmd.substring(0, 100) + (cmd.length > 100 ? '...' : ''))

      const { error } = await supabase.rpc('exec_sql', { sql: cmd })

      if (error) {
        // Certaines erreurs sont OK (ex: colonne déjà existante)
        if (error.message.includes('already exists')) {
          console.log('   ⚠️  Déjà existant (ignoré)')
        } else {
          console.error('   ❌ Erreur:', error.message)
        }
      } else {
        console.log('   ✅ Succès')
      }
    }

    // Vérifier que la colonne existe
    console.log('\n🔍 Vérification de la colonne stage...')

    const { data: testData, error: testError } = await supabase
      .from('matches')
      .select('id, stage')
      .limit(1)

    if (testError) {
      console.error('❌ Erreur lors de la vérification:', testError.message)
      console.log('\n⚠️  Veuillez appliquer manuellement la migration SQL dans Supabase SQL Editor:')
      console.log('\n' + migrationSQL)
      process.exit(1)
    } else {
      console.log('✅ La colonne "stage" existe et est accessible')

      // Afficher un exemple
      if (testData && testData.length > 0) {
        console.log(`\nExemple de match:`, {
          id: testData[0].id,
          stage: testData[0].stage || 'NULL (championnat classique)'
        })
      }
    }

    console.log('\n✅ Migration appliquée avec succès!')
    console.log('\n💡 Prochaine étape: Mettre à jour le code d\'import pour renseigner le champ "stage"')

  } catch (error: any) {
    console.error('❌ Erreur:', error)
    console.log('\n⚠️  Veuillez appliquer manuellement la migration SQL dans Supabase SQL Editor')
    process.exit(1)
  }
}

applyMigration()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Erreur:', error)
    process.exit(1)
  })
