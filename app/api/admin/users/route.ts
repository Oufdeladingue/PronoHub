import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse, NextRequest } from 'next/server'
import { isSuperAdmin } from '@/lib/auth-helpers'
import { UserRole } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    // Vérifier l'authentification et les droits admin
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

    // Paramètres
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '20')
    const sortBy = searchParams.get('sortBy') || 'created_at'
    const sortDir = searchParams.get('sortDir') || 'desc'
    const offset = (page - 1) * pageSize

    const validSortColumns = ['username', 'email', 'created_at', 'last_seen_at', 'country']
    const actualSortBy = validSortColumns.includes(sortBy) ? sortBy : 'created_at'
    const ascending = sortDir === 'asc'

    // Count query
    let countQuery = adminClient
      .from('profiles')
      .select('*', { count: 'exact', head: true })

    if (search) {
      countQuery = countQuery.or(`username.ilike.%${search}%,email.ilike.%${search}%`)
    }

    const { count: totalCount } = await countQuery

    // Requête paginée
    let usersQuery = adminClient
      .from('profiles')
      .select('id, username, email, created_at, last_seen_at, country')
      .order(actualSortBy, { ascending, nullsFirst: false })
      .range(offset, offset + pageSize - 1)

    if (search) {
      usersQuery = usersQuery.or(`username.ilike.%${search}%,email.ilike.%${search}%`)
    }

    const { data: usersData, error: usersError } = await usersQuery

    if (usersError) {
      console.error('Error fetching users:', usersError)
      return NextResponse.json({ error: 'Erreur lors de la récupération des utilisateurs' }, { status: 500 })
    }

    if (!usersData || usersData.length === 0) {
      return NextResponse.json({
        success: true,
        users: [],
        totalCount: 0,
        page,
        pageSize
      })
    }

    // Récupérer les tournois actifs pour ces users
    const userIds = usersData.map(u => u.id)
    const activeStatuses = ['active', 'pending', 'warmup']

    const { data: participations } = await adminClient
      .from('tournament_participants')
      .select(`
        user_id,
        tournaments!inner (
          id,
          name,
          slug,
          status
        )
      `)
      .in('user_id', userIds)
      .in('tournaments.status', activeStatuses)

    // Grouper les tournois par user
    const tournamentsMap = new Map<string, Array<{ id: string; name: string; slug: string; status: string }>>()
    if (participations) {
      participations.forEach((p: any) => {
        const tournament = p.tournaments
        if (!tournament) return
        if (!tournamentsMap.has(p.user_id)) {
          tournamentsMap.set(p.user_id, [])
        }
        tournamentsMap.get(p.user_id)!.push({
          id: tournament.id,
          name: tournament.name,
          slug: tournament.slug,
          status: tournament.status
        })
      })
    }

    // Construire la réponse
    const users = usersData.map(u => {
      const activeTournaments = tournamentsMap.get(u.id) || []
      return {
        id: u.id,
        username: u.username || 'Sans nom',
        email: u.email,
        country: u.country || null,
        created_at: u.created_at,
        last_seen_at: u.last_seen_at,
        active_tournaments_count: activeTournaments.length,
        active_tournaments: activeTournaments
      }
    })

    return NextResponse.json({
      success: true,
      users,
      totalCount: totalCount || 0,
      page,
      pageSize
    })

  } catch (error) {
    console.error('Error in admin users API:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
