import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Mapping du nombre total de journées pour les compétitions avec phases knockout
// Calculé depuis COMPETITION_KNOCKOUT_MATCHDAYS (max des clés de knockout)
const COMPETITION_TOTAL_MATCHDAYS: Record<string, number> = {
  'CL': 17,   // 8 journées ligue + 9 knockout (jusqu'à finale)
  'EL': 17,   // 8 journées ligue + 9 knockout
  'ECL': 17,  // 8 journées ligue + 9 knockout
  'WC': 7,    // 3 journées groupes + 4 knockout
  'EC': 7,    // 3 journées groupes + 4 knockout
  'COPA': 6,  // 3 journées groupes + 3 knockout
  'CDL': 6,   // 6 tours (coupe directe)
}

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

    // Pour chaque compétition, calculer le nombre réel de journées
    const formattedCompetitions = await Promise.all(
      (competitions || []).map(async (comp) => {
        // Récupérer tous les matchdays distincts depuis imported_matches (avec stage)
        const { data: matchdaysData } = await supabase
          .from('imported_matches')
          .select('matchday, stage')
          .eq('competition_id', comp.id)
          .not('matchday', 'is', null)

        // Compter les paires (stage, matchday) distinctes
        // Pour les compétitions avec knockout, le matchday redémarre par stage
        const distinctPairs = new Set(
          (matchdaysData || []).map(m => `${m.stage || 'REGULAR_SEASON'}_${m.matchday}`)
        )
        const importedMatchdaysCount = distinctPairs.size

        // Pour les compétitions avec phases knockout, utiliser le mapping prédéfini
        // Sinon utiliser le max entre: journées importées, total_matchdays de la table
        let totalMatchdays: number | null = null

        // 1. Vérifier si on a un mapping knockout pour cette compétition
        if (comp.code && COMPETITION_TOTAL_MATCHDAYS[comp.code]) {
          totalMatchdays = COMPETITION_TOTAL_MATCHDAYS[comp.code]
        }
        // 2. Sinon utiliser le max entre journées importées et total_matchdays
        else if (importedMatchdaysCount > 0 || comp.total_matchdays) {
          totalMatchdays = Math.max(importedMatchdaysCount, comp.total_matchdays || 0)
        }

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
            totalMatchdays: totalMatchdays
          },
          isImported: true,
          isActive: comp.is_active,
          isEvent: comp.is_event || false,
          importedAt: comp.imported_at,
          lastUpdatedAt: comp.last_updated_at
        }
      })
    )

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
