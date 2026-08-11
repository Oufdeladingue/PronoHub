// Script pour récupérer des matchs avec logos pour tester l'API OG
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function getMatchesWithLogos() {
  // Récupérer les matchs avec logos
  const { data: matches, error } = await supabase
    .from('imported_matches')
    .select('id, competition_id, home_team_name, away_team_name, home_team_crest, away_team_crest, utc_date')
    .not('home_team_crest', 'is', null)
    .not('away_team_crest', 'is', null)
    .order('utc_date', { ascending: true })
    .limit(5)

  if (error) {
    console.error('Erreur:', error)
    return
  }

  // Récupérer les emblèmes des compétitions
  const competitionIds = [...new Set(matches.map(m => m.competition_id).filter(Boolean))]
  const { data: competitions } = await supabase
    .from('competitions')
    .select('id, name, emblem')
    .in('id', competitionIds)

  const competitionMap = new Map()
  for (const comp of competitions || []) {
    competitionMap.set(comp.id, comp)
  }

  console.log('\n=== Matchs avec logos disponibles ===\n')

  matches.forEach((match, i) => {
    const competition = competitionMap.get(match.competition_id)
    console.log(`${i + 1}. ${match.home_team_name} vs ${match.away_team_name}`)
    console.log(`   Competition: ${competition?.name || 'N/A'}`)
    console.log(`   Date: ${match.utc_date}`)
    console.log(`   Home logo: ${match.home_team_crest}`)
    console.log(`   Away logo: ${match.away_team_crest}`)
    console.log(`   Competition logo: ${competition?.emblem || 'N/A'}`)

    // Générer l'URL de test
    const params = new URLSearchParams({
      home: match.home_team_name,
      away: match.away_team_name,
      homeLogo: match.home_team_crest,
      awayLogo: match.away_team_crest,
      competitionLogo: competition?.emblem || '',
      time: '21:00',
      deadline: '20:30',
      otherCount: '2'
    })
    console.log(`   Test URL: http://localhost:3100/api/og/reminder?${params.toString()}`)
    console.log('')
  })
}

getMatchesWithLogos()
