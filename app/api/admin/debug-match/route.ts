import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

/**
 * Debug endpoint pour vérifier l'état d'un match spécifique
 * GET /api/admin/debug-match?home=Parma&away=Cagliari&tournament=elitetimcook
 */
export async function GET(request: Request) {
  try {
    const supabase = createAdminClient()

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

    // 2. Chercher le tournoi
    let tournamentInfo = null
    let tournamentMatches = null
    if (tournamentName) {
      const { data: tournaments } = await supabase
        .from('tournaments')
        .select('id, name, slug, competition_id, custom_competition_id, starting_matchday, ending_matchday, status, all_matchdays')
        .ilike('name', `%${tournamentName}%`)
        .limit(3)

      tournamentInfo = tournaments

      // Si on a trouvé un tournoi et des matchs importés, vérifier les prédictions
      if (tournaments && tournaments.length > 0 && importedMatches && importedMatches.length > 0) {
        const tournament = tournaments[0]
        const matchIds = importedMatches.map(m => m.id)

        // Vérifier si c'est un tournoi custom
        if (tournament.custom_competition_id) {
          // Chercher dans custom_competition_matches
          const { data: customMatches } = await supabase
            .from('custom_competition_matches')
            .select('id, football_data_match_id, imported_match_id, custom_matchday_id')
            .in('football_data_match_id', importedMatches.map(m => m.football_data_match_id))

          tournamentMatches = {
            type: 'custom',
            customMatches,
            note: 'Vérifier que football_data_match_id est bien mappé'
          }
        } else {
          // Vérifier si le matchday du match est dans la plage du tournoi
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
            matchesOutOfRange: importedMatches.filter(m =>
              m.competition_id === tournament.competition_id &&
              (m.matchday < tournament.starting_matchday || m.matchday > tournament.ending_matchday)
            ).map(m => ({
              id: m.id,
              matchday: m.matchday,
              tournamentRange: `${tournament.starting_matchday}-${tournament.ending_matchday}`,
              inRange: false
            }))
          }
        }

        // Chercher les prédictions pour ces matchs
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

    // 3. Vérifier les match_windows actives
    const { data: matchWindows } = await supabase
      .from('match_windows')
      .select('*')
      .gte('window_end', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('window_start', { ascending: false })
      .limit(10)

    // 4. Derniers logs cron
    const { data: recentLogs } = await supabase
      .from('cron_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5)

    return NextResponse.json({
      query: { home, away, tournamentName },
      importedMatches: importedMatches || [],
      importedMatchesError: imError?.message || null,
      tournamentInfo,
      tournamentMatches,
      recentMatchWindows: matchWindows || [],
      recentCronLogs: recentLogs || [],
      diagnosis: getDiagnosis(importedMatches, tournamentInfo, tournamentMatches)
    })

  } catch (error: any) {
    console.error('[DEBUG-MATCH] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

function getDiagnosis(
  importedMatches: any[] | null,
  tournamentInfo: any[] | null,
  tournamentMatches: any
): string[] {
  const issues: string[] = []

  if (!importedMatches || importedMatches.length === 0) {
    issues.push('CRITIQUE: Match non trouvé dans imported_matches - le match n\'existe pas en base')
    return issues
  }

  const match = importedMatches[0]

  if (match.home_score === null || match.away_score === null) {
    issues.push(`CRITIQUE: Score null en base (home_score=${match.home_score}, away_score=${match.away_score}) - L'API n'a pas retourné de score ou le cron n'a pas mis à jour`)
  }

  if (match.status !== 'FINISHED') {
    issues.push(`ATTENTION: Status du match = "${match.status}" (pas FINISHED) - Le match n'est peut-être pas encore terminé côté API`)
  }

  if (!match.finished) {
    issues.push(`ATTENTION: Flag finished = false - Le match n'est pas marqué comme terminé`)
  }

  if (tournamentInfo && tournamentInfo.length > 0) {
    const tournament = tournamentInfo[0]

    if (tournament.competition_id && match.competition_id !== tournament.competition_id) {
      issues.push(`CRITIQUE: Le match est dans la compétition ${match.competition_id} mais le tournoi attend ${tournament.competition_id}`)
    }

    if (!tournament.custom_competition_id && tournament.competition_id) {
      if (match.matchday < tournament.starting_matchday || match.matchday > tournament.ending_matchday) {
        issues.push(`CRITIQUE: Le match est au matchday ${match.matchday} mais le tournoi couvre J${tournament.starting_matchday} à J${tournament.ending_matchday}`)
      }
    }

    if (tournament.status !== 'active') {
      issues.push(`ATTENTION: Le tournoi est en statut "${tournament.status}" (pas active)`)
    }
  }

  if (tournamentMatches?.type === 'standard' && tournamentMatches.matchesInRange?.length === 0) {
    issues.push('CRITIQUE: Le match n\'est pas dans la plage de journées du tournoi')
  }

  if (issues.length === 0) {
    issues.push('OK: Aucun problème détecté - le match devrait s\'afficher correctement')
  }

  return issues
}
