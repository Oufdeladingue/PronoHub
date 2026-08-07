import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getGuide, getGuides } from '@/lib/seo/guides-content'
import { getCompetitions } from '@/lib/seo/pronostics-content'
import { SeoHeader, SeoCta, SeoFooter } from '@/components/seo/PronosticsChrome'
import type { Locale } from '@/i18n/routing'

export const revalidate = 86400
const BASE = 'https://www.pronohub.club'

export function generateStaticParams() {
  return getGuides('fr').map((g) => ({ slug: g.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; locale: Locale }> }): Promise<Metadata> {
  const { slug, locale } = await params
  const g = getGuide(slug, locale)
  const t = await getTranslations({ locale, namespace: 'Seo.guideDetail' })
  if (!g) return { title: t('metaFallback') }
  const url = locale === 'fr' ? `${BASE}/guides/${g.slug}` : `${BASE}/${locale}/guides/${g.slug}`
  return {
    title: g.title,
    description: g.description,
    alternates: { canonical: url },
    openGraph: { title: g.title, description: g.description, url, type: 'article', images: [{ url: '/opengraph-image' }] },
    twitter: { card: 'summary_large_image', title: g.title, description: g.description, images: ['/opengraph-image'] },
  }
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string; locale: Locale }> }) {
  const { slug, locale } = await params
  const g = getGuide(slug, locale)
  if (!g) notFound()

  const t = await getTranslations({ locale, namespace: 'Seo.guideDetail' })
  const competitions = getCompetitions(locale)
  const related = g.related
    .map((s) => competitions.find((c) => c.slug === s))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        headline: g.h1,
        description: g.description,
        inLanguage: locale === 'fr' ? 'fr-FR' : 'en-GB',
        author: { '@type': 'Organization', name: 'PronoHub' },
        publisher: { '@type': 'Organization', name: 'PronoHub', logo: { '@type': 'ImageObject', url: `${BASE}/images/logo.png` } },
        mainEntityOfPage: `${BASE}/guides/${g.slug}`,
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Accueil', item: BASE },
          { '@type': 'ListItem', position: 2, name: t('breadcrumb'), item: `${BASE}/guides` },
          { '@type': 'ListItem', position: 3, name: g.h1, item: `${BASE}/guides/${g.slug}` },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: g.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
      },
    ],
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SeoHeader />

      <article className="max-w-2xl mx-auto px-5 pt-8 pb-4">
        <nav className="text-xs text-slate-500 mb-4">
          <Link href="/guides" className="hover:text-slate-300">{t('breadcrumb')}</Link> <span className="mx-1">/</span> <span className="text-slate-400">{g.h1}</span>
        </nav>
        <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight mb-4 text-balance">{g.h1}</h1>
        <p className="text-slate-300 text-[17px] leading-relaxed mb-8">{g.lede}</p>

        {g.sections.map((s) => (
          <section key={s.h2} className="mb-8">
            <h2 className="text-xl font-bold text-white mb-3">{s.h2}</h2>
            {s.paragraphs?.map((p, i) => (
              <p key={i} className="text-slate-300 text-[15px] leading-relaxed mb-3">{p}</p>
            ))}
            {s.list && (
              <ul className="list-disc pl-5 space-y-1.5 text-slate-300 text-[15px] leading-relaxed">
                {s.list.map((li, i) => <li key={i}>{li}</li>)}
              </ul>
            )}
          </section>
        ))}
      </article>

      {/* Compétitions à mettre en avant (maillage interne) */}
      {related.length > 0 && (
        <section className="max-w-2xl mx-auto px-5 py-6">
          <h2 className="text-lg font-bold text-white mb-4">{t('launch')}</h2>
          <div className="flex flex-wrap gap-3">
            {related.map((c) => (
              <Link key={c.slug} href={`/pronostics/${c.slug}`} className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-slate-200 hover:border-[#ff9900]/50 hover:text-white transition">
                {t('predictionsShort', { short: c.short })}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* FAQ */}
      <section className="max-w-2xl mx-auto px-5 py-8">
        <h2 className="text-2xl font-bold text-white text-center mb-6">{t('faqTitle')}</h2>
        <div className="space-y-4">
          {g.faq.map((f) => (
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
