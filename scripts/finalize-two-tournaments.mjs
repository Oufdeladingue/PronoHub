import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

config({ path: join(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function finalizeTwoTournaments() {
  console.log('🏁 FINALISATION DE 2 TOURNOIS\n')

  const tournamentsToFinalize = [
    { id: '50c52224-61c5-44fa-88f2-95ab78381140', name: 'CPDE' },
    { id: 'd9e176bf-fe24-44d0-9cb4-f22e648093c7', name: 'Ramène1Latina' }
  ]

  for (const { id, name } of tournamentsToFinalize) {
    console.log(`\n🏆 Finalisation: ${name}`)
    console.log(`   ID: ${id}`)

    const { error } = await supabase
      .from('tournaments')
      .update({
        status: 'completed'
      })
      .eq('id', id)

    if (error) {
      console.error(`   ❌ Erreur: ${error.message}`)
    } else {
      console.log(`   ✅ Tournoi finalisé avec succès`)
    }
  }

  console.log('\n' + '─'.repeat(80))
  console.log('\n✅ Finalisation terminée!')
}

finalizeTwoTournaments()
  .then(() => {
    process.exit(0)
  })
  .catch(err => {
    console.error('\n❌ Erreur fatale:', err)
    process.exit(1)
  })
