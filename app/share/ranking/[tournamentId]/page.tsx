import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
const BASE = 'https://www.pronohub.club'

type Params = { tournamentId: string }
type Search = { mode?: string; matchday?: string }

async function getTournament(id: string) {
  try {
    const s = createAdminClient()
    const { data } = await s.from('tournaments').select('name').eq('id', id).maybeSingle()
    return data
  } catch {
    return null
  }
}

function ctxLabel(mode?: string, matchday?: string) {
  if (mode === 'teams') return 'par équipes'
  if (mode === 'matchday') return `Journée ${matchday}`
  return 'général'
}

function ogPath(tournamentId: string, sp: Search) {
  const md = sp.matchday ? `&matchday=${sp.matchday}` : ''
  return `/api/og/ranking?tournamentId=${tournamentId}&mode=${sp.mode || 'general'}${md}`
}

export async function generateMetadata({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Search> }): Promise<Metadata> {
  const { tournamentId } = await params
  const sp = await searchParams
  const t = await getTournament(tournamentId)
  const ctx = ctxLabel(sp.mode, sp.matchday)
  const title = `Classement ${ctx}${t?.name ? ' · ' + t.name : ''} | PronoHub`
  const description = 'Le classement des pronostiqueurs sur PronoHub.'
  const ogUrl = `${BASE}${ogPath(tournamentId, sp)}`
  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: ogUrl }], type: 'website', url: `${BASE}/share/ranking/${tournamentId}` },
    twitter: { card: 'summary_large_image', title, description, images: [ogUrl] },
  }
}

export default async function ShareRankingPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Search> }) {
  const { tournamentId } = await params
  const sp = await searchParams
  const t = await getTournament(tournamentId)
  const ctx = ctxLabel(sp.mode, sp.matchday)

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4 py-10" style={{ background: '#0f172a' }}>
      <a href="/" className="flex items-center gap-3">
        <img src="/images/logo.png" alt="PronoHub" className="h-10 w-auto" />
        <span className="text-2xl font-black text-white">PronoHub</span>
      </a>

      <h1 className="text-lg font-semibold text-slate-200 text-center">
        Classement {ctx}{t?.name ? ` · ${t.name}` : ''}
      </h1>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={ogPath(tournamentId, sp)}
        alt={`Classement ${ctx}`}
        className="w-full max-w-3xl rounded-2xl border border-slate-700 shadow-2xl"
      />

      <a href="/" className="px-6 py-3 rounded-xl font-bold text-slate-900 transition hover:opacity-90" style={{ background: '#ff9900' }}>
        Crée ton tournoi de pronos gratuit →
      </a>

      <p className="text-sm text-slate-400 text-center max-w-md">
        PronoHub — les tournois de pronostics foot entre amis. Défie tes potes, marque des points, débloque des trophées.
      </p>
    </div>
  )
}
