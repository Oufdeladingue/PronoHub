import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

/**
 * Route admin pour consulter les logs de notifications
 * GET /api/admin/notification-logs?date=2026-01-25&type=reminder
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    const searchParams = request.nextUrl.searchParams

    // Paramètres optionnels
    const date = searchParams.get('date') // Format: YYYY-MM-DD
    const type = searchParams.get('type') // reminder, match_result, etc.
    const limit = parseInt(searchParams.get('limit') || '100')

    let query = supabase
      .from('notification_logs')
      .select(`
        id,
        user_id,
        notification_type,
        tournament_id,
        matchday,
        status,
        scheduled_at,
        sent_at,
        error_message,
        created_at
      `)
      .order('scheduled_at', { ascending: false })
      .limit(limit)

    // Filtrer par date si fournie
    if (date) {
      const startOfDay = new Date(date)
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(date)
      endOfDay.setHours(23, 59, 59, 999)

      query = query
        .gte('scheduled_at', startOfDay.toISOString())
        .lte('scheduled_at', endOfDay.toISOString())
    }

    // Filtrer par type si fourni
    if (type) {
      query = query.eq('notification_type', type)
    }

    const { data: logs, error } = await query

    if (error) {
      console.error('Error fetching notification logs:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Enrichir avec les infos utilisateur
    const enrichedLogs = await Promise.all(
      (logs || []).map(async (log) => {
        // Récupérer l'email
        const { data: authUser } = await supabase.auth.admin.getUserById(log.user_id)

        // Récupérer le username
        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', log.user_id)
          .single()

        return {
          ...log,
          user_email: authUser?.user?.email || 'Unknown',
          username: profile?.username || 'Unknown'
        }
      })
    )

    // Statistiques
    const stats = {
      total: enrichedLogs.length,
      sent: enrichedLogs.filter(l => l.status === 'sent').length,
      failed: enrichedLogs.filter(l => l.status === 'failed').length,
      pending: enrichedLogs.filter(l => l.status === 'pending').length,
    }

    return NextResponse.json({
      success: true,
      stats,
      logs: enrichedLogs,
      filters: {
        date: date || 'all',
        type: type || 'all',
        limit
      }
    })

  } catch (error: any) {
    console.error('Admin notification logs error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
