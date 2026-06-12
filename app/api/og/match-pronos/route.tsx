import { NextRequest, NextResponse } from 'next/server'
import satori from 'satori'
import sharp from 'sharp'
import path from 'path'
import fs from 'fs/promises'
import { createAdminClient } from '@/lib/supabase/server'
import { isKnockoutStage, isGroupStage, getStageLabel, formatGroupName, type StageType } from '@/lib/stage-formatter'
import { calculatePoints, calculateKnockoutPoints, getWinnerSide, type PointsSettings } from '@/lib/scoring'

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

type Row = { name: string; ph: number; pa: number; status: 'exact' | 'correct' | 'wrong' | 'neutral'; points: number | null; isDefault: boolean }

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tournamentId = searchParams.get('tournamentId')
    const matchId = searchParams.get('matchId')
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

    // Emblème de la compétition (pour l'en-tête)
    const { data: comp } = await supabase
      .from('competitions')
      .select('emblem, custom_emblem_white')
      .eq('id', match.competition_id)
      .maybeSingle()
    const compEmblemUrl = comp?.custom_emblem_white || comp?.emblem || null

    const isFinished = match.status === 'FINISHED' || match.status === 'AWARDED'
    const isLive = ['IN_PLAY', 'PAUSED', 'SUSPENDED'].includes(match.status || '')

    // Confidentialité : pronos révélés au verrouillage (30 min avant le coup d'envoi)
    const kickoff = match.utc_date ? new Date(match.utc_date).getTime() : 0
    const revealed = Date.now() >= kickoff - 30 * 60 * 1000

    let rows: Row[] = []
    if (revealed) {
      // Tous les participants du tournoi (pour inclure ceux qui ont oublié de pronostiquer)
      const { data: parts } = await supabase
        .from('tournament_participants')
        .select('user_id')
        .eq('tournament_id', tournamentId)

      const { data: preds } = await supabase
        .from('predictions')
        .select('user_id, predicted_home_score, predicted_away_score, is_default_prediction, predicted_qualifier')
        .eq('tournament_id', tournamentId)
        .eq('match_id', matchId)

      const predByUser = new Map((preds || []).map((p) => [p.user_id, p]))
      let userIds = [...new Set((parts || []).map((p) => p.user_id))]
      if (userIds.length === 0) userIds = [...predByUser.keys()] // fallback si pas de participants listés

      const nameById = new Map<string, string>()
      if (userIds.length > 0) {
        const { data: profs } = await supabase.from('profiles').select('id, username').in('id', userIds)
        for (const p of profs || []) nameById.set(p.id, p.username || 'Joueur')
      }

      // Barème + match bonus uniquement si le match est terminé (sinon : pas de points)
      let settings: PointsSettings | null = null
      let isBonus = false
      let isKnockout = false
      if (isFinished) {
        const { data: ps } = await supabase
          .from('admin_settings')
          .select('setting_key, setting_value')
          .in('setting_key', ['points_exact_score', 'points_correct_result', 'points_incorrect_result'])
        const get = (k: string, d: number) => parseInt(ps?.find((s) => s.setting_key === k)?.setting_value ?? String(d)) || d
        settings = {
          exactScore: get('points_exact_score', 3),
          correctResult: get('points_correct_result', 1),
          incorrectResult: get('points_incorrect_result', 0),
          drawWithDefaultPrediction: 1, // pas de colonne dédiée → défaut (= correctResult)
        }
        const { data: bonus } = await supabase
          .from('tournament_bonus_matches')
          .select('match_id')
          .eq('tournament_id', tournamentId)
          .eq('match_id', matchId)
          .maybeSingle()
        isBonus = !!bonus
        isKnockout = !!(match.stage && isKnockoutStage(match.stage as StageType))
      }

      rows = userIds.map((uid) => {
        const p = predByUser.get(uid)
        const hasPred = !!p
        // "défaut" = pas de prono saisi (oubli) OU prono par défaut auto (0-0)
        const isDefault = !hasPred || !!p!.is_default_prediction
        const ph = hasPred ? (p!.predicted_home_score ?? 0) : 0
        const pa = hasPred ? (p!.predicted_away_score ?? 0) : 0
        const base: Row = { name: nameById.get(uid) || 'Joueur', ph, pa, status: 'neutral', points: null, isDefault }

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

      if (isFinished) {
        rows.sort((a, b) => (b.points ?? 0) - (a.points ?? 0) || a.name.localeCompare(b.name))
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
    const borderColor = (s: Row['status']) => (s === 'neutral' ? COLORS.border : statusColor(s))

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
          teamBlock(match.home_team_name || 'Domicile', homeCrest, 'flex-end'),
          txt(scoreLabel, { fontSize: '30px', fontWeight: 900, color: COLORS.orange, padding: '0 10px', whiteSpace: 'nowrap' }),
          teamBlock(match.away_team_name || 'Extérieur', awayCrest, 'flex-start'),
        ]),
        txt(stateTag, { fontSize: '15px', fontWeight: 700, color: stateColor }),
        ...(metaLine ? [txt(metaLine, { fontSize: '15px', color: COLORS.sub })] : []),
      ]
    )

    // ---- Ligne joueur ----
    const ROW_H = 46
    const ROW_GAP = 7
    const makeRow = (p: Row) =>
      el('div', { height: `${ROW_H}px`, alignItems: 'center', width: '100%', background: COLORS.card, borderRadius: '10px', padding: '0 14px', gap: '10px', border: `2px solid ${borderColor(p.status)}` }, [
        // Pastille initiale (pas de rang : il peut y avoir des égalités)
        el('div', { width: '30px', height: '30px', borderRadius: '50%', background: COLORS.orange, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }, [
          txt((p.name[0] || '?').toUpperCase(), { fontSize: '16px', fontWeight: 900, color: '#0f172a' }),
        ]),
        el('div', { alignItems: 'center', gap: '7px', flex: 1, overflow: 'hidden' }, [
          txt(p.name, { fontSize: '19px', fontWeight: 700, color: COLORS.text, overflow: 'hidden', whiteSpace: 'nowrap' }),
          ...(p.isDefault ? [el('div', { background: 'rgba(250,204,21,0.16)', borderRadius: '5px', padding: '1px 7px', flexShrink: 0 }, [txt('défaut', { fontSize: '12px', fontWeight: 700, color: COLORS.gold })])] : []),
        ]),
        el('div', { background: '#0f172a', borderRadius: '7px', padding: '3px 12px', alignItems: 'center', gap: '5px', flexShrink: 0 }, [
          txt(`${p.ph}`, { fontSize: '20px', fontWeight: 900, color: statusColor(p.status) }),
          txt('-', { fontSize: '16px', color: COLORS.sub }),
          txt(`${p.pa}`, { fontSize: '20px', fontWeight: 900, color: statusColor(p.status) }),
        ]),
        ...(p.points !== null
          ? [el('div', { width: '64px', justifyContent: 'flex-end', flexShrink: 0 }, [txt(`${p.points > 0 ? '+' : ''}${p.points} pts`, { fontSize: '17px', fontWeight: 900, color: statusColor(p.status) })])]
          : []),
      ])

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

    const png = await sharp(Buffer.from(svg)).png().toBuffer()

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
