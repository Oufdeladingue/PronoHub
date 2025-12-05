import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // Récupérer uniquement les compétitions déjà importées depuis la base de données locale
    const { data: competitions, error } = await supabase
      .from('competitions')
      .select('*')
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching imported competitions:', error)
      return NextResponse.json(
        { error: 'Failed to fetch imported competitions' },
        { status: 500 }
      )
    }

    // Formater les compétitions en utilisant total_matchdays de la table competitions
    const formattedCompetitions = competitions?.map((comp) => {
      return {
        id: comp.id,
        name: comp.name,
        code: comp.code,
        emblem: comp.emblem,
        area: comp.area_name,
        currentSeason: {
          startDate: comp.current_season_start_date,
          endDate: comp.current_season_end_date,
          currentMatchday: comp.current_matchday,
          totalMatchdays: comp.total_matchdays
        },
        isImported: true,
        isActive: comp.is_active,
        isEvent: comp.is_event || false,
        importedAt: comp.imported_at,
        lastUpdatedAt: comp.last_updated_at
      }
    }) || []

    return NextResponse.json({
      competitions: formattedCompetitions,
      count: formattedCompetitions.length
    })
  } catch (error: any) {
    console.error('Error in imported-competitions route:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
