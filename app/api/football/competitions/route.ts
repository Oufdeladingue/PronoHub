/**
 * Route: GET /api/football/competitions
 *
 * ⚠️ PROVIDER PAR DÉFAUT: football-data (saisons actuelles disponibles)
 * Provider alternatif: api-football (prêt, mais limité saisons 2021-2023 en gratuit)
 *
 * Pour basculer vers API-Football après upgrade plan:
 * Changer ligne 24: const provider = searchParams.get('provider') || 'api-football'
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getApiFootballClient } from '@/lib/api-football-client'
import { ApiFootballQuotaManager } from '@/lib/api-football-quota'
import { transformLeagueToCompetition } from '@/lib/api-football-adapter'

// API actuelle (en production)
const FOOTBALL_DATA_API = 'https://api.football-data.org/v4'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const provider = searchParams.get('provider') || 'football-data' // Par défaut: système actuel (saisons en cours)
    const season = searchParams.get('season') || new Date().getFullYear().toString()

    if (provider === 'football-data') {
      // LEGACY: Ancien système football-data.org
      return await getCompetitionsFromFootballData()
    } else {
      // NOUVEAU: API-Football.com
      return await getCompetitionsFromApiFootball(parseInt(season))
    }
  } catch (error: any) {
    console.error('Error fetching competitions:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

/**
 * NOUVEAU: Récupère les compétitions depuis API-Football.com
 */
async function getCompetitionsFromApiFootball(season: number) {
  const supabase = await createClient()
  const client = getApiFootballClient()

  // Vérifier la configuration
  if (!client.isConfigured()) {
    return NextResponse.json(
      {
        error: 'API-Football key not configured',
        fallback: 'using_cache'
      },
      { status: 500 }
    )
  }

  // Obtenir les stats de quota
  const quotaStats = await ApiFootballQuotaManager.getUsageStats()

  console.log(`📊 Quota API: ${quotaStats.used}/100 utilisées, ${quotaStats.remaining} disponibles`)

  // Si quota épuisé, retourner depuis le cache
  if (quotaStats.remaining === 0) {
    console.log('⚠️  Quota épuisé - Utilisation des données en cache')

    const { data: cachedCompetitions } = await supabase
      .from('competitions')
      .select('*')
      .order('name')

    return NextResponse.json({
      success: true,
      competitions: cachedCompetitions || [],
      fromCache: true,
      quota: quotaStats,
      message: 'Quota épuisé, données depuis le cache'
    })
  }

  try {
    // Récupérer les leagues depuis l'API
    const apiLeagues = await client.getLeagues(season)

    if (!apiLeagues) {
      throw new Error('No data received from API-Football')
    }

    console.log(`✅ ${apiLeagues.length} leagues récupérées depuis API-Football`)

    // Récupérer les compétitions déjà importées localement
    const { data: importedCompetitions } = await supabase
      .from('competitions')
      .select('id, imported_at, last_updated_at, is_active, api_provider')

    // Enrichir les données avec les infos locales
    const enrichedCompetitions = apiLeagues.map((league: any) => {
      const imported = importedCompetitions?.find((ic) => ic.id === league.league.id)

      const currentSeason = league.seasons.find((s: any) => s.current) || league.seasons[0]

      return {
        id: league.league.id,
        name: league.league.name,
        code: league.league.type,
        emblem: league.league.logo,
        area: league.country.name,
        currentSeason: currentSeason ? {
          startDate: currentSeason.start,
          endDate: currentSeason.end,
          currentMatchday: 1,
          year: currentSeason.year
        } : null,
        isImported: !!imported,
        isActive: imported?.is_active ?? false,
        importedAt: imported?.imported_at,
        lastUpdatedAt: imported?.last_updated_at,
        apiProvider: imported?.api_provider || 'api-football'
      }
    })

    // Filtrer pour garder uniquement les leagues principales (optionnel)
    // const mainLeagues = enrichedCompetitions.filter((c: any) =>
    //   c.code === 'League' || c.code === 'Cup'
    // )

    return NextResponse.json({
      success: true,
      competitions: enrichedCompetitions,
      count: enrichedCompetitions.length,
      fromCache: false,
      quota: {
        used: quotaStats.used + 1, // +1 car on vient de faire une requête
        remaining: quotaStats.remaining - 1,
        percentage: quotaStats.percentage,
        status: quotaStats.status
      },
      provider: 'api-football',
      season
    })
  } catch (error: any) {
    console.error('❌ Erreur API-Football, fallback vers cache:', error)

    // En cas d'erreur, retourner depuis le cache
    const { data: cachedCompetitions } = await supabase
      .from('competitions')
      .select('*')
      .order('name')

    return NextResponse.json({
      success: true,
      competitions: cachedCompetitions || [],
      fromCache: true,
      quota: quotaStats,
      error: error.message,
      message: 'Erreur API, données depuis le cache'
    })
  }
}

/**
 * LEGACY: Récupère les compétitions depuis football-data.org
 * @deprecated Sera supprimé après migration complète
 */
async function getCompetitionsFromFootballData() {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Football Data API key not configured' },
      { status: 500 }
    )
  }

  console.log('⚠️  Utilisation de l\'ancienne API football-data.org (LEGACY)')

  // Récupérer les compétitions depuis Football-Data
  const response = await fetch(`${FOOTBALL_DATA_API}/competitions`, {
    headers: {
      'X-Auth-Token': apiKey,
    },
  })

  if (!response.ok) {
    throw new Error(`Football Data API error: ${response.statusText}`)
  }

  const data = await response.json()

  // Récupérer les compétitions déjà importées
  const supabase = await createClient()
  const { data: importedCompetitions } = await supabase
    .from('competitions')
    .select('id, imported_at, last_updated_at, is_active')

  // Enrichir les données avec les infos d'import
  const enrichedCompetitions = data.competitions.map((comp: any) => {
    const imported = importedCompetitions?.find((ic) => ic.id === comp.id)
    return {
      id: comp.id,
      name: comp.name,
      code: comp.code,
      emblem: comp.emblem,
      area: comp.area?.name,
      currentSeason: comp.currentSeason,
      isImported: !!imported,
      isActive: imported?.is_active ?? false,
      importedAt: imported?.imported_at,
      lastUpdatedAt: imported?.last_updated_at,
    }
  })

  return NextResponse.json({
    success: true,
    competitions: enrichedCompetitions,
    count: enrichedCompetitions.length,
    provider: 'football-data',
    legacy: true
  })
}
