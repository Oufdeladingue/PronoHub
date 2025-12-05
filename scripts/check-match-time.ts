import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import path from 'path'

// Charger les variables d'environnement
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkMatchTime() {
  console.log('Recherche du match Sevilla vs Celta...\n')

  // D'abord, voir les matchdays custom pour connaitre les dates
  const { data: matchdays } = await supabase
    .from('custom_competition_matchdays')
    .select('id, week_start, week_end, matchday_number')
    .order('matchday_number', { ascending: true })

  console.log('Journées custom:')
  matchdays?.forEach(md => {
    console.log(`  J${md.matchday_number}: ${md.week_start} -> ${md.week_end}`)
  })
  console.log('')

  // Chercher le match Sevilla vs Celta dans la J5 (janvier 2026)
  const weekStart = '2026-01-05'
  const weekEnd = '2026-01-12'

  console.log(`Recherche des matchs entre ${weekStart} et ${weekEnd}...\n`)

  // Rechercher spécifiquement Sevilla vs Celta
  const { data: matches, error } = await supabase
    .from('imported_matches')
    .select('id, home_team_name, away_team_name, utc_date, status, competition_id, matchday')
    .or('home_team_name.ilike.%sevilla%,away_team_name.ilike.%sevilla%')
    .or('home_team_name.ilike.%celta%,away_team_name.ilike.%celta%')
    .order('utc_date', { ascending: true })
    .limit(50)

  if (error) {
    console.error('Erreur:', error)
    return
  }

  if (!matches || matches.length === 0) {
    console.log('Aucun match trouvé')
    return
  }

  console.log(`${matches.length} match(s) trouvé(s):\n`)

  matches.forEach(match => {
    const utcDate = new Date(match.utc_date)
    const localDate = utcDate.toLocaleString('fr-FR', {
      timeZone: 'Europe/Paris',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })

    console.log(`Match: ${match.home_team_name} vs ${match.away_team_name}`)
    console.log(`  - UTC (base de données): ${match.utc_date}`)
    console.log(`  - Heure locale (Paris): ${localDate}`)
    console.log(`  - Status: ${match.status}`)
    console.log('')
  })
}

checkMatchTime()
