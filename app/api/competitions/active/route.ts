import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // Vérifier l'authentification
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Non authentifié' },
        { status: 401 }
      )
    }

    // Récupérer les compétitions actives
    const { data: competitions, error } = await supabase
      .from('competitions')
      .select('*')
      .eq('is_active', true)
      .order('name')

    if (error) throw error

    // Pour chaque compétition, compter les journées restantes
    const competitionsWithStats = await Promise.all(
      (competitions || []).map(async (comp) => {
        // Récupérer toutes les journées de la compétition
        const { data: allMatchdays } = await supabase
          .from('imported_matches')
          .select('matchday')
          .eq('competition_id', comp.id)
          .order('matchday')

        // Obtenir toutes les journées uniques
        const allUniqueMatchdays = allMatchdays
          ? [...new Set(allMatchdays.map(m => m.matchday))].sort((a, b) => a - b)
          : []

        // Si current_matchday est null ou 0, utiliser la première journée
        const currentMatchday = comp.current_matchday || (allUniqueMatchdays.length > 0 ? allUniqueMatchdays[0] : 1)

        // Calculer les journées restantes (current_matchday inclus et suivantes)
        const remainingMatchdays = allUniqueMatchdays.filter(
          md => md >= currentMatchday
        )

        // Compter les matchs restants
        const { count } = await supabase
          .from('imported_matches')
          .select('*', { count: 'exact', head: true })
          .eq('competition_id', comp.id)
          .gte('matchday', currentMatchday)

        return {
          ...comp,
          remaining_matchdays: remainingMatchdays.length,
          remaining_matches: count || 0
        }
      })
    )

    return NextResponse.json({
      success: true,
      competitions: competitionsWithStats
    })
  } catch (error: any) {
    console.error('Error fetching active competitions:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
