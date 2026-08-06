import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/server'
import { translateTeamName } from '@/lib/translations'

export const dynamic = 'force-dynamic'

type Params = { tournamentId: string; matchId: string }

const BASE = 'https://www.pronohub.club'

async function getMatch(matchId: string) {
  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('imported_matches')
      .select('home_team_name, away_team_name, home_score, away_score, status')
      .eq('id', matchId)
      .maybeSingle()
    return data
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { tournamentId, matchId } = await params
  const match = await getMatch(matchId)
  const teams = match ? `${translateTeamName(match.home_team_name)} - ${translateTeamName(match.away_team_name)}` : 'du match'
  const title = `Pronos ${teams} | PronoHub`
  const description = 'Découvre les pronostics des joueurs sur PronoHub.'
  const ogUrl = `${BASE}/api/og/match-pronos?tournamentId=${tournamentId}&matchId=${matchId}`

  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: ogUrl }], type: 'website', url: `${BASE}/share/match/${tournamentId}/${matchId}` },
    twitter: { card: 'summary_large_image', title, description, images: [ogUrl] },
  }
}

export default async function SharePronosPage({ params }: { params: Promise<Params> }) {
  const { tournamentId, matchId } = await params
  const match = await getMatch(matchId)
  const teams = match ? `${translateTeamName(match.home_team_name)} — ${translateTeamName(match.away_team_name)}` : 'Pronostics du match'
  const ogUrl = `/api/og/match-pronos?tournamentId=${tournamentId}&matchId=${matchId}`

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4 py-10" style={{ background: '#0f172a' }}>
      <a href="/" className="flex items-center gap-3">
        <img src="/images/logo.png" alt="PronoHub" className="h-10 w-auto" />
        <span className="text-2xl font-black text-white">PronoHub</span>
      </a>

      <h1 className="text-lg font-semibold text-slate-200 text-center">{teams}</h1>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={ogUrl}
        alt={`Pronostics ${teams}`}
        className="w-full max-w-3xl rounded-2xl border border-slate-700 shadow-2xl"
      />

      <a
        href="/"
        className="px-6 py-3 rounded-xl font-bold text-slate-900 transition hover:opacity-90"
        style={{ background: '#ff9900' }}
      >
        Crée ton tournoi de pronos gratuit →
      </a>

      <p className="text-sm text-slate-400 text-center max-w-md">
        PronoHub — les tournois de pronostics foot entre amis. Défie tes potes, marque des points, débloque des trophées.
      </p>
    </div>
  )
}
