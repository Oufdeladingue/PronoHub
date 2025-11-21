require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkDB() {
  const { data: user } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', "Rom's")
    .single()

  const { data: trophies } = await supabase
    .from('user_trophies')
    .select('trophy_type, unlocked_at')
    .eq('user_id', user.id)
    .order('unlocked_at', { ascending: false })

  console.log('=== TROPHÉES DANS LA BASE DE DONNÉES ===')
  console.log('Total:', trophies.length)
  trophies.forEach(t => {
    console.log(`  - ${t.trophy_type}: ${t.unlocked_at}`)
  })
}

checkDB()
