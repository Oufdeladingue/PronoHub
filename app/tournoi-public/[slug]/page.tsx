import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { SeoHeader, SeoFooter } from '@/components/seo/PronosticsChrome'

export const dynamic = 'force-dynamic'
const BASE = 'https://www.pronohub.club'

interface PublicTournament {
  id: string
  name: string
  slug: string
  invite_code: string | null
  competition_name: string | null
  status: string
  players: number
  description: string | null
  startDate: string | null
}

async function getPublic(slug: string): Promise<PublicTournament | null> {
  try {
    const s = createAdminClient()
    const { data: t } = await s
      .from('tournaments')
      .select('id, name, slug, invite_code, competition_name, status, is_public, competition_id, custom_competition_id')
      .eq('slug', slug.toUpperCase())
      .eq('is_public', true)
      .maybeSingle()
    if (!t) return null

    const { count } = await s
      .from('tournament_participants')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', t.id)

    // Description (compétition custom) + date de début (1er match)
    let description: string | null = null
    let startDate: string | null = null
    if (t.custom_competition_id) {
      const { data: cc } = await s
        .from('custom_competitions')
        .select('description, custom_competition_matchdays(custom_competition_matches(cached_utc_date))')
        .eq('id', t.custom_competition_id)
        .maybeSingle()
      description = cc?.description || null
      const dates = (cc?.custom_competition_matchdays || [])
        .flatMap((md: any) => (md.custom_competition_matches || []).map((m: any) => m.cached_utc_date))
        .filter(Boolean)
        .sort()
      startDate = dates[0] || null
    } else if (t.competition_id) {
      const { data: m } = await s
        .from('imported_matches')
        .select('utc_date')
        .eq('competition_id', t.competition_id)
        .gte('utc_date', new Date().toISOString())
        .order('utc_date', { ascending: true })
        .limit(1)
        .maybeSingle()
      startDate = m?.utc_date || null
    }

    return { ...t, players: count || 0, description, startDate } as PublicTournament
  } catch {
    return null
  }
}

function fmtDate(iso: string): string {
  const d = new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  return d.charAt(0).toUpperCase() + d.slice(1)
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const t = await getPublic(slug)
  if (!t) return { title: 'Tournoi public | PronoHub', robots: { index: false, follow: true } }
  const title = `${t.name} — tournoi de pronos public gratuit | PronoHub`
  const description = t.description || `Rejoins « ${t.name} » : un tournoi de pronostics ouvert à tous, gratuit. Grimpe au classement !`
  const image = `${BASE}/api/og/ranking?tournamentId=${t.id}&mode=general`
  return {
    title,
    description,
    alternates: { canonical: `${BASE}/tournoi-public/${t.slug}` },
    openGraph: { title, description, url: `${BASE}/tournoi-public/${t.slug}`, type: 'website', images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  }
}

export default async function PublicTournamentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const t = await getPublic(slug)
  if (!t) notFound()

  const joinUrl = `/vestiaire/rejoindre?code=${encodeURIComponent(t.invite_code || t.slug)}`

  return (
    <div className="min-h-screen bg-[#0f172a] text-white">
      <SeoHeader />

      <section className="max-w-3xl mx-auto px-5 pt-8 pb-4 text-center">
        <span className="inline-block text-xs font-bold uppercase tracking-wide text-[#ff9900] bg-[#ff9900]/10 border border-[#ff9900]/30 rounded-full px-3 py-1 mb-4">
          Tournoi public — ouvert à tous
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight mb-3 text-balance">{t.name}</h1>

        {/* Description de la compétition (custom) */}
        {t.description && (
          <p className="text-slate-200 text-[16px] leading-relaxed mb-2">{t.description}</p>
        )}

        <p className="text-slate-400 text-[15px] leading-relaxed mb-3">
          Un tournoi de pronostics <strong className="text-white">gratuit</strong>, que tu peux rejoindre <strong className="text-white">seul</strong> — pas besoin d'amis pour commencer.
        </p>

        {/* Date de début + nombre de joueurs */}
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-sm text-slate-400 mb-6">
          {t.startDate && <span>🗓️ Début : <strong className="text-white">{fmtDate(t.startDate)}</strong></span>}
          {t.players > 1 && <span>👥 Déjà <strong className="text-white">{t.players}</strong> joueurs</span>}
          {t.status !== 'pending' && <span className="text-[#ff9900]">Rejoignable même en cours</span>}
        </div>

        <Link href={joinUrl} className="inline-block bg-[#ff9900] text-[#111827] font-bold text-lg px-9 py-4 rounded-xl hover:brightness-110 transition">
          Rejoindre le tournoi
        </Link>
        <p className="text-slate-500 text-xs mt-3">Inscription en 30 secondes, 100% gratuit.</p>
      </section>

      {/* Classement live */}
      <section className="max-w-2xl mx-auto px-5 py-8">
        <h2 className="text-xl font-bold text-white text-center mb-4">Le classement en direct</h2>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/og/ranking?tournamentId=${t.id}&mode=general`}
          alt={`Classement de ${t.name}`}
          className="w-full rounded-2xl border border-white/10 shadow-2xl"
        />
        <div className="text-center mt-4">
          <Link href={`/share/ranking/${t.id}?mode=general`} className="text-[#ff9900] text-sm font-semibold hover:underline">
            Voir le classement complet →
          </Link>
        </div>
      </section>

      {/* Réassurance */}
      <section className="max-w-2xl mx-auto px-5 py-6">
        <div className="grid gap-4 sm:grid-cols-3 text-center">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-2xl mb-1">🆓</div>
            <p className="text-sm text-slate-300">100% gratuit</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-2xl mb-1">⚡</div>
            <p className="text-sm text-slate-300">Rejoins seul, en 30 s</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-2xl mb-1">🏆</div>
            <p className="text-sm text-slate-300">Classement, trophées, chambrage</p>
          </div>
        </div>
      </section>

      <section className="max-w-2xl mx-auto px-5 py-10 text-center">
        <Link href={joinUrl} className="inline-block bg-[#ff9900] text-[#111827] font-bold text-lg px-9 py-4 rounded-xl hover:brightness-110 transition">
          Rejoindre {t.name}
        </Link>
        <p className="text-slate-500 text-sm mt-4">
          Envie de ton propre tournoi entre potes ? <Link href="/pronostics" className="text-[#ff9900] hover:underline">C'est par ici</Link>.
        </p>
      </section>

      <SeoFooter />
    </div>
  )
}
