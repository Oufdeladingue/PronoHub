import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStageOrder, type StageType } from '@/lib/stage-formatter'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const competitionId = searchParams.get('competitionId')
    // Opt-in : ne renvoyer que la SAISON EN COURS. Sans champ `season` en base, deux saisons
    // ré-importées sous le même competition_id se mélangent (résultats de l'ancienne + matchs de la
    // nouvelle). La vue back-office active ce filtre ; l'échauffement (matchs futurs) n'en a pas besoin.
    const currentSeasonOnly = searchParams.get('currentSeasonOnly') === 'true'

    if (!competitionId) {
      return NextResponse.json(
        { error: 'Competition ID is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Récupérer les infos de la compétition
    const { data: competition, error: compError } = await supabase
      .from('competitions')
      .select('*')
      .eq('id', parseInt(competitionId))
      .single()

    if (compError || !competition) {
      return NextResponse.json(
        { error: 'Competition not found' },
        { status: 404 }
      )
    }

    // Récupérer les matchs de cette compétition (filtrés à la saison en cours si demandé)
    let matchesQuery = supabase
      .from('imported_matches')
      .select('*')
      .eq('competition_id', parseInt(competitionId))
    if (currentSeasonOnly && competition.current_season_start_date) {
      // La saison précédente se termine des mois avant le début de la nouvelle → un simple
      // ">= début de saison" isole proprement la saison en cours (knockouts futurs inclus).
      matchesQuery = matchesQuery.gte('utc_date', competition.current_season_start_date)
    }
    const { data: matches, error: matchesError } = await matchesQuery
      .order('utc_date', { ascending: true })

    if (matchesError) {
      console.error('Error fetching matches:', matchesError)
      return NextResponse.json(
        { error: 'Failed to fetch matches' },
        { status: 500 }
      )
    }

    // Journée VIRTUELLE : certaines compétitions (CDM, Ligue des Champions, coupes) remettent le
    // `matchday` à 1 à chaque phase. On ordonne les paires (stage, matchday) par ordre de phase puis
    // matchday, et la Nème paire = journée N. Sinon les tours à élimination (matchday=1) s'empilaient
    // dans la « J1 » avec la phase de championnat. Pour une ligue classique, journée virtuelle = matchday.
    const pairKey = (m: any) => `${m.stage || 'REGULAR_SEASON'}__${m.matchday ?? 1}`
    const pairs = new Map<string, { stage: string | null; matchday: number; order: number }>()
    for (const m of matches || []) {
      const key = pairKey(m)
      if (!pairs.has(key)) {
        pairs.set(key, { stage: m.stage || null, matchday: m.matchday ?? 1, order: getStageOrder((m.stage || null) as StageType) })
      }
    }
    const sortedPairs = [...pairs.values()].sort((a, b) => a.order !== b.order ? a.order - b.order : a.matchday - b.matchday)
    const virtualByKey = new Map<string, number>()
    sortedPairs.forEach((p, i) => virtualByKey.set(`${p.stage || 'REGULAR_SEASON'}__${p.matchday}`, i + 1))

    // Grouper les matchs par journée virtuelle
    const matchesByMatchday: Record<number, any[]> = {}
    const stagesByMatchday: Record<number, string | null> = {}
    for (const m of matches || []) {
      const vmd = virtualByKey.get(pairKey(m)) || (m.matchday ?? 1)
      if (!matchesByMatchday[vmd]) matchesByMatchday[vmd] = []
      matchesByMatchday[vmd].push(m)
      if (!(vmd in stagesByMatchday)) stagesByMatchday[vmd] = m.stage || null
    }
    for (const k of Object.keys(matchesByMatchday)) {
      matchesByMatchday[+k].sort((a, b) => new Date(a.utc_date).getTime() - new Date(b.utc_date).getTime())
    }

    // Grouper les journées par stage pour une meilleure navigation
    const matchdaysByStage: Record<string, number[]> = {}
    Object.entries(stagesByMatchday).forEach(([matchday, stage]) => {
      const stageKey = stage || 'REGULAR_SEASON'
      if (!matchdaysByStage[stageKey]) {
        matchdaysByStage[stageKey] = []
      }
      matchdaysByStage[stageKey].push(parseInt(matchday))
    })

    return NextResponse.json({
      competition,
      matches: matches || [],
      matchesByMatchday,
      totalMatches: matches?.length || 0,
      matchdays: Object.keys(matchesByMatchday).map(Number).sort((a, b) => a - b),
      stagesByMatchday,
      matchdaysByStage
    })
  } catch (error: any) {
    console.error('Error in competition-matches route:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
