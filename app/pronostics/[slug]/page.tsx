import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { COMPETITIONS_SEO, getCompetitionSeo } from '@/lib/seo/pronostics-content'
import { fetchEmblem, SeoHeader, HowItWorks, WhyPronoHub, SeoCta, SeoFooter } from '@/components/seo/PronosticsChrome'

export const revalidate = 86400 // ISR : régénère au plus une fois/jour
const BASE = 'https://www.pronohub.club'

export function generateStaticParams() {
  return COMPETITIONS_SEO.map((c) => ({ slug: c.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const c = getCompetitionSeo(slug)
  if (!c) return { title: 'Pronostics | PronoHub' }
  const url = `${BASE}/pronostics/${c.slug}`
  return {
    title: c.title,
    description: c.description,
    alternates: { canonical: url },
    openGraph: { title: c.title, description: c.description, url, type: 'website', images: [{ url: '/opengraph-image' }] },
    twitter: { card: 'summary_large_image', title: c.title, description: c.description, images: ['/opengraph-image'] },
  }
}

const FAQ = (short: string) => [
  { q: `Combien coûte un tournoi de pronostics ${short} ?`, a: `Rien du tout. Créer un tournoi ${short}, inviter tes amis et jouer est 100% gratuit sur PronoHub. Aucune carte bancaire n'est demandée.` },
  { q: 'Joue-t-on avec de l\'argent ?', a: 'Non. PronoHub est un jeu de pronostics entre amis, sans mise ni gain en argent. On joue pour le classement, les trophées et l\'honneur.' },
  { q: 'Combien de joueurs peuvent participer ?', a: 'Un tournoi gratuit accueille jusqu\'à 5 joueurs, et des formules permettent d\'aller jusqu\'à 10, 20 ou 30 participants pour les plus grandes bandes.' },
  { q: 'Comment inviter mes amis ?', a: 'Après avoir créé ton tournoi, tu partages un simple lien (WhatsApp, SMS, réseaux…). Tes amis le rejoignent en un clic, même sans compte au préalable.' },
]

export default async function CompetitionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const c = getCompetitionSeo(slug)
  if (!c) notFound()

  const emblem = await fetchEmblem(c.competitionId)
  const others = COMPETITIONS_SEO.filter((x) => x.slug !== c.slug)
  const faq = FAQ(c.short)

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
            Créer mon tournoi {c.short} gratuit
          </Link>
          <Link href="/pronostics" className="inline-block border border-white/20 text-white font-semibold text-[16px] px-8 py-3.5 rounded-xl hover:bg-white/5 transition">
            Voir toutes les compétitions
          </Link>
        </div>
      </section>

      <HowItWorks />
      <WhyPronoHub />

      {/* Autres compétitions (maillage interne) */}
      <section className="max-w-5xl mx-auto px-5 py-10">
        <h2 className="text-2xl font-bold text-white text-center mb-8">Pronostique d'autres compétitions</h2>
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
        <h2 className="text-2xl font-bold text-white text-center mb-8">Questions fréquentes</h2>
        <div className="space-y-4">
          {faq.map((f) => (
            <div key={f.q} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h3 className="text-white font-bold mb-2">{f.q}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      <SeoCta label={`Créer mon tournoi ${c.short}`} />
      <SeoFooter />
    </div>
  )
}
