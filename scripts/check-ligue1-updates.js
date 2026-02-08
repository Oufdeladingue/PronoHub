const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('='.repeat(80));
  console.log('VÉRIFICATION DES MISES À JOUR LIGUE 1');
  console.log('='.repeat(80));
  console.log('');

  // Trouver l'ID de la Ligue 1 (FL1 ou Ligue 1)
  const { data: competitions } = await supabase
    .from('competitions')
    .select('*')
    .or('code.eq.FL1,name.ilike.%ligue 1%');

  console.log('Compétitions trouvées:', competitions?.length || 0);
  if (competitions && competitions.length > 0) {
    competitions.forEach(comp => {
      console.log(`- ${comp.name} (${comp.code}) - ID: ${comp.id}`);
    });
  }
  console.log('');

  // Récupérer les matchs récents de Ligue 1
  const { data: matches, error } = await supabase
    .from('imported_matches')
    .select('id, utc_date, home_team_name, away_team_name, home_score, away_score, status, updated_at')
    .eq('competition_id', 2015) // ID Ligue 1
    .gte('utc_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Derniers 7 jours
    .order('utc_date', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Erreur:', error);
    process.exit(1);
  }

  console.log('DERNIERS MATCHS DE LIGUE 1 (7 derniers jours):');
  console.log('-'.repeat(80));

  matches?.forEach(match => {
    const matchDate = new Date(match.utc_date);
    const updatedDate = new Date(match.updated_at);
    const now = new Date();
    const isLive = ['IN_PLAY', 'PAUSED'].includes(match.status);
    const minutesSinceUpdate = Math.floor((now - updatedDate) / 1000 / 60);

    console.log(`\n${match.home_team_name} ${match.home_score ?? '-'} - ${match.away_score ?? '-'} ${match.away_team_name}`);
    console.log(`  Status: ${match.status}${isLive ? ' 🔴 LIVE' : ''}`);
    console.log(`  Date match: ${matchDate.toLocaleString('fr-FR')}`);
    console.log(`  Dernière MAJ: ${updatedDate.toLocaleString('fr-FR')} (il y a ${minutesSinceUpdate} min)`);
  });

  console.log('');
  console.log('='.repeat(80));
  process.exit(0);
})();
