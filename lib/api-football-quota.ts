/**
 * API-Football Quota Manager
 * Gère le quota quotidien de 100 requêtes pour le plan gratuit
 */

import { createClient } from '@/lib/supabase/server'

const DAILY_LIMIT = 100
const CRITICAL_THRESHOLD = 20 // Seuil d'alerte (20% restant)
const WARNING_THRESHOLD = 40  // Seuil d'avertissement (40% restant)

export interface QuotaStats {
  used: number
  remaining: number
  percentage: number
  isCritical: boolean
  isWarning: boolean
  status: 'NORMAL' | 'WARNING' | 'CRITICAL' | 'EXHAUSTED'
  firstRequestAt?: Date
  lastRequestAt?: Date
  avgResponseTime?: number
}

export class ApiFootballQuotaManager {
  /**
   * Obtient le nombre de requêtes restantes pour aujourd'hui
   */
  static async getRemainingQuota(): Promise<number> {
    const supabase = await createClient()
    const today = new Date().toISOString().split('T')[0]

    const { count, error } = await supabase
      .from('api_request_logs')
      .select('*', { count: 'exact', head: true })
      .eq('request_date', today)

    if (error) {
      console.error('Erreur lecture quota:', error)
      return 0
    }

    return DAILY_LIMIT - (count || 0)
  }

  /**
   * Vérifie si on peut faire N requêtes
   */
  static async canMakeRequest(estimatedCost: number = 1): Promise<boolean> {
    const remaining = await this.getRemainingQuota()
    return remaining >= estimatedCost
  }

  /**
   * Enregistre une requête dans les logs
   */
  static async logRequest(
    endpoint: string,
    competitionId?: number,
    success: boolean = true,
    errorMessage?: string,
    statusCode?: number,
    responseTimeMs?: number
  ): Promise<void> {
    const supabase = await createClient()
    const today = new Date().toISOString().split('T')[0]

    const { error } = await supabase
      .from('api_request_logs')
      .insert({
        request_date: today,
        endpoint,
        competition_id: competitionId,
        method: 'GET',
        status_code: statusCode,
        success,
        error_message: errorMessage,
        response_time_ms: responseTimeMs
      })

    if (error) {
      console.error('Erreur log requête:', error)
    }
  }

  /**
   * Vérifie si on est en dessous du seuil critique
   */
  static async isCriticalThreshold(): Promise<boolean> {
    const remaining = await this.getRemainingQuota()
    return remaining <= CRITICAL_THRESHOLD
  }

  /**
   * Vérifie si on est en dessous du seuil d'avertissement
   */
  static async isWarningThreshold(): Promise<boolean> {
    const remaining = await this.getRemainingQuota()
    return remaining <= WARNING_THRESHOLD && remaining > CRITICAL_THRESHOLD
  }

  /**
   * Obtient les statistiques d'utilisation complètes
   */
  static async getUsageStats(): Promise<QuotaStats> {
    const supabase = await createClient()
    const today = new Date().toISOString().split('T')[0]

    // Récupérer les stats via la vue
    const { data: viewData } = await supabase
      .from('current_day_api_usage')
      .select('*')
      .single()

    if (viewData) {
      const remaining = viewData.remaining_requests || DAILY_LIMIT
      const used = viewData.total_requests || 0
      const percentage = viewData.usage_percentage || 0

      return {
        used,
        remaining,
        percentage,
        isCritical: remaining <= CRITICAL_THRESHOLD,
        isWarning: remaining <= WARNING_THRESHOLD && remaining > CRITICAL_THRESHOLD,
        status: viewData.quota_status || 'NORMAL',
        firstRequestAt: viewData.first_request_at ? new Date(viewData.first_request_at) : undefined,
        lastRequestAt: viewData.last_request_at ? new Date(viewData.last_request_at) : undefined,
        avgResponseTime: viewData.avg_response_time_ms
      }
    }

    // Fallback si la vue ne retourne rien (aucune requête aujourd'hui)
    return {
      used: 0,
      remaining: DAILY_LIMIT,
      percentage: 0,
      isCritical: false,
      isWarning: false,
      status: 'NORMAL'
    }
  }

  /**
   * Obtient l'historique des quotas sur les N derniers jours
   */
  static async getHistoricalUsage(days: number = 7): Promise<Array<{
    date: string
    used: number
    remaining: number
    percentage: number
    status: string
  }>> {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('daily_api_usage')
      .select('*')
      .order('request_date', { ascending: false })
      .limit(days)

    if (error || !data) {
      console.error('Erreur récupération historique:', error)
      return []
    }

    return data.map(row => ({
      date: row.request_date,
      used: row.total_requests,
      remaining: row.remaining_requests,
      percentage: row.usage_percentage,
      status: row.quota_status
    }))
  }

  /**
   * Obtient les statistiques par compétition pour aujourd'hui
   */
  static async getCompetitionUsage(): Promise<Array<{
    competitionId: number
    requestCount: number
    successRate: number
  }>> {
    const supabase = await createClient()
    const today = new Date().toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('api_request_logs')
      .select('competition_id, success')
      .eq('request_date', today)
      .not('competition_id', 'is', null)

    if (error || !data) {
      return []
    }

    // Grouper par compétition
    const grouped = data.reduce((acc, row) => {
      const compId = row.competition_id!
      if (!acc[compId]) {
        acc[compId] = { total: 0, success: 0 }
      }
      acc[compId].total++
      if (row.success) acc[compId].success++
      return acc
    }, {} as Record<number, { total: number, success: number }>)

    return Object.entries(grouped).map(([compId, stats]) => ({
      competitionId: parseInt(compId),
      requestCount: stats.total,
      successRate: (stats.success / stats.total) * 100
    }))
  }

  /**
   * Réinitialise les logs de plus de 30 jours (nettoyage)
   */
  static async cleanOldLogs(daysToKeep: number = 30): Promise<number> {
    const supabase = await createClient()
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)
    const cutoffStr = cutoffDate.toISOString().split('T')[0]

    const { error, count } = await supabase
      .from('api_request_logs')
      .delete()
      .lt('request_date', cutoffStr)

    if (error) {
      console.error('Erreur nettoyage logs:', error)
      return 0
    }

    return count || 0
  }

  /**
   * Estime le coût en requêtes d'une opération
   */
  static estimateOperationCost(operation: 'import' | 'sync' | 'list'): number {
    switch (operation) {
      case 'import':
        return 1 // 1 requête pour importer une compétition (fixtures)
      case 'sync':
        return 1 // 1 requête pour sync scores (live fixtures)
      case 'list':
        return 1 // 1 requête pour lister les compétitions
      default:
        return 1
    }
  }

  /**
   * Vérifie si une opération peut être effectuée
   */
  static async canPerformOperation(operation: 'import' | 'sync' | 'list'): Promise<{
    allowed: boolean
    reason?: string
    remaining: number
  }> {
    const cost = this.estimateOperationCost(operation)
    const remaining = await this.getRemainingQuota()
    const canProceed = remaining >= cost

    return {
      allowed: canProceed,
      reason: canProceed
        ? undefined
        : `Quota insuffisant. Requis: ${cost}, Disponible: ${remaining}`,
      remaining
    }
  }
}
