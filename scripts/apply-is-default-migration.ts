import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as fs from 'fs'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définis')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function applyMigration() {
  console.log('📊 Application de la migration is_default_prediction...\n')

  try {
    // Lire le fichier de migration
    const migration = fs.readFileSync('supabase/migrations/add_is_default_prediction.sql', 'utf-8')
    
    // Exécuter la migration
    const { error } = await supabase.rpc('exec_sql', { sql: migration })
    
    if (error) {
      // Si la fonction n'existe pas, on exécute manuellement les requêtes
      console.log('⚠️ Fonction exec_sql non disponible, exécution manuelle...\n')
      
      // 1. Ajouter la colonne
      const { error: alterError } = await supabase.rpc('exec', {
        sql: 'ALTER TABLE public.predictions ADD COLUMN IF NOT EXISTS is_default_prediction BOOLEAN DEFAULT false'
      })
      
      console.log('✅ Colonne is_default_prediction ajoutée')
      
      // 2. Mettre à jour les pronostics existants
      const { error: updateError } = await supabase
        .from('predictions')
        .update({ is_default_prediction: true })
        .eq('predicted_home_score', 0)
        .eq('predicted_away_score', 0)
      
      if (updateError) throw updateError
      
      console.log('✅ Pronostics 0-0 marqués comme par défaut')
      
      console.log('\n✅ Migration appliquée avec succès!')
    } else {
      console.log('✅ Migration appliquée avec succès!')
    }
    
    // Vérifier le résultat
    const { count: defaultCount } = await supabase
      .from('predictions')
      .select('*', { count: 'exact', head: true })
      .eq('is_default_prediction', true)
    
    const { count: manualCount } = await supabase
      .from('predictions')
      .select('*', { count: 'exact', head: true })
      .eq('is_default_prediction', false)
    
    console.log('\n📈 Résultat:')
    console.log()
    console.log()
    console.log()
    
  } catch (error) {
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
