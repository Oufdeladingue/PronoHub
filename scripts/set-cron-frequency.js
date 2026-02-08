const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const newFrequency = 5; // minutes

  console.log('='.repeat(80));
  console.log('MODIFICATION DE LA FRÉQUENCE DES MISES À JOUR');
  console.log('='.repeat(80));
  console.log('');
  console.log(`Nouvelle fréquence: ${newFrequency} minutes`);
  console.log('');

  // Mettre à jour la fréquence
  const { error } = await supabase
    .from('admin_settings')
    .upsert({
      setting_key: 'cron_realtime_frequency',
      setting_value: String(newFrequency)
    }, { onConflict: 'setting_key' });

  if (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }

  console.log(`✅ Fréquence mise à jour: ${newFrequency} minutes`);
  console.log('');
  console.log('⚠️  Redémarrage du cron nécessaire pour appliquer les changements.');
  console.log('   Aller dans l\'interface admin > Réglages MAJ > Sauvegarder');
  console.log('');
  console.log('='.repeat(80));
  process.exit(0);
})();
