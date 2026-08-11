import type { Metadata } from 'next'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { getGuides } from '@/lib/seo/guides-content'
import { SeoHeader, SeoCta, SeoFooter } from '@/components/seo/PronosticsChrome'
import type { Locale } from '@/i18n/routing'
import { buildAlternates } from '@/lib/seo/alternates'

export const revalidate = 86400
const BASE = 'https://www.pronohub.club'

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Seo.guidesHub' })
  const url = locale === 'fr' ? `${BASE}/guides` : `${BASE}/${locale}/guides`
  const title = t('metaTitle')
  const description = t('metaDesc')
  return {
    title,
    description,
    alternates: buildAlternates('/guides', locale),
    openGraph: { title, description, url, type: 'website', images: [{ url: '/opengraph-image' }] },
    twitter: { card: 'summary_large_image', title, description, images: ['/opengraph-image'] },
  }
}

export default async function GuidesHubPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Seo.guidesHub' })
  const guides = getGuides(locale)

  return (
    <div className="min-h-screen bg-[#0f172a] text-white">
      <SeoHeader />

      <section className="max-w-3xl mx-auto px-5 pt-10 pb-4 text-center">
        <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight mb-4 text-balance">
          {t.rich('h1', { k: (c) => <span className="text-[#ff9900]">{c}</span> })}
        </h1>
        <p className="text-slate-300 text-[16px] leading-relaxed">
          {t('subtitle')}
        </p>
      </section>

      <section className="max-w-3xl mx-auto px-5 py-8">
        <div className="grid gap-4">
          {guides.map((g) => (
            <Link
              key={g.slug}
              href={`/guides/${g.slug}`}
              className="block rounded-2xl border border-white/10 bg-white/[0.03] p-6 hover:border-[#ff9900]/50 transition"
            >
              <h2 className="text-xl font-bold text-white mb-2">{g.h1}</h2>
              <p className="text-slate-400 text-sm leading-relaxed">{g.description}</p>
              <span className="inline-block mt-3 text-[#ff9900] text-sm font-semibold">{t('readGuide')}</span>
            </Link>
          ))}
        </div>
      </section>

      <SeoCta label={t('ctaLabel')} />
      <SeoFooter />
    </div>
  )
}
