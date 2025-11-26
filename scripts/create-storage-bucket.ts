import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables d\'environnement manquantes')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function createStorageBucket() {
  console.log('📦 Création du bucket Supabase Storage pour les logos...\n')

  try {
    // Créer le bucket pour les logos de compétitions
    const { data: bucket, error: bucketError } = await supabase.storage.createBucket('competition-logos', {
      public: true,
      fileSizeLimit: 5242880, // 5MB max
      allowedMimeTypes: ['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp']
    })

    if (bucketError) {
      if (bucketError.message.includes('already exists')) {
        console.log('ℹ️  Le bucket "competition-logos" existe déjà')
      } else {
        throw bucketError
      }
    } else {
      console.log('✅ Bucket "competition-logos" créé avec succès')
    }

    // Créer une policy pour permettre la lecture publique
    console.log('\n📝 Configuration des policies...')
    console.log('⚠️  Les policies doivent être créées manuellement dans l\'interface Supabase:')
    console.log('   1. Aller dans Storage > Policies')
    console.log('   2. Créer une policy "Public read access" pour le bucket "competition-logos"')
    console.log('   3. Operation: SELECT')
    console.log('   4. Policy: USING (true)')

    console.log('\n✅ Configuration terminée !')
    console.log('\n📌 Prochaine étape:')
    console.log('   Exécutez la migration SQL: supabase/migrations/add_custom_competition_logos.sql')

  } catch (error) {
    console.error('❌ Erreur:', error)
    process.exit(1)
  }
}

createStorageBucket()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Erreur:', error)
    process.exit(1)
  })
