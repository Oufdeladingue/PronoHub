/**
 * Script de test pour vérifier les informations de "round" dans l'API
 * Test avec la Ligue des Champions (compétition à élimination)
 */

import { config } from 'dotenv'
import path from 'path'

// Charger les variables d'environnement
config({ path: path.join(process.cwd(), '.env.local') })

const FOOTBALL_DATA_API = 'https://api.football-data.org/v4'
const API_KEY = process.env.FOOTBALL_DATA_API_KEY

async function testRoundNames() {
  console.log('🔍 Test des informations de "round" dans l\'API Football-Data\n')

  if (!API_KEY) {
    console.error('❌ FOOTBALL_DATA_API_KEY non configurée')
    process.exit(1)
  }

  try {
    // Test avec la Ligue des Champions (ID: 2001)
    const competitionId = 2001
    const season = 2024

    console.log(`📊 Compétition testée: Champions League (ID: ${competitionId})`)
    console.log(`📅 Saison: ${season}\n`)

    // Récupérer les matchs de la compétition
    const response = await fetch(
      `${FOOTBALL_DATA_API}/competitions/${competitionId}/matches?season=${season}`,
      {
        headers: {
          'X-Auth-Token': API_KEY,
        },
      }
    )

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    const matches = data.matches || []

    console.log(`✅ ${matches.length} matchs récupérés\n`)

    // Extraire tous les types de "stage" et "matchday" uniques
    const stagesSet = new Set<string>()
    const matchdaysMap = new Map<string, Set<number>>()

    matches.forEach((match: any) => {
      if (match.stage) {
        stagesSet.add(match.stage)

        if (!matchdaysMap.has(match.stage)) {
          matchdaysMap.set(match.stage, new Set())
        }
        matchdaysMap.get(match.stage)!.add(match.matchday)
      }
    })

    console.log('📋 Stages disponibles:')
    console.log('─'.repeat(50))
    Array.from(stagesSet).sort().forEach(stage => {
      const matchdays = Array.from(matchdaysMap.get(stage) || []).sort((a, b) => a - b)
      console.log(`\n🏆 ${stage}`)
      console.log(`   Journées: ${matchdays.join(', ')}`)

      // Afficher quelques exemples de matchs
      const exampleMatches = matches
        .filter((m: any) => m.stage === stage)
        .slice(0, 2)

      exampleMatches.forEach((m: any) => {
        console.log(`   Exemple: ${m.homeTeam.name} vs ${m.awayTeam.name} (Journée ${m.matchday})`)
      })
    })

    console.log('\n' + '─'.repeat(50))
    console.log('\n🔍 Analyse détaillée d\'un match de phase à élimination:')
    console.log('─'.repeat(50))

    // Trouver un match de phase à élimination
    const knockoutMatch = matches.find((m: any) =>
      m.stage && m.stage.includes('ROUND') || m.stage.includes('FINAL')
    )

    if (knockoutMatch) {
      console.log('\nStage:', knockoutMatch.stage)
      console.log('Matchday:', knockoutMatch.matchday)
      console.log('Match:', knockoutMatch.homeTeam.name, 'vs', knockoutMatch.awayTeam.name)
      console.log('Date:', knockoutMatch.utcDate)
      console.log('\nStructure complète du match:')
      console.log(JSON.stringify({
        stage: knockoutMatch.stage,
        matchday: knockoutMatch.matchday,
        group: knockoutMatch.group,
        homeTeam: knockoutMatch.homeTeam.name,
        awayTeam: knockoutMatch.awayTeam.name,
        utcDate: knockoutMatch.utcDate
      }, null, 2))
    }

    console.log('\n' + '─'.repeat(50))
    console.log('\n✅ Test terminé avec succès!')
    console.log('\n💡 Conclusion:')
    console.log('- Le champ "stage" contient le type de rencontre (ex: "GROUP_STAGE", "ROUND_OF_16", "FINAL")')
    console.log('- Le champ "matchday" est toujours un nombre')
    console.log('- On peut utiliser "stage" pour afficher des noms personnalisés dans l\'UI')

  } catch (error: any) {
    console.error('❌ Erreur:', error.message)
    process.exit(1)
  }
}

testRoundNames()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Erreur:', error)
    process.exit(1)
  })
