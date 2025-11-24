import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkColumn() {
  const { data, error } = await supabase
    .from('predictions')
    .select('*')
    .limit(1)
    .single()

  if (error) {
    console.error('Erreur:', error)
    return
  }

  console.log('Colonnes disponibles:', Object.keys(data))
  console.log('\nExemple de pronostic:', data)
}

checkColumn()
