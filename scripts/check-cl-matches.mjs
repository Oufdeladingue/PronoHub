/**
 * Script pour vérifier les matchs de la Champions League sur l'API football-data.org
 * Usage: node scripts/check-cl-matches.mjs
 */

const API_KEY = process.env.FOOTBALL_DATA_API_KEY

if (!API_KEY) {
  console.error('❌ FOOTBALL_DATA_API_KEY non configurée')
  console.log('Exécute avec: FOOTBALL_DATA_API_KEY=ta_cle node scripts/check-cl-matches.mjs')
  process.exit(1)
}

const FOOTBALL_DATA_API = 'https://api.football-data.org/v4'
const CL_ID = 2001 // Champions League

async function checkCLMatches() {
  console.log('🔍 Vérification des matchs Champions League sur football-data.org...\n')

  try {
    // 1. Récupérer les infos de la compétition
    const compResponse = await fetch(`${FOOTBALL_DATA_API}/competitions/CL`, {
      headers: { 'X-Auth-Token': API_KEY }
    })
    const compData = await compResponse.json()

    console.log('📊 Compétition:', compData.name)
    console.log('📅 Saison:', compData.currentSeason?.startDate, '->', compData.currentSeason?.endDate)
    console.log('🎯 Journée actuelle:', compData.currentSeason?.currentMatchday)
    console.log('')

    // 2. Récupérer tous les matchs
    const matchesResponse = await fetch(`${FOOTBALL_DATA_API}/competitions/CL/matches`, {
      headers: { 'X-Auth-Token': API_KEY }
    })
    const matchesData = await matchesResponse.json()

    console.log(`📋 Total matchs trouvés: ${matchesData.matches?.length || 0}\n`)

    // 3. Grouper par journée/stage
    const matchesByStage = {}
    for (const match of matchesData.matches || []) {
      const stage = match.stage || 'Unknown'
      const matchday = match.matchday || 0
      const key = `${stage} - Journée ${matchday}`

      if (!matchesByStage[key]) {
        matchesByStage[key] = { total: 0, finished: 0, scheduled: 0, matches: [] }
      }
      matchesByStage[key].total++
      if (match.status === 'FINISHED') {
        matchesByStage[key].finished++
      } else {
        matchesByStage[key].scheduled++
        matchesByStage[key].matches.push({
          date: match.utcDate,
          home: match.homeTeam?.name,
          away: match.awayTeam?.name,
          status: match.status
        })
      }
    }

    // 4. Afficher le résumé
    console.log('📊 Résumé par phase/journée:\n')
    for (const [key, data] of Object.entries(matchesByStage)) {
      console.log(`  ${key}:`)
      console.log(`    - Total: ${data.total} matchs`)
      console.log(`    - Terminés: ${data.finished}`)
      console.log(`    - À venir: ${data.scheduled}`)

      if (data.scheduled > 0 && data.matches.length <= 5) {
        console.log('    - Prochains matchs:')
        for (const m of data.matches.slice(0, 5)) {
          console.log(`      • ${new Date(m.date).toLocaleDateString('fr-FR')} - ${m.home} vs ${m.away} (${m.status})`)
        }
      }
      console.log('')
    }

    // 5. Résumé des matchs à venir
    const upcomingMatches = (matchesData.matches || [])
      .filter(m => m.status !== 'FINISHED')
      .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate))

    console.log('\n🔮 Prochains matchs (tous confondus):\n')
    for (const m of upcomingMatches.slice(0, 10)) {
      console.log(`  ${new Date(m.utcDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`)
      console.log(`  ${m.homeTeam?.name} vs ${m.awayTeam?.name}`)
      console.log(`  Stage: ${m.stage}, Journée: ${m.matchday}, Status: ${m.status}`)
      console.log('')
    }

    if (upcomingMatches.length === 0) {
      console.log('  ⚠️ Aucun match à venir trouvé!')
      console.log('  → Les matchs de la phase à élimination ne sont peut-être pas encore programmés sur l\'API')
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message)
  }
}

checkCLMatches()
