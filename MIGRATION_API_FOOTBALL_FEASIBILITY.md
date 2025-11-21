# Évaluation de Faisabilité : Migration vers API-Football.com

## 📋 Résumé Exécutif

**Verdict : FAISABLE ✅**

La migration de football-data.org vers api-football.com est **techniquement faisable** et s'intègre bien avec l'architecture existante. Le projet dispose déjà de tous les mécanismes nécessaires (caching, admin, activation/désactivation).

**Contrainte principale :** Gérer intelligemment les 100 requêtes/jour du plan gratuit.

---

## 🎯 Contraintes du Projet

### 1. ✅ Limite API : 100 requêtes/jour
- **Plan gratuit API-Football.com**
- Reset quotidien à 00:00:00 UTC
- Requêtes non utilisées perdues

### 2. ✅ Gestion admin des compétitions
- Récupérer liste des compétitions disponibles
- Activer/désactiver des compétitions
- Système déjà en place, adaptation mineure requise

### 3. ✅ Récupération données pour compétitions activées
- Équipes, matchs, scores
- Structure de données compatible avec existant

### 4. ⚠️ Ne pas perdre les données actuelles
- **Défi principal :** Mapping des IDs entre les deux APIs
- Solution : Table de correspondance

### 5. ✅ Système de limitation intelligente des appels
- Basé sur les horaires des matchs
- Auto-refresh intelligent déjà implémenté

---

## 📊 Analyse de l'Existant

### Points Forts de l'Architecture Actuelle

#### ✅ Système de Caching Déjà Opérationnel
- **Tables DB :**
  - `competitions` : Stockage des compétitions
  - `imported_matches` : Stockage des matchs
  - `competition_config` : Configuration manuelle

- **Stratégie actuelle :**
  - Import initial complet
  - Stockage local de toutes les données
  - Updates périodiques pour les compétitions actives uniquement
  - **Résultat :** Minimise drastiquement les appels API ✅

#### ✅ Interface Admin Complète
**Fichier :** `app/admin/import/page.tsx`

**Fonctionnalités existantes :**
- Affichage liste des compétitions
- Import/Réimport de compétitions
- Toggle activation/désactivation (`is_active`)
- Visualisation des matchs importés
- Indicateurs visuels de statut

**Adaptation requise :** Mineure - juste changer l'endpoint API

#### ✅ Système Auto-Refresh Intelligent
**Fichier :** `hooks/useAutoRefresh.ts`

**Fonctionnalités :**
- Intervalle configurable (1-30 min)
- **Mode intelligent** : refresh plus fréquent pendant les matchs en cours
- Pause quand onglet inactif
- Configuration admin via `app/admin/settings/page.tsx`

**Avantage :** Parfait pour gérer les 100 requêtes/jour ! ✅

#### ✅ Système d'Update Schedulé
**Fichier :** `auto-update-competitions.ps1`

**Fonctionnalités :**
- Batch update des compétitions actives
- Endpoint : `/api/football/auto-update`
- Déclenchable via tâche planifiée Windows

**Adaptation pour API-Football :**
- Ajouter compteur de requêtes quotidiennes
- Prioriser les compétitions avec matchs en cours
- Skip si limite atteinte

---

## 🔄 Stratégie de Migration

### Phase 1 : Préparation (1-2 jours)

#### A. Créer Table de Mapping des IDs
```sql
CREATE TABLE api_migration_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  football_data_competition_id INTEGER UNIQUE NOT NULL,
  api_football_league_id INTEGER UNIQUE NOT NULL,
  competition_code TEXT,
  competition_name TEXT,
  verified BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Exemples de mapping :**
| Football-Data ID | API-Football ID | Code | Nom |
|------------------|-----------------|------|-----|
| 2021 | 61 | PL | Premier League |
| 2014 | 140 | FL1 | Ligue 1 |
| 2019 | 78 | SA | Serie A |
| 2002 | 135 | BL1 | Bundesliga |
| 2001 | 2 | CL | Champions League |

#### B. Créer Table de Monitoring des Requêtes
```sql
CREATE TABLE api_request_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_date DATE NOT NULL,
  endpoint TEXT NOT NULL,
  competition_id INTEGER,
  request_count INTEGER DEFAULT 1,
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_api_request_logs_date ON api_request_logs(request_date);

-- Vue pour compteur quotidien
CREATE VIEW daily_api_usage AS
SELECT
  request_date,
  COUNT(*) as total_requests,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful_requests,
  100 - COUNT(*) as remaining_requests
FROM api_request_logs
WHERE request_date = CURRENT_DATE
GROUP BY request_date;
```

#### C. Adapter les Structures de Données

**Fichier à créer :** `lib/api-football-adapter.ts`

```typescript
// Mapping des statuts de match
const STATUS_MAPPING = {
  // API-Football → Format interne
  'TBD': 'SCHEDULED',       // To Be Defined
  'NS': 'SCHEDULED',        // Not Started
  '1H': 'IN_PLAY',         // First Half
  'HT': 'PAUSED',          // Halftime
  '2H': 'IN_PLAY',         // Second Half
  'ET': 'IN_PLAY',         // Extra Time
  'P': 'IN_PLAY',          // Penalty
  'FT': 'FINISHED',        // Full Time
  'AET': 'FINISHED',       // After Extra Time
  'PEN': 'FINISHED',       // After Penalties
  'PST': 'POSTPONED',      // Postponed
  'CANC': 'CANCELLED',     // Cancelled
  'ABD': 'SUSPENDED',      // Abandoned
  'AWD': 'FINISHED',       // Technical Loss
  'WO': 'FINISHED'         // WalkOver
}

interface ApiFootballFixture {
  fixture: {
    id: number
    date: string
    status: {
      short: string
      long: string
    }
  }
  league: {
    id: number
    name: string
    logo: string
    round: string  // "Regular Season - 15" → parse to matchday
  }
  teams: {
    home: {
      id: number
      name: string
      logo: string
    }
    away: {
      id: number
      name: string
      logo: string
    }
  }
  goals: {
    home: number | null
    away: number | null
  }
  score: {
    halftime: { home: number | null, away: number | null }
    fulltime: { home: number | null, away: number | null }
  }
}

// Transformation vers format interne
export function transformApiFootballMatch(
  apiMatch: ApiFootballFixture,
  competitionId: number
): ImportedMatch {
  // Parse matchday from round string
  const matchday = parseMatchdayFromRound(apiMatch.league.round)

  return {
    football_data_match_id: apiMatch.fixture.id,
    competition_id: competitionId,
    matchday: matchday,
    utc_date: new Date(apiMatch.fixture.date),
    status: STATUS_MAPPING[apiMatch.fixture.status.short] || 'SCHEDULED',
    home_team_id: apiMatch.teams.home.id,
    home_team_name: apiMatch.teams.home.name,
    home_team_crest: apiMatch.teams.home.logo,
    away_team_id: apiMatch.teams.away.id,
    away_team_name: apiMatch.teams.away.name,
    away_team_crest: apiMatch.teams.away.logo,
    home_score: apiMatch.goals.home,
    away_score: apiMatch.goals.away
  }
}

function parseMatchdayFromRound(round: string): number {
  // "Regular Season - 15" → 15
  // "Round of 16 - 1" → parse selon config
  const match = round.match(/(\d+)/)
  return match ? parseInt(match[1]) : 1
}
```

### Phase 2 : Implémentation Système de Limitation (2-3 jours)

#### A. Service de Gestion des Quotas

**Fichier à créer :** `lib/api-football-quota.ts`

```typescript
import { createClient } from '@/lib/supabase/server'

const DAILY_LIMIT = 100
const CRITICAL_THRESHOLD = 20 // Seuil d'alerte

export class ApiFootballQuotaManager {
  private supabase: Awaited<ReturnType<typeof createClient>>

  constructor() {
    this.supabase = createClient()
  }

  async getRemainingQuota(): Promise<number> {
    const today = new Date().toISOString().split('T')[0]

    const { count } = await this.supabase
      .from('api_request_logs')
      .select('*', { count: 'exact', head: true })
      .eq('request_date', today)

    return DAILY_LIMIT - (count || 0)
  }

  async canMakeRequest(estimatedCost: number = 1): Promise<boolean> {
    const remaining = await this.getRemainingQuota()
    return remaining >= estimatedCost
  }

  async logRequest(
    endpoint: string,
    competitionId?: number,
    success: boolean = true,
    errorMessage?: string
  ): Promise<void> {
    const today = new Date().toISOString().split('T')[0]

    await this.supabase
      .from('api_request_logs')
      .insert({
        request_date: today,
        endpoint,
        competition_id: competitionId,
        success,
        error_message: errorMessage
      })
  }

  async isCriticalThreshold(): Promise<boolean> {
    const remaining = await this.getRemainingQuota()
    return remaining <= CRITICAL_THRESHOLD
  }

  async getUsageStats(): Promise<{
    used: number
    remaining: number
    percentage: number
    isCritical: boolean
  }> {
    const remaining = await this.getRemainingQuota()
    const used = DAILY_LIMIT - remaining

    return {
      used,
      remaining,
      percentage: (used / DAILY_LIMIT) * 100,
      isCritical: remaining <= CRITICAL_THRESHOLD
    }
  }
}
```

#### B. Wrapper pour Appels API avec Quota Check

**Fichier à créer :** `lib/api-football-client.ts`

```typescript
import { ApiFootballQuotaManager } from './api-football-quota'

const API_BASE_URL = 'https://v3.football.api-sports.io'
const API_KEY = process.env.API_FOOTBALL_KEY

export class ApiFootballClient {
  private quotaManager: ApiFootballQuotaManager

  constructor() {
    this.quotaManager = new ApiFootballQuotaManager()
  }

  async makeRequest<T>(
    endpoint: string,
    params: Record<string, any> = {},
    competitionId?: number
  ): Promise<T | null> {
    // Vérifier quota avant l'appel
    const canProceed = await this.quotaManager.canMakeRequest()

    if (!canProceed) {
      console.error('❌ Quota API épuisé pour aujourd\'hui')
      await this.quotaManager.logRequest(
        endpoint,
        competitionId,
        false,
        'Daily quota exceeded'
      )
      throw new Error('API quota exceeded. Please try again tomorrow.')
    }

    // Construire URL avec paramètres
    const url = new URL(`${API_BASE_URL}${endpoint}`)
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, String(value))
    })

    try {
      const response = await fetch(url.toString(), {
        headers: {
          'x-rapidapi-key': API_KEY!,
          'x-rapidapi-host': 'v3.football.api-sports.io'
        }
      })

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()

      // Logger le succès
      await this.quotaManager.logRequest(endpoint, competitionId, true)

      return data.response as T
    } catch (error) {
      console.error('API Request failed:', error)

      // Logger l'échec
      await this.quotaManager.logRequest(
        endpoint,
        competitionId,
        false,
        error.message
      )

      return null
    }
  }

  // Méthodes spécifiques
  async getLeagues(season: number = 2024) {
    return this.makeRequest('/leagues', { season })
  }

  async getFixtures(leagueId: number, season: number = 2024) {
    return this.makeRequest(`/fixtures`, {
      league: leagueId,
      season: season
    }, leagueId)
  }

  async getLiveFixtures(leagueId?: number) {
    const params: any = { live: 'all' }
    if (leagueId) params.league = leagueId

    return this.makeRequest('/fixtures', params, leagueId)
  }
}
```

#### C. Système de Priorisation Intelligent

**Fichier à créer :** `lib/api-football-scheduler.ts`

```typescript
interface CompetitionPriority {
  competitionId: number
  priority: number  // 1-5 (5 = urgent)
  reason: string
  estimatedRequests: number
}

export class ApiFootballScheduler {
  /**
   * Détermine la priorité d'update pour chaque compétition active
   * en fonction des matchs en cours ou à venir dans les 24h
   */
  async calculatePriorities(): Promise<CompetitionPriority[]> {
    const supabase = await createClient()

    // Récupérer compétitions actives
    const { data: competitions } = await supabase
      .from('competitions')
      .select('id, name')
      .eq('is_active', true)

    if (!competitions) return []

    const priorities: CompetitionPriority[] = []
    const now = new Date()
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)

    for (const comp of competitions) {
      // Compter matchs en cours
      const { count: liveCount } = await supabase
        .from('imported_matches')
        .select('*', { count: 'exact', head: true })
        .eq('competition_id', comp.id)
        .in('status', ['IN_PLAY', 'PAUSED'])

      // Compter matchs dans les 24h
      const { count: upcomingCount } = await supabase
        .from('imported_matches')
        .select('*', { count: 'exact', head: true })
        .eq('competition_id', comp.id)
        .eq('status', 'SCHEDULED')
        .gte('utc_date', now.toISOString())
        .lte('utc_date', in24h.toISOString())

      let priority = 1
      let reason = 'Pas de match imminent'

      if (liveCount && liveCount > 0) {
        priority = 5
        reason = `${liveCount} match(s) en cours - UPDATE URGENT`
      } else if (upcomingCount && upcomingCount > 0) {
        priority = 3
        reason = `${upcomingCount} match(s) dans les 24h`
      }

      priorities.push({
        competitionId: comp.id,
        priority,
        reason,
        estimatedRequests: 1 // 1 requête pour fixtures endpoint
      })
    }

    // Trier par priorité décroissante
    return priorities.sort((a, b) => b.priority - a.priority)
  }

  /**
   * Exécute les updates en fonction du quota disponible
   */
  async executeScheduledUpdates(): Promise<{
    updated: number[]
    skipped: number[]
    quotaExhausted: boolean
  }> {
    const quotaManager = new ApiFootballQuotaManager()
    const client = new ApiFootballClient()

    const remaining = await quotaManager.getRemainingQuota()
    const priorities = await this.calculatePriorities()

    const updated: number[] = []
    const skipped: number[] = []
    let quotaExhausted = false

    for (const item of priorities) {
      const canProceed = await quotaManager.canMakeRequest(item.estimatedRequests)

      if (!canProceed) {
        console.log(`⏸️  Quota insuffisant - Skip ${item.competitionId}`)
        skipped.push(item.competitionId)
        quotaExhausted = true
        continue
      }

      console.log(`🔄 Update ${item.competitionId} - ${item.reason}`)

      // Faire l'update (appel à la nouvelle route API)
      try {
        const response = await fetch('/api/football/sync-scores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ competitionId: item.competitionId })
        })

        if (response.ok) {
          updated.push(item.competitionId)
        } else {
          skipped.push(item.competitionId)
        }
      } catch (error) {
        console.error(`Erreur update ${item.competitionId}:`, error)
        skipped.push(item.competitionId)
      }
    }

    return { updated, skipped, quotaExhausted }
  }
}
```

### Phase 3 : Adapter les Routes API (3-4 jours)

#### A. Route : Lister les Compétitions Disponibles

**Fichier à modifier :** `app/api/football/competitions/route.ts`

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ApiFootballClient } from '@/lib/api-football-client'
import { ApiFootballQuotaManager } from '@/lib/api-football-quota'

export async function GET() {
  try {
    const supabase = await createClient()
    const client = new ApiFootballClient()
    const quotaManager = new ApiFootballQuotaManager()

    // Vérifier le quota disponible
    const quotaStats = await quotaManager.getUsageStats()

    // Récupérer les compétitions depuis l'API
    // Coût : 1 requête
    const apiLeagues = await client.getLeagues(2024)

    if (!apiLeagues) {
      // Si quota épuisé, retourner depuis la DB
      console.log('⚠️  Quota épuisé - Utilisation des données en cache')

      const { data: cachedCompetitions } = await supabase
        .from('competitions')
        .select('*')
        .order('name')

      return NextResponse.json({
        success: true,
        competitions: cachedCompetitions || [],
        fromCache: true,
        quota: quotaStats
      })
    }

    // Enrichir avec les données locales
    const enrichedCompetitions = await Promise.all(
      apiLeagues.map(async (league: any) => {
        const { data: localData } = await supabase
          .from('competitions')
          .select('is_active, imported_at, last_updated_at')
          .eq('id', league.league.id)
          .single()

        return {
          id: league.league.id,
          name: league.league.name,
          code: league.league.type,
          emblem: league.league.logo,
          country: league.country.name,
          season: league.seasons[0],
          isImported: !!localData,
          isActive: localData?.is_active ?? false,
          importedAt: localData?.imported_at,
          lastUpdatedAt: localData?.last_updated_at
        }
      })
    )

    return NextResponse.json({
      success: true,
      competitions: enrichedCompetitions,
      fromCache: false,
      quota: quotaStats
    })

  } catch (error: any) {
    console.error('Erreur récupération compétitions:', error)

    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
```

#### B. Route : Importer une Compétition

**Fichier à modifier :** `app/api/football/import/route.ts`

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ApiFootballClient } from '@/lib/api-football-client'
import { transformApiFootballMatch } from '@/lib/api-football-adapter'

export async function POST(request: Request) {
  try {
    const { competitionId } = await request.json()

    if (!competitionId) {
      return NextResponse.json({
        success: false,
        error: 'competitionId requis'
      }, { status: 400 })
    }

    const supabase = await createClient()
    const client = new ApiFootballClient()

    console.log(`📥 Import compétition ${competitionId}...`)

    // Récupérer les fixtures
    // Coût : 1 requête
    const fixtures = await client.getFixtures(competitionId, 2024)

    if (!fixtures || fixtures.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Aucune donnée disponible'
      }, { status: 404 })
    }

    // Extraire infos compétition depuis le premier match
    const firstFixture = fixtures[0]
    const league = firstFixture.league

    // Upsert compétition
    const { error: compError } = await supabase
      .from('competitions')
      .upsert({
        id: league.id,
        name: league.name,
        code: league.season,
        emblem: league.logo,
        area_name: firstFixture.league.country || 'International',
        current_season_start_date: new Date().toISOString().split('T')[0],
        current_matchday: 1,
        total_matchdays: calculateTotalMatchdays(fixtures),
        is_active: true,
        last_updated_at: new Date().toISOString()
      }, {
        onConflict: 'id'
      })

    if (compError) throw compError

    // Transformer et insérer les matchs
    const transformedMatches = fixtures.map((f: any) =>
      transformApiFootballMatch(f, competitionId)
    )

    const { error: matchError } = await supabase
      .from('imported_matches')
      .upsert(transformedMatches, {
        onConflict: 'football_data_match_id',
        ignoreDuplicates: false
      })

    if (matchError) throw matchError

    console.log(`✅ Import réussi : ${transformedMatches.length} matchs`)

    return NextResponse.json({
      success: true,
      matchesImported: transformedMatches.length,
      competition: {
        id: league.id,
        name: league.name
      }
    })

  } catch (error: any) {
    console.error('Erreur import:', error)

    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

function calculateTotalMatchdays(fixtures: any[]): number {
  const matchdays = fixtures.map((f: any) => {
    const match = f.league.round.match(/(\d+)/)
    return match ? parseInt(match[1]) : 0
  })

  return Math.max(...matchdays, 0)
}
```

#### C. Route : Sync Scores (avec Priorité)

**Fichier à modifier :** `app/api/football/sync-scores/route.ts`

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ApiFootballClient } from '@/lib/api-football-client'
import { ApiFootballScheduler } from '@/lib/api-football-scheduler'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { competitionId, force = false } = body

    const supabase = await createClient()
    const scheduler = new ApiFootballScheduler()

    if (competitionId) {
      // Sync d'une compétition spécifique
      return await syncSingleCompetition(competitionId, force)
    } else {
      // Sync intelligent de toutes les compétitions actives
      const result = await scheduler.executeScheduledUpdates()

      return NextResponse.json({
        success: true,
        updated: result.updated,
        skipped: result.skipped,
        quotaExhausted: result.quotaExhausted
      })
    }

  } catch (error: any) {
    console.error('Erreur sync scores:', error)

    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

async function syncSingleCompetition(competitionId: number, force: boolean) {
  const client = new ApiFootballClient()
  const supabase = await createClient()

  // Récupérer les matchs live ou récents
  const liveFixtures = await client.getLiveFixtures(competitionId)

  if (!liveFixtures) {
    return NextResponse.json({
      success: false,
      error: 'Quota épuisé ou erreur API'
    }, { status: 429 })
  }

  let updatedCount = 0

  for (const fixture of liveFixtures) {
    const { error } = await supabase
      .from('imported_matches')
      .update({
        status: transformStatus(fixture.fixture.status.short),
        home_score: fixture.goals.home,
        away_score: fixture.goals.away,
        last_updated_at: new Date().toISOString()
      })
      .eq('football_data_match_id', fixture.fixture.id)

    if (!error) updatedCount++
  }

  return NextResponse.json({
    success: true,
    updated: updatedCount
  })
}
```

### Phase 4 : Interface Admin Améliorée (1-2 jours)

#### A. Widget Quota dans Admin Settings

**Fichier à modifier :** `app/admin/settings/page.tsx`

Ajouter après la section "Configuration API" :

```tsx
{/* Monitoring Quota API */}
<div className="bg-white p-6 rounded-lg shadow">
  <h2 className="text-xl font-bold text-gray-900 mb-4">
    Quota API Football
  </h2>

  {quotaStats && (
    <div className="space-y-4">
      {/* Barre de progression */}
      <div>
        <div className="flex justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">
            Utilisation du jour
          </span>
          <span className="text-sm font-medium text-gray-900">
            {quotaStats.used} / 100 requêtes
          </span>
        </div>

        <div className="w-full bg-gray-200 rounded-full h-4">
          <div
            className={`h-4 rounded-full transition-all ${
              quotaStats.isCritical
                ? 'bg-red-600'
                : quotaStats.percentage > 70
                ? 'bg-yellow-500'
                : 'bg-green-600'
            }`}
            style={{ width: `${quotaStats.percentage}%` }}
          />
        </div>

        <p className="text-xs text-gray-500 mt-1">
          Reste {quotaStats.remaining} requêtes - Reset à 00:00 UTC
        </p>
      </div>

      {/* Alerte si critique */}
      {quotaStats.isCritical && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">
            ⚠️ <strong>Quota critique !</strong> Seulement {quotaStats.remaining} requêtes restantes.
            Les updates automatiques sont suspendus.
          </p>
        </div>
      )}

      {/* Statistiques détaillées */}
      <div className="grid grid-cols-3 gap-4 pt-4 border-t">
        <div className="text-center">
          <p className="text-2xl font-bold text-blue-600">
            {quotaStats.used}
          </p>
          <p className="text-xs text-gray-500">Utilisées</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-green-600">
            {quotaStats.remaining}
          </p>
          <p className="text-xs text-gray-500">Disponibles</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-purple-600">
            {quotaStats.percentage.toFixed(0)}%
          </p>
          <p className="text-xs text-gray-500">Utilisé</p>
        </div>
      </div>
    </div>
  )}
</div>
```

#### B. Indicateur Quota sur Page Import

**Fichier à modifier :** `app/admin/import/page.tsx`

Ajouter en haut de page :

```tsx
{/* Bandeau quota */}
{quotaStats && (
  <div className={`mb-6 p-4 rounded-lg border ${
    quotaStats.isCritical
      ? 'bg-red-50 border-red-200'
      : quotaStats.percentage > 70
      ? 'bg-yellow-50 border-yellow-200'
      : 'bg-green-50 border-green-200'
  }`}>
    <div className="flex items-center justify-between">
      <div>
        <p className="font-medium text-gray-900">
          Quota API : {quotaStats.remaining} / 100 requêtes disponibles
        </p>
        <p className="text-sm text-gray-600">
          Reset quotidien à 00:00 UTC
        </p>
      </div>

      <div className="text-right">
        <div className="text-3xl font-bold text-gray-900">
          {quotaStats.remaining}
        </div>
        <div className="text-xs text-gray-500">restantes</div>
      </div>
    </div>
  </div>
)}
```

---

## 💰 Estimation du Coût en Requêtes API

### Import Initial (One-Time)
- **Lister les compétitions** : 1 requête
- **Import d'une compétition** : 1 requête par compétition
  - Exemple : 5 compétitions = 5 requêtes
- **Total initial** : ~6 requêtes

### Maintenance Quotidienne
- **Sync scores compétitions actives** : 1 requête par compétition
  - Exemple : 5 compétitions = 5 requêtes
- **Fréquence intelligente** :
  - Sans matchs en cours : 1x par jour = 5 requêtes
  - Avec matchs en cours : 3x par jour = 15 requêtes

### Scénarios d'Utilisation

#### Scénario A : Utilisation Légère (5 compétitions, peu de matchs)
- Matin : Sync toutes les compétitions = 5 req
- Après-midi : Sync si matchs = 3 req
- Soir : Sync si matchs = 3 req
- **Total : 11 requêtes/jour** ✅ Largement sous la limite

#### Scénario B : Utilisation Moyenne (5 compétitions, journées de matchs)
- Updates fréquentes pendant matchs : 5 req × 5 fois = 25 req
- **Total : 25 requêtes/jour** ✅ Confortable

#### Scénario C : Utilisation Intensive (weekend multi-compétitions)
- 10 updates pendant la journée = 50 req
- **Total : 50 requêtes/jour** ✅ Encore viable

#### Scénario D : Limite Atteinte
- Si 100 requêtes atteintes → Système passe en mode cache only
- Données affichées depuis DB jusqu'au reset quotidien
- **Impact utilisateur : minimal** (données légèrement moins fraîches)

---

## 🔄 Gestion du Mapping des Données Existantes

### Problème
- Tournois existants référencent `competition_id` de football-data.org
- Matchs importés ont des IDs différents entre les deux APIs

### Solution : Migration Douce

#### Étape 1 : Ajouter Colonne de Transition
```sql
-- Ajouter colonne pour l'ancien ID
ALTER TABLE competitions
ADD COLUMN legacy_football_data_id INTEGER;

-- Ajouter colonne pour nouveau provider
ALTER TABLE competitions
ADD COLUMN api_provider VARCHAR(50) DEFAULT 'api-football';
```

#### Étape 2 : Script de Mapping
**Fichier à créer :** `scripts/migrate-competition-ids.ts`

```typescript
const COMPETITION_MAPPING = {
  // football-data.org → api-football.com
  2021: 39,   // Premier League
  2014: 61,   // Ligue 1
  2019: 135,  // Serie A
  2002: 78,   // Bundesliga
  2001: 2,    // Champions League
  2015: 140,  // La Liga
  // ... compléter
}

async function migrateCompetitionIds() {
  const supabase = createClient()

  for (const [oldId, newId] of Object.entries(COMPETITION_MAPPING)) {
    // 1. Sauvegarder ancien ID
    await supabase
      .from('competitions')
      .update({
        legacy_football_data_id: parseInt(oldId),
        api_provider: 'api-football'
      })
      .eq('id', parseInt(oldId))

    // 2. Créer nouvelle entrée avec nouveau ID
    const { data: oldComp } = await supabase
      .from('competitions')
      .select('*')
      .eq('id', parseInt(oldId))
      .single()

    if (oldComp) {
      await supabase
        .from('competitions')
        .upsert({
          ...oldComp,
          id: newId,
          legacy_football_data_id: parseInt(oldId),
          api_provider: 'api-football'
        })
    }

    // 3. Mettre à jour les références dans tournaments
    await supabase
      .from('tournaments')
      .update({ competition_id: newId })
      .eq('competition_id', parseInt(oldId))

    console.log(`✅ Migré ${oldId} → ${newId}`)
  }
}
```

#### Étape 3 : Mode Hybride Temporaire
Pendant la transition, supporter les deux APIs :

```typescript
// lib/competition-loader.ts
async function loadCompetitionData(competitionId: number) {
  const supabase = createClient()

  // Vérifier le provider
  const { data: comp } = await supabase
    .from('competitions')
    .select('api_provider, legacy_football_data_id')
    .eq('id', competitionId)
    .single()

  if (comp?.api_provider === 'football-data') {
    // Ancien système (à supprimer après migration)
    return loadFromFootballData(competitionId)
  } else {
    // Nouveau système
    return loadFromApiFootball(competitionId)
  }
}
```

---

## ⚠️ Risques et Mitigation

### Risque 1 : Quota Épuisé en Plein Match
**Mitigation :**
- Système de priorité favorise les compétitions avec matchs en cours
- Mode cache-only si quota épuisé (affichage des dernières données connues)
- Alert admin si quota critique (<20 req)

### Risque 2 : Mapping IDs Incomplet
**Mitigation :**
- Phase de test avec 2-3 compétitions d'abord
- Table de mapping extensible
- Logs détaillés pour identifier les manques

### Risque 3 : Format de Données Incompatible
**Mitigation :**
- Couche d'adaptation (adapter pattern)
- Tests unitaires pour chaque transformation
- Fallback vers données existantes en cas d'erreur

### Risque 4 : Changement de Structure API-Football
**Mitigation :**
- Versioning de l'API (v3 actuellement)
- Abstraction via client wrapper
- Monitoring des erreurs API

---

## ✅ Checklist de Migration

### Préparation
- [ ] S'inscrire sur api-football.com et obtenir API key
- [ ] Créer table `api_migration_mapping`
- [ ] Créer table `api_request_logs`
- [ ] Documenter mapping compétitions actuelles

### Implémentation
- [ ] Créer `lib/api-football-adapter.ts`
- [ ] Créer `lib/api-football-quota.ts`
- [ ] Créer `lib/api-football-client.ts`
- [ ] Créer `lib/api-football-scheduler.ts`
- [ ] Modifier route `/api/football/competitions`
- [ ] Modifier route `/api/football/import`
- [ ] Modifier route `/api/football/sync-scores`
- [ ] Modifier route `/api/football/auto-update`

### Interface Admin
- [ ] Ajouter widget quota dans settings
- [ ] Ajouter indicateur quota dans import
- [ ] Ajouter logs d'utilisation API
- [ ] Ajouter alerte quota critique

### Migration Données
- [ ] Exécuter script migration IDs
- [ ] Vérifier tournois existants
- [ ] Tester avec 1 compétition pilote
- [ ] Migrer toutes les compétitions

### Tests
- [ ] Test import nouvelle compétition
- [ ] Test sync scores live
- [ ] Test dépassement quota
- [ ] Test priorisation intelligente
- [ ] Test affichage depuis cache

### Documentation
- [ ] Mettre à jour README.md
- [ ] Documenter nouveau système de quota
- [ ] Guide de troubleshooting

---

## 📈 Recommandations

### Court Terme (Migration)
1. **Commencer par 2-3 compétitions pilotes** pour valider le système
2. **Implémenter d'abord le système de quota** avant de migrer
3. **Conserver les anciennes données** pendant 1 mois (safety)

### Moyen Terme (Optimisation)
1. **Machine Learning pour prédiction** : Prédire quand des matchs auront lieu pour optimiser les requêtes
2. **Cache Redis** : Pour données ultra-fréquentes (scores live)
3. **Webhooks** : Si API-Football propose des webhooks (évite le polling)

### Long Terme (Évolution)
1. **Upgrade plan** si l'application décolle (Pro = 7500 req/jour pour 19€/mois)
2. **Multi-provider fallback** : Garder football-data.org en backup
3. **Data warehouse** : Archiver historique des matchs

---

## 🎯 Conclusion

### ✅ Faisabilité : EXCELLENTE

**Points forts :**
1. Architecture existante déjà prête pour le caching
2. Système admin complet pour gestion compétitions
3. Auto-refresh intelligent déjà implémenté
4. 100 requêtes/jour largement suffisantes pour usage raisonnable

**Défis :**
1. Mapping des IDs entre APIs (gérable via table de correspondance)
2. Transformation des formats de données (résolu par adapter layer)
3. Monitoring du quota (implémentation straightforward)

**Temps estimé : 7-12 jours**
- Phase 1 (Préparation) : 1-2 jours
- Phase 2 (Limitation) : 2-3 jours
- Phase 3 (Routes API) : 3-4 jours
- Phase 4 (Interface) : 1-2 jours
- Tests et ajustements : 1-2 jours

**ROI :**
- Migration viable avec plan gratuit
- Évolutif vers plan payant si besoin
- Pas de refonte architecturale majeure requise
- Préserve les données et tournois existants

---

## 📞 Prochaines Étapes Suggérées

1. **Validation utilisateur** : Confirmer que cette approche répond aux besoins
2. **Obtenir API key** : S'inscrire sur api-football.com
3. **Tester endpoints** : Faire quelques appels manuels pour valider les données
4. **Créer mapping initial** : Identifier les compétitions prioritaires à migrer
5. **Démarrer Phase 1** : Créer tables de mapping et monitoring

Prêt à démarrer ? 🚀
