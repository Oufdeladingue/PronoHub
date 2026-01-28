import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const FOOTBALL_DATA_API = 'https://api.football-data.org/v4'

/**
 * API pour synchroniser les classements des compétitions
 *
 * Usage:
 * - GET /api/football/sync-standings - Synchronise toutes les compétitions actives
 * - GET /api/football/sync-standings?competitionId=2015 - Synchronise une compétition spécifique
 *
 * Recommandation: Appeler 1x/jour après la fin des matchs
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const competitionId = searchParams.get('competitionId')

    const apiKey = process.env.FOOTBALL_DATA_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Football Data API key not configured' },
        { status: 500 }
      )
    }

    const supabase = await createClient()

    // Déterminer les compétitions à synchroniser
    let competitionsToSync: number[] = []

    if (competitionId) {
      competitionsToSync = [parseInt(competitionId)]
    } else {
      // Récupérer toutes les compétitions actives
      // Les coupes (qui n'ont pas de classement) retourneront 404 et seront ignorées
      const { data: activeComps } = await supabase
        .from('competitions')
        .select('id')
        .eq('is_active', true)

      competitionsToSync = activeComps?.map(c => c.id) || []
    }

    if (competitionsToSync.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active competitions to sync',
        syncedCompetitions: 0
      })
    }

    let totalSynced = 0
    let totalTeams = 0
    const errors: any[] = []
    const syncedDetails: { competitionId: number; teams: number }[] = []

    // Pour chaque compétition, récupérer et stocker les classements
    for (const compId of competitionsToSync) {
      try {
        console.log(`[STANDINGS] Syncing competition ${compId}...`)

        // Récupérer les classements depuis l'API
        const standingsResponse = await fetch(
          `${FOOTBALL_DATA_API}/competitions/${compId}/standings`,
          {
            headers: { 'X-Auth-Token': apiKey },
          }
        )

        // Log rate limit info
        console.log(`[STANDINGS] Rate limit - Available: ${standingsResponse.headers.get('X-Requests-Available-Minute')}/min`)

        if (!standingsResponse.ok) {
          // Certaines compétitions (coupes) n'ont pas de classement
          if (standingsResponse.status === 404) {
            console.log(`[STANDINGS] Competition ${compId} has no standings (probably a cup)`)
            continue
          }
          throw new Error(`Failed to fetch standings: ${standingsResponse.status} ${standingsResponse.statusText}`)
        }

        const standingsData = await standingsResponse.json()

        // Extraire le classement principal (TOTAL, pas HOME/AWAY)
        const totalStandings = standingsData.standings?.find(
          (s: any) => s.type === 'TOTAL'
        )

        if (!totalStandings || !totalStandings.table) {
          console.log(`[STANDINGS] No TOTAL standings found for competition ${compId}`)
          continue
        }

        // Préparer les données pour l'upsert (filtrer les entrées sans team_id)
        const standingsToInsert = totalStandings.table
          .filter((team: any) => team.team?.id != null)
          .map((team: any) => ({
            competition_id: compId,
            team_id: team.team.id,
            team_name: team.team.name,
            team_crest: team.team.crest,
            position: team.position,
            played_games: team.playedGames,
            won: team.won,
            draw: team.draw,
            lost: team.lost,
            goals_for: team.goalsFor,
            goals_against: team.goalsAgainst,
            goal_difference: team.goalDifference,
            points: team.points,
            form: team.form || null,
            updated_at: new Date().toISOString()
          }))

        // Upsert les classements
        const { error: upsertError } = await supabase
          .from('competition_standings')
          .upsert(standingsToInsert, {
            onConflict: 'competition_id,team_id'
          })

        if (upsertError) {
          console.error(`[STANDINGS] Error upserting standings for ${compId}:`, upsertError)
          errors.push({ competitionId: compId, error: upsertError.message })
        } else {
          totalSynced++
          totalTeams += standingsToInsert.length
          syncedDetails.push({ competitionId: compId, teams: standingsToInsert.length })
          console.log(`[STANDINGS] Synced ${standingsToInsert.length} teams for competition ${compId}`)
        }

        // Délai de 7 secondes pour respecter le rate limit (10 req/min en free tier)
        await new Promise(resolve => setTimeout(resolve, 7000))

      } catch (compError: any) {
        console.error(`[STANDINGS] Error syncing competition ${compId}:`, compError)
        errors.push({ competitionId: compId, error: compError.message })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Synced standings for ${totalSynced} competition(s)`,
      syncedCompetitions: totalSynced,
      totalTeams,
      details: syncedDetails,
      errors: errors.length > 0 ? errors : undefined
    })

  } catch (error: any) {
    console.error('[STANDINGS] Error in sync-standings:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
