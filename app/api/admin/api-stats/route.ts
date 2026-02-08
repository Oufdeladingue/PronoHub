import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // Vérifier l'authentification admin
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // Vérifier le rôle super_admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    // Récupérer les stats d'aujourd'hui
    const today = new Date().toISOString().split('T')[0]

    // 1. Appels API par type (quotidien, temps réel, manuel)
    const { data: callsByType } = await supabase
      .from('api_calls_log')
      .select('call_type, success')
      .gte('created_at', `${today}T00:00:00Z`)

    // 2. Total des appels aujourd'hui
    const totalCalls = callsByType?.length || 0

    // 3. Appels par heure (dernières 24h)
    const { data: callsByHour } = await supabase.rpc('get_api_calls_by_hour')

    // 4. Taux de succès
    const successCount = callsByType?.filter(c => c.success).length || 0
    const failureCount = callsByType?.filter(c => !c.success).length || 0

    // 5. Répartition par type
    const manualCalls = callsByType?.filter(c => c.call_type === 'manual').length || 0
    const realtimeCalls = callsByType?.filter(c => c.call_type === 'realtime').length || 0
    const quotidienCalls = callsByType?.filter(c => c.call_type === 'daily').length || 0

    // 6. Estimation du reste de la journée
    const now = new Date()
    const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes()
    const minutesInDay = 24 * 60
    const minutesRemaining = minutesInDay - minutesSinceMidnight

    // Estimer le nombre d'appels restants basé sur la fréquence actuelle
    const { data: settings } = await supabase
      .from('admin_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['cron_realtime_frequency', 'cron_auto_update_enabled'])

    const settingsMap: Record<string, string> = {}
    settings?.forEach(s => {
      settingsMap[s.setting_key] = s.setting_value
    })

    const realtimeFrequency = parseInt(settingsMap['cron_realtime_frequency']) || 5
    const isEnabled = settingsMap['cron_auto_update_enabled'] === 'true'

    let estimatedRemainingCalls = 0
    if (isEnabled) {
      // Nombre de cycles restants dans la journée
      const cyclesRemaining = Math.floor(minutesRemaining / realtimeFrequency)
      // En moyenne, ~4 matchs actifs par cycle (estimation conservative)
      estimatedRemainingCalls = cyclesRemaining * 4
    }

    const estimatedTotal = totalCalls + estimatedRemainingCalls

    // 7. Quota et pourcentage
    const dailyQuota = 1440 // Free tier Football-Data API
    const quotaUsagePercent = Math.round((totalCalls / dailyQuota) * 100)
    const estimatedQuotaPercent = Math.round((estimatedTotal / dailyQuota) * 100)

    return NextResponse.json({
      success: true,
      stats: {
        totalCalls,
        successCount,
        failureCount,
        successRate: totalCalls > 0 ? Math.round((successCount / totalCalls) * 100) : 100,
        byType: {
          manual: manualCalls,
          realtime: realtimeCalls,
          quotidien: quotidienCalls,
        },
        quota: {
          daily: dailyQuota,
          used: totalCalls,
          remaining: dailyQuota - totalCalls,
          usagePercent: quotaUsagePercent,
          estimatedTotal,
          estimatedRemaining: estimatedRemainingCalls,
          estimatedQuotaPercent,
          status: estimatedQuotaPercent > 100 ? 'critical' : estimatedQuotaPercent > 80 ? 'warning' : 'ok'
        },
        callsByHour: callsByHour || []
      }
    })

  } catch (error: any) {
    console.error('Error in GET api-stats:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
