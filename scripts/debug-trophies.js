const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Calcul des points identique à lib/scoring.ts
function calculatePoints(prediction, result, settings, isBonusMatch = false, isDefaultPrediction = false) {
  const { predictedHomeScore, predictedAwayScore } = prediction;
  const { homeScore, awayScore } = result;

  const getOutcome = (h, a) => h > a ? 'HOME' : (h < a ? 'AWAY' : 'DRAW');

  // Cas spécial : prono par défaut (0-0) avec match nul
  if (isDefaultPrediction && predictedHomeScore === 0 && predictedAwayScore === 0) {
    if (getOutcome(homeScore, awayScore) === 'DRAW') {
      const drawPoints = settings.drawWithDefaultPrediction || settings.correctResult;
      return { points: drawPoints * (isBonusMatch ? 2 : 1), isExactScore: false, isCorrectResult: true };
    }
  }

  // Score exact
  if (predictedHomeScore === homeScore && predictedAwayScore === awayScore) {
    return { points: settings.exactScore * (isBonusMatch ? 2 : 1), isExactScore: true, isCorrectResult: true };
  }

  // Bon résultat
  if (getOutcome(predictedHomeScore, predictedAwayScore) === getOutcome(homeScore, awayScore)) {
    return { points: settings.correctResult * (isBonusMatch ? 2 : 1), isExactScore: false, isCorrectResult: true };
  }

  return { points: 0, isExactScore: false, isCorrectResult: false };
}

async function debug() {
  const tournamentId = '0956fa4f-d661-436b-84f7-520015ffcf89';
  const romsId = '01b0ec3e-7f3d-458d-ba8d-9efae1c2bf06';

  // Récupérer le tournoi
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', tournamentId)
    .single();

  console.log('Tournament:', tournament.name);
  console.log('Scoring settings:', {
    exactScore: tournament.scoring_exact_score,
    correctResult: tournament.scoring_correct_winner,
    defaultPrediction: tournament.scoring_default_prediction_max
  });

  const settings = {
    exactScore: tournament.scoring_exact_score || 3,
    correctResult: tournament.scoring_correct_winner || 1,
    incorrectResult: 0,
    drawWithDefaultPrediction: tournament.scoring_default_prediction_max || 1
  };

  // Récupérer les matchs bonus du tournoi
  const { data: bonusMatches } = await supabase
    .from('tournament_bonus_matches')
    .select('match_id')
    .eq('tournament_id', tournamentId);

  const bonusMatchIds = new Set((bonusMatches || []).map(b => b.match_id));
  console.log('Bonus match IDs:', [...bonusMatchIds]);

  // Récupérer les participants
  const { data: participants } = await supabase
    .from('tournament_participants')
    .select('user_id, profiles(username)')
    .eq('tournament_id', tournamentId);

  console.log('Participants:', participants?.map(p => p.profiles?.username));

  // Récupérer les matchs de la J36
  const { data: matches36 } = await supabase
    .from('imported_matches')
    .select('id, matchday, home_score, away_score, status, finished')
    .eq('competition_id', tournament.competition_id)
    .eq('matchday', 36);

  console.log('\n=== JOURNEE 36 ===');
  console.log('Matchs:', matches36?.length, 'tous FINISHED:', matches36?.every(m => m.status === 'FINISHED'));

  const matchIds36 = matches36?.map(m => m.id) || [];
  const matchesMap = {};
  matches36?.forEach(m => { matchesMap[m.id] = m; });

  // Récupérer les pronostics pour la J36
  const { data: predictions36 } = await supabase
    .from('predictions')
    .select('user_id, match_id, predicted_home_score, predicted_away_score, is_default_prediction')
    .eq('tournament_id', tournamentId)
    .in('match_id', matchIds36);

  console.log('Predictions count:', predictions36?.length);

  // CALCULER LES POINTS CORRECTEMENT
  const pointsByUser = {};
  participants?.forEach(p => { pointsByUser[p.user_id] = 0; });

  predictions36?.forEach(pred => {
    const match = matchesMap[pred.match_id];
    if (!match || match.home_score === null || match.away_score === null) return;
    if (match.status !== 'FINISHED') return;

    const isBonusMatch = bonusMatchIds.has(pred.match_id);
    const result = calculatePoints(
      { predictedHomeScore: pred.predicted_home_score, predictedAwayScore: pred.predicted_away_score },
      { homeScore: match.home_score, awayScore: match.away_score },
      settings,
      isBonusMatch,
      pred.is_default_prediction || false
    );

    if (pointsByUser[pred.user_id] !== undefined) {
      pointsByUser[pred.user_id] += result.points;
    }
  });

  console.log('\nPoints calculés J36:');
  for (const [userId, points] of Object.entries(pointsByUser)) {
    const username = participants?.find(p => p.user_id === userId)?.profiles?.username || 'unknown';
    console.log(`  ${username}: ${points} pts`);
  }

  const values = Object.values(pointsByUser);
  const maxPoints = Math.max(...values);
  const usersWithMax = values.filter(v => v === maxPoints).length;
  const romsPoints = pointsByUser[romsId] || 0;
  const isRomsFirst = romsPoints === maxPoints;
  const isSoleLeader = isRomsFirst && (maxPoints > 0 || usersWithMax === 1);

  console.log('\n=== TROPHEE KING_OF_DAY ===');
  console.log('Max points:', maxPoints);
  console.log('Users with max:', usersWithMax);
  console.log('Roms points:', romsPoints);
  console.log('Is Roms sole leader?', isSoleLeader);

  if (isSoleLeader) {
    console.log('✅ Rom\'s devrait avoir le trophée King of Day!');
  } else {
    console.log('❌ Condition non remplie pour King of Day');
  }

  // Vérifier les trophées de Rom's
  const { data: romsTrophies } = await supabase
    .from('user_trophies')
    .select('trophy_type')
    .eq('user_id', romsId);

  console.log('\nTrophées actuels de Rom\'s:', romsTrophies?.map(t => t.trophy_type));
}

debug().catch(console.error);
