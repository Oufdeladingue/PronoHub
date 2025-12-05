import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET - Récupérer les matchs d'une journée avec jointure sur imported_matches
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; matchdayId: string }> }
) {
  try {
    const { matchdayId } = await params
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

    // Récupérer les matchs de cette journée avec football_data_match_id
    const { data: matches, error } = await supabase
      .from('custom_competition_matches')
      .select(`
        id,
        custom_matchday_id,
        football_data_match_id,
        imported_match_id,
        display_order,
        added_by,
        created_at,
        cached_home_team,
        cached_away_team,
        cached_home_logo,
        cached_away_logo,
        cached_utc_date,
        cached_competition_name
      `)
      .eq('custom_matchday_id', matchdayId)
      .order('display_order', { ascending: true })

    if (error) {
      console.error('Error fetching matchday matches:', error)
      return NextResponse.json({ error: 'Failed to fetch matches' }, { status: 500 })
    }

    // Récupérer les matchs importés via football_data_match_id (ID stable)
    const footballDataIds = (matches || [])
      .map((m: any) => m.football_data_match_id)
      .filter((id: any) => id !== null)

    let importedMatchesMap: Record<number, any> = {}
    if (footballDataIds.length > 0) {
      const { data: importedMatches } = await supabase
        .from('imported_matches')
        .select(`
          football_data_match_id,
          home_team_name,
          away_team_name,
          home_team_crest,
          away_team_crest,
          utc_date,
          status,
          home_score,
          away_score,
          matchday,
          competition_id,
          competitions (
            id,
            name,
            emblem
          )
        `)
        .in('football_data_match_id', footballDataIds)

      if (importedMatches) {
        importedMatchesMap = importedMatches.reduce((acc: any, im: any) => {
          acc[im.football_data_match_id] = im
          return acc
        }, {})
      }
    }

    // Formater les matchs pour un accès plus facile côté client
    // Utiliser les données de imported_matches via football_data_match_id, sinon fallback sur le cache
    const formattedMatches = (matches || []).map(match => {
      const im = importedMatchesMap[match.football_data_match_id]
      return {
        id: match.id,
        custom_matchday_id: match.custom_matchday_id,
        football_data_match_id: match.football_data_match_id,
        imported_match_id: match.imported_match_id,
        display_order: match.display_order,
        added_by: match.added_by,
        created_at: match.created_at,
        // Données du match importé (avec fallback sur le cache)
        home_team: im?.home_team_name || match.cached_home_team,
        away_team: im?.away_team_name || match.cached_away_team,
        home_logo: im?.home_team_crest || match.cached_home_logo,
        away_logo: im?.away_team_crest || match.cached_away_logo,
        utc_date: im?.utc_date || match.cached_utc_date,
        status: im?.status || 'SCHEDULED',
        home_score: im?.home_score,
        away_score: im?.away_score,
        matchday: im?.matchday,
        competition_id: im?.competition_id,
        competition_name: im?.competitions?.name || match.cached_competition_name,
        competition_emblem: im?.competitions?.emblem
      }
    })

    return NextResponse.json({
      success: true,
      matches: formattedMatches
    })
  } catch (error: any) {
    console.error('Error in matchday matches GET:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Ajouter un match à une journée
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; matchdayId: string }> }
) {
  try {
    const { matchdayId } = await params
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

    const body = await request.json()
    const { imported_match_id } = body

    if (!imported_match_id) {
      return NextResponse.json({ error: 'ID du match requis' }, { status: 400 })
    }

    // Vérifier que le match importé existe et récupérer ses infos pour le cache
    const { data: importedMatch, error: fetchError } = await supabase
      .from('imported_matches')
      .select('id, football_data_match_id, home_team_name, away_team_name, home_team_crest, away_team_crest, utc_date, competition_id')
      .eq('id', imported_match_id)
      .single()

    if (fetchError || !importedMatch) {
      console.error('Error fetching imported match:', fetchError)
      return NextResponse.json({ error: 'Match importé non trouvé' }, { status: 404 })
    }

    // Vérifier qu'on a bien le football_data_match_id (ID stable)
    if (!importedMatch.football_data_match_id) {
      console.error('Match without football_data_match_id:', imported_match_id)
      return NextResponse.json({ error: 'Match sans ID Football-Data' }, { status: 400 })
    }

    // Récupérer le nom de la compétition pour le cache
    const { data: competition } = await supabase
      .from('competitions')
      .select('name')
      .eq('id', importedMatch.competition_id)
      .single()

    // Vérifier le nombre de matchs actuels pour le display_order
    const { count } = await supabase
      .from('custom_competition_matches')
      .select('*', { count: 'exact', head: true })
      .eq('custom_matchday_id', matchdayId)

    // Ajouter le match avec le football_data_match_id (ID stable) et les infos cachées
    const { data: match, error } = await supabase
      .from('custom_competition_matches')
      .insert({
        custom_matchday_id: matchdayId,
        imported_match_id,
        football_data_match_id: importedMatch.football_data_match_id, // ID stable!
        display_order: (count || 0) + 1,
        added_by: user.id,
        // Remplir manuellement le cache
        cached_home_team: importedMatch.home_team_name,
        cached_away_team: importedMatch.away_team_name,
        cached_home_logo: importedMatch.home_team_crest,
        cached_away_logo: importedMatch.away_team_crest,
        cached_utc_date: importedMatch.utc_date,
        cached_competition_name: competition?.name || null
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Ce match est déjà dans cette journée' }, { status: 400 })
      }
      console.error('Error adding match:', error)
      return NextResponse.json({ error: 'Failed to add match', details: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      match,
      message: 'Match ajouté'
    })
  } catch (error: any) {
    console.error('Error in matchday matches POST:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Retirer un match d'une journée
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; matchdayId: string }> }
) {
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
    const matchId = searchParams.get('matchId')

    if (!matchId) {
      return NextResponse.json({ error: 'ID du match requis' }, { status: 400 })
    }

    const { error } = await supabase
      .from('custom_competition_matches')
      .delete()
      .eq('id', matchId)

    if (error) {
      console.error('Error removing match:', error)
      return NextResponse.json({ error: 'Failed to remove match' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Match retiré'
    })
  } catch (error: any) {
    console.error('Error in matchday matches DELETE:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
