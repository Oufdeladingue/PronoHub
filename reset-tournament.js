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
  const tournamentCode = 'UBPBZYHL';

  console.log('Vérification du nombre de participants...\n');

  // Récupérer le tournoi
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('*')
    .eq('slug', tournamentCode)
    .single();

  console.log('Tournoi:', tournament.name);
  console.log('current_participants (champ DB):', tournament.current_participants);

  // Compter les participants réels
  const { data: participants, count } = await supabase
    .from('tournament_participants')
    .select('user_id, profiles(username)', { count: 'exact' })
    .eq('tournament_id', tournament.id);

  console.log('Participants réels (comptés):', count);
  console.log('Liste des participants:');
  participants?.forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.profiles?.username || 'Inconnu'}`);
  });
})();
