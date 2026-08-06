import type { Metadata } from 'next'
import Link from 'next/link'
import { COMPETITIONS_SEO } from '@/lib/seo/pronostics-content'
import { fetchEmblem, SeoHeader, HowItWorks, WhyPronoHub, SeoCta, SeoFooter } from '@/components/seo/PronosticsChrome'

export const revalidate = 86400
const BASE = 'https://www.pronohub.club'

const TITLE = 'Pronostics foot entre amis — jeu de pronos gratuit | PronoHub'
const DESC = 'PronoHub, l\'appli pour créer un tournoi de pronostics foot entre amis : gratuit, sans argent, sur la Ligue 1, la Champions League et les grands championnats. Défie tes potes !'

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: `${BASE}/pronostics` },
  openGraph: { title: TITLE, description: DESC, url: `${BASE}/pronostics`, type: 'website', images: [{ url: '/opengraph-image' }] },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESC, images: ['/opengraph-image'] },
}

const FAQ = [
  { q: 'PronoHub est-il vraiment gratuit ?', a: 'Oui. Créer un tournoi de pronostics, inviter tes amis et jouer est 100% gratuit. Des formules payantes existent seulement pour les grands groupes ou des options bonus, mais tu n\'en as pas besoin pour t\'amuser.' },
  { q: 'Joue-t-on avec de l\'argent réel ?', a: 'Non, jamais. PronoHub est un jeu de pronostics entre amis, sans mise ni gain financier. On joue pour le classement, les trophées et la fierté.' },
  { q: 'Sur quelles compétitions puis-je jouer ?', a: 'Ligue 1, Ligue des Champions, Premier League, Liga, Serie A, Bundesliga, Coupe du Monde et d\'autres championnats. Tu peux même créer des compétitions personnalisées.' },
  { q: 'Comment inviter mes amis à un tournoi ?', a: 'Tu partages un simple lien (WhatsApp, SMS, réseaux sociaux). Tes amis le rejoignent en un clic, l\'inscription prend une minute.' },
]

export default async function PronosticsHubPage() {
  const emblems = await Promise.all(COMPETITIONS_SEO.map((c) => fetchEmblem(c.competitionId)))
  const comps = COMPETITIONS_SEO.map((c, i) => ({ ...c, emblem: emblems[i] }))

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
      { '@type': 'FAQPage', mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    ],
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SeoHeader />

      {/* Hero */}
      <section className="max-w-3xl mx-auto px-5 pt-10 pb-6 text-center">
        <h1 className="text-3xl sm:text-5xl font-extrabold leading-tight mb-5 text-balance">
          Pronostics foot <span className="text-[#ff9900]">entre amis</span>
        </h1>
        <p className="text-slate-300 text-[17px] leading-relaxed mb-3">
          Crée ton tournoi de pronostics de foot en une minute, invite ta bande et voyez qui lit le mieux le jeu.
          <strong className="text-white"> 100% gratuit, sans argent</strong> — juste le classement, les trophées et la chambre entre potes.
        </p>
        <p className="text-slate-400 text-[15px] leading-relaxed mb-7">
          Parfait pour un groupe WhatsApp, les collègues du bureau ou la famille. De la Ligue 1 à la Coupe du Monde.
        </p>
        <Link href="/auth/signup" className="inline-block bg-[#ff9900] text-[#111827] font-bold text-lg px-9 py-4 rounded-xl hover:brightness-110 transition">
          Créer mon tournoi gratuit
        </Link>
      </section>

      {/* Grille des compétitions */}
      <section className="max-w-5xl mx-auto px-5 py-10">
        <h2 className="text-2xl font-bold text-white text-center mb-8">Choisis ta compétition</h2>
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
        <h2 className="text-2xl font-bold text-white text-center mb-8">Questions fréquentes</h2>
        <div className="space-y-4">
          {FAQ.map((f) => (
            <div key={f.q} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h3 className="text-white font-bold mb-2">{f.q}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      <SeoCta label="Créer mon tournoi gratuit" />
      <SeoFooter />
    </div>
  )
}
