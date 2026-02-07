const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('='.repeat(60));
  console.log('VÉRIFICATION TOURNOI ZEQXTLPS EN MODE GUESS');
  console.log('='.repeat(60));

  // Vérifier le classement
  const { data: rankings } = await supabase
    .from('tournament_rankings')
    .select('user_id, total_points, exact_scores, correct_results, profiles(username)')
    .eq('tournament_id', '483bfcb4-f192-44f0-8493-f5d99b8281e1')
    .limit(5)
    .order('total_points', { ascending: false });

  console.log('\nClassement actuel:');
  rankings?.forEach(r => {
    const username = r.profiles?.username || 'Inconnu';
    console.log(`  ${username}: ${r.total_points} pts (exact: ${r.exact_scores}, correct: ${r.correct_results})`);
  });

  // Vérifier options du tournoi
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('early_prediction_bonus, bonus_match')
    .eq('id', '483bfcb4-f192-44f0-8493-f5d99b8281e1')
    .single();

  console.log('\nOptions tournoi:');
  console.log('  early_prediction_bonus:', tournament?.early_prediction_bonus);
  console.log('  bonus_match:', tournament?.bonus_match);

  // Vérifier matchs bonus
  const { data: bonusMatches } = await supabase
    .from('tournament_bonus_matches')
    .select('matchday, match_id')
    .eq('tournament_id', '483bfcb4-f192-44f0-8493-f5d99b8281e1')
    .order('matchday');

  console.log('\nMatchs bonus définis:', bonusMatches?.length || 0);
  if (bonusMatches && bonusMatches.length > 0) {
    console.log('Journées avec bonus:');
    bonusMatches.forEach(bm => {
      console.log(`  J${bm.matchday}: ${bm.match_id.substring(0, 20)}...`);
    });
  }

  // Vérifier les matchs J21
  const { data: matches } = await supabase
    .from('imported_matches')
    .select('id, home_team, away_team, status')
    .eq('competition_id', 2015)
    .eq('matchday', 21);

  console.log('\nMatchs J21 Ligue 1:', matches?.length || 0);
  if (matches && matches.length > 0) {
    const finished = matches.filter(m => m.status === 'FINISHED').length;
    console.log('Matchs terminés:', finished + '/' + matches.length);
  }

  console.log('\n' + '='.repeat(60));
  process.exit(0);
})();
