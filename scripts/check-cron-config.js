const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('='.repeat(80));
  console.log('CONFIGURATION DU CRON DE MISE À JOUR DES MATCHS');
  console.log('='.repeat(80));
  console.log('');

  const { data: settings, error } = await supabase
    .from('admin_settings')
    .select('setting_key, setting_value')
    .in('setting_key', [
      'cron_auto_update_enabled',
      'cron_update_frequency',
      'cron_update_time_start',
      'cron_update_time_end',
      'cron_update_days',
      'cron_only_active_competitions',
      'cron_last_run'
    ]);

  if (error) {
    console.error('Erreur:', error);
    process.exit(1);
  }

  const config = {};
  settings?.forEach(setting => {
    config[setting.setting_key] = setting.setting_value;
  });

  console.log('Configuration actuelle:');
  console.log('-'.repeat(80));
  console.log(`Auto-update activé: ${config['cron_auto_update_enabled'] || 'false'}`);
  console.log(`Fréquence: ${config['cron_update_frequency'] || 'non défini'} minutes`);
  console.log(`Plage horaire: ${config['cron_update_time_start'] || 'non défini'} - ${config['cron_update_time_end'] || 'non défini'}`);
  console.log(`Jours actifs: ${config['cron_update_days'] || 'non défini'}`);
  console.log(`Uniquement compétitions actives: ${config['cron_only_active_competitions'] || 'false'}`);
  console.log(`Dernière exécution: ${config['cron_last_run'] || 'jamais'}`);

  console.log('');
  console.log('='.repeat(80));
  console.log('RÉSUMÉ:');
  console.log('-'.repeat(80));

  const frequency = parseInt(config['cron_update_frequency']) || 0;
  if (frequency > 0) {
    console.log(`✅ Les matchs sont mis à jour toutes les ${frequency} minutes`);
    console.log(`   pendant les plages horaires configurées.`);
  } else {
    console.log(`❌ Aucune fréquence de mise à jour configurée`);
  }

  console.log('');
  process.exit(0);
})();
