const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TOURNAMENT_ID = '483bfcb4-f192-44f0-8493-f5d99b8281e1'; // ZEQXTLPS

(async () => {
  console.log('='.repeat(80));
  console.log('DIAGNOSTIC API BONUS MATCHES');
  console.log('='.repeat(80));

  // 1. Récupérer le tournoi
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', TOURNAMENT_ID)
    .single();

  console.log('\n1. TOURNOI:');
  console.log('   ID:', tournament.id);
  console.log('   Nom:', tournament.name);
  console.log('   bonus_match:', tournament.bonus_match);
  console.log('   competition_id:', tournament.competition_id);
  console.log('   custom_competition_id:', tournament.custom_competition_id);
  console.log('   starting_matchday:', tournament.starting_matchday);
  console.log('   ending_matchday:', tournament.ending_matchday);

  // 2. Vérifier les bonus matches en BDD
  const { data: existingBonusMatches, error: bonusError } = await supabase
    .from('tournament_bonus_matches')
    .select('*')
    .eq('tournament_id', TOURNAMENT_ID)
    .order('matchday', { ascending: true });

  console.log('\n2. BONUS MATCHES EN BDD:');
  console.log('   Nombre:', existingBonusMatches?.length || 0);
  if (bonusError) console.error('   Erreur:', bonusError);

  if (existingBonusMatches && existingBonusMatches.length > 0) {
    console.log('   Journées:', existingBonusMatches.map(bm => bm.matchday).join(', '));
  }

  // 3. Déterminer les journées à vérifier (logique de l'API)
  console.log('\n3. LOGIQUE DE L\'API:');
  const isCustomCompetition = !!tournament.custom_competition_id;
  console.log('   isCustomCompetition:', isCustomCompetition);

  let matchdaysToCheck = [];
  if (isCustomCompetition) {
    console.log('   [Custom] Récupération des journées custom...');
    const { data: customMatchdays } = await supabase
      .from('custom_competition_matchdays')
      .select('matchday_number')
      .eq('custom_competition_id', tournament.custom_competition_id)
      .order('matchday_number', { ascending: true });

    matchdaysToCheck = customMatchdays?.map(md => md.matchday_number) || [];
    console.log('   [Custom] Journées trouvées:', matchdaysToCheck.join(', '));
  } else {
    console.log('   [Standard] Calcul des journées...');
    const startMatchday = tournament.starting_matchday || 1;
    const endMatchday = tournament.ending_matchday || (tournament.num_matchdays || 10);
    matchdaysToCheck = Array.from(
      { length: endMatchday - startMatchday + 1 },
      (_, i) => startMatchday + i
    );
    console.log('   [Standard] Journées calculées:', matchdaysToCheck.join(', '));
  }

  // 4. Combiner existants et nouveaux (logique de l'API)
  const existingMatchdays = new Set(existingBonusMatches?.map(bm => bm.matchday) || []);
  const allBonusMatches = [...(existingBonusMatches || [])];

  console.log('\n4. RÉSULTAT FINAL:');
  console.log('   Bonus matches existants:', existingBonusMatches?.length || 0);
  console.log('   Nouveaux à créer:', matchdaysToCheck.filter(md => !existingMatchdays.has(md)).length);
  console.log('   Total à retourner:', allBonusMatches.length);

  console.log('\n5. CE QUI SERAIT RETOURNÉ PAR L\'API:');
  console.log(JSON.stringify({ bonusMatches: allBonusMatches }, null, 2));

  console.log('\n' + '='.repeat(80));
  process.exit(0);
})();
