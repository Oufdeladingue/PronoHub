/**
 * API-Football Scheduler
 * Système de priorisation intelligente pour optimiser l'utilisation du quota quotidien
 */

import { createClient } from '@/lib/supabase/server'
import { ApiFootballQuotaManager } from './api-football-quota'

export interface CompetitionPriority {
  competitionId: number
  competitionName: string
  priority: number  // 1-5 (5 = urgent)
  reason: string
  estimatedRequests: number
  liveMatchesCount?: number
  upcomingMatchesCount?: number
}

export interface SchedulerResult {
  updated: number[]
  skipped: number[]
  quotaExhausted: boolean
  totalRequests: number
  remainingQuota: number
  executionTime: number
}

export class ApiFootballScheduler {
  /**
   * Calcule la priorité d'update pour chaque compétition active
   * Basé sur les matchs en cours et à venir
   */
  static async calculatePriorities(): Promise<CompetitionPriority[]> {
    const supabase = await createClient()
    const now = new Date()
    const in2Hours = new Date(now.getTime() + 2 * 60 * 60 * 1000)
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000)

    // Récupérer les compétitions actives
    const { data: competitions, error } = await supabase
      .from('competitions')
      .select('id, name')
      .eq('is_active', true)

    if (error || !competitions) {
      console.error('Erreur récupération compétitions:', error)
      return []
    }

    const priorities: CompetitionPriority[] = []

    for (const comp of competitions) {
      // Compter les matchs EN COURS
      const { count: liveCount } = await supabase
        .from('imported_matches')
        .select('*', { count: 'exact', head: true })
        .eq('competition_id', comp.id)
        .in('status', ['IN_PLAY', 'PAUSED'])

      // Compter les matchs dans les 2 heures
      const { count: upcoming2hCount } = await supabase
        .from('imported_matches')
        .select('*', { count: 'exact', head: true })
        .eq('competition_id', comp.id)
        .eq('status', 'SCHEDULED')
        .gte('utc_date', now.toISOString())
        .lte('utc_date', in2Hours.toISOString())

      // Compter les matchs dans les 24 heures
      const { count: upcoming24hCount } = await supabase
        .from('imported_matches')
        .select('*', { count: 'exact', head: true })
        .eq('competition_id', comp.id)
        .eq('status', 'SCHEDULED')
        .gte('utc_date', now.toISOString())
        .lte('utc_date', in24Hours.toISOString())

      let priority = 1
      let reason = 'Pas de match imminent'

      if (liveCount && liveCount > 0) {
        priority = 5
        reason = `🔴 ${liveCount} match(s) EN COURS - UPDATE URGENT`
      } else if (upcoming2hCount && upcoming2hCount > 0) {
        priority = 4
        reason = `🟡 ${upcoming2hCount} match(s) dans les 2 heures`
      } else if (upcoming24hCount && upcoming24hCount > 0) {
        priority = 3
        reason = `🟢 ${upcoming24hCount} match(s) dans les 24h`
      } else {
        // Vérifier s'il y a eu des matchs récemment terminés (dans les 3h)
        const in3HoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000)

        const { count: recentFinishedCount } = await supabase
          .from('imported_matches')
          .select('*', { count: 'exact', head: true })
          .eq('competition_id', comp.id)
          .eq('status', 'FINISHED')
          .gte('utc_date', in3HoursAgo.toISOString())

        if (recentFinishedCount && recentFinishedCount > 0) {
          priority = 2
          reason = `⚪ ${recentFinishedCount} match(s) récemment terminé(s)`
        }
      }

      priorities.push({
        competitionId: comp.id,
        competitionName: comp.name,
        priority,
        reason,
        estimatedRequests: 1, // 1 requête pour /fixtures live
        liveMatchesCount: liveCount || 0,
        upcomingMatchesCount: (upcoming2hCount || 0) + (upcoming24hCount || 0)
      })
    }

    // Trier par priorité décroissante
    return priorities.sort((a, b) => b.priority - a.priority)
  }

  /**
   * Exécute les updates en fonction du quota disponible et des priorités
   */
  static async executeScheduledUpdates(): Promise<SchedulerResult> {
    const startTime = Date.now()

    const quotaStats = await ApiFootballQuotaManager.getUsageStats()
    const priorities = await this.calculatePriorities()

    const updated: number[] = []
    const skipped: number[] = []
    let quotaExhausted = false
    let totalRequests = 0

    console.log('\n========================================')
    console.log('🔄 Scheduled Update - API-Football')
    console.log('========================================')
    console.log(`📊 Quota: ${quotaStats.used}/100 utilisées, ${quotaStats.remaining} disponibles`)
    console.log(`📋 ${priorities.length} compétition(s) à traiter`)
    console.log('========================================\n')

    for (const item of priorities) {
      // Vérifier le quota avant chaque update
      const canProceed = await ApiFootballQuotaManager.canMakeRequest(item.estimatedRequests)

      if (!canProceed) {
        console.log(`⏸️  Quota insuffisant - Skip "${item.competitionName}" (priorité ${item.priority})`)
        skipped.push(item.competitionId)
        quotaExhausted = true
        continue
      }

      console.log(`🔄 [P${item.priority}] Update "${item.competitionName}"`)
      console.log(`   ↳ ${item.reason}`)

      try {
        // Appeler la route de sync pour cette compétition
        const response = await fetch('/api/football/sync-scores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            competitionId: item.competitionId,
            source: 'scheduler'
          })
        })

        if (response.ok) {
          const data = await response.json()
          updated.push(item.competitionId)
          totalRequests += item.estimatedRequests

          console.log(`   ✅ Succès: ${data.updatedCount || 0} match(s) mis à jour`)
        } else {
          const errorData = await response.json()
          console.log(`   ❌ Échec: ${errorData.error || 'Unknown error'}`)
          skipped.push(item.competitionId)
        }
      } catch (error) {
        console.error(`   ❌ Erreur update "${item.competitionName}":`, error)
        skipped.push(item.competitionId)
      }
    }

    const executionTime = Date.now() - startTime
    const finalQuotaStats = await ApiFootballQuotaManager.getUsageStats()

    console.log('\n========================================')
    console.log('✅ Scheduled Update Terminé')
    console.log('========================================')
    console.log(`📊 Résultats:`)
    console.log(`   • ${updated.length} compétition(s) mise(s) à jour`)
    console.log(`   • ${skipped.length} compétition(s) ignorée(s)`)
    console.log(`   • ${totalRequests} requête(s) API effectuée(s)`)
    console.log(`   • ${finalQuotaStats.remaining} requête(s) restante(s)`)
    console.log(`   • Exécution: ${(executionTime / 1000).toFixed(2)}s`)

    if (quotaExhausted) {
      console.log(`\n⚠️  ATTENTION: Quota épuisé, certaines compétitions n'ont pas été mises à jour`)
    }

    console.log('========================================\n')

    return {
      updated,
      skipped,
      quotaExhausted,
      totalRequests,
      remainingQuota: finalQuotaStats.remaining,
      executionTime
    }
  }

  /**
   * Détermine la fréquence de refresh recommandée selon le contexte
   */
  static async getRecommendedRefreshInterval(): Promise<{
    intervalMinutes: number
    reason: string
  }> {
    const priorities = await this.calculatePriorities()

    // S'il y a des matchs en cours
    const hasLiveMatches = priorities.some(p => p.liveMatchesCount && p.liveMatchesCount > 0)
    if (hasLiveMatches) {
      return {
        intervalMinutes: 5,
        reason: 'Matchs en cours détectés - Refresh fréquent'
      }
    }

    // S'il y a des matchs dans les 2h
    const hasUpcomingMatches = priorities.some(p => p.priority >= 4)
    if (hasUpcomingMatches) {
      return {
        intervalMinutes: 15,
        reason: 'Matchs à venir sous 2h - Refresh modéré'
      }
    }

    // S'il y a des matchs dans les 24h
    const hasUpcoming24h = priorities.some(p => p.priority >= 3)
    if (hasUpcoming24h) {
      return {
        intervalMinutes: 60,
        reason: 'Matchs à venir sous 24h - Refresh standard'
      }
    }

    // Pas de matchs imminents
    return {
      intervalMinutes: 240, // 4h
      reason: 'Pas de matchs imminents - Refresh minimal'
    }
  }

  /**
   * Calcule le meilleur moment pour la prochaine update
   */
  static async getNextUpdateTime(): Promise<{
    nextUpdate: Date
    intervalMinutes: number
    reason: string
  }> {
    const { intervalMinutes, reason } = await this.getRecommendedRefreshInterval()
    const nextUpdate = new Date(Date.now() + intervalMinutes * 60 * 1000)

    return {
      nextUpdate,
      intervalMinutes,
      reason
    }
  }

  /**
   * Vérifie si un update est nécessaire maintenant
   */
  static async shouldUpdateNow(): Promise<{
    shouldUpdate: boolean
    reason: string
    priority?: number
  }> {
    const priorities = await this.calculatePriorities()

    // Update immédiat si matchs en cours
    const hasLiveMatches = priorities.some(p => p.liveMatchesCount && p.liveMatchesCount > 0)
    if (hasLiveMatches) {
      return {
        shouldUpdate: true,
        reason: 'Matchs en cours',
        priority: 5
      }
    }

    // Update si matchs dans moins de 2h
    const hasUpcoming = priorities.some(p => p.priority >= 4)
    if (hasUpcoming) {
      return {
        shouldUpdate: true,
        reason: 'Matchs imminents (< 2h)',
        priority: 4
      }
    }

    return {
      shouldUpdate: false,
      reason: 'Pas de matchs urgents'
    }
  }

  /**
   * Obtient un rapport détaillé du planning
   */
  static async getScheduleReport(): Promise<{
    totalCompetitions: number
    activeCompetitions: number
    priorities: CompetitionPriority[]
    quotaStatus: {
      used: number
      remaining: number
      percentage: number
      status: string
    }
    recommendation: {
      nextUpdate: Date
      intervalMinutes: number
      reason: string
    }
  }> {
    const supabase = await createClient()

    const { count: totalCompetitions } = await supabase
      .from('competitions')
      .select('*', { count: 'exact', head: true })

    const { count: activeCompetitions } = await supabase
      .from('competitions')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)

    const priorities = await this.calculatePriorities()
    const quotaStatus = await ApiFootballQuotaManager.getUsageStats()
    const recommendation = await this.getNextUpdateTime()

    return {
      totalCompetitions: totalCompetitions || 0,
      activeCompetitions: activeCompetitions || 0,
      priorities,
      quotaStatus: {
        used: quotaStatus.used,
        remaining: quotaStatus.remaining,
        percentage: quotaStatus.percentage,
        status: quotaStatus.status
      },
      recommendation
    }
  }
}
