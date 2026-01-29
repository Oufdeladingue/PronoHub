const { createClient } = require('@supabase/supabase-js')
const dotenv = require('dotenv')
const path = require('path')

dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkSchema() {
  try {
    console.log('=== SCHEMA IMPORTED_MATCHES ===')

    // Récupérer un seul match pour voir tous les champs
    const { data, error } = await supabase
      .from('imported_matches')
      .select('*')
      .limit(1)

    if (error) {
      console.error('Erreur:', error)
      return
    }

    if (data && data.length > 0) {
      console.log('\nColonnes disponibles:')
      Object.keys(data[0]).forEach(key => {
        console.log(`  - ${key}: ${typeof data[0][key]} = ${data[0][key]}`)
      })
    } else {
      console.log('Aucun match trouvé')
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message)
  }
}

checkSchema()
