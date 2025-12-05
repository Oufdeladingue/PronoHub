import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET - Récupérer les matchs disponibles pour une semaine donnée
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
    const weekStart = searchParams.get('week_start')
    const weekEnd = searchParams.get('week_end')

    if (!weekStart || !weekEnd) {
      return NextResponse.json({ error: 'Dates de début et fin requises' }, { status: 400 })
    }

    // Récupérer les matchs des compétitions actives dans cette plage de dates
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
        matchday,
        competition_id,
        competitions!inner(
          id,
          name,
          emblem,
          is_active
        )
      `)
      .gte('utc_date', `${weekStart}T00:00:00`)
      .lte('utc_date', `${weekEnd}T23:59:59`)
      .eq('competitions.is_active', true)
      .order('utc_date', { ascending: true })

    if (error) {
      console.error('Error fetching available matches:', error)
      return NextResponse.json({ error: 'Failed to fetch matches', details: error.message }, { status: 500 })
    }

    // Grouper par compétition pour un affichage plus clair
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
        matchday: match.matchday,
        competition_id: match.competition_id,
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
    console.error('Error in available-matches GET:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
