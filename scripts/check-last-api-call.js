const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('='.repeat(80));
  console.log('VÉRIFICATION DU DERNIER APPEL API');
  console.log('='.repeat(80));
  console.log('');

  // Vérifier le dernier run du smart cron
  const { data: settings, error: settingsError } = await supabase
    .from('admin_settings')
    .select('setting_key, setting_value')
    .in('setting_key', ['cron_last_run', 'smart_cron_last_run']);

  if (settingsError) {
    console.error('Erreur settings:', settingsError);
  } else {
    console.log('Dernières exécutions:');
    console.log('-'.repeat(80));
    settings?.forEach(setting => {
      const value = setting.setting_value;
      if (value) {
        const date = new Date(value);
        const now = new Date();
        const minutesAgo = Math.floor((now - date) / 1000 / 60);
        console.log(`${setting.setting_key}: ${date.toLocaleString('fr-FR')} (il y a ${minutesAgo} min)`);
      } else {
        console.log(`${setting.setting_key}: jamais`);
      }
    });
  }

  console.log('');

  // Vérifier les matchs en cours de Ligue 1
  const { data: matches, error } = await supabase
    .from('imported_matches')
    .select('id, utc_date, home_team_name, away_team_name, home_score, away_score, status, last_updated_at')
    .eq('competition_id', 2015)
    .in('status', ['IN_PLAY', 'PAUSED', 'TIMED'])
    .order('utc_date', { ascending: false });

  if (error) {
    console.error('Erreur matchs:', error);
  } else {
    console.log(`MATCHS EN COURS/À VENIR (Ligue 1):`);
    console.log('-'.repeat(80));

    if (matches && matches.length > 0) {
      matches.forEach(match => {
        const matchDate = new Date(match.utc_date);
        console.log(`\n${match.home_team_name} ${match.home_score ?? '-'} - ${match.away_score ?? '-'} ${match.away_team_name}`);
        console.log(`  Status: ${match.status}`);
        console.log(`  Date match: ${matchDate.toLocaleString('fr-FR')}`);
        if (match.last_updated_at) {
          const updatedDate = new Date(match.last_updated_at);
          const now = new Date();
          const minutesSinceUpdate = Math.floor((now - updatedDate) / 1000 / 60);
          console.log(`  Dernière MAJ: ${updatedDate.toLocaleString('fr-FR')} (il y a ${minutesSinceUpdate} min)`);
        } else {
          console.log(`  Dernière MAJ: inconnue`);
        }
      });
    } else {
      console.log('Aucun match en cours ou à venir');
    }
  }

  console.log('');
  console.log('='.repeat(80));
  process.exit(0);
})();
