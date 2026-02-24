import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse, NextRequest } from 'next/server'
import { isSuperAdmin } from '@/lib/auth-helpers'
import { UserRole } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    // Auth check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!isSuperAdmin(profile?.role as UserRole)) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    // Params
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '20')
    const typeFilter = searchParams.get('type') || 'all'
    const channelFilter = searchParams.get('channel') || 'all'
    const statusFilter = searchParams.get('status') || 'all'
    const offset = (page - 1) * pageSize

    // 1. Stats agrégées (tous les logs, sans pagination)
    const { data: allLogs } = await adminClient
      .from('notification_logs')
      .select('notification_type, channel, status')

    const stats = {
      totalSent: 0,
      totalFailed: 0,
      totalPending: 0,
      byChannel: {} as Record<string, number>,
      byType: {} as Record<string, number>,
    }

    for (const log of allLogs || []) {
      if (log.status === 'sent') stats.totalSent++
      else if (log.status === 'failed') stats.totalFailed++
      else if (log.status === 'pending') stats.totalPending++

      const ch = log.channel || 'email'
      stats.byChannel[ch] = (stats.byChannel[ch] || 0) + 1

      const t = log.notification_type || 'unknown'
      stats.byType[t] = (stats.byType[t] || 0) + 1
    }

    // 2. Logs paginés avec filtres
    let countQuery = adminClient
      .from('notification_logs')
      .select('*', { count: 'exact', head: true })

    let logsQuery = adminClient
      .from('notification_logs')
      .select('id, notification_type, channel, status, sent_at, scheduled_at, created_at, error_message, matchday, user_id, tournament_id')
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)

    // Appliquer les filtres
    if (typeFilter !== 'all') {
      countQuery = countQuery.eq('notification_type', typeFilter)
      logsQuery = logsQuery.eq('notification_type', typeFilter)
    }
    if (channelFilter !== 'all') {
      countQuery = countQuery.eq('channel', channelFilter)
      logsQuery = logsQuery.eq('channel', channelFilter)
    }
    if (statusFilter !== 'all') {
      countQuery = countQuery.eq('status', statusFilter)
      logsQuery = logsQuery.eq('status', statusFilter)
    }

    const [{ count: totalCount }, { data: logs, error: logsError }] = await Promise.all([
      countQuery,
      logsQuery
    ])

    if (logsError) {
      console.error('Error fetching notification logs:', logsError)
      return NextResponse.json({ error: 'Erreur récupération logs' }, { status: 500 })
    }

    // 3. Enrichir avec username/email et tournament_name
    const userIds = [...new Set((logs || []).map(l => l.user_id).filter(Boolean))]
    const tournamentIds = [...new Set((logs || []).map(l => l.tournament_id).filter(Boolean))]

    const [profilesResult, tournamentsResult] = await Promise.all([
      userIds.length > 0
        ? adminClient.from('profiles').select('id, username, email').in('id', userIds)
        : Promise.resolve({ data: [] }),
      tournamentIds.length > 0
        ? adminClient.from('tournaments').select('id, name').in('id', tournamentIds)
        : Promise.resolve({ data: [] }),
    ])

    const profileMap = new Map<string, { username: string; email: string }>()
    for (const p of profilesResult.data || []) {
      profileMap.set(p.id, { username: p.username, email: p.email })
    }

    const tournamentMap = new Map<string, string>()
    for (const t of tournamentsResult.data || []) {
      tournamentMap.set(t.id, t.name)
    }

    const enrichedLogs = (logs || []).map(l => ({
      id: l.id,
      created_at: l.created_at,
      notification_type: l.notification_type,
      channel: l.channel,
      status: l.status,
      sent_at: l.sent_at,
      error_message: l.error_message,
      matchday: l.matchday,
      username: l.user_id ? profileMap.get(l.user_id)?.username || null : null,
      email: l.user_id ? profileMap.get(l.user_id)?.email || null : null,
      tournament_name: l.tournament_id ? tournamentMap.get(l.tournament_id) || null : null,
    }))

    return NextResponse.json({
      success: true,
      stats,
      logs: enrichedLogs,
      totalCount: totalCount || 0,
      page,
      pageSize,
    })

  } catch (error: any) {
    console.error('Admin notifications error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
