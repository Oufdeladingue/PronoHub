import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * API Route pour récupérer les données d'un tournoi.
 * Utilisée par le client Capacitor qui ne peut pas accéder aux Server Components.
 */
export async function GET(request: NextRequest) {
  // Récupérer le token depuis le header Authorization
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = authHeader.substring(7)
  const tournamentSlug = request.nextUrl.searchParams.get('slug')

  if (!tournamentSlug) {
    return NextResponse.json({ error: 'Missing slug parameter' }, { status: 400 })
  }

  // Extraire le code du slug (format: nomtournoi_ABCDEFGH)
  const tournamentCode = tournamentSlug.split('_').pop()?.toUpperCase() || ''

  // Créer un client Supabase avec le token
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )

  // Vérifier l'utilisateur
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Récupérer le tournoi et les données de base
  const [
    { data: tournamentData, error: tournamentError },
    { data: profile },
    { data: pointsSettingsData }
  ] = await Promise.all([
    supabase
      .from('tournaments')
      .select('*')
      .eq('slug', tournamentCode)
      .single(),
    supabase
      .from('profiles')
      .select('username, avatar')
      .eq('id', user.id)
      .single(),
    supabase
      .from('admin_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['points_exact_score', 'points_correct_result', 'points_incorrect_result'])
  ])

  if (tournamentError || !tournamentData) {
    return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
  }

  // Récupérer le nom de la compétition
  let competitionName = 'Compétition'
  if (tournamentData.custom_competition_id) {
    const { data } = await supabase
      .from('custom_competitions')
      .select('name')
      .eq('id', tournamentData.custom_competition_id)
      .single()
    competitionName = data?.name || 'Compétition Custom'
  } else if (tournamentData.competition_id) {
    const { data } = await supabase
      .from('competitions')
      .select('name')
      .eq('id', tournamentData.competition_id)
      .single()
    competitionName = data?.name || 'Compétition'
  }

  // Récupérer le logo de la compétition
  let competitionLogo = { logo: null, logoWhite: null }
  if (tournamentData.custom_competition_id) {
    const { data } = await supabase
      .from('custom_competitions')
      .select('custom_emblem_white, custom_emblem_color')
      .eq('id', tournamentData.custom_competition_id)
      .single()
    competitionLogo = {
      logo: data?.custom_emblem_color || null,
      logoWhite: data?.custom_emblem_white || null
    }
  } else if (tournamentData.competition_id) {
    const { data } = await supabase
      .from('competitions')
      .select('emblem, custom_emblem_white, custom_emblem_color')
      .eq('id', tournamentData.competition_id)
      .single()
    competitionLogo = {
      logo: data?.custom_emblem_color || data?.emblem || null,
      logoWhite: data?.custom_emblem_white || data?.emblem || null
    }
  }

  // Récupérer le pseudo du capitaine
  let captainUsername = null
  if (tournamentData.creator_id) {
    const { data } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', tournamentData.creator_id)
      .single()
    captainUsername = data?.username || null
  }

  // Récupérer tous les matchs
  const allMatches = await fetchAllMatches(supabase, tournamentData)

  // Calculer les stages par matchday (utilise virtual_matchday si présent pour les compétitions knockout)
  const matchdayStages: Record<number, string | null> = {}
  allMatches.forEach((match: any) => {
    const md = match.virtual_matchday || match.matchday
    if (md && !matchdayStages[md]) {
      matchdayStages[md] = match.stage || null
    }
  })

  // Parser les paramètres de points
  const pointsSettings = {
    exactScore: 3,
    correctResult: 1,
    incorrectResult: 0
  }
  if (pointsSettingsData) {
    const exactScoreSetting = pointsSettingsData.find((s: any) => s.setting_key === 'points_exact_score')
    const correctResultSetting = pointsSettingsData.find((s: any) => s.setting_key === 'points_correct_result')
    const incorrectResultSetting = pointsSettingsData.find((s: any) => s.setting_key === 'points_incorrect_result')
    pointsSettings.exactScore = parseInt(exactScoreSetting?.setting_value || '3')
    pointsSettings.correctResult = parseInt(correctResultSetting?.setting_value || '1')
    pointsSettings.incorrectResult = parseInt(incorrectResultSetting?.setting_value || '0')
  }

  return NextResponse.json({
    tournament: {
      ...tournamentData,
      competition_name: competitionName
    },
    user: {
      id: user.id,
      username: profile?.username || 'utilisateur',
      avatar: profile?.avatar || 'avatar1'
    },
    pointsSettings,
    competitionLogo: competitionLogo.logo,
    competitionLogoWhite: competitionLogo.logoWhite,
    captainUsername,
    allMatches,
    matchdayStages
  })
}

// Fonction pour récupérer tous les matchs
async function fetchAllMatches(supabase: any, tournament: any) {
  const startMatchday = tournament.starting_matchday
  const endMatchday = tournament.ending_matchday

  if (!startMatchday || !endMatchday) {
    return []
  }

  let matchesData: any[] = []

  if (tournament.custom_competition_id) {
    // Compétition custom
    const { data: matchdaysData } = await supabase
      .from('custom_competition_matchdays')
      .select('id, matchday_number')
      .eq('custom_competition_id', tournament.custom_competition_id)
      .gte('matchday_number', startMatchday)
      .lte('matchday_number', endMatchday)

    if (matchdaysData && matchdaysData.length > 0) {
      const matchdayIds = matchdaysData.map((md: any) => md.id)
      const matchdayNumberMap = matchdaysData.reduce((acc: any, md: any) => {
        acc[md.id] = md.matchday_number
        return acc
      }, {})

      const { data: customMatches } = await supabase
        .from('custom_competition_matches')
        .select(`
          id,
          custom_matchday_id,
          football_data_match_id,
          imported_match_id,
          display_order,
          cached_utc_date,
          cached_home_team,
          cached_away_team,
          cached_home_logo,
          cached_away_logo,
          cached_competition_name
        `)
        .in('custom_matchday_id', matchdayIds)
        .order('display_order', { ascending: true })

      const footballDataIds = (customMatches || [])
        .map((m: any) => m.football_data_match_id)
        .filter((id: any) => id !== null)

      let importedMatchesMap: Record<number, any> = {}
      if (footballDataIds.length > 0) {
        const { data: importedMatches } = await supabase
          .from('imported_matches')
          .select(`
            id,
            football_data_match_id,
            home_team_name,
            away_team_name,
            home_team_crest,
            away_team_crest,
            utc_date,
            status,
            home_score,
            away_score,
            finished,
            stage,
            competition_id,
            competitions (
              id,
              name,
              emblem,
              custom_emblem_white,
              custom_emblem_color
            )
          `)
          .in('football_data_match_id', footballDataIds)

        if (importedMatches) {
          importedMatchesMap = importedMatches.reduce((acc: any, im: any) => {
            acc[im.football_data_match_id] = im
            return acc
          }, {})
        }
      }

      matchesData = (customMatches || []).map((match: any) => {
        const im = importedMatchesMap[match.football_data_match_id]
        const comp = im?.competitions
        return {
          id: im?.id || match.id,
          custom_match_id: match.id,
          matchday: matchdayNumberMap[match.custom_matchday_id],
          utc_date: im?.utc_date || match.cached_utc_date,
          home_team_name: im?.home_team_name || match.cached_home_team,
          away_team_name: im?.away_team_name || match.cached_away_team,
          home_team_crest: im?.home_team_crest || match.cached_home_logo,
          away_team_crest: im?.away_team_crest || match.cached_away_logo,
          status: im?.status || 'SCHEDULED',
          finished: im?.finished || false,
          home_score: im?.home_score ?? null,
          away_score: im?.away_score ?? null,
          stage: im?.stage || null,
          competition_name: comp?.name || match.cached_competition_name || null,
          competition_emblem: comp?.custom_emblem_color || comp?.emblem || null,
          competition_emblem_white: comp?.custom_emblem_white || comp?.emblem || null
        }
      }).sort((a: any, b: any) => new Date(a.utc_date).getTime() - new Date(b.utc_date).getTime())
    }
  } else if (tournament.competition_id) {
    // Liste des phases knockout reconnues
    const KNOCKOUT_STAGES = ['PLAYOFFS', 'LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'FINAL']

    // Vérifier si la compétition a des phases knockout
    const { data: knockoutCheck } = await supabase
      .from('imported_matches')
      .select('id')
      .eq('competition_id', tournament.competition_id)
      .in('stage', KNOCKOUT_STAGES)
      .limit(1)

    const hasKnockoutStages = knockoutCheck && knockoutCheck.length > 0

    if (hasKnockoutStages) {
      // Compétition avec knockout: deux requêtes parallèles
      const [leagueStageResult, knockoutResult] = await Promise.all([
        // 1. Matchs de phase de ligue dans la plage de matchdays
        supabase
          .from('imported_matches')
          .select('*')
          .eq('competition_id', tournament.competition_id)
          .not('stage', 'in', `(${KNOCKOUT_STAGES.map(s => `"${s}"`).join(',')})`)
          .gte('matchday', startMatchday)
          .lte('matchday', endMatchday),
        // 2. Tous les matchs knockout
        supabase
          .from('imported_matches')
          .select('*')
          .eq('competition_id', tournament.competition_id)
          .in('stage', KNOCKOUT_STAGES)
      ])

      const leagueMatches = leagueStageResult.data || []
      const knockoutMatches = knockoutResult.data || []

      // Ordre des phases knockout avec leur base de journée virtuelle
      const STAGE_ORDER: Record<string, number> = {
        'LEAGUE_STAGE': 0,
        'PLAYOFFS': 8,
        'LAST_16': 10,
        'QUARTER_FINALS': 12,
        'SEMI_FINALS': 14,
        'FINAL': 16
      }

      // Ajouter la journée virtuelle aux matchs
      const leagueWithVirtual = leagueMatches.map((m: any) => ({
        ...m,
        virtual_matchday: m.matchday
      }))

      const knockoutWithVirtual = knockoutMatches.map((m: any) => {
        const baseMatchday = STAGE_ORDER[m.stage] || 8
        return {
          ...m,
          virtual_matchday: baseMatchday + (m.matchday || 1)
        }
      })

      // Fusionner et trier par date
      matchesData = [...leagueWithVirtual, ...knockoutWithVirtual]
        .sort((a, b) => new Date(a.utc_date).getTime() - new Date(b.utc_date).getTime())
    } else {
      // Compétition classique (ligue): filtre par matchday uniquement
      const { data: allMatchesData } = await supabase
        .from('imported_matches')
        .select('*')
        .eq('competition_id', tournament.competition_id)
        .gte('matchday', startMatchday)
        .lte('matchday', endMatchday)
        .order('utc_date', { ascending: true })

      matchesData = allMatchesData || []
    }
  }

  return matchesData
}
