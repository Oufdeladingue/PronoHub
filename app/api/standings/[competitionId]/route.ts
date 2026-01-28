import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/standings/[competitionId]
 * Retourne le classement d'une compétition
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ competitionId: string }> }
) {
  try {
    const supabase = await createClient()
    const { competitionId } = await params

    if (!competitionId) {
      return NextResponse.json(
        { error: 'Competition ID required' },
        { status: 400 }
      )
    }

    // Récupérer le classement trié par position
    const { data: standings, error } = await supabase
      .from('competition_standings')
      .select('*')
      .eq('competition_id', parseInt(competitionId))
      .order('position', { ascending: true })

    if (error) {
      console.error('Error fetching standings:', error)
      return NextResponse.json(
        { error: 'Failed to fetch standings' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      competitionId: parseInt(competitionId),
      standings: standings || []
    })

  } catch (error) {
    console.error('Error in standings API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
