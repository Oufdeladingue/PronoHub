import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { createAdminClient } from '@/lib/supabase/server'

/** Logo blanc (fond sombre) d'une compétition, custom_emblem_white en priorité. */
export async function fetchEmblem(competitionId: number): Promise<string | null> {
  try {
    const s = createAdminClient()
    const { data } = await s
      .from('competitions')
      .select('emblem, custom_emblem_white')
      .eq('id', competitionId)
      .maybeSingle()
    return data?.custom_emblem_white || data?.emblem || null
  } catch {
    return null
  }
}

export async function SeoHeader() {
  const t = await getTranslations('Seo.header')
  return (
    <header className="flex items-center justify-between max-w-5xl mx-auto px-5 py-4">
      <Link href="/" aria-label="Accueil PronoHub">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/logo.png" alt="PronoHub" className="h-9 w-auto" />
      </Link>
      <Link
        href="/auth/signup"
        className="inline-block bg-[#ff9900] text-[#111827] font-bold text-sm px-5 py-2.5 rounded-xl hover:brightness-110 transition"
      >
        {t('cta')}
      </Link>
    </header>
  )
}

/** Section « Comment ça marche » réutilisable. */
export async function HowItWorks() {
  const t = await getTranslations('Seo.how')
  const steps = [
    { n: '1', t: t('s1t'), d: t('s1d') },
    { n: '2', t: t('s2t'), d: t('s2d') },
    { n: '3', t: t('s3t'), d: t('s3d') },
  ]
  return (
    <section className="max-w-5xl mx-auto px-5 py-10">
      <h2 className="text-2xl font-bold text-white text-center mb-8">{t('title')}</h2>
      <div className="grid gap-5 sm:grid-cols-3">
        {steps.map((s) => (
          <div key={s.n} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="w-9 h-9 rounded-full bg-[#ff9900] text-[#111827] font-black flex items-center justify-center mb-3">{s.n}</div>
            <h3 className="text-white font-bold mb-1.5">{s.t}</h3>
            <p className="text-slate-400 text-sm leading-relaxed">{s.d}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

/** Arguments clés (différenciation : gratuit, sans argent, entre amis). */
export async function WhyPronoHub() {
  const t = await getTranslations('Seo.why')
  const items = [
    ['🆓', t('i1t'), t('i1d')],
    ['🚫💶', t('i2t'), t('i2d')],
    ['👥', t('i3t'), t('i3d')],
    ['🏆', t('i4t'), t('i4d')],
  ]
  return (
    <section className="max-w-5xl mx-auto px-5 py-10">
      <h2 className="text-2xl font-bold text-white text-center mb-8">{t('title')}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {items.map(([e, t, d]) => (
          <div key={t} className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="text-2xl">{e}</div>
            <div>
              <h3 className="text-white font-bold mb-1">{t}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{d}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export async function SeoCta({ label }: { label?: string }) {
  const t = await getTranslations('Seo.cta')
  return (
    <section className="max-w-3xl mx-auto px-5 py-12 text-center">
      <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">{t('title')}</h2>
      <p className="text-slate-400 mb-6">{t('subtitle')}</p>
      <Link
        href="/auth/signup"
        className="inline-block bg-[#ff9900] text-[#111827] font-bold text-lg px-9 py-4 rounded-xl hover:brightness-110 transition"
      >
        {label ?? t('createFree')}
      </Link>
    </section>
  )
}

export async function SeoFooter() {
  const t = await getTranslations('Seo.footer')
  return (
    <footer className="border-t border-white/10 mt-8">
      <div className="max-w-5xl mx-auto px-5 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/logo.png" alt="PronoHub" className="h-7 w-auto opacity-80" />
        <nav className="flex flex-wrap gap-x-5 gap-y-2 justify-center">
          <Link href="/pronostics" className="hover:text-slate-300">{t('competitions')}</Link>
          <Link href="/guides" className="hover:text-slate-300">{t('guides')}</Link>
          <Link href="/pricing" className="hover:text-slate-300">{t('pricing')}</Link>
          <Link href="/about" className="hover:text-slate-300">{t('about')}</Link>
          <Link href="/auth/login" className="hover:text-slate-300">{t('login')}</Link>
        </nav>
      </div>
    </footer>
  )
}
