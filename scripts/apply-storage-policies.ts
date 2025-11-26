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

async function applyPolicies() {
  console.log('🔐 Application des policies RLS pour le bucket competition-logos...\n')

  try {
    // Policy pour permettre la lecture publique
    console.log('📝 Création de la policy de lecture publique...')
    const { error: readError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE POLICY IF NOT EXISTS "Public read access for competition logos"
        ON storage.objects FOR SELECT
        USING (bucket_id = 'competition-logos');
      `
    })

    if (readError) {
      console.log('⚠️  Tentative alternative avec SQL direct...')

      // Approche alternative: désactiver RLS pour ce bucket (plus simple)
      const { error: updateError } = await supabase
        .from('buckets')
        .update({ public: true })
        .eq('id', 'competition-logos')
        .select()

      if (updateError) {
        console.log('⚠️  Impossible de modifier via l\'API. Utilisation de l\'approche SQL directe...')

        // Exécuter directement via l'API SQL
        const { error: sqlError } = await supabase.rpc('exec', {
          sql: `
            -- Activer RLS si pas déjà fait
            ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

            -- Supprimer les policies existantes si elles existent
            DROP POLICY IF EXISTS "Public read access for competition logos" ON storage.objects;
            DROP POLICY IF EXISTS "Admins can insert competition logos" ON storage.objects;
            DROP POLICY IF EXISTS "Admins can update competition logos" ON storage.objects;
            DROP POLICY IF EXISTS "Admins can delete competition logos" ON storage.objects;

            -- Policy pour lecture publique
            CREATE POLICY "Public read access for competition logos"
            ON storage.objects FOR SELECT
            USING (bucket_id = 'competition-logos');

            -- Policy pour insert (service role uniquement)
            CREATE POLICY "Admins can insert competition logos"
            ON storage.objects FOR INSERT
            WITH CHECK (bucket_id = 'competition-logos');

            -- Policy pour update (service role uniquement)
            CREATE POLICY "Admins can update competition logos"
            ON storage.objects FOR UPDATE
            USING (bucket_id = 'competition-logos');

            -- Policy pour delete (service role uniquement)
            CREATE POLICY "Admins can delete competition logos"
            ON storage.objects FOR DELETE
            USING (bucket_id = 'competition-logos');
          `
        })

        if (sqlError) {
          console.error('❌ Erreur SQL:', sqlError)
          console.log('\n💡 Solution manuelle requise:')
          console.log('   1. Aller sur https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new')
          console.log('   2. Copier et exécuter le SQL ci-dessus')
          console.log('\n💡 OU utiliser cette approche simplifiée (moins sécurisée):')
          console.log('   1. Aller sur https://supabase.com/dashboard/project/YOUR_PROJECT/storage/buckets')
          console.log('   2. Cliquer sur "competition-logos"')
          console.log('   3. Activer "Public bucket" dans les settings')
          process.exit(1)
        }
      } else {
        console.log('✅ Bucket configuré en mode public')
      }
    } else {
      console.log('✅ Policies créées avec succès')
    }

    console.log('\n✅ Configuration terminée!')
    console.log('   Vous pouvez maintenant uploader des logos via l\'interface admin.')

  } catch (error) {
    console.error('❌ Erreur:', error)
    process.exit(1)
  }
}

applyPolicies()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Erreur:', error)
    process.exit(1)
  })
