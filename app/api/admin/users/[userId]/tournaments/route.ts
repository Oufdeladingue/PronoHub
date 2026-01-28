import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth-helpers'
import { UserRole } from '@/types'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params
    const supabase = await createClient()

    // Vérifier que l'utilisateur est super admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!isSuperAdmin(profile?.role as UserRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const adminClient = createAdminClient()

    // Récupérer les tournois où l'utilisateur est participant
    const { data: participations, error: partError } = await adminClient
      .from('tournament_participants')
      .select('tournament_id')
      .eq('user_id', userId)

    if (partError) {
      console.error('Error fetching user participations:', partError)
      return NextResponse.json({ error: 'Error fetching participations' }, { status: 500 })
    }

    if (!participations || participations.length === 0) {
      return NextResponse.json({ success: true, tournaments: [] })
    }

    const tournamentIds = participations.map(p => p.tournament_id)

    // Récupérer les détails des tournois
    const { data: tournaments, error: tournError } = await adminClient
      .from('tournaments')
      .select(`
        id,
        name,
        slug,
        status,
        tournament_type,
        competition_id,
        custom_competition_id
      `)
      .in('id', tournamentIds)
      .order('created_at', { ascending: false })

    if (tournError) {
      console.error('Error fetching tournaments:', tournError)
      return NextResponse.json({ error: 'Error fetching tournaments' }, { status: 500 })
    }

    // Récupérer les noms des compétitions
    const competitionIds = tournaments?.filter(t => t.competition_id).map(t => t.competition_id) || []
    const customCompetitionIds = tournaments?.filter(t => t.custom_competition_id).map(t => t.custom_competition_id) || []

    const [competitionsResult, customCompetitionsResult] = await Promise.all([
      competitionIds.length > 0
        ? adminClient.from('competitions').select('id, name').in('id', competitionIds)
        : { data: [] },
      customCompetitionIds.length > 0
        ? adminClient.from('custom_competitions').select('id, name').in('id', customCompetitionIds)
        : { data: [] }
    ])

    const competitionsMap = new Map((competitionsResult.data || []).map(c => [c.id, c.name]))
    const customCompetitionsMap = new Map((customCompetitionsResult.data || []).map(c => [c.id, c.name]))

    // Vérifier si l'utilisateur a déjà un accès stats pour chaque tournoi
    const { data: statsAccess } = await adminClient
      .from('tournament_purchases')
      .select('tournament_id')
      .eq('user_id', userId)
      .eq('purchase_type', 'stats_access_tournament')
      .eq('status', 'completed')
      .in('tournament_id', tournamentIds)

    // Vérifier si l'utilisateur a un accès lifetime
    const { data: lifetimeAccess } = await adminClient
      .from('tournament_purchases')
      .select('id')
      .eq('user_id', userId)
      .eq('purchase_type', 'stats_access_lifetime')
      .eq('status', 'completed')
      .limit(1)

    const hasLifetime = (lifetimeAccess?.length || 0) > 0
    const tournamentStatsAccessSet = new Set((statsAccess || []).map(s => s.tournament_id))

    // Enrichir les tournois
    const enrichedTournaments = (tournaments || []).map(t => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      status: t.status,
      tournament_type: t.tournament_type,
      competition_name: t.custom_competition_id
        ? customCompetitionsMap.get(t.custom_competition_id) || 'Compétition personnalisée'
        : competitionsMap.get(t.competition_id) || 'Inconnue',
      has_stats_access: hasLifetime || tournamentStatsAccessSet.has(t.id)
    }))

    return NextResponse.json({
      success: true,
      tournaments: enrichedTournaments,
      has_lifetime_access: hasLifetime
    })

  } catch (error: any) {
    console.error('Error in admin user tournaments API:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
