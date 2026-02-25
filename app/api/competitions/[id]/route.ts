import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Endpoint optimisé pour récupérer une seule compétition par ID
// Beaucoup plus rapide que /api/competitions/active qui charge toutes les compétitions

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Vérifier l'authentification
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Non authentifié' },
        { status: 401 }
      )
    }

    // Vérifier si c'est une compétition custom (id commence par "custom_")
    if (id.startsWith('custom_')) {
      const customId = id.replace('custom_', '')

      const { data: customComp, error } = await supabase
        .from('custom_competitions')
        .select('*, custom_competition_matchdays(id, status)')
        .eq('id', customId)
        .eq('is_active', true)
        .single()

      if (error || !customComp) {
        return NextResponse.json(
          { success: false, error: 'Compétition non trouvée' },
          { status: 404 }
        )
      }

      // Compter les journées non terminées
      const matchdays = customComp.custom_competition_matchdays || []
      const pendingMatchdays = matchdays.filter(
        (md: { id: string; status: string }) => md.status !== 'completed'
      ).length
      const remainingMatchdays = pendingMatchdays > 0 ? pendingMatchdays : 10

      return NextResponse.json({
        success: true,
        competition: {
          id: `custom_${customComp.id}`,
          name: customComp.name,
          code: customComp.code,
          emblem: null,
          area_name: 'Best of Week',
          current_matchday: customComp.current_matchday || 1,
          current_season_start_date: customComp.created_at,
          current_season_end_date: null,
          is_active: customComp.is_active,
          remaining_matchdays: remainingMatchdays,
          remaining_matches: remainingMatchdays * (customComp.matches_per_matchday || 8),
          custom_emblem_white: customComp.custom_emblem_white ?? null,
          custom_emblem_color: customComp.custom_emblem_color ?? null,
          is_custom: true,
          custom_competition_id: customComp.id,
          competition_type: customComp.competition_type,
          matches_per_matchday: customComp.matches_per_matchday,
          season: customComp.season,
          description: customComp.description
        }
      })
    }

    // Compétition importée standard
    const competitionId = parseInt(id)
    if (isNaN(competitionId)) {
      return NextResponse.json(
        { success: false, error: 'ID de compétition invalide' },
        { status: 400 }
      )
    }

    // Récupérer la compétition et ses matchs en parallèle
    const [compResult, matchesResult] = await Promise.all([
      supabase
        .from('competitions')
        .select('*')
        .eq('id', competitionId)
        .eq('is_active', true)
        .single(),
      supabase
        .from('imported_matches')
        .select('matchday, status, utc_date, stage')
        .eq('competition_id', competitionId)
    ])

    if (compResult.error || !compResult.data) {
      return NextResponse.json(
        { success: false, error: 'Compétition non trouvée' },
        { status: 404 }
      )
    }

    const comp = compResult.data
    const allMatches = matchesResult.data || []
    const now = new Date()

    // Buffer de 30 minutes pour la clôture des pronostics (comme dans l'API start)
    const closingBuffer = 30 * 60 * 1000 // 30 minutes en ms
    const closingTime = new Date(now.getTime() + closingBuffer)

    // Calculer les stats de matchdays par paire (stage, matchday)
    // Pour gérer les knockouts où le matchday redémarre à 1 par stage
    const matchdayStats: Record<string, {
      total: number,
      finished: number,
      firstMatchDate: Date | null,
      allFinished: boolean,
      isPlayable: boolean // Basé sur la date du premier match, pas seulement le statut
    }> = {}

    allMatches.forEach((match: any) => {
      const key = `${match.stage || 'REGULAR_SEASON'}_${match.matchday ?? 'KO'}`
      if (!matchdayStats[key]) {
        matchdayStats[key] = {
          total: 0,
          finished: 0,
          firstMatchDate: null,
          allFinished: true,
          isPlayable: true
        }
      }
      matchdayStats[key].total++
      if (match.status === 'FINISHED') {
        matchdayStats[key].finished++
      } else {
        matchdayStats[key].allFinished = false
      }
      const matchDate = new Date(match.utc_date)
      if (!matchdayStats[key].firstMatchDate ||
          matchDate < matchdayStats[key].firstMatchDate!) {
        matchdayStats[key].firstMatchDate = matchDate
      }
    })

    // Déterminer si chaque journée est jouable basé sur la DATE du premier match
    // Une journée n'est PAS jouable si son premier match est déjà clôturé (< 30 min avant le coup d'envoi)
    // Cela évite les bugs quand les matchs ne sont pas marqués FINISHED dans la BDD
    Object.values(matchdayStats).forEach(stats => {
      if (stats.firstMatchDate) {
        // La journée est jouable seulement si le premier match n'est pas encore clôturé
        stats.isPlayable = stats.firstMatchDate > closingTime
      } else {
        // Pas de date de match = considérer comme jouable si pas encore terminé
        stats.isPlayable = !stats.allFinished
      }
    })

    // Compter les journées jouables (basé sur les dates, plus fiable que le statut)
    const playableMatchdaysCount = Object.values(matchdayStats)
      .filter(stats => stats.isPlayable).length

    const importedMatchdaysCount = Object.keys(matchdayStats).length
    const totalMatchdays = comp.total_matchdays || importedMatchdaysCount

    // remaining_matchdays = nombre de journées encore jouables
    const remainingMatchdays = playableMatchdaysCount

    const remainingMatchdayKeys = Object.entries(matchdayStats)
      .filter(([_, stats]) => stats.isPlayable)
      .map(([key]) => key)

    const remainingMatches = allMatches.filter(
      (m: any) => {
        const key = `${m.stage || 'REGULAR_SEASON'}_${m.matchday}`
        return remainingMatchdayKeys.includes(key) && m.status !== 'FINISHED'
      }
    ).length

    // Détecter si la compétition a des phases éliminatoires
    const KNOCKOUT_STAGES = ['PLAYOFFS', 'LAST_16', 'ROUND_OF_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'FINAL', 'THIRD_PLACE', 'LAST_32']
    const hasKnockoutStages = allMatches.some(
      (m: any) => m.stage && KNOCKOUT_STAGES.includes(m.stage)
    )

    return NextResponse.json({
      success: true,
      competition: {
        ...comp,
        remaining_matchdays: remainingMatchdays,
        remaining_matches: remainingMatches,
        has_knockout_stages: hasKnockoutStages,
      }
    })
  } catch (error: any) {
    console.error('Error fetching competition:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
