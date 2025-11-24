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

    // Pour chaque compétition, compter les journées restantes et la popularité
    const competitionsWithStats = await Promise.all(
      (competitions || []).map(async (comp) => {
        // Utiliser total_matchdays de la base de données (qui inclut les matchs à élimination)
        const totalMatchdays = comp.total_matchdays || 0

        // Si current_matchday est null ou 0, utiliser 1 comme valeur par défaut
        let currentMatchday = comp.current_matchday || 1

        // Vérifier si le premier match de la journée actuelle commence dans moins de 2 heures
        const { data: firstMatch } = await supabase
          .from('imported_matches')
          .select('utc_date')
          .eq('competition_id', comp.id)
          .eq('matchday', currentMatchday)
          .order('utc_date', { ascending: true })
          .limit(1)
          .single()

        if (firstMatch?.utc_date) {
          const now = new Date()
          const matchTime = new Date(firstMatch.utc_date)
          const hoursUntilMatch = (matchTime.getTime() - now.getTime()) / (1000 * 60 * 60)

          // Si le premier match commence dans moins de 2 heures, exclure cette journée
          if (hoursUntilMatch < 2) {
            currentMatchday = currentMatchday + 1
          }
        }

        // Calculer les journées restantes: total - journée de départ + 1 (inclure la journée de départ)
        const remainingMatchdays = totalMatchdays > 0
          ? Math.max(0, totalMatchdays - currentMatchday + 1)
          : 0

        // Compter les matchs restants (seulement ceux qui ont été importés)
        const { count } = await supabase
          .from('imported_matches')
          .select('*', { count: 'exact', head: true })
          .eq('competition_id', comp.id)
          .gte('matchday', currentMatchday)

        // Compter le nombre de tournois utilisant cette compétition
        const { count: tournamentsCount } = await supabase
          .from('tournaments')
          .select('*', { count: 'exact', head: true })
          .eq('competition_id', comp.id)

        return {
          ...comp,
          remaining_matchdays: remainingMatchdays,
          remaining_matches: count || 0,
          tournaments_count: tournamentsCount || 0
        }
      })
    )

    // Trier par popularité (nombre de tournois) décroissant
    competitionsWithStats.sort((a, b) => b.tournaments_count - a.tournaments_count)

    // Marquer la plus populaire
    if (competitionsWithStats.length > 0 && competitionsWithStats[0].tournaments_count > 0) {
      competitionsWithStats[0].is_most_popular = true
    }

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
