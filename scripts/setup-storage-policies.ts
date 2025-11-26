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

async function setupPolicies() {
  console.log('🔐 Configuration des policies pour le bucket competition-logos...\n')

  try {
    // Note: Les policies Storage doivent être créées via SQL
    console.log('📝 Exécution des policies SQL...\n')

    // Policy pour permettre la lecture publique
    const readPolicy = `
      CREATE POLICY "Public read access for competition logos"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'competition-logos');
    `

    // Policy pour permettre l'upload aux admins (via service role)
    const insertPolicy = `
      CREATE POLICY "Admins can insert competition logos"
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'competition-logos');
    `

    // Policy pour permettre la mise à jour aux admins
    const updatePolicy = `
      CREATE POLICY "Admins can update competition logos"
      ON storage.objects FOR UPDATE
      USING (bucket_id = 'competition-logos');
    `

    // Policy pour permettre la suppression aux admins
    const deletePolicy = `
      CREATE POLICY "Admins can delete competition logos"
      ON storage.objects FOR DELETE
      USING (bucket_id = 'competition-logos');
    `

    console.log('⚠️  Les policies doivent être créées via l\'interface Supabase SQL Editor:')
    console.log('\n1. Aller sur https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new')
    console.log('2. Copier et exécuter le SQL suivant:\n')
    console.log('-- Policy pour lecture publique')
    console.log(readPolicy)
    console.log('\n-- Policy pour insert (admin)')
    console.log(insertPolicy)
    console.log('\n-- Policy pour update (admin)')
    console.log(updatePolicy)
    console.log('\n-- Policy pour delete (admin)')
    console.log(deletePolicy)

    console.log('\n💡 Alternative: Désactiver RLS pour ce bucket (moins sécurisé):')
    console.log('   UPDATE storage.buckets SET public = true WHERE id = \'competition-logos\';')

  } catch (error) {
    console.error('❌ Erreur:', error)
    process.exit(1)
  }
}

setupPolicies()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Erreur:', error)
    process.exit(1)
  })
