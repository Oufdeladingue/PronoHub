'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import type { FeaturedPublicTournament } from '@/lib/public-tournament'

/** Bandeau discret « rejoins le tournoi public » — intégré au header sombre de la landing. */
export default function PublicTournamentBanner({ t }: { t: FeaturedPublicTournament }) {
  const tr = useTranslations('PublicBanner')
  const players = t.players > 1 ? ` · ${tr('players', { n: t.players })}` : ''
  return (
    <Link href={`/tournoi-public/${t.slug}`} className="block group">
      <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-0.5 px-4 py-2 text-center text-[13px] bg-[#0b1220]/80 backdrop-blur-sm border-b border-white/[0.06]">
        <span className="text-slate-300">
          {tr('openToAll')} — <strong className="text-white font-semibold">{t.name}</strong>{players}
        </span>
        <span className="text-[#ff9900] font-semibold group-hover:underline underline-offset-2 whitespace-nowrap">
          {tr('join')}
        </span>
      </div>
    </Link>
  )
}
