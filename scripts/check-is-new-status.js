const { createClient } = require('@supabase/supabase-js')
const dotenv = require('dotenv')
const path = require('path')

dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkStatus() {
  const userId = '01b0ec3e-7f3d-458d-ba8d-9efae1c2bf06'

  console.log('=== VÉRIFICATION BDD ===')
  const { data, error } = await supabase
    .from('user_trophies')
    .select('*')
    .eq('user_id', userId)
    .order('unlocked_at', { ascending: false })

  if (error) {
    console.error('Erreur:', error)
    return
  }

  console.log('Total trophées:', data.length)
  console.log('')

  data.forEach(t => {
    console.log(`- ${t.trophy_type.padEnd(20)} | is_new: ${t.is_new} | unlocked_at: ${t.unlocked_at}`)
  })

  const newOnes = data.filter(t => t.is_new)
  console.log('')
  console.log('✅ Trophées is_new=true:', newOnes.length)
}

checkStatus()
