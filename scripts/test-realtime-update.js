const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('='.repeat(80));
  console.log('SIMULATION: Mise à jour temps réel ciblée');
  console.log('='.repeat(80));
  console.log('');

  const now = new Date().toISOString();
  console.log('Heure actuelle:', now);
  console.log('');

  // 1. Récupérer les fenêtres actives
  const { data: activeWindows, error } = await supabase
    .from('match_windows')
    .select('competition_id, match_date, competitions(name)')
    .lte('window_start', now)
    .gte('window_end', now);

  if (error) {
    console.error('Erreur fenêtres:', error);
    process.exit(1);
  }

  if (!activeWindows || activeWindows.length === 0) {
    console.log('❌ Aucune fenêtre active - pas de mise à jour nécessaire');
    console.log('');
    console.log('='.repeat(80));
    process.exit(0);
  }

  console.log(`✅ ${activeWindows.length} fenêtre(s) active(s):`);
  activeWindows.forEach(w => {
    const compName = w.competitions?.name || `Comp ${w.competition_id}`;
    console.log(`  - ${compName} (${w.match_date})`);
  });
  console.log('');

  // 2. Pour chaque fenêtre, récupérer les matchs
  let totalMatches = 0;
  const allMatchIds = new Set();

  for (const window of activeWindows) {
    const { data: matches, error: matchesError } = await supabase
      .from('imported_matches')
      .select('football_data_match_id, home_team_name, away_team_name, status, home_score, away_score')
      .eq('competition_id', window.competition_id)
      .gte('utc_date', window.match_date)
      .lt('utc_date', new Date(new Date(window.match_date).getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .in('status', ['TIMED', 'IN_PLAY', 'PAUSED']);

    if (matchesError) {
      console.error(`Erreur matchs (${window.competition_id}):`, matchesError);
      continue;
    }

    if (matches && matches.length > 0) {
      const compName = window.competitions?.name || `Comp ${window.competition_id}`;
      console.log(`${compName}:`);
      console.log('-'.repeat(80));
      matches.forEach(match => {
        allMatchIds.add(match.football_data_match_id);
        totalMatches++;
        const score = `${match.home_score ?? '-'} - ${match.away_score ?? '-'}`;
        console.log(`  [${match.status}] ${match.home_team_name} ${score} ${match.away_team_name}`);
      });
      console.log('');
    }
  }

  console.log('='.repeat(80));
  console.log('RÉSUMÉ:');
  console.log('-'.repeat(80));
  console.log(`Total matchs à mettre à jour: ${totalMatches}`);
  console.log(`Appels API nécessaires: ${totalMatches} (au lieu de ${activeWindows.length * 2} avec l'ancienne méthode)`);
  console.log(`Économie: ${activeWindows.length * 2 - totalMatches} appels (${Math.round(((activeWindows.length * 2 - totalMatches) / (activeWindows.length * 2)) * 100)}%)`);
  console.log('');
  console.log('='.repeat(80));
  process.exit(0);
})();
