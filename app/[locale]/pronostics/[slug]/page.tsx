import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getCompetitions, getCompetitionSeo } from '@/lib/seo/pronostics-content'
import { fetchEmblem, SeoHeader, HowItWorks, WhyPronoHub, SeoCta, SeoFooter } from '@/components/seo/PronosticsChrome'
import type { Locale } from '@/i18n/routing'
import { buildAlternates } from '@/lib/seo/alternates'

export const revalidate = 86400 // ISR : régénère au plus une fois/jour
const BASE = 'https://www.pronohub.club'

export function generateStaticParams() {
  return getCompetitions('fr').map((c) => ({ slug: c.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; locale: Locale }> }): Promise<Metadata> {
  const { slug, locale } = await params
  const c = getCompetitionSeo(slug, locale)
  const t = await getTranslations({ locale, namespace: 'Seo.compDetail' })
  if (!c) return { title: t('metaFallback') }
  const url = locale === 'fr' ? `${BASE}/pronostics/${c.slug}` : `${BASE}/${locale}/pronostics/${c.slug}`
  return {
    title: c.title,
    description: c.description,
    alternates: buildAlternates(`/pronostics/${c.slug}`, locale),
    openGraph: { title: c.title, description: c.description, url, type: 'website', images: [{ url: '/opengraph-image' }] },
    twitter: { card: 'summary_large_image', title: c.title, description: c.description, images: ['/opengraph-image'] },
  }
}

export default async function CompetitionPage({ params }: { params: Promise<{ slug: string; locale: Locale }> }) {
  const { slug, locale } = await params
  const c = getCompetitionSeo(slug, locale)
  if (!c) notFound()

  const t = await getTranslations({ locale, namespace: 'Seo.compDetail' })
  const emblem = await fetchEmblem(c.competitionId)
  const others = getCompetitions(locale).filter((x) => x.slug !== c.slug)
  const faq = [
    { q: t('q1', { short: c.short }), a: t('a1', { short: c.short }) },
    { q: t('q2', { short: c.short }), a: t('a2', { short: c.short }) },
    { q: t('q3', { short: c.short }), a: t('a3', { short: c.short }) },
    { q: t('q4', { short: c.short }), a: t('a4', { short: c.short }) },
  ]

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Accueil', item: BASE },
          { '@type': 'ListItem', position: 2, name: 'Pronostics', item: `${BASE}/pronostics` },
          { '@type': 'ListItem', position: 3, name: c.short, item: `${BASE}/pronostics/${c.slug}` },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
      },
    ],
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SeoHeader />

      {/* Hero */}
      <section className="max-w-3xl mx-auto px-5 pt-8 pb-4 text-center">
        {emblem && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={emblem} alt={c.short} className="h-20 w-auto object-contain mx-auto mb-6" />
        )}
        <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight mb-4 text-balance">{c.h1}</h1>
        <p className="text-slate-300 text-[16px] leading-relaxed mb-7">{c.intro}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/auth/signup" className="inline-block bg-[#ff9900] text-[#111827] font-bold text-[16px] px-8 py-3.5 rounded-xl hover:brightness-110 transition">
            {t('createFree', { short: c.short })}
          </Link>
          <Link href="/pronostics" className="inline-block border border-white/20 text-white font-semibold text-[16px] px-8 py-3.5 rounded-xl hover:bg-white/5 transition">
            {t('allComps')}
          </Link>
        </div>
      </section>

      <HowItWorks />
      <WhyPronoHub />

      {/* Autres compétitions (maillage interne) */}
      <section className="max-w-5xl mx-auto px-5 py-10">
        <h2 className="text-2xl font-bold text-white text-center mb-8">{t('otherComps')}</h2>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {others.map((o) => (
            <Link key={o.slug} href={`/pronostics/${o.slug}`} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-4 text-center text-sm font-semibold text-slate-200 hover:border-[#ff9900]/50 hover:text-white transition">
              {o.short}
            </Link>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-5 py-10">
        <h2 className="text-2xl font-bold text-white text-center mb-8">{t('faqTitle')}</h2>
        <div className="space-y-4">
          {faq.map((f) => (
            <div key={f.q} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h3 className="text-white font-bold mb-2">{f.q}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      <SeoCta label={t('ctaLabel', { short: c.short })} />
      <SeoFooter />
    </div>
  )
}
