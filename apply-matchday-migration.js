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
  console.log('=== Application de la migration: Tracking des journées ===\n');

  try {
    // 1. Ajouter les colonnes
    console.log('1. Ajout des colonnes de tracking...');

    const queries = [
      `ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS planned_matchdays INTEGER`,
      `ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS actual_matchdays INTEGER`,
      `ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS starting_matchday INTEGER`,
      `ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS ending_matchday INTEGER`,
      `ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS matchday_snapshot JSONB`
    ];

    for (const query of queries) {
      const { error } = await supabase.rpc('exec_sql', { sql: query });
      if (error && !error.message.includes('already exists')) {
        console.error(`  ✗ Erreur: ${error.message}`);
      }
    }

    console.log('  ✓ Colonnes ajoutées');

    // 2. Mettre à jour les tournois existants
    console.log('\n2. Mise à jour des tournois existants...');

    const { data: tournaments, error: fetchError } = await supabase
      .from('tournaments')
      .select('id, num_matchdays, planned_matchdays')
      .is('planned_matchdays', null);

    if (fetchError) {
      throw fetchError;
    }

    console.log(`  Trouvé: ${tournaments?.length || 0} tournoi(s) à mettre à jour`);

    if (tournaments && tournaments.length > 0) {
      for (const tournament of tournaments) {
        const { error: updateError } = await supabase
          .from('tournaments')
          .update({ planned_matchdays: tournament.num_matchdays })
          .eq('id', tournament.id);

        if (updateError) {
          console.error(`  ✗ Erreur pour tournoi ${tournament.id}: ${updateError.message}`);
        } else {
          console.log(`  ✓ Tournoi ${tournament.id}: planned_matchdays = ${tournament.num_matchdays}`);
        }
      }
    }

    console.log('\n=== Migration terminée avec succès ===');

    // 3. Vérifier les résultats
    console.log('\nVérification des résultats:');
    const { data: updatedTournaments } = await supabase
      .from('tournaments')
      .select('name, num_matchdays, planned_matchdays, status')
      .order('created_at', { ascending: false })
      .limit(5);

    if (updatedTournaments) {
      updatedTournaments.forEach(t => {
        console.log(`  • ${t.name}: ${t.planned_matchdays || '?'} tours prévus (${t.status})`);
      });
    }

  } catch (error) {
    console.error('\n✗ Erreur:', error.message);
    process.exit(1);
  }
})();
