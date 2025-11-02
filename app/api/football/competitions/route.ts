import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const FOOTBALL_DATA_API = 'https://api.football-data.org/v4'

export async function GET() {
  try {
    const apiKey = process.env.FOOTBALL_DATA_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Football Data API key not configured' },
        { status: 500 }
      )
    }

    // Récupérer les compétitions depuis Football-Data
    const response = await fetch(`${FOOTBALL_DATA_API}/competitions`, {
      headers: {
        'X-Auth-Token': apiKey,
      },
    })

    if (!response.ok) {
      throw new Error(`Football Data API error: ${response.statusText}`)
    }

    const data = await response.json()

    // Récupérer les compétitions déjà importées
    const supabase = await createClient()
    const { data: importedCompetitions } = await supabase
      .from('competitions')
      .select('id, imported_at, last_updated_at, is_active')

    // Enrichir les données avec les infos d'import
    const enrichedCompetitions = data.competitions.map((comp: any) => {
      const imported = importedCompetitions?.find((ic) => ic.id === comp.id)
      return {
        id: comp.id,
        name: comp.name,
        code: comp.code,
        emblem: comp.emblem,
        area: comp.area?.name,
        currentSeason: comp.currentSeason,
        isImported: !!imported,
        isActive: imported?.is_active ?? false,
        importedAt: imported?.imported_at,
        lastUpdatedAt: imported?.last_updated_at,
      }
    })

    return NextResponse.json({
      competitions: enrichedCompetitions,
      count: enrichedCompetitions.length,
    })
  } catch (error: any) {
    console.error('Error fetching competitions:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
