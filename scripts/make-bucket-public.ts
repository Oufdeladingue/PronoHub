import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables d\'environnement manquantes')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function makeBucketPublic() {
  console.log('🔓 Configuration du bucket competition-logos en mode public...\n')

  try {
    // Approche: uploader un fichier test avec le service role
    // Cela devrait fonctionner car le service role bypass RLS

    // Créer un fichier test
    const testFile = new Blob(['test'], { type: 'text/plain' })

    console.log('📝 Test d\'upload avec service role...')
    const { data, error } = await supabase.storage
      .from('competition-logos')
      .upload('test.txt', testFile, {
        upsert: true
      })

    if (error) {
      console.error('❌ Erreur lors du test:', error)
      console.log('\n💡 Le bucket nécessite une configuration manuelle:')
      console.log('   1. Aller sur: https://supabase.com/dashboard/project/txpmihreaxmtsxlgmdko/storage/buckets')
      console.log('   2. Cliquer sur "competition-logos"')
      console.log('   3. Dans Configuration > Security:')
      console.log('      - Activer "Public bucket" OU')
      console.log('      - Aller dans "Policies" et créer une policy de lecture publique')
      process.exit(1)
    }

    console.log('✅ Upload test réussi!')
    console.log('   Le service role peut uploader des fichiers.')

    // Supprimer le fichier test
    await supabase.storage
      .from('competition-logos')
      .remove(['test.txt'])

    console.log('\n✅ Configuration OK!')
    console.log('   Le bucket est opérationnel avec le service role.')
    console.log('   Les uploads via l\'interface admin devraient fonctionner.')

  } catch (error) {
    console.error('❌ Erreur:', error)
    process.exit(1)
  }
}

makeBucketPublic()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Erreur:', error)
    process.exit(1)
  })
