import type { Metadata } from 'next'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { getCompetitions } from '@/lib/seo/pronostics-content'
import { fetchEmblem, SeoHeader, HowItWorks, WhyPronoHub, SeoCta, SeoFooter } from '@/components/seo/PronosticsChrome'
import type { Locale } from '@/i18n/routing'

export const revalidate = 86400
const BASE = 'https://www.pronohub.club'

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Seo.pronosticsHub' })
  const url = locale === 'fr' ? `${BASE}/pronostics` : `${BASE}/${locale}/pronostics`
  const title = t('metaTitle')
  const description = t('metaDesc')
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website', images: [{ url: '/opengraph-image' }] },
    twitter: { card: 'summary_large_image', title, description, images: ['/opengraph-image'] },
  }
}

export default async function PronosticsHubPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Seo.pronosticsHub' })
  const competitions = getCompetitions(locale)
  const emblems = await Promise.all(competitions.map((c) => fetchEmblem(c.competitionId)))
  const comps = competitions.map((c, i) => ({ ...c, emblem: emblems[i] }))

  const faq = [
    { q: t('q1'), a: t('a1') },
    { q: t('q2'), a: t('a2') },
    { q: t('q3'), a: t('a3') },
    { q: t('q4'), a: t('a4') },
  ]

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Accueil', item: BASE },
          { '@type': 'ListItem', position: 2, name: 'Pronostics', item: `${BASE}/pronostics` },
        ],
      },
      { '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    ],
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SeoHeader />

      {/* Hero */}
      <section className="max-w-3xl mx-auto px-5 pt-10 pb-6 text-center">
        <h1 className="text-3xl sm:text-5xl font-extrabold leading-tight mb-5 text-balance">
          {t.rich('heroH1', { k: (c) => <span className="text-[#ff9900]">{c}</span> })}
        </h1>
        <p className="text-slate-300 text-[17px] leading-relaxed mb-3">
          {t.rich('heroP1', { b: (c) => <strong className="text-white">{c}</strong> })}
        </p>
        <p className="text-slate-400 text-[15px] leading-relaxed mb-7">
          {t('heroP2')}
        </p>
        <Link href="/auth/signup" className="inline-block bg-[#ff9900] text-[#111827] font-bold text-lg px-9 py-4 rounded-xl hover:brightness-110 transition">
          {t('heroCta')}
        </Link>
      </section>

      {/* Grille des compétitions */}
      <section className="max-w-5xl mx-auto px-5 py-10">
        <h2 className="text-2xl font-bold text-white text-center mb-8">{t('chooseComp')}</h2>
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {comps.map((c) => (
            <Link
              key={c.slug}
              href={`/pronostics/${c.slug}`}
              className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-5 text-center hover:border-[#ff9900]/50 transition"
            >
              {c.emblem ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.emblem} alt={c.short} className="h-12 w-auto object-contain" />
              ) : (
                <div className="h-12 flex items-center text-2xl">⚽</div>
              )}
              <span className="text-sm font-semibold text-slate-200">{c.short}</span>
            </Link>
          ))}
        </div>
      </section>

      <HowItWorks />
      <WhyPronoHub />

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

      <SeoCta label={t('ctaLabel')} />
      <SeoFooter />
    </div>
  )
}
