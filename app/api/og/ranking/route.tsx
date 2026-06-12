import { NextRequest, NextResponse } from 'next/server'
import satori from 'satori'
import sharp from 'sharp'
import path from 'path'
import fs from 'fs/promises'
import { createAdminClient } from '@/lib/supabase/server'
import { getAvatarUrl } from '@/lib/avatars'

export const dynamic = 'force-dynamic'

async function fetchWithTimeout(url: string, ms: number, opts: RequestInit = {}): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal })
  } finally {
    clearTimeout(t)
  }
}

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

let _fontsCache: [ArrayBuffer, ArrayBuffer, ArrayBuffer] | null = null
async function getFonts() {
  if (_fontsCache) return _fontsCache
  _fontsCache = await Promise.all([loadFont(400), loadFont(700), loadFont(900)]) as [ArrayBuffer, ArrayBuffer, ArrayBuffer]
  return _fontsCache
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

// Avatar (PNG/SVG) → PNG carré base64 (normalise les SVG d'équipes pour satori)
async function loadAvatarPng(url: string): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(url, 3500)
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    const png = await sharp(buf).resize(64, 64, { fit: 'cover' }).png().toBuffer()
    return `data:image/png;base64,${png.toString('base64')}`
  } catch {
    return null
  }
}

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
  bg: '#0f172a', card: '#1e293b', border: '#334155', text: '#f1f5f9', sub: '#94a3b8',
  orange: '#ff9900', gold: '#fbbf24', green: '#22c55e', red: '#ef4444',
}

type RRow = { rank: number; name: string; avatar: string | null; pointsStr: string; corrects: number; exacts: number; members?: number }

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tournamentId = searchParams.get('tournamentId')
    const mode = (searchParams.get('mode') || 'general') as 'general' | 'teams' | 'matchday'
    const matchdayParam = searchParams.get('matchday')
    if (!tournamentId) {
      return NextResponse.json({ error: 'tournamentId requis' }, { status: 400 })
    }
    const base = new URL(request.url).origin

    const supabase = createAdminClient()
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('name, competition_id')
      .eq('id', tournamentId)
      .maybeSingle()
    const { data: comp } = tournament?.competition_id
      ? await supabase.from('competitions').select('emblem, custom_emblem_white').eq('id', tournament.competition_id).maybeSingle()
      : { data: null }
    const compEmblemUrl = comp?.custom_emblem_white || comp?.emblem || null

    // Récupération des classements (réutilise les endpoints existants → calcul + égalités OK)
    let rows: RRow[] = []
    let isLive = false
    let matchesFinished = 0
    let matchesTotal = 0
    let unit = 'joueurs'

    if (mode === 'teams') {
      const [tRes, gRes] = await Promise.all([
        fetchWithTimeout(`${base}/api/tournaments/${tournamentId}/teams/rankings`, 8000),
        fetchWithTimeout(`${base}/api/tournaments/${tournamentId}/rankings`, 8000),
      ])
      const tJson = tRes.ok ? await tRes.json() : { rankings: [] }
      const gJson = gRes.ok ? await gRes.json() : {}
      isLive = !!gJson.hasInProgressMatches
      matchesFinished = gJson.matchesFinished || 0
      matchesTotal = gJson.matchesTotal || 0
      unit = 'équipes'
      rows = (tJson.rankings || []).map((t: any) => ({
        rank: t.rank,
        name: t.teamName || 'Équipe',
        avatar: t.teamAvatar ? `${base}/images/team-avatars/${t.teamAvatar}.svg` : null,
        // Moyenne de points par joueur (équité entre équipes d'effectifs différents)
        pointsStr: (t.avgPoints ?? 0).toFixed(1),
        corrects: t.totalCorrectResults ?? 0,
        exacts: t.totalExactScores ?? 0,
        members: t.memberCount ?? 0,
      }))
    } else {
      const url = mode === 'matchday' && matchdayParam
        ? `${base}/api/tournaments/${tournamentId}/rankings?matchday=${matchdayParam}`
        : `${base}/api/tournaments/${tournamentId}/rankings`
      const res = await fetchWithTimeout(url, 8000)
      const json = res.ok ? await res.json() : { rankings: [] }
      isLive = !!json.hasInProgressMatches
      matchesFinished = json.matchesFinished || 0
      matchesTotal = json.matchesTotal || 0
      rows = (json.rankings || []).map((p: any) => ({
        rank: p.rank,
        name: p.playerName || 'Joueur',
        avatar: `${base}${getAvatarUrl(p.avatar || 'avatar1')}`,
        pointsStr: `${p.totalPoints ?? 0}`,
        corrects: p.correctResults ?? 0,
        exacts: p.exactScores ?? 0,
      }))
    }

    const TWO_COLS = rows.length > 10
    const MAX_SHOWN = TWO_COLS ? 24 : 12
    const extra = Math.max(0, rows.length - MAX_SHOWN)
    const shown = rows.slice(0, MAX_SHOWN)
    const rowsPerCol = TWO_COLS ? Math.ceil(shown.length / 2) : shown.length

    // Charger les assets (polices, logo, emblème, avatars)
    const [fonts, logo, compEmblem, avatars] = await Promise.all([
      getFonts(),
      loadLogo(38),
      fetchImageAsBase64(compEmblemUrl),
      Promise.all(shown.map((r) => (r.avatar ? loadAvatarPng(r.avatar) : Promise.resolve(null)))),
    ])
    const [fr, fb, fblack] = fonts

    const contextLabel = mode === 'teams' ? 'Classement par équipes' : mode === 'matchday' ? `Classement · Journée ${matchdayParam}` : 'Classement général'

    // ---- Header ----
    const logoW = logo ? logo.w : 0
    const header = el('div', { height: '48px', alignItems: 'center', justifyContent: 'space-between', width: '100%' }, [
      el('div', { alignItems: 'center', width: `${logoW}px` }, logo ? [img(logo.src, logo.w, logo.h)] : []),
      el('div', { alignItems: 'center', justifyContent: 'center', gap: '14px', flex: 1, overflow: 'hidden' }, [
        ...(compEmblem ? [img(compEmblem, 42, 42)] : []),
        txt(tournament?.name || 'PronoHub', { fontSize: '28px', fontWeight: 900, color: COLORS.text, maxWidth: '720px', overflow: 'hidden', whiteSpace: 'nowrap' }),
      ]),
      el('div', { width: `${logoW}px` }),
    ])

    // ---- Bandeau contexte ----
    const CTX_H = 92
    const ctxBar = el('div', { height: `${CTX_H}px`, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', background: COLORS.card, borderRadius: '16px', gap: '6px' }, [
      el('div', { alignItems: 'center', gap: '12px' }, [
        txt(contextLabel, { fontSize: '26px', fontWeight: 900, color: COLORS.orange }),
        ...(isLive ? [el('div', { background: 'rgba(239,68,68,0.18)', borderRadius: '7px', padding: '3px 10px', alignItems: 'center' }, [txt('● Classement live', { fontSize: '15px', fontWeight: 700, color: COLORS.red })])] : []),
      ]),
      txt(`${matchesFinished} / ${matchesTotal} matchs joués     ·     ${rows.length} ${unit}`, { fontSize: '16px', color: COLORS.sub }),
    ])

    // ---- Ligne ----
    const ROW_H = 46
    const ROW_GAP = 7
    // Bordure colorée selon le rang : or (1er), argent (2e), bronze (3e), rouge (dernier·s)
    const maxRank = rows.length ? Math.max(...rows.map((r) => r.rank)) : 0
    const rankColor = (rank: number): string | null =>
      rank === 1 ? '#fbbf24' : rank === 2 ? '#cbd5e1' : rank === 3 ? '#cd7f32' : (rank === maxRank && maxRank > 3 ? COLORS.red : null)
    const makeRow = (r: RRow, idx: number) =>
      el('div', { height: `${ROW_H}px`, alignItems: 'center', width: '100%', background: COLORS.card, borderRadius: '10px', padding: '0 12px', gap: '10px', border: `2px solid ${rankColor(r.rank) || COLORS.border}` }, [
        txt(`${r.rank}`, { fontSize: '18px', fontWeight: 900, color: rankColor(r.rank) || COLORS.sub, width: '30px', justifyContent: 'center' }),
        el('div', { width: '32px', height: '32px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: COLORS.border, alignItems: 'center', justifyContent: 'center' },
          avatars[idx] ? [img(avatars[idx] as string, 32, 32)] : [txt((r.name[0] || '?').toUpperCase(), { fontSize: '15px', fontWeight: 900, color: COLORS.text })]),
        el('div', { alignItems: 'center', gap: '8px', flex: 1, overflow: 'hidden' }, [
          txt(r.name, { fontSize: '19px', fontWeight: 700, color: COLORS.text, overflow: 'hidden', whiteSpace: 'nowrap' }),
          ...(r.members !== undefined ? [txt(`· ${r.members} joueur${r.members > 1 ? 's' : ''}`, { fontSize: '14px', color: COLORS.sub, flexShrink: 0, whiteSpace: 'nowrap' })] : []),
        ]),
        el('div', { background: '#0f172a', borderRadius: '7px', padding: '3px 12px', flexShrink: 0 }, [txt(r.pointsStr, { fontSize: '20px', fontWeight: 900, color: COLORS.orange })]),
        el('div', { width: '38px', justifyContent: 'center', flexShrink: 0 }, [txt(`${r.corrects}`, { fontSize: '19px', fontWeight: 700, color: COLORS.green })]),
        el('div', { width: '38px', justifyContent: 'center', flexShrink: 0 }, [txt(`${r.exacts}`, { fontSize: '19px', fontWeight: 700, color: COLORS.gold })]),
      ])

    const colStyle = { flexDirection: 'column' as const, gap: `${ROW_GAP}px`, flex: 1 }
    let body: any
    if (TWO_COLS) {
      const left = shown.slice(0, rowsPerCol)
      const right = shown.slice(rowsPerCol)
      body = el('div', { width: '100%', gap: '14px' }, [
        el('div', colStyle, left.map((r, i) => makeRow(r, i))),
        el('div', colStyle, right.map((r, i) => makeRow(r, rowsPerCol + i))),
      ])
    } else {
      body = el('div', { ...colStyle, width: '100%' }, shown.map((r, i) => makeRow(r, i)))
    }
    const bodyH = rowsPerCol * ROW_H + (rowsPerCol - 1) * ROW_GAP

    const FOOTER_H = 26
    const footer = el('div', { height: `${FOOTER_H}px`, width: '100%', justifyContent: 'space-between', alignItems: 'center' }, [
      txt(extra > 0 ? `C’est qui le roi du Prono ?  ·  +${extra} autres` : 'C’est qui le roi du Prono ?', { fontSize: '17px', fontWeight: 700, color: COLORS.text }),
      txt('pronohub.club', { fontSize: '18px', fontWeight: 700, color: COLORS.orange }),
    ])

    // Légende des colonnes (pastilles colorées)
    const legendItem = (color: string, label: string) => el('div', { alignItems: 'center', gap: '6px' }, [
      el('div', { width: '12px', height: '12px', borderRadius: '50%', background: color, flexShrink: 0 }),
      txt(label, { fontSize: '15px', color: COLORS.sub }),
    ])
    const LEGEND_H = 22
    const legend = el('div', { height: `${LEGEND_H}px`, width: '100%', justifyContent: 'center', alignItems: 'center', gap: '28px' }, [
      legendItem(COLORS.orange, mode === 'teams' ? 'Moyenne de points' : 'Points'),
      legendItem(COLORS.green, 'Bons résultats'),
      legendItem(COLORS.gold, 'Scores exacts'),
    ])

    const PAD_V = 26
    const GAP = 12
    const WIDTH = 1200
    const HEIGHT = PAD_V * 2 + 48 + GAP + CTX_H + GAP + LEGEND_H + GAP + bodyH + GAP + FOOTER_H

    const root = el('div', { width: `${WIDTH}px`, height: `${HEIGHT}px`, flexDirection: 'column', background: COLORS.bg, padding: `${PAD_V}px 40px`, gap: `${GAP}px` }, [header, ctxBar, legend, body, footer])

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
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=120' },
    })
  } catch (error) {
    console.error('[OG-ranking] error:', error)
    return NextResponse.json({ error: 'Failed to generate image' }, { status: 500 })
  }
}
