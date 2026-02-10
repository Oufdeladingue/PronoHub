const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('='.repeat(80));
  console.log('DEBUG: Fenêtres de matchs - Ligue 1');
  console.log('='.repeat(80));
  console.log('');

  // 1. Récupérer les fenêtres Ligue 1 du 08/02
  const { data: windows, error: windowsError } = await supabase
    .from('match_windows')
    .select('*')
    .eq('competition_id', 2015) // Ligue 1
    .gte('match_date', '2026-02-08')
    .lt('match_date', '2026-02-09')
    .order('window_start');

  if (windowsError) {
    console.error('Erreur fenêtres:', windowsError);
    process.exit(1);
  }

  console.log(`Fenêtres trouvées pour Ligue 1 le 08/02: ${windows?.length || 0}`);
  console.log('');

  for (const window of windows || []) {
    console.log('-'.repeat(80));
    console.log(`Fenêtre: ${new Date(window.window_start).toLocaleString('fr-FR')} → ${new Date(window.window_end).toLocaleString('fr-FR')}`);
    console.log(`match_date: ${window.match_date}`);
    console.log(`matches_count (DB): ${window.matches_count}`);
    console.log('');

    // 2. Récupérer TOUS les matchs de la journée (sans filtre de statut)
    const { data: allMatches } = await supabase
      .from('imported_matches')
      .select('id, utc_date, home_team_name, away_team_name, status, matchday')
      .eq('competition_id', 2015)
      .gte('utc_date', window.match_date)
      .lt('utc_date', new Date(new Date(window.match_date).getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('utc_date');

    console.log(`Total matchs dans la date ${window.match_date}: ${allMatches?.length || 0}`);
    if (allMatches) {
      allMatches.forEach(m => {
        const date = new Date(m.utc_date);
        console.log(`  ${date.toLocaleString('fr-FR')} [${m.status}] ${m.home_team_name} - ${m.away_team_name} (J${m.matchday})`);
      });
    }
    console.log('');

    // 3. Matchs avec statut TIMED/IN_PLAY/PAUSED uniquement
    const { data: activeMatches } = await supabase
      .from('imported_matches')
      .select('id, utc_date, home_team_name, away_team_name, status')
      .eq('competition_id', 2015)
      .gte('utc_date', window.match_date)
      .lt('utc_date', new Date(new Date(window.match_date).getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .in('status', ['TIMED', 'IN_PLAY', 'PAUSED'])
      .order('utc_date');

    console.log(`Matchs avec statut TIMED/IN_PLAY/PAUSED: ${activeMatches?.length || 0}`);
    console.log('');

    // 4. Matchs réellement dans la fenêtre horaire
    const windowStart = new Date(window.window_start).getTime();
    const windowEnd = new Date(window.window_end).getTime();
    const marginBefore = 10 * 60 * 1000;
    const marginAfter = 3 * 60 * 60 * 1000;

    const realCount = (activeMatches || []).filter(match => {
      const matchTime = new Date(match.utc_date).getTime();
      return matchTime >= windowStart - marginBefore &&
             matchTime <= windowEnd + marginAfter;
    }).length;

    console.log(`Matchs VRAIMENT dans la fenêtre horaire (±marges): ${realCount}`);
    console.log('');
  }

  // 5. Récupérer TOUS les matchs de Ligue 1 pour cette journée
  console.log('='.repeat(80));
  console.log('TOUS LES MATCHS DE LA JOURNÉE (toutes dates):');
  console.log('-'.repeat(80));

  const { data: allMatchdays } = await supabase
    .from('imported_matches')
    .select('id, utc_date, home_team_name, away_team_name, status, matchday')
    .eq('competition_id', 2015)
    .gte('utc_date', '2026-02-06')
    .lt('utc_date', '2026-02-09')
    .order('utc_date');

  if (allMatchdays) {
    console.log(`Total matchs du 06/02 au 08/02: ${allMatchdays.length}`);
    allMatchdays.forEach(m => {
      const date = new Date(m.utc_date);
      console.log(`  ${date.toLocaleDateString('fr-FR')} ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} [${m.status}] ${m.home_team_name} - ${m.away_team_name} (J${m.matchday})`);
    });
  }

  console.log('');
  console.log('='.repeat(80));
  process.exit(0);
})();
