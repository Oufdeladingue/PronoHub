/**
 * Route: POST /api/football/import
 *
 * ⚠️ PROVIDER PAR DÉFAUT: football-data (saisons actuelles disponibles)
 * Provider alternatif: api-football (prêt, mais limité saisons 2021-2023 en gratuit)
 *
 * Pour basculer vers API-Football après upgrade plan:
 * Changer ligne 38: const useProvider = provider || 'api-football'
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getApiFootballClient } from '@/lib/api-football-client'
import {
  transformLeagueToCompetition,
  transformFixturesToMatches,
  calculateTotalMatchdays,
  determineCurrentMatchday,
  extractSeasonInfo
} from '@/lib/api-football-adapter'
import { ApiFootballQuotaManager } from '@/lib/api-football-quota'

const FOOTBALL_DATA_API = 'https://api.football-data.org/v4'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { competitionId, provider } = body

    if (!competitionId) {
      return NextResponse.json(
        { error: 'Competition ID is required' },
        { status: 400 }
      )
    }

    // Déterminer le provider (par défaut: football-data pour saisons actuelles)
    const useProvider = provider || 'football-data'

    if (useProvider === 'football-data') {
      // LEGACY: Ancien système
      return await importFromFootballData(competitionId)
    } else {
      // NOUVEAU: API-Football
      return await importFromApiFootball(competitionId)
    }
  } catch (error: any) {
    console.error('Error importing competition:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

/**
 * NOUVEAU: Import depuis API-Football.com
 */
async function importFromApiFootball(leagueId: number) {
  const supabase = await createClient()
  const client = getApiFootballClient()

  console.log(`\n📥 Import compétition ${leagueId} depuis API-Football...`)

  // Vérifier la configuration
  if (!client.isConfigured()) {
    return NextResponse.json(
      { error: 'API-Football key not configured' },
      { status: 500 }
    )
  }

  // Vérifier le quota (il faut 1 requête pour l'import)
  const canProceed = await ApiFootballQuotaManager.canPerformOperation('import')

  if (!canProceed.allowed) {
    return NextResponse.json(
      {
        error: 'Quota insuffisant pour l\'import',
        reason: canProceed.reason,
        remaining: canProceed.remaining
      },
      { status: 429 }
    )
  }

  try {
    // 1. Récupérer les fixtures de la league pour la saison en cours
    const currentYear = new Date().getFullYear()
    const season = currentYear // Ou currentYear - 1 selon la période

    console.log(`🔄 Récupération fixtures pour league ${leagueId}, saison ${season}...`)

    const fixtures = await client.getFixturesByLeague(leagueId, season)

    if (!fixtures || fixtures.length === 0) {
      return NextResponse.json(
        {
          error: 'Aucune donnée disponible pour cette league',
          leagueId,
          season
        },
        { status: 404 }
      )
    }

    console.log(`✅ ${fixtures.length} fixtures récupérés`)

    // 2. Extraire les informations de la league depuis le premier fixture
    const firstFixture = fixtures[0]
    const leagueInfo = firstFixture.league

    // 3. Calculer les statistiques
    const totalMatchdays = calculateTotalMatchdays(fixtures)
    const currentMatchday = determineCurrentMatchday(fixtures)
    const seasonInfo = extractSeasonInfo(fixtures)

    console.log('[IMPORT] League info:', {
      id: leagueInfo.id,
      name: leagueInfo.name,
      season: leagueInfo.season,
      totalMatchdays,
      currentMatchday
    })

    // 4. Vérifier s'il existe une configuration manuelle
    const { data: configData } = await supabase
      .from('competition_config')
      .select('total_matchdays_override')
      .eq('competition_id', leagueId)
      .single()

    const finalMatchdays = configData?.total_matchdays_override || totalMatchdays

    console.log('[IMPORT] Matchdays info:', {
      calculated: totalMatchdays,
      override: configData?.total_matchdays_override,
      final: finalMatchdays
    })

    // 5. Upsert la compétition dans la base
    const { error: compError } = await supabase
      .from('competitions')
      .upsert({
        id: leagueInfo.id,
        name: leagueInfo.name,
        code: leagueInfo.season.toString(),
        emblem: leagueInfo.logo,
        area_name: leagueInfo.country || 'International',
        current_season_start_date: seasonInfo?.startDate,
        current_season_end_date: seasonInfo?.endDate,
        current_matchday: currentMatchday,
        total_matchdays: finalMatchdays,
        is_active: true,
        api_provider: 'api-football',
        last_updated_at: new Date().toISOString()
      }, {
        onConflict: 'id'
      })

    if (compError) {
      console.error('❌ Erreur upsert compétition:', compError)
      throw compError
    }

    // 6. Transformer les fixtures vers format interne (avec matchs knockout sans équipes)
    const transformedMatches = transformFixturesToMatches(fixtures, leagueId, { keepKnockoutWithoutTeams: true })

    // Log des phases détectées
    const stagesCounts = transformedMatches.reduce((acc: Record<string, number>, m) => {
      const stage = m.stage || 'REGULAR_SEASON'
      acc[stage] = (acc[stage] || 0) + 1
      return acc
    }, {})
    console.log('[IMPORT API-Football] Phases détectées:', stagesCounts)

    console.log(`🔄 Insertion de ${transformedMatches.length} matchs...`)

    // 7. Upsert les matchs
    const { error: matchesError } = await supabase
      .from('imported_matches')
      .upsert(transformedMatches, {
        onConflict: 'football_data_match_id',
        ignoreDuplicates: false
      })

    if (matchesError) {
      console.error('❌ Erreur upsert matchs:', matchesError)
      throw matchesError
    }

    const skippedMatches = fixtures.length - transformedMatches.length

    console.log(`✅ Import réussi: ${transformedMatches.length} matchs importés`)
    if (skippedMatches > 0) {
      console.log(`⚠️  ${skippedMatches} matchs ignorés (sans équipes assignées)`)
    }

    // Obtenir les stats de quota après import
    const quotaStats = await ApiFootballQuotaManager.getUsageStats()

    return NextResponse.json({
      success: true,
      competition: leagueInfo.name,
      competitionId: leagueInfo.id,
      matchesCount: transformedMatches.length,
      totalMatchdays: finalMatchdays,
      currentMatchday,
      season: leagueInfo.season,
      skippedMatches: skippedMatches > 0 ? skippedMatches : undefined,
      provider: 'api-football',
      quota: {
        used: quotaStats.used,
        remaining: quotaStats.remaining,
        percentage: quotaStats.percentage
      }
    })
  } catch (error: any) {
    console.error('❌ Erreur import API-Football:', error)

    return NextResponse.json(
      {
        error: error.message,
        leagueId,
        provider: 'api-football'
      },
      { status: 500 }
    )
  }
}

/**
 * LEGACY: Import depuis football-data.org
 * @deprecated Sera supprimé après migration complète
 */
async function importFromFootballData(competitionId: number) {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Football Data API key not configured' },
      { status: 500 }
    )
  }

  console.log('⚠️  Utilisation de l\'ancienne API football-data.org (LEGACY)')

  const supabase = await createClient()

  // 1. Récupérer les détails de la compétition
  const compResponse = await fetch(
    `${FOOTBALL_DATA_API}/competitions/${competitionId}`,
    {
      headers: { 'X-Auth-Token': apiKey },
    }
  )

  if (!compResponse.ok) {
    throw new Error(`Failed to fetch competition: ${compResponse.statusText}`)
  }

  const compData = await compResponse.json()

  console.log('[IMPORT] Competition data:', {
    id: compData.id,
    name: compData.name,
    currentSeason: compData.currentSeason
  })

  // 2. Sauvegarder la compétition
  const { error: compError } = await supabase.from('competitions').upsert({
    id: compData.id,
    name: compData.name,
    code: compData.code,
    emblem: compData.emblem,
    area_name: compData.area?.name,
    current_season_start_date: compData.currentSeason?.startDate,
    current_season_end_date: compData.currentSeason?.endDate,
    current_matchday: compData.currentSeason?.currentMatchday,
    api_provider: 'football-data',
    last_updated_at: new Date().toISOString(),
  })

  if (compError) throw compError

  // 3. Récupérer tous les matchs de la compétition
  const matchesResponse = await fetch(
    `${FOOTBALL_DATA_API}/competitions/${competitionId}/matches`,
    {
      headers: { 'X-Auth-Token': apiKey },
    }
  )

  // Log des informations de rate limit
  console.log('=== FOOTBALL-DATA API RATE LIMIT INFO ===')
  console.log('Status:', matchesResponse.status, matchesResponse.statusText)
  console.log('X-Requests-Available-Minute:', matchesResponse.headers.get('X-Requests-Available-Minute'))
  console.log('X-Requests-Available-Day:', matchesResponse.headers.get('X-Requests-Available-Day'))
  console.log('X-RequestCounter-Reset:', matchesResponse.headers.get('X-RequestCounter-Reset'))
  console.log('=========================================')

  if (!matchesResponse.ok) {
    const errorText = await matchesResponse.text()
    throw new Error(`Failed to fetch matches: ${matchesResponse.status} ${matchesResponse.statusText} - ${errorText}`)
  }

  const matchesData = await matchesResponse.json()

  // 4. Calculer le nombre total de journées (paires stage+matchday uniques)
  // Pour les knockouts à match unique (WC), matchday est null → on utilise 'KO' comme clé
  const stageMatchdayPairs = new Set<string>()
  matchesData.matches.forEach((match: any) => {
    stageMatchdayPairs.add(`${match.stage || 'REGULAR_SEASON'}_${match.matchday ?? 'KO'}`)
  })
  const calculatedMatchdays = stageMatchdayPairs.size > 0 ? stageMatchdayPairs.size : null

  // 5. Vérifier s'il existe une configuration manuelle pour cette compétition
  const { data: configData } = await supabase
    .from('competition_config')
    .select('total_matchdays_override')
    .eq('competition_id', competitionId)
    .single()

  const totalMatchdays = configData?.total_matchdays_override || calculatedMatchdays

  console.log('[IMPORT] Matchdays info:', {
    calculated: calculatedMatchdays,
    override: configData?.total_matchdays_override,
    final: totalMatchdays
  })

  // 6. Mettre à jour le nombre total de journées dans la compétition
  if (totalMatchdays) {
    await supabase.from('competitions').update({
      total_matchdays: totalMatchdays
    }).eq('id', competitionId)
  }

  // 7. Préparer les matchs pour l'insertion
  // Pour les matchs knockout sans équipes, on les garde avec des placeholders
  const knockoutStages = ['LAST_32', 'LAST_16', 'ROUND_OF_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'THIRD_PLACE', 'FINAL', 'PLAYOFFS']

  const matchesToInsert = matchesData.matches
    .filter((match: any) => {
      // Garder tous les matchs avec un id
      if (!match.id) return false

      const hasTeams = match.homeTeam?.id && match.awayTeam?.id
      if (hasTeams) return true

      // Garder les matchs knockout même sans équipes définies
      if (match.stage && knockoutStages.includes(match.stage)) {
        return true
      }
      return false
    })
    .map((match: any) => {
      const hasHomeTeam = match.homeTeam?.id
      const hasAwayTeam = match.awayTeam?.id

      return {
        football_data_match_id: match.id,
        competition_id: competitionId,
        matchday: match.matchday ?? 1, // Default to 1 for single-leg knockout (WC)
        stage: match.stage || null, // Phase de compétition (LEAGUE_STAGE, PLAYOFFS, QUARTER_FINALS, etc.)
        group_name: match.group || null, // Groupe pour les phases de poule (GROUP_A, ...)
        utc_date: match.utcDate,
        status: match.status,
        home_team_id: hasHomeTeam ? match.homeTeam.id : 0,
        home_team_name: hasHomeTeam ? match.homeTeam.name : 'À déterminer',
        home_team_crest: hasHomeTeam ? match.homeTeam.crest : '',
        away_team_id: hasAwayTeam ? match.awayTeam.id : 0,
        away_team_name: hasAwayTeam ? match.awayTeam.name : 'À déterminer',
        away_team_crest: hasAwayTeam ? match.awayTeam.crest : '',
        home_score: match.score?.fullTime?.home,
        away_score: match.score?.fullTime?.away,
      }
    })

  // Compter les matchs ignorés (sans équipes et hors knockout)
  const skippedMatches = matchesData.matches.filter((match: any) => {
    const hasTeams = match.homeTeam?.id && match.awayTeam?.id
    const isKnockout = match.stage && knockoutStages.includes(match.stage)
    return !hasTeams && !isKnockout
  }).length

  // Log des phases détectées
  const stagesCounts = matchesToInsert.reduce((acc: Record<string, number>, m: any) => {
    const stage = m.stage || 'REGULAR_SEASON'
    acc[stage] = (acc[stage] || 0) + 1
    return acc
  }, {})
  console.log('[IMPORT] Phases détectées:', stagesCounts)

  // 8. Insérer ou mettre à jour les matchs
  const { error: matchesError } = await supabase
    .from('imported_matches')
    .upsert(matchesToInsert, {
      onConflict: 'football_data_match_id',
    })

  if (matchesError) throw matchesError

  return NextResponse.json({
    success: true,
    competition: compData.name,
    matchesCount: matchesToInsert.length,
    totalMatchdays,
    skippedMatches: skippedMatches > 0 ? skippedMatches : undefined,
    provider: 'football-data',
    legacy: true
  })
}
