import { createClient as createServerClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { calculatePoints, calculateKnockoutPoints, getWinnerSide } from '@/lib/scoring'
import { isKnockoutStage, getStageOrder, type StageType } from '@/lib/stage-formatter'

/**
 * Évolution du classement dans le temps — pour une visualisation animée (bump chart).
 *
 * Renvoie, pour chaque "étape" (chaque match terminé, ou chaque journée terminée selon
 * ?granularity=match|matchday), le rang + le total de points de chaque participant.
 *
 * Scoring identique à la route classement (barème global admin_settings, score 90' en knockout,
 * bonus qualifié, bonus avant-match par journée, pronos par défaut, tie-break points→exacts→bons).
 *
 * 1 seule requête : on charge tout une fois (pronos paginés) et on parcourt les matchs dans
 * l'ordre chronologique en accumulant les points. Aucun appel externe.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { tournamentId } = await params
    const granularity = new URL(request.url).searchParams.get('granularity') === 'match' ? 'match' : 'matchday'

    // 1. Tournoi + barème + participants (en parallèle)
    const [{ data: tournament }, { data: pointsSettingsData }, { data: participants }] = await Promise.all([
      supabase.from('tournaments').select('*').eq('id', tournamentId).single(),
      supabase.from('admin_settings').select('setting_key, setting_value')
        .in('setting_key', ['points_exact_score', 'points_correct_result', 'points_incorrect_result']),
      supabase.from('tournament_participants')
        .select('user_id, profiles(username, avatar)').eq('tournament_id', tournamentId),
    ])

    if (!tournament) return NextResponse.json({ error: 'Tournoi non trouvé' }, { status: 404 })
    if (!participants) return NextResponse.json({ error: 'Participants introuvables' }, { status: 500 })
    if (tournament.custom_competition_id) {
      // V1 : compétitions importées uniquement (la CDM/ligues). Custom (BOTW) = TODO.
      return NextResponse.json({ error: 'Évolution non disponible pour les compétitions custom (à venir)' }, { status: 400 })
    }

    const pointsSettings = {
      exactScore: parseInt(pointsSettingsData?.find(s => s.setting_key === 'points_exact_score')?.setting_value || '3'),
      correctResult: parseInt(pointsSettingsData?.find(s => s.setting_key === 'points_correct_result')?.setting_value || '1'),
      incorrectResult: parseInt(pointsSettingsData?.find(s => s.setting_key === 'points_incorrect_result')?.setting_value || '0'),
      drawWithDefaultPrediction: tournament.scoring_draw_with_default_prediction || 1,
    }

    const startMatchday = tournament.starting_matchday
    const endMatchday = tournament.ending_matchday
    if (!startMatchday || !endMatchday) {
      return NextResponse.json({ error: 'Le tournoi n\'a pas de journées définies' }, { status: 400 })
    }
    const matchdaysToCalculate = Array.from({ length: endMatchday - startMatchday + 1 }, (_, i) => startMatchday + i)

    // Bornes de saison (mêmes que la route classement)
    const tournamentStartDate = tournament.start_date ? new Date(tournament.start_date) : null
    const SEASON_END_MARGIN_MS = 21 * 24 * 60 * 60 * 1000
    const tournamentEndDate = tournament.ending_date
      ? new Date(new Date(tournament.ending_date).getTime() + SEASON_END_MARGIN_MS) : null

    // 2. Matchs de la compétition (avec journée virtuelle pour les phases knockout)
    const KNOCKOUT_STAGES_RANK = ['PLAYOFFS', 'LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'FINAL']
    const { data: knockoutCheck } = await supabase.from('imported_matches')
      .select('id').eq('competition_id', tournament.competition_id).in('stage', KNOCKOUT_STAGES_RANK).limit(1)
    const cols = 'id, matchday, stage, status, utc_date, home_score, away_score, home_score_90, away_score_90, winner_team_id, home_team_id, away_team_id, home_team_name, away_team_name, home_team_crest, away_team_crest'

    let matchesInRange: any[] = []
    if (knockoutCheck && knockoutCheck.length > 0) {
      const { data: all } = await supabase.from('imported_matches').select(cols).eq('competition_id', tournament.competition_id)
      const allM = all || []
      const pairKey = (m: any) => `${m.stage || 'REGULAR_SEASON'}__${m.matchday ?? 1}`
      const pairs = new Map<string, { stage: string | null; matchday: number; order: number }>()
      for (const m of allM) {
        const k = pairKey(m)
        if (!pairs.has(k)) pairs.set(k, { stage: m.stage || null, matchday: m.matchday ?? 1, order: getStageOrder((m.stage || null) as any) })
      }
      const sortedPairs = Array.from(pairs.values()).sort((a, b) => a.order !== b.order ? a.order - b.order : a.matchday - b.matchday)
      const vmap = new Map<string, number>()
      sortedPairs.forEach((p, i) => vmap.set(`${p.stage || 'REGULAR_SEASON'}__${p.matchday}`, i + 1))
      matchesInRange = allM
        .map((m: any) => ({ ...m, matchday: vmap.get(pairKey(m)) || m.matchday }))
        .filter((m: any) => matchdaysToCalculate.includes(m.matchday))
    } else {
      const { data: md } = await supabase.from('imported_matches').select(cols)
        .eq('competition_id', tournament.competition_id).in('matchday', matchdaysToCalculate)
      matchesInRange = md || []
    }

    // Matchs TERMINÉS dans la fenêtre, triés chronologiquement
    const finishedMatches = matchesInRange
      .filter((m: any) => {
        if (m.home_score === null || m.away_score === null) return false
        const d = new Date(m.utc_date)
        if (tournamentStartDate && d < tournamentStartDate) return false
        if (tournamentEndDate && d > tournamentEndDate) return false
        return true
      })
      .sort((a: any, b: any) => new Date(a.utc_date).getTime() - new Date(b.utc_date).getTime())

    // 3. Pronos (paginés — au-delà de 1000 lignes Supabase tronque)
    const allMatchIds = matchesInRange.map((m: any) => m.id)
    const predIds = allMatchIds.length ? allMatchIds : ['00000000-0000-0000-0000-000000000000']
    const allPredictions: any[] = []
    for (let from = 0; ; from += 1000) {
      const { data: chunk } = await supabase.from('predictions')
        .select('user_id, match_id, predicted_home_score, predicted_away_score, is_default_prediction, predicted_qualifier')
        .eq('tournament_id', tournamentId).in('match_id', predIds).range(from, from + 999)
      if (!chunk || chunk.length === 0) break
      allPredictions.push(...chunk)
      if (chunk.length < 1000) break
    }
    // prono par (user, match)
    const predByUserMatch = new Map<string, any>()
    for (const p of allPredictions) predByUserMatch.set(`${p.user_id}_${p.match_id}`, p)

    // 4. Matchs bonus
    const { data: bonusMatches } = await supabase.from('tournament_bonus_matches')
      .select('match_id').eq('tournament_id', tournamentId)
    const bonusMatchIds = new Set((bonusMatches || []).map((b: any) => b.match_id))

    // Helper scoring unifié (identique à la route classement)
    const scoreOne = (prediction: any, match: any) => {
      const isBonusMatch = bonusMatchIds.has(match.id)
      const isDefault = prediction.is_default_prediction || false
      const isKnockout = match.stage && isKnockoutStage(match.stage as StageType)
      const pred = { predictedHomeScore: prediction.predicted_home_score, predictedAwayScore: prediction.predicted_away_score }
      if (isKnockout && tournament.bonus_qualified) {
        const h = match.home_score_90 != null ? match.home_score_90 : match.home_score
        const a = match.away_score_90 != null ? match.away_score_90 : match.away_score
        return calculateKnockoutPoints(pred, { homeScore: h, awayScore: a }, prediction.predicted_qualifier || null,
          getWinnerSide(match.winner_team_id, match.home_team_id, match.away_team_id), pointsSettings, isBonusMatch, isDefault, true)
      } else if (isKnockout) {
        const h = match.home_score_90 != null ? match.home_score_90 : match.home_score
        const a = match.away_score_90 != null ? match.away_score_90 : match.away_score
        return calculatePoints(pred, { homeScore: h, awayScore: a }, pointsSettings, isBonusMatch, isDefault)
      }
      return calculatePoints(pred, { homeScore: match.home_score, awayScore: match.away_score }, pointsSettings, isBonusMatch, isDefault)
    }

    // Pré-calcul bonus avant-match : par journée, les matchs + leur dernier match terminé
    const matchesByMd: Record<number, any[]> = {}
    for (const m of finishedMatches) (matchesByMd[m.matchday] ||= []).push(m)
    // TOUS les matchs de la journée dans la fenêtre (finis ou non) — pour la complétude du bonus
    const inWindow = (m: any) => {
      const d = new Date(m.utc_date)
      if (tournamentStartDate && d < tournamentStartDate) return false
      if (tournamentEndDate && d > tournamentEndDate) return false
      return true
    }
    const allByMd: Record<number, any[]> = {}
    for (const m of matchesInRange) if (inWindow(m)) (allByMd[m.matchday] ||= []).push(m)

    // 5. Parcours chronologique → accumulation + snapshots
    const userIds = participants.map((p: any) => p.user_id)
    const cum: Record<string, { points: number; exact: number; correct: number }> = {}
    for (const uid of userIds) cum[uid] = { points: 0, exact: 0, correct: 0 }

    const steps: any[] = []
    const snapshot = (label: string, date: string, matchInfo?: any) => {
      const sorted = userIds.slice().sort((a, b) => {
        const A = cum[a], B = cum[b]
        return B.points !== A.points ? B.points - A.points : B.exact !== A.exact ? B.exact - A.exact : B.correct - A.correct
      })
      const ranks: Record<string, { rank: number; points: number }> = {}
      let currentRank = 1
      sorted.forEach((uid, i) => {
        if (i > 0) {
          const prev = cum[sorted[i - 1]], me = cum[uid]
          if (!(me.points === prev.points && me.exact === prev.exact && me.correct === prev.correct)) currentRank = i + 1
        }
        ranks[uid] = { rank: currentRank, points: cum[uid].points }
      })
      steps.push({ label, date, ...(matchInfo ? { match: matchInfo } : {}), ranks })
    }

    // Pour le bonus : un user gagne +1 si, à la fin d'une journée, TOUS ses pronos de la journée
    // sont non-défaut (et la journée a au moins 1 match terminé ici traité).
    const awardMatchdayBonus = (md: number) => {
      if (!tournament.early_prediction_bonus) return
      const dayAll = allByMd[md] || []
      if (dayAll.length === 0) return
      // bonus seulement si TOUTE la journée est terminée (comme la route classement)
      const complete = dayAll.every((m: any) => m.home_score !== null && m.away_score !== null)
      if (!complete) return
      for (const uid of userIds) {
        let allReal = true
        for (const m of dayAll) {
          const p = predByUserMatch.get(`${uid}_${m.id}`)
          if (!p || p.is_default_prediction) { allReal = false; break }
        }
        if (allReal) cum[uid].points += 1
      }
    }

    // index du dernier match (chronologique) de chaque journée
    const lastIdxOfMd: Record<number, number> = {}
    finishedMatches.forEach((m, i) => { lastIdxOfMd[m.matchday] = i })

    finishedMatches.forEach((match, idx) => {
      for (const uid of userIds) {
        const p = predByUserMatch.get(`${uid}_${match.id}`) || {
          predicted_home_score: 0, predicted_away_score: 0, is_default_prediction: true,
        }
        const r = scoreOne(p, match)
        cum[uid].points += r.points
        if (!p.is_default_prediction) { if (r.isExactScore) cum[uid].exact++; if (r.isCorrectResult) cum[uid].correct++ }
      }
      const isLastOfMd = lastIdxOfMd[match.matchday] === idx
      if (isLastOfMd) awardMatchdayBonus(match.matchday)

      const matchInfo = {
        matchday: match.matchday, utcDate: match.utc_date,
        homeName: match.home_team_name, awayName: match.away_team_name,
        homeCrest: match.home_team_crest, awayCrest: match.away_team_crest,
        homeScore: match.home_score, awayScore: match.away_score, stage: match.stage,
      }
      if (granularity === 'match') {
        snapshot(`Match ${idx + 1}`, match.utc_date, matchInfo)
      } else if (isLastOfMd) {
        snapshot(`J${match.matchday}`, match.utc_date, matchInfo)
      }
    })

    // Logo du tournoi (pour le coin de la vidéo) — même résolution que l'image OG du classement :
    // on privilégie le logo custom PronoHub (version blanche, lisible sur fond sombre) au crest brut.
    let tournamentEmblem: string | null = null
    if (tournament.custom_competition_id) {
      const { data: cc } = await supabase.from('custom_competitions')
        .select('custom_emblem_white, emblem_url').eq('id', tournament.custom_competition_id).maybeSingle()
      tournamentEmblem = cc?.custom_emblem_white || cc?.emblem_url || null
    } else if (tournament.competition_id) {
      const { data: comp } = await supabase.from('competitions')
        .select('emblem, custom_emblem_white').eq('id', tournament.competition_id).maybeSingle()
      tournamentEmblem = comp?.custom_emblem_white || comp?.emblem || null
    }

    return NextResponse.json({
      granularity,
      tournamentEmblem,
      users: participants.map((p: any) => ({
        id: p.user_id,
        name: (p.profiles as any)?.username || 'Inconnu',
        avatar: (p.profiles as any)?.avatar || 'avatar1',
      })),
      stepCount: steps.length,
      steps,
    }, { headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=120' } })
  } catch (e: any) {
    console.error('[Evolution API] error:', e)
    return NextResponse.json({ error: 'Erreur serveur', details: e.message }, { status: 500 })
  }
}
