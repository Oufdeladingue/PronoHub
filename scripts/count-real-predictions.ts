import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function countPredictions() {
  const { count: totalCount } = await supabase
    .from('predictions')
    .select('*', { count: 'exact', head: true })

  const { count: defaultCount } = await supabase
    .from('predictions')
    .select('*', { count: 'exact', head: true })
    .eq('is_default_prediction', true)

  const { count: manualCount } = await supabase
    .from('predictions')
    .select('*', { count: 'exact', head: true })
    .eq('is_default_prediction', false)

  console.log('📊 Statistiques des pronostics:\n')
  console.log(`  Total:             ${totalCount}`)
  console.log(`  Par défaut (0-0):  ${defaultCount}`)
  console.log(`  Saisis manuels:    ${manualCount}`)
}

countPredictions()
