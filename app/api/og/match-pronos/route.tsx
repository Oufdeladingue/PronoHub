import { NextRequest, NextResponse } from 'next/server'
import satori from 'satori'
import sharp from 'sharp'
import { Resvg } from '@resvg/resvg-js'
import path from 'path'
import fs from 'fs/promises'
import { createAdminClient } from '@/lib/supabase/server'
import { isKnockoutStage, isGroupStage, getStageLabel, formatGroupName, type StageType } from '@/lib/stage-formatter'
import { calculatePoints, calculateKnockoutPoints, getWinnerSide, type PointsSettings } from '@/lib/scoring'
import { translateTeamName } from '@/lib/translations'
import { getAvatarUrl } from '@/lib/avatars'
import { GET as rankingsGET } from '@/app/api/tournaments/[tournamentId]/rankings/route'

export const dynamic = 'force-dynamic'

// fetch avec timeout (évite qu'une URL lente bloque toute la génération)
async function fetchWithTimeout(url: string, ms: number, opts: RequestInit = {}): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal })
  } finally {
    clearTimeout(t)
  }
}

// ---- helpers (police, images) ----
async function loadFont(weight: number): Promise<ArrayBuffer> {
  const urls: Record<number, string> = {
    400: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjp-Ek-_EeA.woff',
    700: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuI6fAZ9hjp-Ek-_EeA.woff',
    900: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuBWYAZ9hjp-Ek-_EeA.woff',
  }
  const res = await fetchWithTimeout(urls[weight] || urls[400], 8000)
  if (!res.ok) throw new Error('font load failed')
  return res.arrayBuffer()
}

// Cache des polices en mémoire (process) : évite de re-fetch Google à chaque appel
let _fontsCache: [ArrayBuffer, ArrayBuffer, ArrayBuffer] | null = null
async function getFonts() {
  if (_fontsCache) return _fontsCache
  _fontsCache = await Promise.all([loadFont(400), loadFont(700), loadFont(900)]) as [ArrayBuffer, ArrayBuffer, ArrayBuffer]
  return _fontsCache
}

// Charge le logo PronoHub en respectant son ratio largeur/hauteur (cache mémoire)
let _logoCache: { src: string; w: number; h: number } | null | undefined = undefined
async function loadLogo(targetH: number): Promise<{ src: string; w: number; h: number } | null> {
  if (_logoCache !== undefined) return _logoCache
  try {
    const buf = await fs.readFile(path.join(process.cwd(), 'public', 'images/logo.png'))
    const meta = await sharp(buf).metadata()
    const ratio = (meta.width || 1) / (meta.height || 1)
    _logoCache = { src: `data:image/png;base64,${buf.toString('base64')}`, w: Math.round(targetH * ratio), h: targetH }
  } catch {
    _logoCache = null
  }
  return _logoCache
}

// Charge un avatar joueur depuis public/ (avatarN.png ou trophée), en base64, avec cache mémoire
const _avatarCache = new Map<string, string | null>()
async function loadAvatar(avatarId: string): Promise<string | null> {
  const id = avatarId || 'avatar1'
  if (_avatarCache.has(id)) return _avatarCache.get(id)!
  // getAvatarUrl renvoie un chemin public ('/avatars/avatarN.png' ou '/trophy/x.png')
  const rel = getAvatarUrl(id).replace(/^\//, '')
  let result: string | null = null
  try {
    const buf = await fs.readFile(path.join(process.cwd(), 'public', rel))
    result = `data:image/png;base64,${buf.toString('base64')}`
  } catch {
    result = null
  }
  _avatarCache.set(id, result)
  return result
}

// Classement du tournoi (rang + total de points par joueur) — appel IN-PROCESS du handler
// rankings (pas de HTTP vers soi-même → plus rapide et robuste derrière le proxy)
// asOf (ISO) : classement figé à l'issue de ce match (au lieu du classement actuel)
async function fetchRankingMap(tournamentId: string, asOf?: string | null): Promise<Map<string, { rank: number | null; totalPoints: number }>> {
  const map = new Map<string, { rank: number | null; totalPoints: number }>()
  try {
    const qs = asOf ? `?asOf=${encodeURIComponent(asOf)}` : ''
    const res = await rankingsGET(
      new Request(`http://internal/api/tournaments/${tournamentId}/rankings${qs}`) as any,
      { params: Promise.resolve({ tournamentId }) } as any,
    )
    if (res.ok) {
      const j = await res.json()
      for (const it of j?.rankings || []) map.set(it.playerId, { rank: it.rank ?? null, totalPoints: it.totalPoints ?? 0 })
    }
  } catch {
    // échec classement → tri alphabétique de repli
  }
  return map
}

async function fetchImageAsBase64(url: string | null): Promise<string | null> {
  if (!url) return null
  try {
    const res = await fetchWithTimeout(url, 3500, { next: { revalidate: 3600 } } as any)
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    const ct = res.headers.get('content-type') || 'image/png'
    return `data:${ct};base64,${Buffer.from(buf).toString('base64')}`
  } catch {
    return null
  }
}

// ---- mini-DSL pour construire les éléments satori ----
function el(type: string, style: Record<string, any>, children?: any): any {
  return { type, props: { style: { display: 'flex', ...style }, ...(children !== undefined ? { children } : {}) } }
}
function txt(text: string, style: Record<string, any>): any {
  return { type: 'div', props: { style: { display: 'flex', ...style }, children: text } }
}
function img(src: string, w: number, h: number, style: Record<string, any> = {}): any {
  return { type: 'img', props: { src, width: w, height: h, style } }
}

const COLORS = {
  bg: '#0f172a',
  card: '#1e293b',
  border: '#334155',
  text: '#f1f5f9',
  sub: '#94a3b8',
  orange: '#ff9900',
  gold: '#fbbf24',
  green: '#22c55e',
  red: '#ef4444',
}

type Row = { uid: string; name: string; avatar: string; ph: number; pa: number; status: 'exact' | 'correct' | 'wrong' | 'neutral'; points: number | null; isDefault: boolean; rank: number | null; totalPoints: number | null; rankDelta: number | null; predictedQualifier: 'home' | 'away' | null }

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tournamentId = searchParams.get('tournamentId')
    const matchId = searchParams.get('matchId')
    const sort = searchParams.get('sort') === 'classement' ? 'classement' : 'alpha'
    if (!tournamentId || !matchId) {
      return NextResponse.json({ error: 'tournamentId et matchId requis' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const [{ data: tournament }, { data: match }] = await Promise.all([
      supabase.from('tournaments').select('name, bonus_qualified').eq('id', tournamentId).maybeSingle(),
      supabase
        .from('imported_matches')
        .select('home_team_name, away_team_name, home_team_crest, away_team_crest, home_score, away_score, home_score_90, away_score_90, winner_team_id, home_team_id, away_team_id, stage, matchday, group_name, competition_id, utc_date, status')
        .eq('id', matchId)
        .maybeSingle(),
    ])

    if (!match) {
      return NextResponse.json({ error: 'Match introuvable' }, { status: 404 })
    }

    const isFinished = match.status === 'FINISHED' || match.status === 'AWARDED'
    const isLive = ['IN_PLAY', 'PAUSED', 'SUSPENDED'].includes(match.status || '')

    // Confidentialité : pronos révélés au verrouillage (30 min avant le coup d'envoi)
    const kickoff = match.utc_date ? new Date(match.utc_date).getTime() : 0
    const revealed = Date.now() >= kickoff - 30 * 60 * 1000

    // Batch A : requêtes indépendantes en parallèle (emblème compétition + participants + pronos
    // + barème + match bonus selon l'état du match)
    const noop = Promise.resolve({ data: null as any })
    const [compRes, partsRes, predsRes, psRes, bonusRes] = await Promise.all([
      supabase.from('competitions').select('emblem, custom_emblem_white').eq('id', match.competition_id).maybeSingle(),
      revealed ? supabase.from('tournament_participants').select('user_id').eq('tournament_id', tournamentId) : noop,
      revealed ? supabase.from('predictions').select('user_id, predicted_home_score, predicted_away_score, is_default_prediction, predicted_qualifier').eq('tournament_id', tournamentId).eq('match_id', matchId) : noop,
      (revealed && isFinished) ? supabase.from('admin_settings').select('setting_key, setting_value').in('setting_key', ['points_exact_score', 'points_correct_result', 'points_incorrect_result']) : noop,
      (revealed && isFinished) ? supabase.from('tournament_bonus_matches').select('match_id').eq('tournament_id', tournamentId).eq('match_id', matchId).maybeSingle() : noop,
    ])
    const compEmblemUrl = compRes.data?.custom_emblem_white || compRes.data?.emblem || null

    let rows: Row[] = []
    if (revealed) {
      // Participants + pronos déjà récupérés dans le Batch A
      const parts = partsRes.data as { user_id: string }[] | null
      const preds = predsRes.data as Array<{ user_id: string; predicted_home_score: number | null; predicted_away_score: number | null; is_default_prediction: boolean | null; predicted_qualifier: string | null }> | null

      const predByUser = new Map((preds || []).map((p) => [p.user_id, p]))
      let userIds = [...new Set((parts || []).map((p) => p.user_id))]
      if (userIds.length === 0) userIds = [...predByUser.keys()] // fallback si pas de participants listés

      // Batch B : profils (avatars/noms) + classement du tournoi, en parallèle
      const [profsRes, rankByUser] = await Promise.all([
        userIds.length > 0
          ? supabase.from('profiles').select('id, username, avatar').in('id', userIds)
          : Promise.resolve({ data: [] as Array<{ id: string; username: string | null; avatar: string | null }> }),
        sort === 'classement'
          ? fetchRankingMap(tournamentId, match.utc_date) // classement figé à l'issue de ce match
          : Promise.resolve(new Map<string, { rank: number | null; totalPoints: number }>()),
      ])
      const nameById = new Map<string, string>()
      const avatarById = new Map<string, string>()
      for (const p of (profsRes.data as Array<{ id: string; username: string | null; avatar: string | null }>) || []) {
        nameById.set(p.id, p.username || 'Joueur')
        avatarById.set(p.id, p.avatar || 'avatar1')
      }

      // Barème + match bonus (déjà récupérés dans le Batch A) si le match est terminé
      let settings: PointsSettings | null = null
      let isBonus = false
      let isKnockout = false
      if (isFinished) {
        const ps = psRes.data as Array<{ setting_key: string; setting_value: string }> | null
        const get = (k: string, d: number) => parseInt(ps?.find((s) => s.setting_key === k)?.setting_value ?? String(d)) || d
        settings = {
          exactScore: get('points_exact_score', 3),
          correctResult: get('points_correct_result', 1),
          incorrectResult: get('points_incorrect_result', 0),
          drawWithDefaultPrediction: 1, // pas de colonne dédiée → défaut (= correctResult)
        }
        isBonus = !!bonusRes.data
        isKnockout = !!(match.stage && isKnockoutStage(match.stage as StageType))
      }

      rows = userIds.map((uid) => {
        const p = predByUser.get(uid)
        const hasPred = !!p
        // "défaut" = pas de prono saisi (oubli) OU prono par défaut auto (0-0)
        const isDefault = !hasPred || !!p!.is_default_prediction
        const ph = hasPred ? (p!.predicted_home_score ?? 0) : 0
        const pa = hasPred ? (p!.predicted_away_score ?? 0) : 0
        const rk = rankByUser.get(uid)
        const base: Row = { uid, name: nameById.get(uid) || 'Joueur', avatar: avatarById.get(uid) || 'avatar1', ph, pa, status: 'neutral', points: null, isDefault, rank: rk?.rank ?? null, totalPoints: rk?.totalPoints ?? null, rankDelta: null, predictedQualifier: hasPred ? ((p!.predicted_qualifier as 'home' | 'away' | null) ?? null) : null }

        if (isFinished && settings) {
          const hs = (isKnockout && match.home_score_90 != null ? match.home_score_90 : match.home_score) as number
          const as = (isKnockout && match.away_score_90 != null ? match.away_score_90 : match.away_score) as number
          if (hs != null && as != null) {
            let res
            if (isKnockout && tournament?.bonus_qualified) {
              const winnerSide = getWinnerSide(match.winner_team_id, match.home_team_id, match.away_team_id)
              res = calculateKnockoutPoints(
                { predictedHomeScore: ph, predictedAwayScore: pa },
                { homeScore: hs, awayScore: as },
                (hasPred ? (p!.predicted_qualifier as 'home' | 'away' | null) : null) || null,
                winnerSide,
                settings,
                isBonus,
                isDefault,
                true,
              )
            } else {
              res = calculatePoints(
                { predictedHomeScore: ph, predictedAwayScore: pa },
                { homeScore: hs, awayScore: as },
                settings,
                isBonus,
                isDefault,
              )
            }
            base.points = res.points
            base.status = res.isExactScore ? 'exact' : res.isCorrectResult ? 'correct' : 'wrong'
          }
        }
        return base
      })

      // Incidence de CE match sur le classement (mode classement + match terminé).
      // rank/totalPoints = instantané À L'ISSUE de ce match (param asOf).
      // place "avant" = re-classement sur (total à l'issue − points du match) ; delta = avant − après
      if (sort === 'classement' && isFinished) {
        const ranked = rows.filter((r) => r.rank != null && r.totalPoints != null)
        const beforeOf = (r: Row) => (r.totalPoints ?? 0) - (r.points ?? 0)
        for (const r of rows) {
          if (r.rank == null || r.totalPoints == null) continue
          const before = beforeOf(r)
          const rankBefore = 1 + ranked.filter((o) => beforeOf(o) > before).length
          r.rankDelta = rankBefore - r.rank
        }
      }

      if (sort === 'classement') {
        // Tri par classement du tournoi (rang croissant), puis total de points, puis nom
        rows.sort((a, b) =>
          (a.rank ?? 99999) - (b.rank ?? 99999) ||
          (b.totalPoints ?? 0) - (a.totalPoints ?? 0) ||
          a.name.localeCompare(b.name)
        )
      } else {
        rows.sort((a, b) => a.name.localeCompare(b.name))
      }
    }

    // ---- Mise en page : 1 ou 2 colonnes selon le nombre de joueurs ----
    const TWO_COLS = revealed && rows.length > 8
    const MAX_SHOWN = TWO_COLS ? 22 : 10
    const extra = Math.max(0, rows.length - MAX_SHOWN)
    const shown = rows.slice(0, MAX_SHOWN)
    const rowsPerCol = TWO_COLS ? Math.ceil(shown.length / 2) : shown.length

    const [fonts, logo, compEmblem, homeCrest, awayCrest] = await Promise.all([
      getFonts(),
      loadLogo(38),
      fetchImageAsBase64(compEmblemUrl),
      fetchImageAsBase64(match.home_team_crest),
      fetchImageAsBase64(match.away_team_crest),
    ])
    const [fr, fb, fblack] = fonts

    // Avatars des joueurs affichés (depuis le disque, mis en cache)
    const avatarSrcById = new Map<string, string | null>()
    await Promise.all(shown.map(async (p) => { avatarSrcById.set(p.uid, await loadAvatar(p.avatar)) }))

    // En-tête : score final / live / heure de coup d'envoi
    const scoreLabel = isFinished || isLive ? `${match.home_score ?? 0} - ${match.away_score ?? 0}` : 'VS'
    const stateTag = isFinished ? 'Terminé' : isLive ? '● En direct' : 'À venir'
    const stateColor = isFinished ? COLORS.sub : isLive ? COLORS.red : COLORS.sub

    // Métadonnées du match : jour, heure, journée, poule
    const md = match.utc_date ? new Date(match.utc_date) : null
    const dayLabel = md ? md.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' }) : ''
    const dayCap = dayLabel ? dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1) : ''
    const timeLabel = md ? md.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }) : ''
    const grouped = !!(match.stage && isGroupStage(match.stage as StageType))
    const journeeLabel = grouped ? `Journée ${match.matchday ?? 1}` : (getStageLabel((match.stage as StageType) || null) || '')
    const pouleLabel = formatGroupName(match.group_name)
    const metaLine = [dayCap && timeLabel ? `${dayCap} · ${timeLabel}` : (dayCap || timeLabel), journeeLabel, pouleLabel].filter(Boolean).join('     ·     ')

    const statusColor = (s: Row['status']) => (s === 'exact' ? COLORS.gold : s === 'correct' ? COLORS.green : s === 'wrong' ? COLORS.red : COLORS.text)

    // ---- Header ----
    const logoW = logo ? logo.w : 0
    const header = el('div', { height: '48px', alignItems: 'center', justifyContent: 'space-between', width: '100%' }, [
      // gauche : logo de l'app
      el('div', { alignItems: 'center', width: `${logoW}px` }, logo ? [img(logo.src, logo.w, logo.h)] : []),
      // centre : emblème de la compétition + nom du tournoi
      el('div', { alignItems: 'center', justifyContent: 'center', gap: '14px', flex: 1, overflow: 'hidden' }, [
        ...(compEmblem ? [img(compEmblem, 42, 42)] : []),
        txt(tournament?.name || 'PronoHub', { fontSize: '28px', fontWeight: 900, color: COLORS.text, maxWidth: '720px', overflow: 'hidden', whiteSpace: 'nowrap' }),
      ]),
      // droite : espace pour équilibrer le centrage
      el('div', { width: `${logoW}px` }),
    ])

    // ---- Bandeau match ----
    const teamBlock = (name: string, crest: string | null, align: 'flex-end' | 'flex-start') =>
      el('div', { alignItems: 'center', gap: '12px', flex: 1, justifyContent: align }, [
        ...(align === 'flex-end'
          ? [txt(name, { fontSize: '24px', fontWeight: 700, color: COLORS.text, maxWidth: '300px' }), ...(crest ? [img(crest, 50, 50)] : [])]
          : [...(crest ? [img(crest, 50, 50)] : []), txt(name, { fontSize: '24px', fontWeight: 700, color: COLORS.text, maxWidth: '300px' })]),
      ])

    const MATCHBAR_H = 136
    const matchBar = el(
      'div',
      { height: `${MATCHBAR_H}px`, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', background: COLORS.card, borderRadius: '16px', gap: '6px' },
      [
        el('div', { alignItems: 'center', justifyContent: 'center', width: '100%', gap: '18px' }, [
          teamBlock(translateTeamName(match.home_team_name || 'Domicile'), homeCrest, 'flex-end'),
          txt(scoreLabel, { fontSize: '30px', fontWeight: 900, color: COLORS.orange, padding: '0 10px', whiteSpace: 'nowrap' }),
          teamBlock(translateTeamName(match.away_team_name || 'Extérieur'), awayCrest, 'flex-start'),
        ]),
        txt(stateTag, { fontSize: '15px', fontWeight: 700, color: stateColor }),
        ...(metaLine ? [txt(metaLine, { fontSize: '15px', color: COLORS.sub })] : []),
      ]
    )

    // ---- Ligne joueur ----
    const ROW_H = 46
    const ROW_GAP = 7
    const isClassement = sort === 'classement'
    // Flèche d'incidence du match sur le classement : ▲ vert (gagné), ▼ rouge (perdu), = (inchangé)
    // Triangle via SVG polygon (satori ne gère pas l'astuce CSS bordure-triangle)
    const tri = (dir: 'up' | 'down', color: string): any => ({
      type: 'svg',
      props: {
        width: 11, height: 9, viewBox: '0 0 11 9',
        children: { type: 'polygon', props: { points: dir === 'up' ? '5.5,0 11,9 0,9' : '0,0 11,0 5.5,9', fill: color } },
      },
    })
    const rankArrow = (delta: number | null): any[] => {
      if (delta == null) return []
      if (delta > 0) return [tri('up', COLORS.green)]
      if (delta < 0) return [tri('down', COLORS.red)]
      return [txt('=', { fontSize: '13px', fontWeight: 900, color: COLORS.sub })]
    }
    const makeRow = (p: Row) => {
      const avSrc = avatarSrcById.get(p.uid)
      const avatarEl = avSrc
        ? img(avSrc, 30, 30, { borderRadius: '50%', objectFit: 'cover', flexShrink: 0 })
        : el('div', { width: '30px', height: '30px', borderRadius: '50%', background: COLORS.orange, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }, [
            txt((p.name[0] || '?').toUpperCase(), { fontSize: '16px', fontWeight: 900, color: '#0f172a' }),
          ])
      return el('div', { height: `${ROW_H}px`, alignItems: 'center', width: '100%', background: COLORS.card, borderRadius: '10px', padding: '0 12px', gap: '9px', border: `2px solid ${COLORS.border}` }, [
        // Rang + flèche d'incidence du match (mode classement uniquement)
        ...(isClassement ? [el('div', { width: '46px', alignItems: 'center', justifyContent: 'flex-start', gap: '4px', flexShrink: 0 }, [
          txt(p.rank != null ? `${p.rank}` : '–', { fontSize: '18px', fontWeight: 900, color: COLORS.orange }),
          ...rankArrow(p.rankDelta),
        ])] : []),
        avatarEl,
        el('div', { alignItems: 'center', gap: '7px', flex: 1, overflow: 'hidden' }, [
          txt(p.name, { fontSize: '18px', fontWeight: 700, color: COLORS.text, overflow: 'hidden', whiteSpace: 'nowrap' }),
          ...(p.isDefault ? [el('div', { background: 'rgba(250,204,21,0.16)', borderRadius: '5px', padding: '1px 7px', flexShrink: 0 }, [txt('défaut', { fontSize: '12px', fontWeight: 700, color: COLORS.gold })])] : []),
        ]),
        // Total de points du tournoi (mode classement)
        ...(isClassement ? [el('div', { width: '70px', justifyContent: 'flex-end', flexShrink: 0 }, [txt(`${p.totalPoints ?? 0} pts`, { fontSize: '16px', fontWeight: 900, color: COLORS.text })])] : []),
        // Pronostic du match
        el('div', { background: '#0f172a', borderRadius: '7px', padding: '3px 11px', alignItems: 'center', gap: '5px', flexShrink: 0 }, [
          txt(`${p.ph}`, { fontSize: '19px', fontWeight: 900, color: statusColor(p.status) }),
          txt('-', { fontSize: '15px', color: COLORS.sub }),
          txt(`${p.pa}`, { fontSize: '19px', fontWeight: 900, color: statusColor(p.status) }),
        ]),
        // Équipe pronostiquée qualifiée (phases finales + bonus qualifié) : drapeau/logo, liseré orange
        ...(tournament?.bonus_qualified && p.predictedQualifier && (p.predictedQualifier === 'home' ? homeCrest : awayCrest)
          ? [img((p.predictedQualifier === 'home' ? homeCrest : awayCrest)!, 26, 26, { flexShrink: 0, borderRadius: '4px', objectFit: 'contain', border: `2px solid ${COLORS.orange}` })]
          : []),
        // Points gagnés sur le match (si terminé)
        ...(p.points !== null
          ? [el('div', { width: '58px', justifyContent: 'flex-end', flexShrink: 0 }, [txt(`${p.points > 0 ? '+' : ''}${p.points}`, { fontSize: '17px', fontWeight: 900, color: statusColor(p.status) })])]
          : []),
      ])
    }

    // ---- Corps : 1 ou 2 colonnes ----
    let body: any
    let bodyH: number
    if (!revealed) {
      bodyH = 160
      body = el('div', { height: `${bodyH}px`, width: '100%', justifyContent: 'center', alignItems: 'center' }, [
        txt('🔒 Pronostics révélés 30 min avant le coup d’envoi', { fontSize: '24px', fontWeight: 700, color: COLORS.sub }),
      ])
    } else {
      const colStyle = { flexDirection: 'column' as const, gap: `${ROW_GAP}px`, flex: 1 }
      if (TWO_COLS) {
        const left = shown.slice(0, rowsPerCol)
        const right = shown.slice(rowsPerCol)
        body = el('div', { width: '100%', gap: '14px' }, [
          el('div', colStyle, left.map((p) => makeRow(p))),
          el('div', colStyle, right.map((p) => makeRow(p))),
        ])
      } else {
        body = el('div', { ...colStyle, width: '100%' }, shown.map((p) => makeRow(p)))
      }
      bodyH = rowsPerCol * ROW_H + (rowsPerCol - 1) * ROW_GAP
    }

    // ---- Footer ----
    const FOOTER_H = 26
    const footer = el('div', { height: `${FOOTER_H}px`, width: '100%', justifyContent: 'space-between', alignItems: 'center' }, [
      txt(extra > 0 ? `C’est qui le roi du Prono ?  ·  +${extra} autres` : 'C’est qui le roi du Prono ?', { fontSize: '17px', fontWeight: 700, color: COLORS.text, maxWidth: '820px', overflow: 'hidden' }),
      txt('pronohub.club', { fontSize: '18px', fontWeight: 700, color: COLORS.orange }),
    ])

    const PAD_V = 26
    const GAP = 12
    const WIDTH = 1200
    const HEIGHT = PAD_V * 2 + 48 + GAP + MATCHBAR_H + GAP + bodyH + GAP + FOOTER_H

    const root = el(
      'div',
      { width: `${WIDTH}px`, height: `${HEIGHT}px`, flexDirection: 'column', background: COLORS.bg, padding: `${PAD_V}px 40px`, gap: `${GAP}px` },
      [header, matchBar, body, footer]
    )

    const svg = await satori(root as any, {
      width: WIDTH,
      height: HEIGHT,
      fonts: [
        { name: 'Inter', data: fr, weight: 400, style: 'normal' as const },
        { name: 'Inter', data: fb, weight: 700, style: 'normal' as const },
        { name: 'Inter', data: fblack, weight: 900, style: 'normal' as const },
      ],
    })

    // resvg-js (Rust) : rendu SVG→PNG bien plus rapide que sharp pour ce cas
    const png = new Resvg(svg, { fitTo: { mode: 'width', value: WIDTH } }).render().asPng()

    return new NextResponse(new Uint8Array(png), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=120',
      },
    })
  } catch (error) {
    console.error('[OG-match-pronos] error:', error)
    return NextResponse.json({ error: 'Failed to generate image' }, { status: 500 })
  }
}
