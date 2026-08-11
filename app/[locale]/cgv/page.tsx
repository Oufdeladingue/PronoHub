import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import Footer from '@/components/Footer'
import { getTranslations } from 'next-intl/server'
import type { Locale } from '@/i18n/routing'
import { buildAlternates } from '@/lib/seo/alternates'

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Cgv.meta' })
  return {
    title: t('title'),
    description: t('description'),
    alternates: buildAlternates('/cgv', locale),
    robots: {
      index: true,
      follow: true,
    },
  }
}

type ListItem = string | { label: string; text: string }

function ListItems({ items }: { items: ListItem[] }) {
  return (
    <>
      {items.map((item, i) =>
        typeof item === 'string' ? (
          <li key={i}>{item}</li>
        ) : (
          <li key={i}>
            <strong className="text-white">{item.label}</strong> {item.text}
          </li>
        )
      )}
    </>
  )
}

export default async function CGVPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Cgv' })

  const bold = { b: (chunks: React.ReactNode) => <strong className="text-white">{chunks}</strong> }
  const contactLink = (chunks: React.ReactNode) => (
    <Link href="/contact" className="text-[#ff9900] hover:underline">
      {chunks}
    </Link>
  )
  const privacyLink = (chunks: React.ReactNode) => (
    <Link href="/privacy" className="text-[#ff9900] hover:underline">
      {chunks}
    </Link>
  )

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 bg-gradient-to-b from-gray-900 to-gray-800 text-white py-16 px-4">
        <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('backHome')}
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            {t('h1')}
          </h1>
          <p className="text-gray-400">
            {t('lastUpdated')}
          </p>
        </div>

        {/* Content */}
        <div className="prose prose-invert prose-orange max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-bold text-[#ff9900] mb-4">{t('s1.title')}</h2>
            <p className="text-gray-300 leading-relaxed">
              {t('s1.body')}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#ff9900] mb-4">{t('s2.title')}</h2>
            <p className="text-gray-300 leading-relaxed">
              {t('s2.intro')}
            </p>
            <ul className="list-disc list-inside text-gray-300 mt-2 space-y-1">
              <ListItems items={t.raw('s2.items') as ListItem[]} />
            </ul>
            <p className="text-gray-300 leading-relaxed mt-4">
              {t.rich('s2.important', bold)}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#ff9900] mb-4">{t('s3.title')}</h2>
            <p className="text-gray-300 leading-relaxed">
              {t('s3.body1')}
            </p>
            <p className="text-gray-300 leading-relaxed mt-2">
              {t('s3.body2')}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#ff9900] mb-4">{t('s4.title')}</h2>
            <p className="text-gray-300 leading-relaxed">
              {t('s4.intro')}
            </p>
            <ul className="list-disc list-inside text-gray-300 mt-2 space-y-1">
              <ListItems items={t.raw('s4.items') as ListItem[]} />
            </ul>
            <p className="text-gray-300 leading-relaxed mt-4">
              {t('s4.outro')}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#ff9900] mb-4">{t('s5.title')}</h2>
            <p className="text-gray-300 leading-relaxed">
              {t('s5.body1')}
            </p>
            <p className="text-gray-300 leading-relaxed mt-2">
              {t('s5.body2')}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#ff9900] mb-4">{t('s6.title')}</h2>
            <p className="text-gray-300 leading-relaxed">
              {t('s6.body')}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#ff9900] mb-4">{t('s7.title')}</h2>
            <p className="text-gray-300 leading-relaxed">
              {t('s7.intro')}
            </p>
            <ul className="list-disc list-inside text-gray-300 mt-2 space-y-1">
              <ListItems items={t.raw('s7.items') as ListItem[]} />
            </ul>
            <p className="text-gray-300 leading-relaxed mt-4">
              {t('s7.outro')}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#ff9900] mb-4">{t('s8.title')}</h2>
            <p className="text-gray-300 leading-relaxed">
              {t('s8.body1')}
            </p>
            <p className="text-gray-300 leading-relaxed mt-2">
              {t('s8.body2')}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#ff9900] mb-4">{t('s9.title')}</h2>
            <p className="text-gray-300 leading-relaxed">
              {t.rich('s9.body', { privacy: privacyLink })}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#ff9900] mb-4">{t('s10.title')}</h2>
            <p className="text-gray-300 leading-relaxed">
              {t('s10.intro')}
            </p>
            <ul className="list-disc list-inside text-gray-300 mt-2 space-y-1">
              <ListItems items={t.raw('s10.items') as ListItem[]} />
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#ff9900] mb-4">{t('s11.title')}</h2>
            <p className="text-gray-300 leading-relaxed">
              {t('s11.body')}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#ff9900] mb-4">{t('s12.title')}</h2>
            <p className="text-gray-300 leading-relaxed">
              {t('s12.body')}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#ff9900] mb-4">{t('s13.title')}</h2>
            <p className="text-gray-300 leading-relaxed">
              {t.rich('s13.body', { contact: contactLink })}
            </p>
          </section>
        </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
