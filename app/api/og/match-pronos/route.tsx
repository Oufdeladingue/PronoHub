import { NextRequest, NextResponse } from 'next/server'
import satori from 'satori'
import sharp from 'sharp'
import path from 'path'
import fs from 'fs/promises'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ---- helpers (police, images) ----
async function loadFont(weight: number): Promise<ArrayBuffer> {
  const urls: Record<number, string> = {
    400: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjp-Ek-_EeA.woff',
    700: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuI6fAZ9hjp-Ek-_EeA.woff',
    900: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuBWYAZ9hjp-Ek-_EeA.woff',
  }
  const res = await fetch(urls[weight] || urls[400])
  if (!res.ok) throw new Error('font load failed')
  return res.arrayBuffer()
}

async function fetchImageAsBase64(url: string | null): Promise<string | null> {
  if (!url) return null
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } })
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    const ct = res.headers.get('content-type') || 'image/png'
    return `data:${ct};base64,${Buffer.from(buf).toString('base64')}`
  } catch {
    return null
  }
}

async function loadLocalImageAsBase64(rel: string): Promise<string | null> {
  try {
    const buf = await fs.readFile(path.join(process.cwd(), 'public', rel))
    return `data:image/png;base64,${buf.toString('base64')}`
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
      supabase.from('tournaments').select('name').eq('id', tournamentId).maybeSingle(),
      supabase
        .from('imported_matches')
        .select('home_team_name, away_team_name, home_team_crest, away_team_crest, home_score, away_score, utc_date, status')
        .eq('id', matchId)
        .maybeSingle(),
    ])

    if (!match) {
      return NextResponse.json({ error: 'Match introuvable' }, { status: 404 })
    }

    // Confidentialité : les pronos ne sont révélés qu'au verrouillage (30 min avant le coup d'envoi)
    const kickoff = match.utc_date ? new Date(match.utc_date).getTime() : 0
    const revealAt = kickoff - 30 * 60 * 1000
    const revealed = Date.now() >= revealAt

    // Pronostics + profils
    let players: Array<{ name: string; ph: number; pa: number; status: 'exact' | 'correct' | 'wrong' | 'pending' }> = []
    const hasRealScore = match.home_score !== null && match.away_score !== null
    if (revealed) {
      const { data: preds } = await supabase
        .from('predictions')
        .select('user_id, predicted_home_score, predicted_away_score')
        .eq('tournament_id', tournamentId)
        .eq('match_id', matchId)

      const userIds = [...new Set((preds || []).map((p) => p.user_id))]
      const nameById = new Map<string, string>()
      if (userIds.length > 0) {
        const { data: profs } = await supabase.from('profiles').select('id, username').in('id', userIds)
        for (const p of profs || []) nameById.set(p.id, p.username || 'Joueur')
      }

      players = (preds || []).map((p) => {
        const ph = p.predicted_home_score ?? 0
        const pa = p.predicted_away_score ?? 0
        let st: 'exact' | 'correct' | 'wrong' | 'pending' = 'pending'
        if (hasRealScore) {
          const hs = match.home_score as number
          const as = match.away_score as number
          if (ph === hs && pa === as) st = 'exact'
          else {
            const po = ph > pa ? 'H' : ph < pa ? 'A' : 'D'
            const ro = hs > as ? 'H' : hs < as ? 'A' : 'D'
            st = po === ro ? 'correct' : 'wrong'
          }
        }
        return { name: nameById.get(p.user_id) || 'Joueur', ph, pa, status: st }
      })
      // exact d'abord, puis bons résultats, puis ratés
      const order = { exact: 0, correct: 1, wrong: 2, pending: 3 }
      players.sort((a, b) => order[a.status] - order[b.status] || a.name.localeCompare(b.name))
    }

    const MAX_ROWS = 9
    const extra = Math.max(0, players.length - MAX_ROWS)
    const shown = players.slice(0, MAX_ROWS)

    // Assets
    const [fr, fb, fblack, logo, homeCrest, awayCrest] = await Promise.all([
      loadFont(400),
      loadFont(700),
      loadFont(900),
      loadLocalImageAsBase64('images/logo.png'),
      fetchImageAsBase64(match.home_team_crest),
      fetchImageAsBase64(match.away_team_crest),
    ])

    const scoreLabel = hasRealScore ? `${match.home_score} - ${match.away_score}` : 'à venir'

    const statusColor = (s: string) => (s === 'exact' ? COLORS.gold : s === 'correct' ? COLORS.green : s === 'wrong' ? COLORS.red : COLORS.sub)

    // ---- Header : logo + titre ----
    const header = el('div', { alignItems: 'center', justifyContent: 'space-between', width: '100%' }, [
      el('div', { alignItems: 'center', gap: '14px' }, [
        ...(logo ? [img(logo, 44, 44)] : []),
        txt('PronoHub', { fontSize: '30px', fontWeight: 900, color: COLORS.text }),
      ]),
      txt('Les pronos du match', { fontSize: '22px', fontWeight: 700, color: COLORS.orange }),
    ])

    // ---- Bandeau match ----
    const teamBlock = (name: string, crest: string | null, align: 'flex-end' | 'flex-start') =>
      el('div', { alignItems: 'center', gap: '12px', flex: 1, justifyContent: align }, [
        ...(align === 'flex-end'
          ? [txt(name, { fontSize: '24px', fontWeight: 700, color: COLORS.text, maxWidth: '320px' }), ...(crest ? [img(crest, 52, 52)] : [])]
          : [...(crest ? [img(crest, 52, 52)] : []), txt(name, { fontSize: '24px', fontWeight: 700, color: COLORS.text, maxWidth: '320px' })]),
      ])

    const matchBar = el(
      'div',
      { alignItems: 'center', justifyContent: 'center', width: '100%', background: COLORS.card, borderRadius: '16px', padding: '18px 24px', gap: '18px' },
      [
        teamBlock(match.home_team_name || 'Domicile', homeCrest, 'flex-end'),
        txt(scoreLabel, { fontSize: '30px', fontWeight: 900, color: COLORS.orange, padding: '0 10px', whiteSpace: 'nowrap' }),
        teamBlock(match.away_team_name || 'Extérieur', awayCrest, 'flex-start'),
      ]
    )

    // ---- Lignes joueurs ----
    const rows = revealed
      ? shown.map((p) =>
          el('div', { alignItems: 'center', width: '100%', background: COLORS.card, borderRadius: '12px', padding: '10px 18px', gap: '14px', border: `2px solid ${statusColor(p.status)}` }, [
            // pastille initiale
            el('div', { width: '40px', height: '40px', borderRadius: '50%', background: COLORS.orange, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }, [
              txt((p.name[0] || '?').toUpperCase(), { fontSize: '20px', fontWeight: 900, color: '#0f172a' }),
            ]),
            txt(p.name, { fontSize: '22px', fontWeight: 700, color: COLORS.text, flex: 1, overflow: 'hidden' }),
            el('div', { background: '#0f172a', borderRadius: '8px', padding: '6px 16px', alignItems: 'center', gap: '6px' }, [
              txt(`${p.ph}`, { fontSize: '24px', fontWeight: 900, color: statusColor(p.status) }),
              txt('-', { fontSize: '20px', color: COLORS.sub }),
              txt(`${p.pa}`, { fontSize: '24px', fontWeight: 900, color: statusColor(p.status) }),
            ]),
          ])
        )
      : [
          el('div', { width: '100%', justifyContent: 'center', alignItems: 'center', padding: '60px 0' }, [
            txt('🔒 Pronostics révélés au coup d’envoi', { fontSize: '26px', fontWeight: 700, color: COLORS.sub }),
          ]),
        ]

    if (revealed && extra > 0) {
      rows.push(el('div', { width: '100%', justifyContent: 'center', padding: '4px' }, [txt(`+ ${extra} autre${extra > 1 ? 's' : ''} joueur${extra > 1 ? 's' : ''}`, { fontSize: '18px', color: COLORS.sub })]))
    }

    // ---- Footer ----
    const footer = el('div', { width: '100%', justifyContent: 'space-between', alignItems: 'center' }, [
      txt(tournament?.name || 'PronoHub', { fontSize: '18px', color: COLORS.sub, maxWidth: '500px', overflow: 'hidden' }),
      txt('pronohub.club', { fontSize: '18px', fontWeight: 700, color: COLORS.orange }),
    ])

    const root = el(
      'div',
      { width: '1200px', height: '630px', flexDirection: 'column', background: COLORS.bg, padding: '36px 44px', gap: '18px' },
      [header, matchBar, el('div', { flexDirection: 'column', gap: '10px', width: '100%', flex: 1 }, rows), footer]
    )

    const svg = await satori(root as any, {
      width: 1200,
      height: 630,
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
