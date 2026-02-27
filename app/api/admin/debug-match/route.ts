import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const FOOTBALL_DATA_API = 'https://api.football-data.org/v4'

/**
 * Debug endpoint pour vérifier l'état d'un match spécifique
 * GET /api/admin/debug-match?home=Parma&away=Cagliari&tournament=elitetimcook
 */
export async function GET(request: Request) {
  try {
    const supabase = createAdminClient()
    const apiKey = process.env.FOOTBALL_DATA_API_KEY

    const { searchParams } = new URL(request.url)
    const home = searchParams.get('home') || 'Parma'
    const away = searchParams.get('away') || 'Cagliari'
    const tournamentName = searchParams.get('tournament') || ''

    // 1. Chercher le match dans imported_matches
    const { data: importedMatches, error: imError } = await supabase
      .from('imported_matches')
      .select('id, football_data_match_id, competition_id, matchday, stage, utc_date, status, finished, home_team_name, away_team_name, home_score, away_score, home_score_90, away_score_90, last_updated_at')
      .ilike('home_team_name', `%${home}%`)
      .ilike('away_team_name', `%${away}%`)
      .order('utc_date', { ascending: false })
      .limit(5)

    // 2. Appeler l'API Football Data directement pour vérifier
    let apiResponse: any = null
    if (importedMatches && importedMatches.length > 0 && apiKey) {
      const matchId = importedMatches[0].football_data_match_id
      try {
        const res = await fetch(`${FOOTBALL_DATA_API}/matches/${matchId}`, {
          headers: { 'X-Auth-Token': apiKey }
        })
        if (res.ok) {
          const data = await res.json()
          apiResponse = {
            id: data.id,
            status: data.status,
            utcDate: data.utcDate,
            matchday: data.matchday,
            homeTeam: data.homeTeam?.name,
            awayTeam: data.awayTeam?.name,
            score: data.score,
            lastUpdated: data.lastUpdated
          }
        } else {
          apiResponse = { error: `HTTP ${res.status}: ${res.statusText}` }
        }
      } catch (err: any) {
        apiResponse = { error: err.message }
      }

      // 2b. Aussi vérifier via l'endpoint competition/matches pour Serie A
      const competitionId = importedMatches[0].competition_id
      try {
        const compRes = await fetch(`${FOOTBALL_DATA_API}/competitions/${competitionId}/matches?matchday=${importedMatches[0].matchday}`, {
          headers: { 'X-Auth-Token': apiKey }
        })
        if (compRes.ok) {
          const compData = await compRes.json()
          const targetMatch = compData.matches?.find((m: any) => m.id === importedMatches[0].football_data_match_id)
          apiResponse = {
            ...apiResponse,
            fromCompetitionEndpoint: targetMatch ? {
              id: targetMatch.id,
              status: targetMatch.status,
              score: targetMatch.score,
              homeTeam: targetMatch.homeTeam?.name,
              awayTeam: targetMatch.awayTeam?.name,
            } : 'Match NOT FOUND in competition endpoint response',
            competitionMatchesCount: compData.matches?.length || 0,
            allMatchStatuses: compData.matches?.map((m: any) => ({
              id: m.id,
              home: m.homeTeam?.shortName,
              away: m.awayTeam?.shortName,
              status: m.status,
              score: `${m.score?.fullTime?.home ?? '-'}-${m.score?.fullTime?.away ?? '-'}`
            }))
          }
        }
      } catch {
        // ignore
      }
    }

    // 2c. Vérifier le statut du compte API + rate limits
    let apiAccountStatus: any = null
    if (apiKey) {
      try {
        const accountRes = await fetch(`${FOOTBALL_DATA_API}/`, {
          headers: { 'X-Auth-Token': apiKey }
        })
        const rateLimitRemaining = accountRes.headers.get('x-requests-available-minute')
        const rateLimitUsed = accountRes.headers.get('x-requestcounter-reset')
        const apiVersion = accountRes.headers.get('x-api-version')

        if (accountRes.ok) {
          const accountData = await accountRes.json()
          apiAccountStatus = {
            plan: accountData.plan,
            name: accountData.name,
            permissions: accountData.permissions,
            rateLimitRemaining,
            rateLimitUsed,
            apiVersion,
            httpStatus: accountRes.status
          }
        } else {
          apiAccountStatus = {
            error: `HTTP ${accountRes.status}: ${accountRes.statusText}`,
            rateLimitRemaining,
            httpStatus: accountRes.status
          }
        }
      } catch (err: any) {
        apiAccountStatus = { error: err.message }
      }

      // 2d. Vérifier plusieurs compétitions pour comparer
      const competitionsToCheck = [
        { id: 2021, name: 'Premier League' },
        { id: 2015, name: 'Ligue 1' },
        { id: 2014, name: 'La Liga' },
        { id: 2002, name: 'Bundesliga' },
        { id: 2019, name: 'Serie A' },
      ]

      const competitionStatuses: any[] = []
      for (const comp of competitionsToCheck) {
        try {
          const compRes = await fetch(`${FOOTBALL_DATA_API}/competitions/${comp.id}`, {
            headers: { 'X-Auth-Token': apiKey }
          })
          if (compRes.ok) {
            const compData = await compRes.json()
            const currentMd = compData.currentSeason?.currentMatchday
            // Récupérer les matchs du matchday actuel
            let recentMatches: any[] = []
            if (currentMd) {
              const mdRes = await fetch(`${FOOTBALL_DATA_API}/competitions/${comp.id}/matches?matchday=${currentMd}`, {
                headers: { 'X-Auth-Token': apiKey }
              })
              if (mdRes.ok) {
                const mdData = await mdRes.json()
                recentMatches = mdData.matches?.slice(0, 3).map((m: any) => ({
                  home: m.homeTeam?.shortName,
                  away: m.awayTeam?.shortName,
                  status: m.status,
                  score: `${m.score?.fullTime?.home ?? '-'}-${m.score?.fullTime?.away ?? '-'}`,
                  utcDate: m.utcDate
                })) || []
              }
            }
            competitionStatuses.push({
              name: comp.name,
              id: comp.id,
              currentMatchday: currentMd,
              seasonStart: compData.currentSeason?.startDate,
              seasonEnd: compData.currentSeason?.endDate,
              lastUpdated: compData.lastUpdated,
              recentMatches
            })
          }
        } catch {
          competitionStatuses.push({ name: comp.name, id: comp.id, error: 'fetch failed' })
        }
      }
      apiAccountStatus = { ...apiAccountStatus, competitionStatuses }
    }

    // 3. Chercher le tournoi
    let tournamentInfo = null
    let tournamentMatches = null
    if (tournamentName) {
      const { data: tournaments } = await supabase
        .from('tournaments')
        .select('id, name, slug, competition_id, custom_competition_id, starting_matchday, ending_matchday, status, all_matchdays')
        .ilike('name', `%${tournamentName}%`)
        .limit(3)

      tournamentInfo = tournaments

      if (tournaments && tournaments.length > 0 && importedMatches && importedMatches.length > 0) {
        const tournament = tournaments[0]
        const matchIds = importedMatches.map(m => m.id)

        if (tournament.custom_competition_id) {
          const { data: customMatches } = await supabase
            .from('custom_competition_matches')
            .select('id, football_data_match_id, imported_match_id, custom_matchday_id')
            .in('football_data_match_id', importedMatches.map(m => m.football_data_match_id))

          tournamentMatches = {
            type: 'custom',
            customMatches,
          }
        } else {
          const matchesInRange = importedMatches.filter(m =>
            m.competition_id === tournament.competition_id &&
            m.matchday >= tournament.starting_matchday &&
            m.matchday <= tournament.ending_matchday
          )

          tournamentMatches = {
            type: 'standard',
            matchesInRange: matchesInRange.map(m => ({
              id: m.id,
              matchday: m.matchday,
              status: m.status,
              home_score: m.home_score,
              away_score: m.away_score,
              inRange: true
            })),
          }
        }

        const { data: predictions } = await supabase
          .from('predictions')
          .select('id, user_id, match_id, predicted_home_score, predicted_away_score, is_default_prediction, profiles(username)')
          .eq('tournament_id', tournament.id)
          .in('match_id', matchIds)

        tournamentMatches = {
          ...tournamentMatches,
          predictions: predictions?.map(p => ({
            username: (p.profiles as any)?.username,
            match_id: p.match_id,
            predicted: `${p.predicted_home_score}-${p.predicted_away_score}`,
            isDefault: p.is_default_prediction
          }))
        }
      }
    }

    // 4. Derniers logs cron
    const { data: recentLogs } = await supabase
      .from('cron_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5)

    return NextResponse.json({
      query: { home, away, tournamentName },
      importedMatches: importedMatches || [],
      footballDataAPI: apiResponse,
      apiAccountStatus,
      tournamentInfo,
      tournamentMatches,
      recentCronLogs: recentLogs || [],
      diagnosis: getDiagnosis(importedMatches, tournamentInfo, tournamentMatches, apiResponse)
    })

  } catch (error: any) {
    console.error('[DEBUG-MATCH] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

function getDiagnosis(
  importedMatches: any[] | null,
  tournamentInfo: any[] | null,
  tournamentMatches: any,
  apiResponse: any
): string[] {
  const issues: string[] = []

  if (!importedMatches || importedMatches.length === 0) {
    issues.push('CRITIQUE: Match non trouvé dans imported_matches')
    return issues
  }

  const match = importedMatches[0]

  // Comparer DB vs API
  if (apiResponse && !apiResponse.error) {
    if (apiResponse.status !== match.status) {
      issues.push(`BUG CONFIRMÉ: L'API retourne status="${apiResponse.status}" mais la DB a "${match.status}" → L'upsert ne fonctionne pas`)
    }
    if (apiResponse.status === 'FINISHED' && (match.home_score === null || match.away_score === null)) {
      issues.push(`BUG CONFIRMÉ: L'API a le score final (${apiResponse.score?.fullTime?.home}-${apiResponse.score?.fullTime?.away}) mais la DB a des scores null → L'upsert ne met pas à jour`)
    }
    if (apiResponse.status === match.status && match.status === 'TIMED') {
      issues.push(`INFO: L'API retourne aussi TIMED → Le match n'est pas encore terminé selon Football Data`)
    }
  }

  if (match.home_score === null || match.away_score === null) {
    issues.push(`Score null en base (home=${match.home_score}, away=${match.away_score})`)
  }

  if (match.status !== 'FINISHED') {
    issues.push(`Status = "${match.status}" (pas FINISHED)`)
  }

  if (tournamentInfo && tournamentInfo.length > 0) {
    const tournament = tournamentInfo[0]
    if (!tournament.custom_competition_id && tournament.competition_id) {
      if (match.matchday < tournament.starting_matchday || match.matchday > tournament.ending_matchday) {
        issues.push(`Match J${match.matchday} hors plage tournoi J${tournament.starting_matchday}-J${tournament.ending_matchday}`)
      }
    }
  }

  if (issues.length === 0) {
    issues.push('OK: Aucun problème détecté')
  }

  return issues
}
