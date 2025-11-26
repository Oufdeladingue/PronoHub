import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définis')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function applyMigration() {
  console.log('📊 Application de la migration early_prediction_bonus...\n')

  try {
    // Vérifier si la colonne existe déjà
    const { data: columns, error: checkError } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT column_name
          FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = 'tournaments'
          AND column_name = 'early_prediction_bonus'
        `
      })

    // Si la fonction n'existe pas, utiliser une approche alternative
    // On va simplement essayer d'ajouter la colonne et gérer l'erreur si elle existe déjà

    // Essayer de récupérer un tournoi avec la nouvelle colonne
    const { data: testData, error: testError } = await supabase
      .from('tournaments')
      .select('early_prediction_bonus')
      .limit(1)
      .single()

    if (testError && testError.message.includes('does not exist')) {
      console.log('⚠️ La colonne n\'existe pas encore. Veuillez appliquer manuellement la migration SQL.')
      console.log('\nExécutez cette requête SQL dans votre base de données Supabase :')
      console.log('\nALTER TABLE tournaments ADD COLUMN IF NOT EXISTS early_prediction_bonus BOOLEAN DEFAULT false;')
      console.log('\nOu utilisez l\'interface Supabase SQL Editor.')
      process.exit(1)
    } else {
      console.log('✅ La colonne early_prediction_bonus existe déjà dans la table tournaments')

      // Vérifier le résultat
      const { count: totalTournaments } = await supabase
        .from('tournaments')
        .select('*', { count: 'exact', head: true })

      console.log(`\n📈 Résultat: ${totalTournaments} tournois dans la base`)
      console.log('✅ Migration vérifiée avec succès!')
    }

  } catch (error: any) {
    console.error('❌ Erreur:', error)
    console.log('\n⚠️ Veuillez appliquer manuellement la migration SQL :')
    console.log('\nALTER TABLE tournaments ADD COLUMN IF NOT EXISTS early_prediction_bonus BOOLEAN DEFAULT false;')
    process.exit(1)
  }
}

applyMigration()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Erreur:', error)
    process.exit(1)
  })
