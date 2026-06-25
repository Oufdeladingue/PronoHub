'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchWithAuth, createClient } from '@/lib/supabase/client'
import { getAvatarUrl } from '@/lib/avatars'
import { translateTeamName } from '@/lib/translations'

interface EvoUser { id: string; name: string; avatar: string }
interface EvoMatch { matchday: number; utcDate: string; homeName?: string; awayName?: string; homeCrest?: string | null; awayCrest?: string | null; homeScore: number; awayScore: number; stage?: string | null }
interface EvoStep { label: string; date: string; match?: EvoMatch; ranks: Record<string, { rank: number; points: number }> }
interface EvoData { granularity: string; tournamentEmblem?: string | null; users: EvoUser[]; stepCount: number; steps: EvoStep[] }

// Proxy d'image same-origin (rasterise les SVG en PNG → dessinables sur canvas)
const proxyImg = (url?: string | null, size = 64) => url ? `/api/img-proxy?url=${encodeURIComponent(url)}&size=${size}` : ''

// Palette de couleurs distinctes pour les lignes
const COLORS = [
  '#ff9900', '#3b82f6', '#22c55e', '#ef4444', '#a855f7', '#ec4899', '#14b8a6', '#eab308',
  '#f97316', '#6366f1', '#10b981', '#f43f5e', '#8b5cf6', '#06b6d4', '#84cc16', '#d946ef', '#0ea5e9',
]

export default function RankingEvolution({ tournamentId, tournamentName }: { tournamentId: string; tournamentName?: string }) {
  const [granularity, setGranularity] = useState<'matchday' | 'match'>('matchday')
  const [data, setData] = useState<EvoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [pos, setPos] = useState(0)        // index d'étape "continu" (float) pour l'animation
  const [playing, setPlaying] = useState(false)
  const [msPerStep, setMsPerStep] = useState(700)
  const rafRef = useRef<number | null>(null)
  const lastTsRef = useRef<number | null>(null)

  // Export vidéo
  const [exporting, setExporting] = useState(false)
  const [exportPct, setExportPct] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const avatarsRef = useRef<Map<string, HTMLImageElement>>(new Map())
  const crestsRef = useRef<Map<string, HTMLImageElement>>(new Map())
  const logoRef = useRef<HTMLImageElement | null>(null)
  const emblemRef = useRef<HTMLImageElement | null>(null)

  // Mise en avant d'un user : survol (transitoire) ou case "m'isoler" (persistante)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isolateMe, setIsolateMe] = useState(false)
  const [hoveredUser, setHoveredUser] = useState<string | null>(null)   // survol souris (desktop, transitoire)
  const [selectedUser, setSelectedUser] = useState<string | null>(null) // tap (mobile/desktop, persistant)

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null))
  }, [])

  // Charger l'évolution
  useEffect(() => {
    let cancelled = false
    setLoading(true); setError(null); setPlaying(false)
    fetchWithAuth(`/api/tournaments/${tournamentId}/rankings/evolution?granularity=${granularity}`)
      .then(r => r.json())
      .then((d: any) => {
        if (cancelled) return
        if (d.error) { setError(d.error); setData(null) }
        else { setData(d); setPos(Math.max(0, (d.stepCount || 1) - 1)) } // démarre à la fin (état actuel)
      })
      .catch(e => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [tournamentId, granularity])

  // Précharger les images pour l'export canvas
  useEffect(() => {
    if (!data) return
    // avatars (same-origin)
    for (const u of data.users) {
      const url = getAvatarUrl(u.avatar)
      if (!avatarsRef.current.has(url)) {
        const img = new Image()
        img.src = url
        avatarsRef.current.set(url, img)
      }
    }
    // blasons : via le proxy → PNG same-origin (rasterise les SVG) → dessinables sur canvas
    for (const s of data.steps) {
      const m = s.match
      for (const c of [m?.homeCrest, m?.awayCrest]) {
        if (c && !crestsRef.current.has(c)) {
          const img = new Image()
          img.src = proxyImg(c, 64)
          crestsRef.current.set(c, img) // clé = URL d'origine
        }
      }
    }
    // logo de l'app (same-origin)
    if (!logoRef.current) {
      const lg = new Image()
      lg.src = '/images/logo.png'
      logoRef.current = lg
    }
    // emblème du tournoi (via proxy → PNG)
    if (data.tournamentEmblem && !emblemRef.current) {
      const em = new Image()
      em.src = proxyImg(data.tournamentEmblem, 80)
      emblemRef.current = em
    }
  }, [data])

  const stepCount = data?.stepCount || 0
  const maxPos = Math.max(0, stepCount - 1)

  // Boucle d'animation
  useEffect(() => {
    if (!playing) { if (rafRef.current) cancelAnimationFrame(rafRef.current); lastTsRef.current = null; return }
    const tick = (ts: number) => {
      if (lastTsRef.current == null) lastTsRef.current = ts
      const dt = ts - lastTsRef.current
      lastTsRef.current = ts
      setPos(prev => {
        const next = prev + dt / msPerStep
        if (next >= maxPos) { setPlaying(false); return maxPos }
        return next
      })
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [playing, msPerStep, maxPos])

  const play = () => {
    if (pos >= maxPos) setPos(0) // relancer du début
    setPlaying(true)
  }

  // Rangs par user (array sur les étapes)
  const ranksByUser = useMemo(() => {
    const m: Record<string, number[]> = {}
    if (!data) return m
    for (const u of data.users) m[u.id] = data.steps.map(s => s.ranks[u.id]?.rank ?? data.users.length)
    return m
  }, [data])

  if (loading) return <div className="text-center py-8 theme-text-secondary text-sm">Chargement de l'évolution…</div>
  if (error) return <div className="text-center py-8 text-red-400 text-sm">{error}</div>
  if (!data || stepCount === 0) return <div className="text-center py-8 theme-text-secondary text-sm">Pas encore de données (aucune journée terminée).</div>

  const N = data.users.length
  // Coordonnées virtuelles (SVG en viewBox, avatars en overlay % → responsive sans mesurer)
  const VW = 1000
  const padL = 70, padR = 130, padT = 30, rowH = 38
  const VH = padT * 2 + (N - 1) * rowH
  const xOf = (stepIdx: number) => padL + (maxPos === 0 ? 0 : (stepIdx / maxPos)) * (VW - padL - padR)
  const yOf = (rank: number) => padT + (N === 1 ? 0 : (rank - 1) * (VH - padT * 2) / (N - 1))

  // rang interpolé d'un user à la position continue `pos`
  const interpRank = (uid: string) => interpRankAt(uid, pos)
  function interpRankAt(uid: string, p: number) {
    const arr = ranksByUser[uid]; if (!arr) return N
    const i0 = Math.floor(p), i1 = Math.min(maxPos, Math.ceil(p)), f = p - i0
    return arr[i0] + (arr[i1] - arr[i0]) * f
  }

  // ---- Rendu sur canvas (pour l'export vidéo) ----
  const renderFrame = (ctx: CanvasRenderingContext2D, W: number, H: number, p: number) => {
    ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, W, H)
    // Coins supérieurs : nom du tournoi (gauche) + logo app (droite)
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'
    let nameX = 18
    const emblem = emblemRef.current
    if (emblem && emblem.complete && emblem.naturalWidth) {
      ctx.drawImage(emblem, 18, 8, 30, 30); nameX = 18 + 30 + 8
    }
    ctx.fillStyle = '#ff9900'; ctx.font = 'bold 18px sans-serif'
    ctx.fillText(tournamentName || 'Classement', nameX, 16)
    const logo = logoRef.current
    if (logo && logo.complete && logo.naturalWidth) {
      const lw = 120, lh = Math.round(lw * (logo.naturalHeight / logo.naturalWidth))
      ctx.drawImage(logo, W - 18 - lw, 12, lw, lh)
    }
    ctx.textBaseline = 'middle'
    const padL = 90, padR = 210, padT = granularity === 'match' ? 96 : 52, padB = 24
    const cxOf = (i: number) => padL + (maxPos ? i / maxPos : 0) * (W - padL - padR)
    const cyOf = (rank: number) => padT + (N === 1 ? 0 : (rank - 1) * (H - padT - padB) / (N - 1))
    ctx.textBaseline = 'middle'
    for (let i = 1; i <= N; i++) {
      const y = cyOf(i)
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke()
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'left'; ctx.fillText(String(i), 26, y)
    }
    const upTo = Math.floor(p)
    data!.users.forEach((u, ui) => {
      const arr = ranksByUser[u.id]
      ctx.globalAlpha = (focusUid != null && u.id !== focusUid) ? 0.08 : 1
      ctx.strokeStyle = COLORS[ui % COLORS.length]; ctx.lineWidth = focusUid === u.id ? 4.5 : 3; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.beginPath()
      for (let i = 0; i <= upTo; i++) { const X = cxOf(i), Y = cyOf(arr[i]); i === 0 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y) }
      ctx.lineTo(cxOf(p), cyOf(interpRankAt(u.id, p))); ctx.stroke()
    })
    ctx.globalAlpha = 1
    const si = Math.min(maxPos, Math.round(p))
    const step = data!.steps[si]
    const byR: Record<number, string[]> = {}
    for (const u of data!.users) { const r = step?.ranks[u.id]?.rank; if (r != null) (byR[r] ||= []).push(u.id) }
    const lastR = Object.keys(byR).length ? Math.max(...Object.keys(byR).map(Number)) : 0
    const podium = (r: number) => r === 1 ? '#FFD700' : r === 2 ? '#C0C0C0' : r === 3 ? '#CD7F32' : r === lastR ? '#EF4444' : '#e5e7eb'
    const nameOf = (id: string) => data!.users.find(u => u.id === id)?.name || ''
    const R = 15
    data!.users.forEach((u, ui) => {
      const grp = byR[step?.ranks[u.id]?.rank ?? -1] || [u.id]
      const k = grp.indexOf(u.id); const fan = (k - (grp.length - 1) / 2) * 20
      const isFocus = focusUid === u.id
      const rr = isFocus ? R + 3 : R
      const X = cxOf(p) + fan, Y = cyOf(interpRankAt(u.id, p))
      const img = avatarsRef.current.get(getAvatarUrl(u.avatar))
      ctx.globalAlpha = (focusUid != null && !isFocus) ? 0.18 : 1
      ctx.save(); ctx.beginPath(); ctx.arc(X, Y, rr, 0, Math.PI * 2); ctx.closePath(); ctx.clip()
      if (img && img.complete && img.naturalWidth) ctx.drawImage(img, X - rr, Y - rr, 2 * rr, 2 * rr)
      else { ctx.fillStyle = '#334155'; ctx.fillRect(X - rr, Y - rr, 2 * rr, 2 * rr) }
      ctx.restore()
      ctx.lineWidth = isFocus ? 3.5 : 2.5; ctx.strokeStyle = COLORS[ui % COLORS.length]; ctx.beginPath(); ctx.arc(X, Y, rr, 0, Math.PI * 2); ctx.stroke()
    })
    ctx.globalAlpha = 1
    ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'left'
    Object.entries(byR).forEach(([rs, uids]) => {
      const avg = uids.reduce((s, id) => s + interpRankAt(id, p), 0) / uids.length
      const rightFan = ((uids.length - 1) / 2) * 20
      ctx.globalAlpha = (focusUid != null && !uids.includes(focusUid)) ? 0.18 : 1
      ctx.fillStyle = podium(Number(rs))
      ctx.fillText(uids.map(nameOf).join(' / '), cxOf(p) + rightFan + R + 8, cyOf(avg))
    })
    ctx.globalAlpha = 1
    if (granularity === 'match' && step?.match) {
      const m = step.match
      const cy = 62, cs = 26, gap = 10
      const homeT = translateTeamName(m.homeName || ''), awayT = translateTeamName(m.awayName || '')
      const scoreT = `${m.homeScore} – ${m.awayScore}`
      const hC = crestsRef.current.get(m.homeCrest || ''); const aC = crestsRef.current.get(m.awayCrest || '')
      const hasH = !!(hC && hC.complete && hC.naturalWidth); const hasA = !!(aC && aC.complete && aC.naturalWidth)
      ctx.textBaseline = 'middle'; ctx.textAlign = 'left'
      ctx.font = 'bold 20px sans-serif'; const wHome = ctx.measureText(homeT).width, wAway = ctx.measureText(awayT).width
      ctx.font = 'bold 24px sans-serif'; const wScore = ctx.measureText(scoreT).width
      const total = wHome + gap + (hasH ? cs + gap : 0) + wScore + (hasA ? gap + cs : 0) + gap + wAway
      let x = (W - total) / 2
      ctx.fillStyle = '#f1f5f9'
      ctx.font = 'bold 20px sans-serif'; ctx.fillText(homeT, x, cy); x += wHome + gap
      if (hasH) { ctx.drawImage(hC!, x, cy - cs / 2, cs, cs); x += cs + gap }
      ctx.font = 'bold 24px sans-serif'; ctx.fillText(scoreT, x, cy); x += wScore
      if (hasA) { x += gap; ctx.drawImage(aC!, x, cy - cs / 2, cs, cs); x += cs }
      x += gap; ctx.font = 'bold 20px sans-serif'; ctx.fillText(awayT, x, cy)
      ctx.textAlign = 'center'; ctx.font = '13px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.55)'
      ctx.fillText(fmtDateLocal(m.utcDate), W / 2, cy + 22)
    }
  }

  const fmtDateLocal = (iso?: string) => iso
    ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : ''

  const exportVideo = async () => {
    const canvas = canvasRef.current; if (!canvas) return
    setExporting(true); setExportPct(0); setPlaying(false)
    const W = 1280, H = Math.min(1080, Math.max(440, 80 + N * 48))
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d'); if (!ctx) { setExporting(false); return }
    const endPos = maxPos // exporte TOUTE l'animation (du 1er au dernier step)
    // Capture DÉTERMINISTE : captureStream(0) + requestFrame() → on pousse exactement 1 frame
    // par dessin. Évite le désync entre le timer de capture auto (30 i/s) et notre boucle, qui
    // produisait des frames dupliquées/droppées = saccades.
    let stream = canvas.captureStream(0)
    let vtrack: any = stream.getVideoTracks()[0]
    const manualFrame = typeof vtrack?.requestFrame === 'function'
    if (!manualFrame) { stream = canvas.captureStream(30); vtrack = stream.getVideoTracks()[0] }
    let rec: MediaRecorder
    // VP8 d'abord : encodage nettement plus rapide que VP9 → moins de frames droppées → plus fluide.
    try { rec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8', videoBitsPerSecond: 8_000_000 }) }
    catch { try { rec = new MediaRecorder(stream, { mimeType: 'video/webm' }) } catch { rec = new MediaRecorder(stream) } }
    const chunks: BlobPart[] = []
    rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data) }
    const stopped = new Promise<void>(res => { rec.onstop = () => res() })
    // Durée d'export FIXE (~12 s max), indépendante de la vitesse d'affichage → court ET complet.
    // setInterval (et non requestAnimationFrame) : l'enregistrement continue même si l'onglet
    // perd le focus (rAF est mis en pause en arrière-plan → c'était la cause de la coupure).
    const playMs = Math.min(14000, Math.max(4000, endPos * 230))
    const totalMs = playMs + 1200 // pause finale ~1,2 s sur l'image finale
    renderFrame(ctx, W, H, 0); if (manualFrame) vtrack.requestFrame()
    rec.start(250) // flush périodique
    const t0 = performance.now()
    let lastBucket = -1
    await new Promise<void>(resolve => {
      const id = setInterval(() => {
        const el = performance.now() - t0
        renderFrame(ctx, W, H, Math.min(endPos, (el / playMs) * endPos))
        if (manualFrame) vtrack.requestFrame()
        // MAJ du % par paliers de 5 → très peu de re-renders React pendant l'enregistrement.
        const bucket = Math.floor(Math.min(100, (el / totalMs) * 100) / 5)
        if (bucket !== lastBucket) { lastBucket = bucket; setExportPct(bucket * 5) }
        if (el >= totalMs) { clearInterval(id); resolve() }
      }, 1000 / 30)
    })
    rec.stop(); await stopped
    const blob = new Blob(chunks, { type: rec.mimeType || 'video/webm' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'evolution-classement.webm'
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(a.href)
    setExporting(false); setExportPct(0)
  }

  const curStepIdx = Math.round(pos)
  const curStep = data.steps[curStepIdx]
  // Groupes par rang à l'étape courante → pseudos combinés "p1 / p2" en cas d'égalité parfaite
  const nameById: Record<string, string> = {}
  data.users.forEach(u => { nameById[u.id] = u.name })
  const byRank: Record<number, string[]> = {}
  for (const u of data.users) { const r = curStep?.ranks[u.id]?.rank; if (r != null) (byRank[r] ||= []).push(u.id) }
  const groupOf = (uid: string) => byRank[curStep?.ranks[uid]?.rank ?? -1] || [uid]
  const lastRank = Object.keys(byRank).length ? Math.max(...Object.keys(byRank).map(Number)) : 0
  // or = 1er, argent = 2e, bronze = 3e, rouge = dernier
  const podiumColor = (rank: number): string | undefined =>
    rank === 1 ? '#FFD700' : rank === 2 ? '#C0C0C0' : rank === 3 ? '#CD7F32' : rank === lastRank ? '#EF4444' : undefined
  // Ordre d'affichage (haut→bas) selon le rang interpolé
  const fmtDate = (iso?: string) => iso
    ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : ''

  // User mis en avant : survol souris > tap sélectionné > case "m'isoler". null = personne (tout normal).
  const focusUid = hoveredUser ?? selectedUser ?? (isolateMe ? currentUserId : null)
  const isDimmed = (uid: string) => focusUid != null && uid !== focusUid

  return (
    <div className="theme-secondary-bg border theme-border rounded-xl p-3 md:p-4">
      {/* Contrôles */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="flex rounded-lg overflow-hidden border theme-border">
          {(['matchday', 'match'] as const).map(g => (
            <button key={g} onClick={() => setGranularity(g)}
              className={`px-3 py-1.5 text-xs font-semibold ${granularity === g ? 'bg-[#ff9900] text-black' : 'theme-text-secondary'}`}>
              {g === 'matchday' ? 'Par journée' : 'Par match'}
            </button>
          ))}
        </div>
        <button onClick={() => (playing ? setPlaying(false) : play())}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#ff9900] text-black">
          {playing ? '⏸ Pause' : (pos >= maxPos ? '↻ Rejouer' : '▶ Lecture')}
        </button>
        <label className="flex items-center gap-1 text-xs theme-text-secondary">
          Vitesse
          <input type="range" min={150} max={1500} step={50} value={1650 - msPerStep}
            onChange={e => setMsPerStep(1650 - parseInt(e.target.value))} className="w-20 accent-[#ff9900]" />
        </label>
        {currentUserId && data.users.some(u => u.id === currentUserId) && (
          <label className="flex items-center gap-1.5 text-xs theme-text-secondary cursor-pointer select-none">
            <input type="checkbox" checked={isolateMe} onChange={e => setIsolateMe(e.target.checked)} className="accent-[#ff9900]" />
            M'isoler
          </label>
        )}
        <button onClick={exportVideo} disabled={exporting}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-700 text-white disabled:opacity-60">
          {exporting ? `⏺ Export… ${exportPct}%` : '⬇ Exporter (vidéo)'}
        </button>
        {selectedUser && (
          <button onClick={() => setSelectedUser(null)}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-full font-semibold bg-[#ff9900]/20 text-[#ff9900]">
            👁 {nameById[selectedUser] ?? ''} <span className="opacity-70">✕</span>
          </button>
        )}
        <span className="text-xs theme-text-secondary ml-auto">
          {curStep?.label} <span className="opacity-60">· {curStepIdx + 1}/{stepCount}</span>
        </span>
      </div>

      {/* Pendant l'export : on masque tout le graphe SVG on-screen (sinon chaque re-render le
          recompose et concurrence l'encodage = saccades). L'utilisateur regarde le canvas. */}
      {!exporting && (
        <div>
      {/* Match en cours (granularité par match) — 2 lignes : match puis date en-dessous */}
      {granularity === 'match' && curStep?.match && (
        <div className="flex flex-col items-center gap-0.5 mb-2 theme-text">
          <div className="flex items-center justify-center gap-1.5 w-full">
            <span className="flex-1 min-w-0 truncate text-right font-medium text-xs sm:text-sm">{translateTeamName(curStep.match.homeName || '')}</span>
            {curStep.match.homeCrest && <img src={curStep.match.homeCrest} alt="" className="w-5 h-5 sm:w-6 sm:h-6 object-contain shrink-0" />}
            <span className="font-bold tabular-nums px-1 text-sm sm:text-base shrink-0">{curStep.match.homeScore}–{curStep.match.awayScore}</span>
            {curStep.match.awayCrest && <img src={curStep.match.awayCrest} alt="" className="w-5 h-5 sm:w-6 sm:h-6 object-contain shrink-0" />}
            <span className="flex-1 min-w-0 truncate text-left font-medium text-xs sm:text-sm">{translateTeamName(curStep.match.awayName || '')}</span>
          </div>
          <span className="text-[11px] opacity-60 whitespace-nowrap">{fmtDate(curStep.match.utcDate)}</span>
        </div>
      )}

      {/* Scrubber */}
      <input type="range" min={0} max={maxPos} step={0.001} value={pos}
        onChange={e => { setPlaying(false); setPos(parseFloat(e.target.value)) }}
        className="w-full mb-3 accent-[#ff9900]" />

      {/* Graphe */}
      <div className="relative w-full" style={{ aspectRatio: `${VW} / ${VH}` }}>
        <svg viewBox={`0 0 ${VW} ${VH}`} className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
          {/* lignes de rang (repères) */}
          {Array.from({ length: N }, (_, i) => (
            <line key={i} x1={padL} y1={yOf(i + 1)} x2={VW - padR} y2={yOf(i + 1)} stroke="currentColor" strokeOpacity={0.08} />
          ))}
          {/* trajectoires (jusqu'à la position courante) */}
          {data.users.map((u, ui) => {
            const arr = ranksByUser[u.id]
            const pts: string[] = []
            const upTo = Math.floor(pos)
            for (let i = 0; i <= upTo; i++) pts.push(`${xOf(i)},${yOf(arr[i])}`)
            // segment partiel vers la position interpolée
            pts.push(`${xOf(pos)},${yOf(interpRank(u.id))}`)
            const dim = isDimmed(u.id)
            return <polyline key={u.id} points={pts.join(' ')} fill="none"
              stroke={COLORS[ui % COLORS.length]} strokeWidth={focusUid === u.id ? 4 : 2.5}
              strokeLinejoin="round" strokeLinecap="round" opacity={dim ? 0.07 : 0.85}
              style={{ transition: 'opacity 0.15s' }} />
          })}
        </svg>

        {/* Numéros de place (axe gauche) */}
        {Array.from({ length: N }, (_, i) => (
          <div key={`rank-${i}`} className="absolute text-xs font-bold theme-text-secondary tabular-nums"
            style={{ left: '4px', top: `${(yOf(i + 1) / VH) * 100}%`, transform: 'translateY(-50%)' }}>
            {i + 1}
          </div>
        ))}

        {/* Avatars (éventaillés horizontalement en cas d'égalité de rang) */}
        {data.users.map((u, ui) => {
          const grp = groupOf(u.id)
          const k = grp.indexOf(u.id)
          const fan = (k - (grp.length - 1) / 2) * 16
          const x = xOf(pos) + fan, y = yOf(interpRank(u.id))
          const dim = isDimmed(u.id)
          return (
            <div key={u.id} className="absolute cursor-pointer"
              style={{ left: `${(x / VW) * 100}%`, top: `${(y / VH) * 100}%`, transform: 'translate(-50%, -50%)',
                       opacity: dim ? 0.18 : 1, zIndex: focusUid === u.id ? 20 : 2, transition: 'opacity 0.15s' }}
              onMouseEnter={() => setHoveredUser(u.id)} onMouseLeave={() => setHoveredUser(null)}
              onClick={() => setSelectedUser(s => (s === u.id ? null : u.id))}>
              <img src={getAvatarUrl(u.avatar)} alt={u.name}
                className="block w-6 h-6 md:w-7 md:h-7 rounded-full border-2 object-cover bg-slate-700"
                style={{ borderColor: COLORS[ui % COLORS.length],
                         transform: focusUid === u.id ? 'scale(1.25)' : undefined, transition: 'transform 0.15s' }} />
            </div>
          )
        })}

        {/* Pseudos — combinés "pseudo1 / pseudo2 / …" si plusieurs à la même place */}
        {Object.entries(byRank).map(([rankStr, uids]) => {
          const avg = uids.reduce((s, id) => s + interpRank(id), 0) / uids.length
          const rightFan = ((uids.length - 1) / 2) * 16
          const x = xOf(pos) + rightFan, y = yOf(avg)
          const label = uids.map(id => nameById[id]).join(' / ')
          const dimLbl = focusUid != null && !uids.includes(focusUid)
          return (
            <div key={`lbl-${rankStr}`} className="absolute"
              style={{ left: `${(x / VW) * 100}%`, top: `${(y / VH) * 100}%`, transform: 'translateY(-50%)',
                       opacity: dimLbl ? 0.18 : 1, transition: 'opacity 0.15s' }}>
              <span className="inline-block ml-3 px-1 rounded text-[10px] md:text-xs font-semibold whitespace-nowrap
                               max-w-[150px] truncate theme-text bg-black/30 backdrop-blur-sm pointer-events-none"
                style={{ color: podiumColor(Number(rankStr)) }}>
                {label}
              </span>
            </div>
          )
        })}
      </div>
        </div>
      )}

      <p className="mt-2 text-[11px] theme-text-secondary opacity-70">
        ⬇ L'export génère une vidéo (.webm) de <b>toute l'animation</b> (~12 s). Garde l'onglet au premier plan pendant l'encodage.
      </p>

      {/* Canvas d'encodage — visible pendant l'export (un canvas display:none n'émet pas de frames) */}
      <canvas ref={canvasRef} className="mt-3 w-full rounded-lg border theme-border"
        style={{ display: exporting ? 'block' : 'none' }} />
    </div>
  )
}
