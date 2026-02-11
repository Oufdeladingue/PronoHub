/**
 * API-Football Client
 * Client HTTP pour appeler api-football.com avec gestion automatique du quota
 *
 * ⚠️ NOTE IMPORTANTE - MIGRATION FUTURE
 * Ce fichier est prêt pour une migration future vers api-football.com
 * Actuellement, l'application utilise football-data.org pour les saisons en cours.
 *
 * RAISON : Plan gratuit API-Football limité aux saisons 2021-2023
 * SOLUTION : Upgrade vers Plan Pro (19€/mois) donne accès aux saisons actuelles
 *
 * Pour activer API-Football :
 * 1. Upgrade vers plan payant sur api-football.com
 * 2. Modifier provider par défaut dans les routes API (competitions, import)
 * 3. Voir MIGRATION_QUICK_START.md pour détails
 */

import { ApiFootballQuotaManager } from './api-football-quota'
import type { ApiFootballLeague, ApiFootballFixture } from './api-football-adapter'

const API_BASE_URL = 'https://v3.football.api-sports.io'

export interface ApiFootballResponse<T> {
  get: string
  parameters: Record<string, any>
  errors: any[]
  results: number
  paging: {
    current: number
    total: number
  }
  response: T
}

export class ApiFootballClientError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public endpoint?: string
  ) {
    super(message)
    this.name = 'ApiFootballClientError'
  }
}

export class QuotaExhaustedError extends ApiFootballClientError {
  constructor() {
    super('API quota exhausted. Please try again tomorrow.', 429)
    this.name = 'QuotaExhaustedError'
  }
}

export class ApiFootballClient {
  private apiKey: string
  private apiHost: string

  constructor() {
    this.apiKey = process.env.API_FOOTBALL_KEY || ''
    this.apiHost = process.env.API_FOOTBALL_HOST || 'v3.football.api-sports.io'

    if (!this.apiKey) {
      console.warn('⚠️  API_FOOTBALL_KEY non configurée. Les appels API échoueront.')
    }
  }

  /**
   * Effectue une requête vers l'API avec gestion du quota
   */
  private async makeRequest<T>(
    endpoint: string,
    params: Record<string, any> = {},
    competitionId?: number
  ): Promise<T | null> {
    const startTime = Date.now()

    // Vérifier le quota AVANT l'appel
    const canProceed = await ApiFootballQuotaManager.canMakeRequest()

    if (!canProceed) {
      const stats = await ApiFootballQuotaManager.getUsageStats()
      console.error(`❌ Quota API épuisé (${stats.used}/100 requêtes utilisées)`)

      // Logger l'échec
      await ApiFootballQuotaManager.logRequest(
        endpoint,
        competitionId,
        false,
        'Daily quota exceeded',
        429,
        0
      )

      throw new QuotaExhaustedError()
    }

    // Construire l'URL avec paramètres
    const url = new URL(`${API_BASE_URL}${endpoint}`)
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value))
      }
    })

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'x-rapidapi-key': this.apiKey,
          'x-rapidapi-host': this.apiHost
        }
      })

      const responseTime = Date.now() - startTime

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`❌ API Error ${response.status}:`, errorText)

        // Logger l'échec
        await ApiFootballQuotaManager.logRequest(
          endpoint,
          competitionId,
          false,
          `HTTP ${response.status}: ${errorText}`,
          response.status,
          responseTime
        )

        throw new ApiFootballClientError(
          `API Error: ${response.status} ${response.statusText}`,
          response.status,
          endpoint
        )
      }

      const data: ApiFootballResponse<T> = await response.json()

      // Vérifier les erreurs de l'API
      if (data.errors && Object.keys(data.errors).length > 0) {
        console.error('❌ API Errors:', data.errors)

        await ApiFootballQuotaManager.logRequest(
          endpoint,
          competitionId,
          false,
          JSON.stringify(data.errors),
          response.status,
          responseTime
        )

        throw new ApiFootballClientError(
          `API returned errors: ${JSON.stringify(data.errors)}`,
          response.status,
          endpoint
        )
      }

      // Logger le succès
      await ApiFootballQuotaManager.logRequest(
        endpoint,
        competitionId,
        true,
        undefined,
        response.status,
        responseTime
      )

      return data.response
    } catch (error) {
      const responseTime = Date.now() - startTime

      if (error instanceof ApiFootballClientError) {
        throw error
      }

      console.error('❌ Request failed:', error)

      // Logger l'échec réseau
      await ApiFootballQuotaManager.logRequest(
        endpoint,
        competitionId,
        false,
        error instanceof Error ? error.message : 'Unknown error',
        undefined,
        responseTime
      )

      throw new ApiFootballClientError(
        error instanceof Error ? error.message : 'Unknown error',
        undefined,
        endpoint
      )
    }
  }

  // ============================================
  // Méthodes publiques pour les endpoints
  // ============================================

  /**
   * Récupère la liste des leagues/compétitions
   * Endpoint: /leagues
   */
  async getLeagues(
    season?: number,
    country?: string,
    type?: 'league' | 'cup'
  ): Promise<ApiFootballLeague[] | null> {
    const params: Record<string, any> = {}

    if (season) params.season = season
    if (country) params.country = country
    if (type) params.type = type

    return this.makeRequest<ApiFootballLeague[]>('/leagues', params)
  }

  /**
   * Récupère une league spécifique
   */
  async getLeague(leagueId: number, season?: number): Promise<ApiFootballLeague | null> {
    const params: Record<string, any> = { id: leagueId }
    if (season) params.season = season

    const leagues = await this.makeRequest<ApiFootballLeague[]>('/leagues', params, leagueId)
    return leagues && leagues.length > 0 ? leagues[0] : null
  }

  /**
   * Récupère les fixtures d'une league pour une saison
   * Endpoint: /fixtures
   */
  async getFixturesByLeague(
    leagueId: number,
    season: number
  ): Promise<ApiFootballFixture[] | null> {
    return this.makeRequest<ApiFootballFixture[]>(
      '/fixtures',
      {
        league: leagueId,
        season: season
      },
      leagueId
    )
  }

  /**
   * Récupère les fixtures d'une journée spécifique
   */
  async getFixturesByRound(
    leagueId: number,
    season: number,
    round: string
  ): Promise<ApiFootballFixture[] | null> {
    return this.makeRequest<ApiFootballFixture[]>(
      '/fixtures',
      {
        league: leagueId,
        season: season,
        round: round
      },
      leagueId
    )
  }

  /**
   * Récupère les matchs en cours (live)
   * Endpoint: /fixtures avec param live=all
   */
  async getLiveFixtures(leagueId?: number): Promise<ApiFootballFixture[] | null> {
    const params: Record<string, any> = { live: 'all' }
    if (leagueId) params.league = leagueId

    return this.makeRequest<ApiFootballFixture[]>('/fixtures', params, leagueId)
  }

  /**
   * Récupère les fixtures d'une date spécifique
   */
  async getFixturesByDate(
    date: string, // Format: YYYY-MM-DD
    leagueId?: number
  ): Promise<ApiFootballFixture[] | null> {
    const params: Record<string, any> = { date }
    if (leagueId) params.league = leagueId

    return this.makeRequest<ApiFootballFixture[]>('/fixtures', params, leagueId)
  }

  /**
   * Récupère un fixture spécifique par son ID
   */
  async getFixtureById(fixtureId: number): Promise<ApiFootballFixture | null> {
    const fixtures = await this.makeRequest<ApiFootballFixture[]>(
      '/fixtures',
      { id: fixtureId }
    )

    return fixtures && fixtures.length > 0 ? fixtures[0] : null
  }

  /**
   * Récupère les fixtures entre deux dates
   */
  async getFixturesByDateRange(
    from: string, // Format: YYYY-MM-DD
    to: string,   // Format: YYYY-MM-DD
    leagueId?: number
  ): Promise<ApiFootballFixture[] | null> {
    const params: Record<string, any> = { from, to }
    if (leagueId) params.league = leagueId

    return this.makeRequest<ApiFootballFixture[]>('/fixtures', params, leagueId)
  }

  // ============================================
  // Méthodes utilitaires
  // ============================================

  /**
   * Teste la connexion à l'API
   */
  async testConnection(): Promise<{
    success: boolean
    message: string
    quotaRemaining?: number
  }> {
    try {
      const stats = await ApiFootballQuotaManager.getUsageStats()

      if (stats.remaining === 0) {
        return {
          success: false,
          message: 'Quota épuisé pour aujourd\'hui',
          quotaRemaining: 0
        }
      }

      // Faire un appel simple pour tester
      const leagues = await this.getLeagues(new Date().getFullYear())

      if (leagues && leagues.length > 0) {
        return {
          success: true,
          message: `Connexion OK - ${leagues.length} leagues disponibles`,
          quotaRemaining: stats.remaining - 1 // -1 car on vient de faire une requête
        }
      }

      return {
        success: false,
        message: 'API répondu mais aucune donnée retournée',
        quotaRemaining: stats.remaining - 1
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur inconnue',
        quotaRemaining: undefined
      }
    }
  }

  /**
   * Vérifie si l'API key est configurée
   */
  isConfigured(): boolean {
    return !!this.apiKey && this.apiKey.length > 0
  }

  /**
   * Obtient les informations de configuration
   */
  getConfig(): {
    configured: boolean
    host: string
    keyLength: number
  } {
    return {
      configured: this.isConfigured(),
      host: this.apiHost,
      keyLength: this.apiKey.length
    }
  }
}

/**
 * Instance singleton du client (optionnel)
 */
let clientInstance: ApiFootballClient | null = null

export function getApiFootballClient(): ApiFootballClient {
  if (!clientInstance) {
    clientInstance = new ApiFootballClient()
  }
  return clientInstance
}

/**
 * Créer une nouvelle instance du client (pour tests ou cas spéciaux)
 */
export function createApiFootballClient(): ApiFootballClient {
  return new ApiFootballClient()
}
