const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('*')
    .eq('slug', 'VUTTFRBF')
    .single();

  console.log('='.repeat(80));
  console.log('TOURNOI:', tournament.name);
  console.log('='.repeat(80));
  console.log('');

  // Trouver Rom's
  const { data: romsProfile } = await supabase
    .from('profiles')
    .select('id, username')
    .ilike('username', "%rom%s%")
    .single();

  console.log('User:', romsProfile.username, '(ID:', romsProfile.id, ')');
  console.log('');

  // Récupérer tous les matchs du tournoi par journée
  const matchdays = Array.from({length: tournament.ending_matchday - tournament.starting_matchday + 1}, (_, i) => tournament.starting_matchday + i);

  let totalAllPoints = 0;
  let totalFinishedPoints = 0;

  for (const md of matchdays) {
    const { data: matches } = await supabase
      .from('imported_matches')
      .select('id, home_score, away_score, status, home_team, away_team')
      .eq('competition_id', tournament.competition_id)
      .eq('matchday', md);

    const finished = matches?.filter(m => m.status === 'FINISHED') || [];
    const withScores = matches?.filter(m => m.home_score !== null && m.away_score !== null) || [];
    const inProgress = matches?.filter(m => ['IN_PLAY', 'PAUSED'].includes(m.status)) || [];

    if (withScores.length > 0) {
      console.log(`J${md}: ${finished.length} FINISHED, ${withScores.length} avec scores, ${inProgress.length} en cours`);

      // Montrer les matchs en cours s'il y en a
      if (inProgress.length > 0) {
        inProgress.forEach(m => {
          console.log(`  IN_PLAY: ${m.home_team} ${m.home_score}-${m.away_score} ${m.away_team}`);
        });
      }
    }
  }

  process.exit(0);
})();
