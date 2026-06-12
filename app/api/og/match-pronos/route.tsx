import { NextRequest, NextResponse } from 'next/server'
import satori from 'satori'
import sharp from 'sharp'
import path from 'path'
import fs from 'fs/promises'
import { createAdminClient } from '@/lib/supabase/server'
import { isKnockoutStage, type StageType } from '@/lib/stage-formatter'
import { calculatePoints, calculateKnockoutPoints, getWinnerSide, type PointsSettings } from '@/lib/scoring'

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

type Row = { name: string; ph: number; pa: number; status: 'exact' | 'correct' | 'wrong' | 'neutral'; points: number | null }

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
      supabase.from('tournaments').select('name, bonus_qualified, scoring_draw_with_default_prediction').eq('id', tournamentId).maybeSingle(),
      supabase
        .from('imported_matches')
        .select('home_team_name, away_team_name, home_team_crest, away_team_crest, home_score, away_score, home_score_90, away_score_90, winner_team_id, home_team_id, away_team_id, stage, utc_date, status')
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

    let rows: Row[] = []
    if (revealed) {
      const { data: preds } = await supabase
        .from('predictions')
        .select('user_id, predicted_home_score, predicted_away_score, is_default_prediction, predicted_qualifier')
        .eq('tournament_id', tournamentId)
        .eq('match_id', matchId)

      const userIds = [...new Set((preds || []).map((p) => p.user_id))]
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
          drawWithDefaultPrediction: tournament?.scoring_draw_with_default_prediction ?? 1,
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

      rows = (preds || []).map((p) => {
        const ph = p.predicted_home_score ?? 0
        const pa = p.predicted_away_score ?? 0
        const base: Row = { name: nameById.get(p.user_id) || 'Joueur', ph, pa, status: 'neutral', points: null }

        if (isFinished && settings) {
          // Score de référence : 90 min pour les phases à élimination, sinon score final
          const hs = (isKnockout && match.home_score_90 != null ? match.home_score_90 : match.home_score) as number
          const as = (isKnockout && match.away_score_90 != null ? match.away_score_90 : match.away_score) as number
          if (hs != null && as != null) {
            let res
            if (isKnockout && tournament?.bonus_qualified) {
              const winnerSide = getWinnerSide(match.winner_team_id, match.home_team_id, match.away_team_id)
              res = calculateKnockoutPoints(
                { predictedHomeScore: ph, predictedAwayScore: pa },
                { homeScore: hs, awayScore: as },
                (p.predicted_qualifier as 'home' | 'away' | null) || null,
                winnerSide,
                settings,
                isBonus,
                !!p.is_default_prediction,
                true,
              )
            } else {
              res = calculatePoints(
                { predictedHomeScore: ph, predictedAwayScore: pa },
                { homeScore: hs, awayScore: as },
                settings,
                isBonus,
                !!p.is_default_prediction,
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

    const MAX_ROWS = 6
    const extra = Math.max(0, rows.length - MAX_ROWS)
    const shown = rows.slice(0, MAX_ROWS)

    const [fr, fb, fblack, logo, homeCrest, awayCrest] = await Promise.all([
      loadFont(400),
      loadFont(700),
      loadFont(900),
      loadLocalImageAsBase64('images/logo.png'),
      fetchImageAsBase64(match.home_team_crest),
      fetchImageAsBase64(match.away_team_crest),
    ])

    // En-tête : score final / live / heure de coup d'envoi
    let scoreLabel: string
    if (isFinished || isLive) {
      scoreLabel = `${match.home_score ?? 0} - ${match.away_score ?? 0}`
    } else {
      const d = match.utc_date ? new Date(match.utc_date) : null
      scoreLabel = d
        ? d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
        : 'à venir'
    }
    const stateTag = isFinished ? 'Terminé' : isLive ? '● En direct' : 'À venir'
    const stateColor = isFinished ? COLORS.sub : isLive ? COLORS.red : COLORS.sub

    const statusColor = (s: Row['status']) => (s === 'exact' ? COLORS.gold : s === 'correct' ? COLORS.green : s === 'wrong' ? COLORS.red : COLORS.text)
    const borderColor = (s: Row['status']) => (s === 'neutral' ? COLORS.border : statusColor(s))

    // ---- Header ----
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
          ? [txt(name, { fontSize: '24px', fontWeight: 700, color: COLORS.text, maxWidth: '300px' }), ...(crest ? [img(crest, 52, 52)] : [])]
          : [...(crest ? [img(crest, 52, 52)] : []), txt(name, { fontSize: '24px', fontWeight: 700, color: COLORS.text, maxWidth: '300px' })]),
      ])

    const matchBar = el(
      'div',
      { flexDirection: 'column', alignItems: 'center', width: '100%', background: COLORS.card, borderRadius: '16px', padding: '14px 24px', gap: '6px' },
      [
        el('div', { alignItems: 'center', justifyContent: 'center', width: '100%', gap: '18px' }, [
          teamBlock(match.home_team_name || 'Domicile', homeCrest, 'flex-end'),
          txt(scoreLabel, { fontSize: '30px', fontWeight: 900, color: COLORS.orange, padding: '0 10px', whiteSpace: 'nowrap' }),
          teamBlock(match.away_team_name || 'Extérieur', awayCrest, 'flex-start'),
        ]),
        txt(stateTag, { fontSize: '16px', fontWeight: 700, color: stateColor }),
      ]
    )

    // ---- Lignes joueurs ----
    const playerRows = revealed
      ? shown.map((p) =>
          el('div', { alignItems: 'center', width: '100%', background: COLORS.card, borderRadius: '12px', padding: '8px 16px', gap: '14px', border: `2px solid ${borderColor(p.status)}` }, [
            el('div', { width: '36px', height: '36px', borderRadius: '50%', background: COLORS.orange, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }, [
              txt((p.name[0] || '?').toUpperCase(), { fontSize: '18px', fontWeight: 900, color: '#0f172a' }),
            ]),
            txt(p.name, { fontSize: '22px', fontWeight: 700, color: COLORS.text, flex: 1, overflow: 'hidden' }),
            el('div', { background: '#0f172a', borderRadius: '8px', padding: '5px 16px', alignItems: 'center', gap: '6px' }, [
              txt(`${p.ph}`, { fontSize: '23px', fontWeight: 900, color: statusColor(p.status) }),
              txt('-', { fontSize: '19px', color: COLORS.sub }),
              txt(`${p.pa}`, { fontSize: '23px', fontWeight: 900, color: statusColor(p.status) }),
            ]),
            // Points uniquement si match terminé
            ...(p.points !== null
              ? [
                  el('div', { width: '78px', justifyContent: 'flex-end' }, [
                    txt(`${p.points > 0 ? '+' : ''}${p.points} pts`, { fontSize: '19px', fontWeight: 900, color: statusColor(p.status) }),
                  ]),
                ]
              : []),
          ])
        )
      : [
          el('div', { width: '100%', justifyContent: 'center', alignItems: 'center', padding: '60px 0' }, [
            txt('🔒 Pronostics révélés 30 min avant le coup d’envoi', { fontSize: '24px', fontWeight: 700, color: COLORS.sub }),
          ]),
        ]

    if (revealed && extra > 0) {
      playerRows.push(el('div', { width: '100%', justifyContent: 'center', padding: '2px' }, [txt(`+ ${extra} autre${extra > 1 ? 's' : ''} joueur${extra > 1 ? 's' : ''}`, { fontSize: '18px', color: COLORS.sub })]))
    }

    // ---- Footer ----
    const footer = el('div', { width: '100%', justifyContent: 'space-between', alignItems: 'center' }, [
      txt(tournament?.name || 'PronoHub', { fontSize: '18px', color: COLORS.sub, maxWidth: '500px', overflow: 'hidden' }),
      txt('pronohub.club', { fontSize: '18px', fontWeight: 700, color: COLORS.orange }),
    ])

    const root = el(
      'div',
      { width: '1200px', height: '630px', flexDirection: 'column', background: COLORS.bg, padding: '26px 40px', gap: '12px' },
      [header, matchBar, el('div', { flexDirection: 'column', gap: '7px', width: '100%', flex: 1 }, playerRows), footer]
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
