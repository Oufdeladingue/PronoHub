import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { generateBonusMatch } from '@/lib/scoring'
import { getStageOrder } from '@/lib/stage-formatter'

/**
 * Construit la map { journée_virtuelle -> ids imported_matches } pour un tournoi STANDARD.
 *
 * Réplique EXACTEMENT la logique d'affichage (app/api/tournament/data) : certaines compétitions
 * (Coupe du Monde, Euro, CL, coupes) redémarrent le `matchday` à 1 à chaque phase et distinguent
 * les tours par `stage`. On ordonne donc les paires (stage, matchday) par ordre de phase puis
 * matchday, et la Nème paire = journée N. Pour une ligue classique, virtual_matchday == matchday ;
 * pour une coupe : J1/J2/J3 = poules, J4 = 16es (LAST_32), J5 = 8es, J6 = quarts, etc.
 *
 * Sans ça, la génération bonus cherchait `matchday=4` → 0 match (les phases finales sont en
 * matchday=1) → aucun bonus en phase finale ; et la J1 ratissait à tort les 24 poules + 32 finales.
 */
async function buildStandardVirtualMatchdayMap(
  supabase: ReturnType<typeof createAdminClient>,
  tournament: any
): Promise<Map<number, string[]>> {
  const { data: allCompMatches } = await supabase
    .from('imported_matches')
    .select('id, stage, matchday, utc_date')
    .eq('competition_id', tournament.competition_id)

  // Borne saison (mêmes marges que la page opposition) : éviter la collision des numéros de journée
  // avec une autre saison ré-importée sous le même competition_id.
  const SEASON_MARGIN_MS = 21 * 24 * 60 * 60 * 1000
  const seasonStartMs = tournament.start_date ? new Date(tournament.start_date).getTime() - SEASON_MARGIN_MS : null
  const seasonEndMs = tournament.ending_date ? new Date(tournament.ending_date).getTime() + SEASON_MARGIN_MS : null
  const allMatches = (allCompMatches || []).filter((m: any) => {
    const t = new Date(m.utc_date).getTime()
    if (seasonStartMs != null && t < seasonStartMs) return false
    if (seasonEndMs != null && t > seasonEndMs) return false
    return true
  })

  const pairKey = (m: any) => `${m.stage || 'REGULAR_SEASON'}__${m.matchday ?? 1}`
  const pairs = new Map<string, { stage: string | null; matchday: number; order: number }>()
  for (const m of allMatches) {
    const key = pairKey(m)
    if (!pairs.has(key)) {
      pairs.set(key, { stage: m.stage || null, matchday: m.matchday ?? 1, order: getStageOrder((m.stage || null) as any) })
    }
  }
  const sortedPairs = Array.from(pairs.values()).sort((a, b) =>
    a.order !== b.order ? a.order - b.order : a.matchday - b.matchday
  )
  const virtualByKey = new Map<string, number>()
  sortedPairs.forEach((p, i) => virtualByKey.set(`${p.stage || 'REGULAR_SEASON'}__${p.matchday}`, i + 1))

  // Ordre stable (date puis id) → tirage bonus reproductible.
  const sorted = [...allMatches].sort((a: any, b: any) => {
    const ta = new Date(a.utc_date).getTime()
    const tb = new Date(b.utc_date).getTime()
    return ta !== tb ? ta - tb : String(a.id).localeCompare(String(b.id))
  })
  const map = new Map<number, string[]>()
  for (const m of sorted) {
    const vmd = virtualByKey.get(pairKey(m)) || (m.matchday ?? 1)
    if (!map.has(vmd)) map.set(vmd, [])
    map.get(vmd)!.push(m.id)
  }
  return map
}

/** ids des matchs d'une journée pour un tournoi CUSTOM (les journées sont définies explicitement). */
async function getCustomMatchIdsForMatchday(
  supabase: ReturnType<typeof createAdminClient>,
  tournament: any,
  matchday: number
): Promise<string[]> {
  const { data: matchdayData } = await supabase
    .from('custom_competition_matchdays')
    .select('id')
    .eq('custom_competition_id', tournament.custom_competition_id)
    .eq('matchday_number', matchday)
    .single()
  if (!matchdayData) return []

  const { data: customMatches } = await supabase
    .from('custom_competition_matches')
    .select('football_data_match_id')
    .eq('custom_matchday_id', matchdayData.id)

  const footballDataIds = (customMatches || [])
    .map((m: any) => m.football_data_match_id)
    .filter((id: any) => id !== null)
  if (footballDataIds.length === 0) return []

  const { data: importedMatches } = await supabase
    .from('imported_matches')
    .select('id')
    .in('football_data_match_id', footballDataIds)
  return (importedMatches || []).map((m: any) => m.id)
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  try {
    const supabase = await createClient()
    const supabaseAdmin = createAdminClient() // Client admin pour bypass RLS
    const { searchParams } = new URL(request.url)
    const matchday = searchParams.get('matchday')

    const { tournamentId } = await params

    // Récupérer le tournoi
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', tournamentId)
      .single()

    if (tournamentError || !tournament) {
      return NextResponse.json({ error: 'Tournoi non trouvé' }, { status: 404 })
    }

    // Vérifier si les matchs bonus sont activés
    if (!tournament.bonus_match) {
      return NextResponse.json({ bonusMatches: [] })
    }

    // Récupérer les bonus matches existants (avec client admin pour bypass RLS)
    const { data: existingBonusMatches, error: bonusError } = await supabaseAdmin
      .from('tournament_bonus_matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('matchday', { ascending: true })

    if (bonusError) console.error('[BONUS API] Error fetching bonus matches:', bonusError)

    // ⚠️ On ne TOUCHE JAMAIS aux journées déjà créées (bonus validés/comptés) — on n'insère que les manquantes.
    const existingMatchdays = new Set(existingBonusMatches?.map((bm: any) => bm.matchday) || [])

    // Déterminer les journées du tournoi
    let matchdaysToCheck: number[] = []
    const isCustomCompetition = !!tournament.custom_competition_id

    if (isCustomCompetition) {
      const { data: customMatchdays } = await supabase
        .from('custom_competition_matchdays')
        .select('matchday_number')
        .eq('custom_competition_id', tournament.custom_competition_id)
        .order('matchday_number', { ascending: true })

      matchdaysToCheck = customMatchdays?.map((md: any) => md.matchday_number) || []
    } else {
      const startMatchday = tournament.starting_matchday || 1
      const endMatchday = tournament.ending_matchday || (tournament.num_matchdays || 10)
      matchdaysToCheck = Array.from(
        { length: endMatchday - startMatchday + 1 },
        (_, i) => startMatchday + i
      )
    }

    // Source des matchs par journée : map virtuelle (standard) calculée une seule fois, ou lookup custom.
    const standardMap = isCustomCompetition ? null : await buildStandardVirtualMatchdayMap(supabaseAdmin, tournament)

    // Créer les bonus matches manquants (avec client admin pour bypass RLS)
    const newBonusMatches: any[] = []
    for (const md of matchdaysToCheck) {
      if (existingMatchdays.has(md)) continue

      const matchIds = isCustomCompetition
        ? await getCustomMatchIdsForMatchday(supabaseAdmin, tournament, md)
        : (standardMap!.get(md) || [])
      if (matchIds.length === 0) continue

      const selectedMatchId = generateBonusMatch(tournament.id, md, matchIds)
      const { data: bonusMatch, error } = await supabaseAdmin
        .from('tournament_bonus_matches')
        .insert({ tournament_id: tournament.id, matchday: md, match_id: selectedMatchId })
        .select()
        .single()

      if (error) console.error(`Erreur création bonus match J${md}:`, error)
      else if (bonusMatch) newBonusMatches.push(bonusMatch)
    }

    // Combiner existants et nouveaux
    const allBonusMatches = [...(existingBonusMatches || []), ...newBonusMatches]
      .sort((a, b) => a.matchday - b.matchday)

    // Si une journée spécifique est demandée
    if (matchday) {
      const bonusMatch = allBonusMatches.find((bm: any) => bm.matchday === parseInt(matchday))
      return NextResponse.json({ bonusMatch })
    }

    return NextResponse.json({ bonusMatches: allBonusMatches })

  } catch (error: any) {
    console.error('Erreur lors de la récupération des matchs bonus:', error)
    return NextResponse.json(
      { error: 'Erreur serveur', details: error.message },
      { status: 500 }
    )
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  try {
    const supabase = await createClient()
    const supabaseAdmin = createAdminClient() // Client admin pour bypass RLS
    const { tournamentId } = await params
    const { matchday } = await request.json()

    if (!matchday) {
      return NextResponse.json({ error: 'La journée est requise' }, { status: 400 })
    }

    // Récupérer le tournoi
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', tournamentId)
      .single()

    if (tournamentError || !tournament) {
      return NextResponse.json({ error: 'Tournoi non trouvé' }, { status: 404 })
    }

    // Vérifier si les matchs bonus sont activés
    if (!tournament.bonus_match) {
      return NextResponse.json({ error: 'Les matchs bonus ne sont pas activés pour ce tournoi' }, { status: 400 })
    }

    // Ne JAMAIS recréer un bonus existant (déjà validé/compté)
    const { data: existingBonus } = await supabaseAdmin
      .from('tournament_bonus_matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('matchday', matchday)
      .single()

    if (existingBonus) {
      return NextResponse.json({ bonusMatch: existingBonus })
    }

    // Récupérer les matchs de cette journée (même mapping que l'affichage : par stage en phase finale)
    const isCustomCompetition = !!tournament.custom_competition_id
    let matchIds: string[] = []

    if (isCustomCompetition) {
      matchIds = await getCustomMatchIdsForMatchday(supabaseAdmin, tournament, matchday)
    } else {
      const standardMap = await buildStandardVirtualMatchdayMap(supabaseAdmin, tournament)
      matchIds = standardMap.get(Number(matchday)) || []
    }

    if (matchIds.length === 0) {
      return NextResponse.json({ error: 'Aucun match trouvé pour cette journée' }, { status: 404 })
    }

    // Générer un match bonus aléatoire (mais reproductible)
    const selectedMatchId = generateBonusMatch(tournamentId, matchday, matchIds)

    // Insérer le match bonus (avec client admin pour bypass RLS)
    const { data: bonusMatch, error: insertError } = await supabaseAdmin
      .from('tournament_bonus_matches')
      .insert({
        tournament_id: tournamentId,
        matchday,
        match_id: selectedMatchId
      })
      .select()
      .single()

    if (insertError) {
      return NextResponse.json({ error: 'Erreur lors de la création du match bonus' }, { status: 500 })
    }

    return NextResponse.json({ bonusMatch })

  } catch (error: any) {
    console.error('Erreur lors de la création du match bonus:', error)
    return NextResponse.json(
      { error: 'Erreur serveur', details: error.message },
      { status: 500 }
    )
  }
}
