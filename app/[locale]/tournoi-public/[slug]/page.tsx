import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { SeoHeader, SeoFooter } from '@/components/seo/PronosticsChrome'
import { getTranslations, getLocale } from 'next-intl/server'

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

function fmtDate(iso: string, locale: string): string {
  const d = new Date(iso).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
  return d.charAt(0).toUpperCase() + d.slice(1)
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const tr = await getTranslations('PublicTournament.meta')
  const locale = await getLocale()
  const t = await getPublic(slug)
  if (!t) return { title: tr('fallbackTitle'), robots: { index: false, follow: true } }
  const title = tr('title', { name: t.name })
  const description = t.description || tr('description', { name: t.name })
  const image = `${BASE}/api/og/ranking?tournamentId=${t.id}&mode=general${locale === 'en' ? '&locale=en' : ''}`
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
  const tr = await getTranslations('PublicTournament')
  const locale = await getLocale()
  const t = await getPublic(slug)
  if (!t) notFound()

  const joinUrl = `/vestiaire/rejoindre?code=${encodeURIComponent(t.invite_code || t.slug)}`
  const bold = (c: React.ReactNode) => <strong className="text-white">{c}</strong>

  return (
    <div className="min-h-screen bg-[#0f172a] text-white">
      <SeoHeader />

      <section className="max-w-3xl mx-auto px-5 pt-8 pb-4 text-center">
        <span className="inline-block text-xs font-bold uppercase tracking-wide text-[#ff9900] bg-[#ff9900]/10 border border-[#ff9900]/30 rounded-full px-3 py-1 mb-4">
          {tr('badge')}
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight mb-3 text-balance">{t.name}</h1>

        {/* Description de la compétition (custom) */}
        {t.description && (
          <p className="text-slate-200 text-[16px] leading-relaxed mb-2">{t.description}</p>
        )}

        <p className="text-slate-400 text-[15px] leading-relaxed mb-3">
          {tr.rich('intro', { b: bold })}
        </p>

        {/* Date de début + nombre de joueurs */}
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-sm text-slate-400 mb-6">
          {t.startDate && <span>{tr.rich('startDate', { b: bold, date: fmtDate(t.startDate, locale) })}</span>}
          {t.players > 1 && <span>{tr.rich('playersCount', { b: bold, count: t.players })}</span>}
          {t.status !== 'pending' && <span className="text-[#ff9900]">{tr('joinableInProgress')}</span>}
        </div>

        <Link href={joinUrl} className="inline-block bg-[#ff9900] text-[#111827] font-bold text-lg px-9 py-4 rounded-xl hover:brightness-110 transition">
          {tr('joinButton')}
        </Link>
        <p className="text-slate-500 text-xs mt-3">{tr('signupNote')}</p>
      </section>

      {/* Classement live */}
      <section className="max-w-2xl mx-auto px-5 py-8">
        <h2 className="text-xl font-bold text-white text-center mb-4">{tr('liveRanking')}</h2>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/og/ranking?tournamentId=${t.id}&mode=general${locale === 'en' ? '&locale=en' : ''}`}
          alt={tr('rankingAlt', { name: t.name })}
          className="w-full rounded-2xl border border-white/10 shadow-2xl"
        />
        <div className="text-center mt-4">
          <Link href={`/share/ranking/${t.id}?mode=general`} className="text-[#ff9900] text-sm font-semibold hover:underline">
            {tr('viewFullRanking')}
          </Link>
        </div>
      </section>

      {/* Réassurance */}
      <section className="max-w-2xl mx-auto px-5 py-6">
        <div className="grid gap-4 sm:grid-cols-3 text-center">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-2xl mb-1">🆓</div>
            <p className="text-sm text-slate-300">{tr('free')}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-2xl mb-1">⚡</div>
            <p className="text-sm text-slate-300">{tr('joinAlone')}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-2xl mb-1">🏆</div>
            <p className="text-sm text-slate-300">{tr('rankingTrophies')}</p>
          </div>
        </div>
      </section>

      <section className="max-w-2xl mx-auto px-5 py-10 text-center">
        <Link href={joinUrl} className="inline-block bg-[#ff9900] text-[#111827] font-bold text-lg px-9 py-4 rounded-xl hover:brightness-110 transition">
          {tr('joinNamed', { name: t.name })}
        </Link>
        <p className="text-slate-500 text-sm mt-4">
          {tr.rich('ownTournament', { link: (c) => <Link href="/pronostics" className="text-[#ff9900] hover:underline">{c}</Link> })}
        </p>
      </section>

      <SeoFooter />
    </div>
  )
}
