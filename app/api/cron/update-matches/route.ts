import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Clés des paramètres dans la table admin_settings
const SETTINGS_KEYS = {
  autoUpdateEnabled: 'cron_auto_update_enabled',
  updateFrequency: 'cron_update_frequency',
  updateTimeStart: 'cron_update_time_start',
  updateTimeEnd: 'cron_update_time_end',
  updateDays: 'cron_update_days',
  onlyActiveCompetitions: 'cron_only_active_competitions',
  lastCronRun: 'cron_last_run'
}

// Mapping des jours en anglais vers les index JS (0 = dimanche)
const DAY_MAP: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6
}

/**
 * Vérifie si l'heure actuelle est dans la plage horaire configurée
 */
function isWithinTimeRange(startTime: string, endTime: string): boolean {
  const now = new Date()
  // Convertir en heure de Paris (Europe/Paris)
  const parisTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }))
  const currentMinutes = parisTime.getHours() * 60 + parisTime.getMinutes()

  const [startHour, startMin] = startTime.split(':').map(Number)
  const [endHour, endMin] = endTime.split(':').map(Number)

  const startMinutes = startHour * 60 + startMin
  const endMinutes = endHour * 60 + endMin

  // Gérer le cas où la plage traverse minuit
  if (endMinutes < startMinutes) {
    return currentMinutes >= startMinutes || currentMinutes <= endMinutes
  }

  return currentMinutes >= startMinutes && currentMinutes <= endMinutes
}

/**
 * Vérifie si le jour actuel est dans la liste des jours configurés
 */
function isAllowedDay(allowedDays: string[]): boolean {
  const now = new Date()
  const parisTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }))
  const currentDayIndex = parisTime.getDay()

  return allowedDays.some(day => DAY_MAP[day] === currentDayIndex)
}

// GET - Appelé par le cron Vercel
export async function GET(request: Request) {
  return handleCronRequest(request, false)
}

// POST - Appelé manuellement depuis l'admin
export async function POST(request: Request) {
  return handleCronRequest(request, true)
}

async function handleCronRequest(request: Request, isManual: boolean) {
  try {
    const supabase = await createClient()

    // Vérification du secret pour les appels Vercel cron
    if (!isManual) {
      const authHeader = request.headers.get('authorization')
      const cronSecret = process.env.CRON_SECRET

      // Si CRON_SECRET est configuré, vérifier l'authentification
      if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        console.log('[CRON] Unauthorized cron request')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    } else {
      // Pour les appels manuels, vérifier l'authentification admin
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role !== 'super_admin') {
        return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
      }
    }

    // Récupérer les paramètres de MAJ auto
    const { data: settingsData } = await supabase
      .from('admin_settings')
      .select('setting_key, setting_value')
      .in('setting_key', Object.values(SETTINGS_KEYS))

    const settingsMap: Record<string, string> = {}
    settingsData?.forEach(s => {
      settingsMap[s.setting_key] = s.setting_value
    })

    const autoUpdateEnabled = settingsMap[SETTINGS_KEYS.autoUpdateEnabled] === 'true'
    const updateTimeStart = settingsMap[SETTINGS_KEYS.updateTimeStart] || '18:00'
    const updateTimeEnd = settingsMap[SETTINGS_KEYS.updateTimeEnd] || '23:59'
    const updateDays: string[] = settingsMap[SETTINGS_KEYS.updateDays]
      ? JSON.parse(settingsMap[SETTINGS_KEYS.updateDays])
      : ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

    // Vérifications (sauf si appel manuel)
    if (!isManual) {
      // Vérifier si les MAJ auto sont activées
      if (!autoUpdateEnabled) {
        console.log('[CRON] Auto-update is disabled')
        return NextResponse.json({
          success: false,
          message: 'Auto-update is disabled',
          skipped: true
        })
      }

      // Vérifier si on est dans la plage horaire
      if (!isWithinTimeRange(updateTimeStart, updateTimeEnd)) {
        console.log(`[CRON] Outside time range (${updateTimeStart} - ${updateTimeEnd})`)
        return NextResponse.json({
          success: false,
          message: `Outside configured time range (${updateTimeStart} - ${updateTimeEnd})`,
          skipped: true
        })
      }

      // Vérifier si c'est un jour autorisé
      if (!isAllowedDay(updateDays)) {
        console.log('[CRON] Not an allowed day')
        return NextResponse.json({
          success: false,
          message: 'Not an allowed day for updates',
          skipped: true
        })
      }
    }

    console.log(`[CRON] Starting ${isManual ? 'manual' : 'scheduled'} update...`)

    // Appeler l'API auto-update existante
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3100'
    const autoUpdateResponse = await fetch(`${baseUrl}/api/football/auto-update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })

    const autoUpdateResult = await autoUpdateResponse.json()

    // Mettre à jour la date de dernière exécution
    await supabase
      .from('admin_settings')
      .upsert({
        setting_key: SETTINGS_KEYS.lastCronRun,
        setting_value: new Date().toISOString()
      }, { onConflict: 'setting_key' })

    console.log(`[CRON] Update completed: ${autoUpdateResult.successCount || 0} competitions updated`)

    return NextResponse.json({
      success: true,
      message: `${isManual ? 'Manual' : 'Scheduled'} update completed`,
      updated: autoUpdateResult.successCount || 0,
      failed: autoUpdateResult.failureCount || 0,
      finishedTournaments: autoUpdateResult.finishedTournaments,
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('[CRON] Error:', error)
    return NextResponse.json(
      { error: error.message, success: false },
      { status: 500 }
    )
  }
}
