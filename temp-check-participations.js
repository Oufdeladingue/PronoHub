const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://txpmihreaxmtsxlgmdko.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4cG1paHJlYXhtdHN4bGdtZGtvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTU5MDIyNiwiZXhwIjoyMDc3MTY2MjI2fQ.so6lF4GH-DGbSr3EYmzxS24kRxTgzF7-aT3OV1o5QJQ'

const supabase = createClient(supabaseUrl, supabaseKey)

async function check() {
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', "Rom's")
    .single()

  console.log('User ID:', profile.id)

  // Participations
  const { data: participations, error: partError } = await supabase
    .from('tournament_participants')
    .select('*')
    .eq('user_id', profile.id)

  console.log('\nParticipations count:', participations?.length || 0)
  console.log('Error:', partError)

  if (participations && participations.length > 0) {
    console.log('\nTournament IDs:')
    const tournamentIds = participations.map(p => p.tournament_id)
    console.log(tournamentIds)

    // Récupérer les tournois
    const { data: tournaments, error: tourError } = await supabase
      .from('tournaments')
      .select('*')
      .in('id', tournamentIds)

    console.log('\nTournaments found:', tournaments?.length || 0)
    console.log('Error:', tourError)

    if (tournaments) {
      console.log('\nDétails tournois:')
      tournaments.forEach(t => {
        const participation = participations.find(p => p.tournament_id === t.id)
        console.log(`- ${t.name} (${t.tournament_type || 'free'}) - Status: ${t.status}`)
        console.log(`  invite_type: ${participation?.invite_type}, role: ${participation?.participant_role}`)
      })
    }
  }
}

check()
