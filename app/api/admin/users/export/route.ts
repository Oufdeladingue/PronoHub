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
    const sortBy = searchParams.get('sortBy') || 'created_at'
    const sortDir = searchParams.get('sortDir') || 'desc'

    const validSortColumns = ['username', 'email', 'created_at', 'last_seen_at']
    const actualSortBy = validSortColumns.includes(sortBy) ? sortBy : 'created_at'
    const ascending = sortDir === 'asc'

    // Récupérer TOUS les users (sans pagination)
    let usersQuery = adminClient
      .from('profiles')
      .select('id, username, email, created_at, last_seen_at')
      .order(actualSortBy, { ascending, nullsFirst: false })

    if (search) {
      usersQuery = usersQuery.or(`username.ilike.%${search}%,email.ilike.%${search}%`)
    }

    const { data: usersData, error: usersError } = await usersQuery

    if (usersError) {
      console.error('Error fetching users for export:', usersError)
      return NextResponse.json({ error: 'Erreur export' }, { status: 500 })
    }

    if (!usersData || usersData.length === 0) {
      const csv = 'Email,Pseudo,Date creation,Derniere connexion,Nb tournois actifs,Tournois actifs\n'
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename=users_export.csv'
        }
      })
    }

    // Récupérer les tournois actifs
    const userIds = usersData.map(u => u.id)
    const activeStatuses = ['active', 'in_progress', 'registration']

    // Supabase .in() a une limite, on batch par 500
    const allParticipations: any[] = []
    for (let i = 0; i < userIds.length; i += 500) {
      const batch = userIds.slice(i, i + 500)
      const { data } = await adminClient
        .from('tournament_participants')
        .select(`
          user_id,
          tournaments!inner (
            id,
            name,
            status
          )
        `)
        .in('user_id', batch)
        .in('tournaments.status', activeStatuses)

      if (data) allParticipations.push(...data)
    }

    // Grouper par user
    const tournamentsMap = new Map<string, string[]>()
    allParticipations.forEach((p: any) => {
      const tournament = p.tournaments
      if (!tournament) return
      if (!tournamentsMap.has(p.user_id)) {
        tournamentsMap.set(p.user_id, [])
      }
      tournamentsMap.get(p.user_id)!.push(tournament.name)
    })

    // Générer CSV
    const formatDate = (d: string | null) => {
      if (!d) return ''
      return new Date(d).toLocaleDateString('fr-FR', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
      })
    }

    const escapeCsv = (val: string) => {
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`
      }
      return val
    }

    const header = 'Email,Pseudo,Date creation,Derniere connexion,Nb tournois actifs,Tournois actifs'
    const rows = usersData.map(u => {
      const tournaments = tournamentsMap.get(u.id) || []
      return [
        escapeCsv(u.email || ''),
        escapeCsv(u.username || 'Sans nom'),
        escapeCsv(formatDate(u.created_at)),
        escapeCsv(formatDate(u.last_seen_at)),
        tournaments.length.toString(),
        escapeCsv(tournaments.join('; '))
      ].join(',')
    })

    const csv = [header, ...rows].join('\n')

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename=users_export.csv'
      }
    })

  } catch (error) {
    console.error('Error in admin users export:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
