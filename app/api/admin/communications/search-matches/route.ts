import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()

    // Vérifier que l'utilisateur est admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')

    if (!dateFrom || !dateTo) {
      return NextResponse.json({ error: 'date_from et date_to requis' }, { status: 400 })
    }

    const { data: matches, error } = await supabase
      .from('imported_matches')
      .select(`
        id,
        home_team_name,
        away_team_name,
        home_team_crest,
        away_team_crest,
        utc_date,
        status,
        competition_id,
        competitions!inner(
          id,
          name,
          emblem
        )
      `)
      .gte('utc_date', `${dateFrom}T00:00:00`)
      .lte('utc_date', `${dateTo}T23:59:59`)
      .order('utc_date', { ascending: true })

    if (error) {
      console.error('Error fetching matches:', error)
      return NextResponse.json({ error: 'Erreur lors de la recherche', details: error.message }, { status: 500 })
    }

    // Grouper par compétition
    const matchesByCompetition: Record<string, any[]> = {}

    matches?.forEach(match => {
      const compName = (match.competitions as any)?.name || 'Autre'
      if (!matchesByCompetition[compName]) {
        matchesByCompetition[compName] = []
      }
      matchesByCompetition[compName].push({
        id: match.id,
        home_team: match.home_team_name,
        away_team: match.away_team_name,
        home_team_crest: match.home_team_crest,
        away_team_crest: match.away_team_crest,
        utc_date: match.utc_date,
        status: match.status,
        competition_name: compName,
        competition_emblem: (match.competitions as any)?.emblem
      })
    })

    return NextResponse.json({
      success: true,
      matchesByCompetition,
      totalMatches: matches?.length || 0
    })
  } catch (error: any) {
    console.error('Error in search-matches GET:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
