import Link from 'next/link'
import type { FeaturedPublicTournament } from '@/lib/public-tournament'

/** Bandeau « rejoins le tournoi public » — à surfacer sur la home / les pages marketing. */
export default function PublicTournamentBanner({ t }: { t: FeaturedPublicTournament }) {
  return (
    <Link
      href={`/tournoi-public/${t.slug}`}
      className="block group"
    >
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2.5 text-center text-sm bg-[#ff9900] text-[#111827] font-semibold">
        <span>🌍 Tournoi public ouvert à tous — <strong>{t.name}</strong>{t.players > 0 ? ` · ${t.players} joueurs` : ''}</span>
        <span className="underline underline-offset-2 group-hover:no-underline">Rejoindre gratuitement →</span>
      </div>
    </Link>
  )
}
