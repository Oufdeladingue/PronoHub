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
  console.log('=== Mise à jour du nombre total de journées ===\n');

  try {
    // 1. Note: La colonne total_matchdays doit exister dans la table competitions
    console.log('1. Vérification des compétitions...');

    // 2. Récupérer toutes les compétitions
    console.log('2. Récupération des compétitions...');
    const { data: competitions, error: compError } = await supabase
      .from('competitions')
      .select('id, name, code');

    if (compError) throw compError;

    console.log(`   Trouvé: ${competitions.length} compétition(s)\n`);

    // 3. Pour chaque compétition, calculer le nombre total de journées
    for (const comp of competitions) {
      console.log(`Traitement: ${comp.name} (${comp.code})...`);

      // Récupérer tous les matchs de la compétition
      const { data: matches, error: matchesError } = await supabase
        .from('imported_matches')
        .select('matchday')
        .eq('competition_id', comp.id)
        .not('matchday', 'is', null);

      if (matchesError) {
        console.error(`  ✗ Erreur: ${matchesError.message}`);
        continue;
      }

      if (!matches || matches.length === 0) {
        console.log('  ⚠ Aucun match trouvé');
        continue;
      }

      // Calculer le nombre maximum de journées
      const matchdays = matches.map(m => m.matchday);
      const totalMatchdays = Math.max(...matchdays);

      // Mettre à jour la compétition
      const { error: updateError } = await supabase
        .from('competitions')
        .update({ total_matchdays: totalMatchdays })
        .eq('id', comp.id);

      if (updateError) {
        console.error(`  ✗ Erreur de mise à jour: ${updateError.message}`);
      } else {
        console.log(`  ✓ Mis à jour: ${totalMatchdays} journées`);
      }
    }

    console.log('\n=== Mise à jour terminée ===');

    // 4. Vérifier les résultats
    console.log('\nVérification des résultats:');
    const { data: updatedComps } = await supabase
      .from('competitions')
      .select('name, code, current_matchday, total_matchdays')
      .order('name');

    if (updatedComps) {
      updatedComps.forEach(comp => {
        const status = comp.total_matchdays ? '✓' : '✗';
        console.log(`  ${status} ${comp.name}: ${comp.current_matchday || '?'}/${comp.total_matchdays || '?'}`);
      });
    }

  } catch (error) {
    console.error('\n✗ Erreur:', error.message);
    process.exit(1);
  }
})();
