/**
 * Script pour vérifier le schéma de la table tournament_participants
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkSchema() {
  console.log('\n🔍 Vérification du schéma tournament_participants...\n')

  // Récupérer une ligne de la table pour voir les colonnes disponibles
  const { data, error } = await supabase
    .from('tournament_participants')
    .select('*')
    .limit(1)

  if (error) {
    console.error('❌ Erreur:', error)
    return
  }

  if (!data || data.length === 0) {
    console.log('⚠️  Aucune donnée trouvée')
    return
  }

  console.log('✅ Colonnes disponibles:')
  Object.keys(data[0]).forEach(col => {
    console.log(`   - ${col}: ${typeof data[0][col]}`)
  })

  console.log('\n📊 Exemple de données:')
  console.log(JSON.stringify(data[0], null, 2))
  console.log('')
}

checkSchema()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Erreur:', error)
    process.exit(1)
  })
