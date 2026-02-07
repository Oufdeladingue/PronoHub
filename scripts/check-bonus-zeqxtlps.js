const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('*')
    .eq('slug', 'ZEQXTLPS')
    .single();

  console.log('='.repeat(80));
  console.log('TOURNOI:', tournament.name);
  console.log('='.repeat(80));
  console.log('Match bonus activé:', tournament.bonus_match);
  console.log('Journées:', tournament.starting_matchday, '->', tournament.ending_matchday);
  console.log('');

  // Vérifier les matchs disponibles
  const { data: matches } = await supabase
    .from('imported_matches')
    .select('matchday, status, id, home_team, away_team, home_score, away_score')
    .eq('competition_id', tournament.competition_id)
    .gte('matchday', tournament.starting_matchday)
    .lte('matchday', tournament.ending_matchday)
    .order('matchday')
    .order('utc_date');

  const byMatchday = {};
  matches?.forEach(m => {
    if (!byMatchday[m.matchday]) byMatchday[m.matchday] = { total: 0, finished: 0, matches: [] };
    byMatchday[m.matchday].total++;
    byMatchday[m.matchday].matches.push(m);
    if (m.status === 'FINISHED') byMatchday[m.matchday].finished++;
  });

  console.log('Matchs par journée:');
  Object.entries(byMatchday).sort((a, b) => Number(a[0]) - Number(b[0])).forEach(([md, stats]) => {
    console.log(`  J${md}: ${stats.total} matchs (${stats.finished} terminés)`);
  });

  console.log('');

  // Vérifier les matchs bonus
  const { data: bonusMatches } = await supabase
    .from('tournament_bonus_matches')
    .select('matchday, match_id')
    .eq('tournament_id', tournament.id);

  console.log('Matchs bonus définis:', bonusMatches?.length || 0);
  const bonusByMatchday = {};
  bonusMatches?.forEach(bm => {
    if (!bonusByMatchday[bm.matchday]) bonusByMatchday[bm.matchday] = [];
    bonusByMatchday[bm.matchday].push(bm.match_id);
  });

  Object.entries(bonusByMatchday).sort((a, b) => Number(a[0]) - Number(b[0])).forEach(([md, matchIds]) => {
    console.log(`  J${md}: ${matchIds.length} match(s) bonus`);
  });

  console.log('');
  console.log('='.repeat(80));
  console.log('DÉTAIL J21 (si elle existe):');
  console.log('='.repeat(80));

  if (byMatchday[21]) {
    const j21Matches = byMatchday[21].matches;
    j21Matches.forEach(m => {
      const isBonus = bonusByMatchday[21]?.includes(m.id);
      console.log(`${isBonus ? '⭐ BONUS' : '      '} ${m.home_team} vs ${m.away_team} (${m.status}) - ${m.home_score ?? '-'}:${m.away_score ?? '-'}`);
    });
  } else {
    console.log('Journée 21 non trouvée dans ce tournoi');
  }

  console.log('');
  console.log('='.repeat(80));
  console.log('VÉRIFICATION USER SHANKS:');
  console.log('='.repeat(80));

  // Trouver Shanks
  const { data: shanksProfile } = await supabase
    .from('profiles')
    .select('id, username')
    .ilike('username', '%shanks%')
    .single();

  if (!shanksProfile) {
    console.log('User Shanks non trouvé');
    return;
  }

  console.log('User:', shanksProfile.username);

  // Trouver la journée avec le plus de matchs terminés
  const sortedMatchdays = Object.entries(byMatchday)
    .filter(([_, stats]) => stats.finished > 0)
    .sort((a, b) => Number(b[0]) - Number(a[0]));

  if (sortedMatchdays.length === 0) {
    console.log('Aucune journée avec matchs terminés');
    return;
  }

  const [currentMatchday, stats] = sortedMatchdays[0];
  console.log(`Journée la plus récente avec matchs terminés: J${currentMatchday} (${stats.finished} matchs terminés)`);
  console.log('');

  // Récupérer les pronostics de Shanks pour cette journée
  const matchIds = stats.matches.map(m => m.id);
  const { data: predictions } = await supabase
    .from('predictions')
    .select('match_id, predicted_home_score, predicted_away_score, is_default_prediction')
    .eq('tournament_id', tournament.id)
    .eq('user_id', shanksProfile.id)
    .in('match_id', matchIds);

  console.log(`Pronostics de ${shanksProfile.username} pour J${currentMatchday}:`);
  console.log('');

  let totalPoints = 0;
  stats.matches.forEach(m => {
    if (m.status !== 'FINISHED') return;

    const pred = predictions?.find(p => p.match_id === m.id);
    const isBonus = bonusByMatchday[currentMatchday]?.includes(m.id);

    if (!pred) {
      console.log(`  ${m.home_team} vs ${m.away_team}: PAS DE PRONO`);
      return;
    }

    const isExact = pred.predicted_home_score === m.home_score && pred.predicted_away_score === m.away_score;
    const predResult = pred.predicted_home_score > pred.predicted_away_score ? 'H' :
                      pred.predicted_home_score < pred.predicted_away_score ? 'A' : 'D';
    const realResult = m.home_score > m.away_score ? 'H' :
                      m.home_score < m.away_score ? 'A' : 'D';
    const isCorrect = predResult === realResult;

    let points = 0;
    if (pred.is_default_prediction && realResult === 'D') {
      points = 1;
    } else if (!pred.is_default_prediction) {
      if (isExact) points = 5;
      else if (isCorrect) points = 3;
      else points = 0;
    }

    if (isBonus) points *= 2;

    totalPoints += points;

    console.log(`  ${isBonus ? '⭐' : '  '} ${m.home_team} vs ${m.away_team}: ${pred.predicted_home_score}-${pred.predicted_away_score} (réel: ${m.home_score}-${m.away_score}) = ${points} pts ${isBonus ? '(x2)' : ''}${pred.is_default_prediction ? ' [DEFAULT]' : ''}`);
  });

  console.log('');
  console.log('TOTAL CALCULÉ:', totalPoints, 'pts');

  // Récupérer le classement
  const { data: ranking } = await supabase
    .from('tournament_rankings')
    .select('total_points, exact_scores, correct_results')
    .eq('tournament_id', tournament.id)
    .eq('user_id', shanksProfile.id)
    .single();

  if (ranking) {
    console.log('TOTAL AU CLASSEMENT:', ranking.total_points, 'pts');
    console.log('(Exact:', ranking.exact_scores, '/ Correct:', ranking.correct_results, ')');
  }

  process.exit(0);
})();
