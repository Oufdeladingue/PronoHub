import type { Metadata } from 'next'
import Link from 'next/link'
import { GUIDES } from '@/lib/seo/guides-content'
import { SeoHeader, SeoCta, SeoFooter } from '@/components/seo/PronosticsChrome'

export const revalidate = 86400
const BASE = 'https://www.pronohub.club'

const TITLE = 'Guides pronostics foot entre amis | PronoHub'
const DESC = 'Nos guides pour organiser et animer un tournoi de pronostics de foot entre amis : règles, barème, idées de jeux pour un groupe WhatsApp. Gratuit et sans argent.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: `${BASE}/guides` },
  openGraph: { title: TITLE, description: DESC, url: `${BASE}/guides`, type: 'website', images: [{ url: '/opengraph-image' }] },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESC, images: ['/opengraph-image'] },
}

export default function GuidesHubPage() {
  return (
    <div className="min-h-screen bg-[#0f172a] text-white">
      <SeoHeader />

      <section className="max-w-3xl mx-auto px-5 pt-10 pb-4 text-center">
        <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight mb-4 text-balance">
          Guides pronostics <span className="text-[#ff9900]">entre amis</span>
        </h1>
        <p className="text-slate-300 text-[16px] leading-relaxed">
          Tout pour organiser, régler et animer ton tournoi de pronos de foot entre potes — simplement, et gratuitement.
        </p>
      </section>

      <section className="max-w-3xl mx-auto px-5 py-8">
        <div className="grid gap-4">
          {GUIDES.map((g) => (
            <Link
              key={g.slug}
              href={`/guides/${g.slug}`}
              className="block rounded-2xl border border-white/10 bg-white/[0.03] p-6 hover:border-[#ff9900]/50 transition"
            >
              <h2 className="text-xl font-bold text-white mb-2">{g.h1}</h2>
              <p className="text-slate-400 text-sm leading-relaxed">{g.description}</p>
              <span className="inline-block mt-3 text-[#ff9900] text-sm font-semibold">Lire le guide →</span>
            </Link>
          ))}
        </div>
      </section>

      <SeoCta label="Créer mon tournoi gratuit" />
      <SeoFooter />
    </div>
  )
}
