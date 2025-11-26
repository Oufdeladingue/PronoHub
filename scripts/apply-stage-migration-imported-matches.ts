/**
 * Script pour ajouter la colonne stage à imported_matches
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import path from 'path'

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
  console.log('📊 Ajout de la colonne stage à imported_matches...\n')

  try {
    // Vérifier si la colonne existe déjà
    console.log('🔍 Vérification de l\'existence de la colonne...')
    const { data: testData, error: testError } = await supabase
      .from('imported_matches')
      .select('id, stage')
      .limit(1)

    if (!testError) {
      console.log('✅ La colonne "stage" existe déjà dans imported_matches')
      return
    }

    // La colonne n'existe pas, on doit l'ajouter via SQL brut
    console.log('⚙️  Ajout de la colonne stage...')

    const migrationSQL = `
      -- Ajouter la colonne stage
      ALTER TABLE imported_matches
      ADD COLUMN IF NOT EXISTS stage TEXT;

      -- Créer un index pour améliorer les performances
      CREATE INDEX IF NOT EXISTS idx_imported_matches_stage ON imported_matches(stage);

      -- Créer un index composé
      CREATE INDEX IF NOT EXISTS idx_imported_matches_competition_stage ON imported_matches(competition_id, stage);
    `

    console.log('\n⚠️  IMPORTANT: Vous devez exécuter le SQL suivant dans Supabase SQL Editor:\n')
    console.log('=' .repeat(80))
    console.log(migrationSQL)
    console.log('=' .repeat(80))
    console.log('\n📝 Étapes à suivre:')
    console.log('1. Ouvrez https://supabase.com/dashboard/project/YOUR_PROJECT/sql')
    console.log('2. Copiez et collez le SQL ci-dessus')
    console.log('3. Cliquez sur "Run"')
    console.log('4. Revenez ici et appuyez sur Entrée pour continuer')

    // Attendre que l'utilisateur appuie sur Entrée
    await new Promise(resolve => {
      process.stdin.once('data', resolve)
    })

    // Vérifier que la migration a été appliquée
    console.log('\n🔍 Vérification...')
    const { data: verifyData, error: verifyError } = await supabase
      .from('imported_matches')
      .select('id, stage')
      .limit(1)

    if (verifyError) {
      console.error('❌ La colonne n\'existe toujours pas:', verifyError.message)
      console.log('\n⚠️  Veuillez appliquer manuellement la migration SQL ci-dessus dans Supabase')
      process.exit(1)
    }

    console.log('✅ La colonne "stage" a été ajoutée avec succès!')
    console.log('\n💡 Prochaine étape: Réimportez la compétition Champions League pour renseigner les stages')
    console.log('   Utilisez le bouton "Actualiser" dans le panneau admin')

  } catch (error: any) {
    console.error('❌ Erreur:', error)
    process.exit(1)
  }
}

applyMigration()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Erreur:', error)
    process.exit(1)
  })
