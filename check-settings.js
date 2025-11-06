const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Lire les variables d'environnement
const envContent = fs.readFileSync('.env.local', 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length) {
    envVars[key.trim()] = valueParts.join('=').trim();
  }
});

const supabase = createClient(
  envVars.NEXT_PUBLIC_SUPABASE_URL,
  envVars.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('Mise à jour des paramètres de points...\n');

  // Mettre à jour points_exact_score à 5
  const { error: error1 } = await supabase
    .from('admin_settings')
    .update({ setting_value: '5' })
    .eq('setting_key', 'points_exact_score');

  if (error1) {
    console.error('❌ Erreur lors de la mise à jour de points_exact_score:', error1);
  } else {
    console.log('✅ points_exact_score mis à jour à 5');
  }

  // Mettre à jour points_correct_result à 2
  const { error: error2 } = await supabase
    .from('admin_settings')
    .update({ setting_value: '2' })
    .eq('setting_key', 'points_correct_result');

  if (error2) {
    console.error('❌ Erreur lors de la mise à jour de points_correct_result:', error2);
  } else {
    console.log('✅ points_correct_result mis à jour à 2');
  }

  // Vérifier les nouvelles valeurs
  console.log('\nVérification des valeurs...\n');
  const { data: settings, error } = await supabase
    .from('admin_settings')
    .select('*')
    .in('setting_key', ['points_exact_score', 'points_correct_result', 'points_incorrect_result'])
    .order('setting_key');

  if (error) {
    console.error('❌ Erreur:', error);
  } else {
    console.log('✅ Paramètres de points:');
    settings?.forEach(setting => {
      console.log(`  ${setting.setting_key} = ${setting.setting_value}`);
    });
  }
})();
