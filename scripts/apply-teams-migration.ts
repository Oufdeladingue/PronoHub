// Script pour appliquer la migration des équipes
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://txpmihreaxmtsxlgmdko.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4cG1paHJlYXhtdHN4bGdtZGtvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTU5MDIyNiwiZXhwIjoyMDc3MTY2MjI2fQ.so6lF4GH-DGbSr3EYmzxS24kRxTgzF7-aT3OV1o5QJQ'
)

async function applyMigration() {
  console.log('Application de la migration des équipes...')

  // 1. Ajouter colonne teams_enabled
  const { error: error1 } = await supabase.rpc('exec_sql', {
    sql: `ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS teams_enabled BOOLEAN DEFAULT FALSE;`
  })
  if (error1) {
    console.log('Tentative alternative pour teams_enabled...')
    // Essayer via une requête directe
    const { error: altError } = await supabase
      .from('tournaments')
      .select('teams_enabled')
      .limit(1)

    if (altError && altError.message.includes('does not exist')) {
      console.log('Colonne teams_enabled non existante, création nécessaire via SQL Editor Supabase')
    } else {
      console.log('Colonne teams_enabled existe déjà ou autre erreur:', altError?.message)
    }
  }

  // 2. Vérifier si la table tournament_teams existe
  const { data: teamsData, error: teamsError } = await supabase
    .from('tournament_teams')
    .select('id')
    .limit(1)

  if (teamsError) {
    console.log('Table tournament_teams:', teamsError.message)
    console.log('\n⚠️  Les tables doivent être créées manuellement via le SQL Editor de Supabase')
    console.log('Copiez le contenu de supabase/migrations/add_tournament_teams.sql')
  } else {
    console.log('✅ Table tournament_teams existe')
  }

  // 3. Vérifier si la table tournament_team_members existe
  const { data: membersData, error: membersError } = await supabase
    .from('tournament_team_members')
    .select('id')
    .limit(1)

  if (membersError) {
    console.log('Table tournament_team_members:', membersError.message)
  } else {
    console.log('✅ Table tournament_team_members existe')
  }

  console.log('\n📋 Instructions:')
  console.log('1. Allez sur https://supabase.com/dashboard/project/txpmihreaxmtsxlgmdko/sql')
  console.log('2. Copiez-collez le contenu de: supabase/migrations/add_tournament_teams.sql')
  console.log('3. Exécutez le SQL')
}

applyMigration()
