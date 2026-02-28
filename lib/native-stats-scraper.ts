/**
 * Native Stats Scraper - Fallback temps réel pour les scores
 * Scrape native-stats.org/match/{matchId} quand football-data.org retourne des données stale
 *
 * Avantages:
 * - Utilise les MÊMES match IDs que football-data.org (matching exact, pas de fuzzy)
 * - Gratuit, pas de clé API
 * - Mise à jour quasi temps réel des scores
 *
 * Gestion des prolongations:
 * - Le score affiché inclut les prolongations (ex: 3:2)
 * - On parse la table des buts pour filtrer ceux > 90 min
 * - On retourne uniquement le score à l'issue des 90 minutes réglementaires
 */

const NATIVE_STATS_BASE = 'https://native-stats.org/match'

export interface ScrapedScore {
  homeScore: number
  awayScore: number
  isFinished: boolean
  hasExtraTime: boolean
  source: 'native-stats'
}

/**
 * Parse un numéro de minute (ex: "105+1" → 105, "37" → 37, "90+3" → 90)
 */
function parseMinute(minuteStr: string): number {
  const match = minuteStr.trim().match(/^(\d+)/)
  return match ? parseInt(match[1], 10) : 0
}

/**
 * Scrape le score d'un match depuis native-stats.org
 * @param matchId - football_data_match_id (même ID que football-data.org)
 * @param utcDate - date de kickoff (ISO string) pour déterminer si le match est terminé
 * @returns Score scrapé ou null si indisponible/pas commencé
 */
export async function scrapeMatchScore(
  matchId: number,
  utcDate: string
): Promise<ScrapedScore | null> {
  try {
    const response = await fetch(`${NATIVE_STATS_BASE}/${matchId}`, {
      headers: {
        'User-Agent': 'PronoHub/1.0',
        'Accept': 'text/html',
      },
    })

    if (!response.ok) {
      console.log(`[NATIVE-STATS] HTTP ${response.status} for match ${matchId}`)
      return null
    }

    const html = await response.text()

    // 1. Extraire le score depuis <div id="score">
    const scoreMatch = html.match(/<div id="score"[^>]*>\s*([^<]+)/)
    const scoreText = scoreMatch?.[1]?.trim()

    if (!scoreText || scoreText === '-:-') {
      return null // Match pas encore commencé sur native-stats
    }

    // Parser le score principal: "5:2 (3:0)" ou "5:2"
    const mainScoreMatch = scoreText.match(/^(\d+):(\d+)/)
    if (!mainScoreMatch) {
      console.log(`[NATIVE-STATS] Could not parse score "${scoreText}" for match ${matchId}`)
      return null
    }

    let homeScore = parseInt(mainScoreMatch[1], 10)
    let awayScore = parseInt(mainScoreMatch[2], 10)
    let hasExtraTime = false

    // 2. Vérifier si prolongation en parsant la table des buts
    const goalsSection = html.split('<!-- Goals -->')[1]
    if (goalsSection) {
      const tbodyMatch = goalsSection.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/)

      if (tbodyMatch && !tbodyMatch[1].includes('No goals yet')) {
        const tbodyHtml = tbodyMatch[1]

        // Extraire chaque ligne de but
        const rows = tbodyHtml.split(/<tr class="text-gray-300">/).slice(1)

        const goals: { minute: number; cumulativeScore: string }[] = []

        for (const row of rows) {
          // Extraire les <td> de chaque ligne
          const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/g
          const tds: string[] = []
          let tdMatch
          while ((tdMatch = tdRegex.exec(row)) !== null) {
            const text = tdMatch[1].replace(/<[^>]*>/g, '').trim()
            tds.push(text)
          }

          // 5 colonnes: Min, Team, Scorer, Assist, Score
          if (tds.length >= 5) {
            const minute = parseMinute(tds[0])
            const score = tds[4]
            if (minute > 0 && /^\d+:\d+$/.test(score)) {
              goals.push({ minute, cumulativeScore: score })
            }
          }
        }

        // Vérifier si des buts sont en prolongation (> 90 min)
        const extraTimeGoals = goals.filter(g => g.minute > 90)

        if (extraTimeGoals.length > 0) {
          hasExtraTime = true

          // Trouver le dernier but dans les 90 min réglementaires
          const regularTimeGoals = goals.filter(g => g.minute <= 90)

          if (regularTimeGoals.length > 0) {
            const lastRegularGoal = regularTimeGoals[regularTimeGoals.length - 1]
            const scoreParts = lastRegularGoal.cumulativeScore.match(/^(\d+):(\d+)$/)
            if (scoreParts) {
              homeScore = parseInt(scoreParts[1], 10)
              awayScore = parseInt(scoreParts[2], 10)
              console.log(`[NATIVE-STATS] Extra time detected for match ${matchId}: displayed ${scoreText}, 90min score: ${homeScore}:${awayScore}`)
            }
          } else {
            // Tous les buts sont en prolongation → score à 90 min = 0:0
            homeScore = 0
            awayScore = 0
            console.log(`[NATIVE-STATS] Extra time detected for match ${matchId}: all goals in ET, 90min score: 0:0`)
          }
        }
      }
    }

    // 3. Déterminer si le match est terminé (kickoff + 2h15)
    const kickoff = new Date(utcDate).getTime()
    const matchDuration = 2 * 60 * 60 * 1000 + 15 * 60 * 1000 // 2h15
    const isFinished = Date.now() > kickoff + matchDuration

    console.log(`[NATIVE-STATS] Match ${matchId}: ${homeScore}:${awayScore} (${isFinished ? 'FINISHED' : 'IN_PLAY'})${hasExtraTime ? ' [ET]' : ''}`)

    return {
      homeScore,
      awayScore,
      isFinished,
      hasExtraTime,
      source: 'native-stats',
    }
  } catch (error: any) {
    console.error(`[NATIVE-STATS] Error scraping match ${matchId}:`, error.message)
    return null
  }
}
