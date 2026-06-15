import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

const FOOTBALL_DATA_API = 'https://api.football-data.org/v4'

type GroupMatchRow = {
  home_team_id: number | null
  away_team_id: number | null
  home_team_name: string | null
  away_team_name: string | null
  home_team_crest: string | null
  away_team_crest: string | null
  home_score: number | null
  away_score: number | null
  status: string | null
  group_name: string | null
}

/**
 * Calcule les classements de poules À PARTIR de nos propres matchs (imported_matches).
 * Raison : football-data.org (free tier) renvoie des classements de Coupe du Monde
 * CORROMPUS (groupes manquants, faux groupes "Atlantic/Central Division", équipes
 * réassignées). Nos matchs ont le bon group_name (GROUP_X) et des scores tenus à jour
 * (cron de scores + fallback TheSportsDB) → source fiable et auto-suffisante.
 * On inclut toutes les équipes de la poule (même celles qui n'ont pas encore joué → 0).
 */
function computeGroupStandings(compId: number, matches: GroupMatchRow[]) {
  const groups = new Map<string, Map<number, any>>()
  const ensure = (g: string, id: number, name: string | null, crest: string | null) => {
    if (!groups.has(g)) groups.set(g, new Map())
    const tm = groups.get(g)!
    if (!tm.has(id)) {
      tm.set(id, { team_id: id, team_name: name || 'Équipe', team_crest: crest || null, played_games: 0, won: 0, draw: 0, lost: 0, goals_for: 0, goals_against: 0, points: 0 })
    } else if (!tm.get(id).team_crest && crest) {
      tm.get(id).team_crest = crest
    }
    return tm.get(id)
  }

  for (const m of matches) {
    if (!m.group_name || m.home_team_id == null || m.away_team_id == null) continue
    const home = ensure(m.group_name, m.home_team_id, m.home_team_name, m.home_team_crest)
    const away = ensure(m.group_name, m.away_team_id, m.away_team_name, m.away_team_crest)
    const finished = (m.status === 'FINISHED' || m.status === 'AWARDED') && m.home_score != null && m.away_score != null
    if (!finished) continue
    const hs = m.home_score as number
    const as = m.away_score as number
    home.played_games++; away.played_games++
    home.goals_for += hs; home.goals_against += as
    away.goals_for += as; away.goals_against += hs
    if (hs > as) { home.won++; home.points += 3; away.lost++ }
    else if (hs < as) { away.won++; away.points += 3; home.lost++ }
    else { home.draw++; away.draw++; home.points++; away.points++ }
  }

  const now = new Date().toISOString()
  const rows: any[] = []
  for (const [g, teams] of groups) {
    const arr = [...teams.values()].map((t) => ({ ...t, goal_difference: t.goals_for - t.goals_against }))
    // Tri: points, puis diff de buts, puis buts marqués, puis nom (approx. réglementaire)
    arr.sort((a, b) =>
      b.points - a.points ||
      b.goal_difference - a.goal_difference ||
      b.goals_for - a.goals_for ||
      (a.team_name as string).localeCompare(b.team_name as string)
    )
    arr.forEach((t, i) => {
      rows.push({
        competition_id: compId,
        team_id: t.team_id,
        team_name: t.team_name,
        team_crest: t.team_crest,
        group_name: g,
        position: i + 1,
        played_games: t.played_games,
        won: t.won,
        draw: t.draw,
        lost: t.lost,
        goals_for: t.goals_for,
        goals_against: t.goals_against,
        goal_difference: t.goal_difference,
        points: t.points,
        form: null,
        updated_at: now,
      })
    })
  }
  return rows
}

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
    // Auth cron (même schéma que les autres crons)
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const competitionId = searchParams.get('competitionId')

    const apiKey = process.env.FOOTBALL_DATA_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Football Data API key not configured' },
        { status: 500 }
      )
    }

    // IMPORTANT: service role (bypass RLS). Appelé par un cron sans cookies/JWT valide :
    // createClient() transmettrait le Bearer CRON_SECRET à PostgREST → 401 sur tout,
    // et la table competition_standings n'a aucune policy INSERT/UPDATE → 0 ligne écrite.
    const supabase = createAdminClient()

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

        // Compétition à POULES : si on a des matchs avec group_name, calculer le classement
        // depuis NOS matchs (football-data renvoie des poules WC corrompues). Sinon ligue → API.
        const { data: groupMatches } = await supabase
          .from('imported_matches')
          .select('home_team_id, away_team_id, home_team_name, away_team_name, home_team_crest, away_team_crest, home_score, away_score, status, group_name')
          .eq('competition_id', compId)
          .not('group_name', 'is', null)

        if (groupMatches && groupMatches.length > 0) {
          const rows = computeGroupStandings(compId, groupMatches as GroupMatchRow[])
          const { error: upsertError } = await supabase
            .from('competition_standings')
            .upsert(rows, { onConflict: 'competition_id,team_id' })

          if (upsertError) {
            console.error(`[STANDINGS] Error upserting computed standings for ${compId}:`, upsertError)
            errors.push({ competitionId: compId, error: upsertError.message })
          } else {
            totalSynced++
            totalTeams += rows.length
            syncedDetails.push({ competitionId: compId, teams: rows.length })
            console.log(`[STANDINGS] Computed ${rows.length} teams from matches for competition ${compId}`)
          }
          continue // pas d'appel football-data pour les compétitions à poules
        }

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

        // Extraire TOUS les classements principaux (type TOTAL, pas HOME/AWAY).
        // Pour une ligue, il y a une seule entrée TOTAL.
        // Pour une compétition à poules (Coupe du Monde, Euro...), football-data
        // renvoie une entrée TOTAL par groupe, chacune avec un champ `group`.
        const totalStandings = (standingsData.standings || []).filter(
          (s: any) => s.type === 'TOTAL' && Array.isArray(s.table)
        )

        if (totalStandings.length === 0) {
          console.log(`[STANDINGS] No TOTAL standings found for competition ${compId}`)
          continue
        }

        // Préparer les données pour l'upsert (filtrer les entrées sans team_id),
        // en aplatissant tous les groupes et en conservant le nom du groupe.
        const standingsToInsert = totalStandings.flatMap((group: any) =>
          group.table
            .filter((team: any) => team.team?.id != null)
            .map((team: any) => ({
              competition_id: compId,
              team_id: team.team.id,
              team_name: team.team.name,
              team_crest: team.team.crest,
              group_name: group.group || null,
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
        )

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

    // Si au moins une compétition a échoué (ex: RLS, rate limit, API down), renvoyer 500
    // pour que le job GitHub Actions passe au ROUGE au lieu de rester vert à tort.
    return NextResponse.json({
      success: errors.length === 0,
      message: `Synced standings for ${totalSynced} competition(s)`,
      syncedCompetitions: totalSynced,
      totalTeams,
      details: syncedDetails,
      errors: errors.length > 0 ? errors : undefined
    }, { status: errors.length > 0 ? 500 : 200 })

  } catch (error: any) {
    console.error('[STANDINGS] Error in sync-standings:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
