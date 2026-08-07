'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { ChevronRight, Loader2, Trophy, Users, PlusCircle, Eye, Wallet } from 'lucide-react'
import Link from 'next/link'
import { fetchWithAuth } from '@/lib/supabase/client'

interface UserTournament {
  id: string
  name: string
  slug: string
  tournament_type: string
  status: string
  participant_role: string
  current_players: number
  max_players: number
  competition_name: string
  is_event?: boolean
}

interface Credits {
  oneshot: number
  elite: number
  platinium_solo: number
  platinium_group: number
  slot_invite: number
  duration_extension: number
  player_extension: number
}

interface ZoneVIPData {
  free_tournaments_active: number
  free_tournaments_max: number
  premium_invites_active: number
  premium_invites_max: number
  can_create_free_tournament: boolean
  can_join_premium_free: boolean
  paid_slots_used: number
  paid_slots_total: number
  // Événement
  event_tournaments_active: number
  event_tournaments_max: number
  event_slots_available: number
  event_slots_used: number
  can_join_event_free: boolean
  can_join_event_with_slot: boolean
  credits?: Credits
  tournaments: UserTournament[]
  total_active_tournaments: number
  total_as_captain: number
}

export default function UserQuotasCard() {
  const t = useTranslations('UserQuotas')
  const router = useRouter()
  const [data, setData] = useState<ZoneVIPData | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedSection, setExpandedSection] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const response = await fetchWithAuth('/api/user/zone-vip')
      const result = await response.json()
      if (result.success) {
        setData(result.data)
      }
    } catch (error) {
      console.error('Error fetching zone VIP data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-[#ff9900] animate-spin" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-8 theme-text-secondary">
        {t('loadError')}
      </div>
    )
  }

  // Calculer les crédits de création disponibles (ne jamais afficher de négatif)
  const freeCreationSlots = Math.max(0, data.free_tournaments_max - data.free_tournaments_active)
  const totalCreationCredits =
    freeCreationSlots +
    (data.credits?.oneshot || 0) +
    (data.credits?.elite || 0) +
    (data.credits?.platinium_solo || 0) +
    (data.credits?.platinium_group || 0)

  // Calculer les crédits pour rejoindre
  // 1. Slots Free-Kick gratuits restants (2 max - participations actives)
  const freeKickJoinSlots = Math.max(0, data.free_tournaments_max - data.free_tournaments_active)
  // 2. Invitation gratuite premium (1 par tournoi One-Shot/Elite)
  const premiumFreeInvite = data.can_join_premium_free ? 1 : 0
  // 3. Slots payants (slot_invite achetés)
  const paidJoinSlots = data.credits?.slot_invite || 0
  const totalJoinCredits = freeKickJoinSlots + premiumFreeInvite + paidJoinSlots

  // Construire le résumé pour "Créer"
  const getCreateSummary = () => {
    const parts: string[] = []
    if (freeCreationSlots > 0) parts.push(`${freeCreationSlots} Free-Kick`)
    if (data.credits?.oneshot) parts.push(`${data.credits.oneshot} One-Shot`)
    if (data.credits?.elite) parts.push(`${data.credits.elite} Elite`)
    if (data.credits?.platinium_solo || data.credits?.platinium_group) {
      const plat = (data.credits?.platinium_solo || 0) + (data.credits?.platinium_group || 0)
      parts.push(`${plat} Platinium`)
    }
    return parts.length > 0 ? parts.join(' · ') : t('noCredit')
  }

  // Construire le résumé pour "Rejoindre"
  const getJoinSummary = () => {
    const parts: string[] = []

    // Slots Free-Kick gratuits
    if (freeKickJoinSlots > 0) {
      parts.push(t('freeKickFree', { n: freeKickJoinSlots }))
    }

    // Invitation premium gratuite
    if (premiumFreeInvite > 0) {
      parts.push(t('premiumInvite'))
    }

    // Slots payants
    if (paidJoinSlots > 0) {
      parts.push(t('paidSlots', { n: paidJoinSlots }))
    }

    if (parts.length > 0) {
      return parts.join(' · ')
    }
    return t('quotaReached')
  }

  // Calculer le total des crédits
  const getTotalCredits = () => {
    return (
      freeCreationSlots +
      (data.credits?.oneshot || 0) +
      (data.credits?.elite || 0) +
      (data.credits?.platinium_solo || 0) +
      (data.credits?.platinium_group || 0) +
      paidJoinSlots +
      premiumFreeInvite +
      (data.credits?.duration_extension || 0) +
      (data.credits?.player_extension || 0)
    )
  }

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section)
  }

  return (
    <div className="space-y-4">
      {/* Titre simplifié */}
      <div className="text-center pb-4">
        <h3 className="text-lg font-bold theme-text">{t('whatToDo')}</h3>
      </div>

      {/* Action 1: Créer un tournoi */}
      <div className="rounded-xl border-2 border-[#ff9900]/30 overflow-hidden transition-all hover:border-[#ff9900]/60">
        <button
          onClick={() => toggleSection('create')}
          className="w-full p-4 flex items-center gap-4 text-left"
        >
          <div className="w-12 h-12 bg-[#ff9900]/10 rounded-full flex items-center justify-center flex-shrink-0">
            <Trophy className="w-6 h-6 text-[#ff9900]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold theme-text">{t('createTournament')}</p>
            <p className="text-sm theme-text-secondary truncate">
              {totalCreationCredits > 0 ? getCreateSummary() : t('quotaReached')}
            </p>
          </div>
          <ChevronRight className={`w-5 h-5 theme-text-secondary transition-transform ${expandedSection === 'create' ? 'rotate-90' : ''}`} />
        </button>

        {/* Détails Créer */}
        {expandedSection === 'create' && (
          <div className="px-4 pb-4 space-y-2 border-t theme-border pt-3">
            {/* Free-Kick - Toujours affiché */}
            <Link
              href={freeCreationSlots > 0 ? "/vestiaire?type=free" : "/pricing?product=free-slot"}
              className="flex items-center justify-between p-3 rounded-lg theme-bg hover:bg-blue-500/10 transition group"
            >
              <div className="flex items-center gap-3">
                <img src="/images/icons/free-tour.svg" alt="" className="w-5 h-5 icon-filter-blue" />
                <div>
                  <span className="theme-text">Free-Kick</span>
                  {freeCreationSlots === 0 && (
                    <p className="text-xs theme-text-secondary">{t('quotaOfReached', { n: data.free_tournaments_max })}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {freeCreationSlots > 0 ? (
                  <>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-500">
                      {t('available', { n: freeCreationSlots })}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/20 theme-text-secondary">{t('free')}</span>
                  </>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-500">0,99€</span>
                )}
                <ChevronRight className="w-4 h-4 text-blue-500 opacity-0 group-hover:opacity-100 transition" />
              </div>
            </Link>

            {/* One-Shot - Toujours affiché */}
            <Link
              href={(data.credits?.oneshot || 0) > 0 ? "/vestiaire?type=oneshot&use_credit=true" : "/pricing?buy=oneshot"}
              className="flex items-center justify-between p-3 rounded-lg theme-bg hover:bg-green-500/10 transition group"
            >
              <div className="flex items-center gap-3">
                <img src="/images/icons/on-shot-tour.svg" alt="" className="w-5 h-5 icon-filter-green" />
                <span className="theme-text">One-Shot</span>
              </div>
              <div className="flex items-center gap-2">
                {(data.credits?.oneshot || 0) > 0 ? (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-500">
                    {t('creditsCount', { n: data.credits?.oneshot || 0 })}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-500">4,99€</span>
                )}
                <ChevronRight className="w-4 h-4 text-green-500 opacity-0 group-hover:opacity-100 transition" />
              </div>
            </Link>

            {/* Elite Team - Toujours affiché */}
            <Link
              href={(data.credits?.elite || 0) > 0 ? "/vestiaire?type=elite&use_credit=true" : "/pricing?buy=elite"}
              className="flex items-center justify-between p-3 rounded-lg theme-bg hover:bg-orange-500/10 transition group"
            >
              <div className="flex items-center gap-3">
                <img src="/images/icons/team-elite-tour.svg" alt="" className="w-5 h-5 icon-filter-orange" />
                <span className="theme-text">Elite Team</span>
              </div>
              <div className="flex items-center gap-2">
                {(data.credits?.elite || 0) > 0 ? (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[#ff9900]/20 text-[#ff9900]">
                    {t('creditsCount', { n: data.credits?.elite || 0 })}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[#ff9900]/20 text-[#ff9900]">9,99€</span>
                )}
                <ChevronRight className="w-4 h-4 text-[#ff9900] opacity-0 group-hover:opacity-100 transition" />
              </div>
            </Link>

            {/* Platinium - Toujours affiché */}
            <Link
              href={((data.credits?.platinium_solo || 0) + (data.credits?.platinium_group || 0)) > 0 ? "/vestiaire?type=platinium&use_credit=true" : "/pricing?buy=platinium"}
              className="flex items-center justify-between p-3 rounded-lg theme-bg hover:bg-yellow-500/10 transition group"
            >
              <div className="flex items-center gap-3">
                <img src="/images/icons/premium-tour.svg" alt="" className="w-5 h-5 icon-filter-yellow" />
                <span className="theme-text">Platinium</span>
              </div>
              <div className="flex items-center gap-2">
                {((data.credits?.platinium_solo || 0) + (data.credits?.platinium_group || 0)) > 0 ? (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-500">
                    {t('creditsCount', { n: (data.credits?.platinium_solo || 0) + (data.credits?.platinium_group || 0) })}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-500">6,99€</span>
                )}
                <ChevronRight className="w-4 h-4 text-yellow-500 opacity-0 group-hover:opacity-100 transition" />
              </div>
            </Link>

            {/* Événement - Affiché avec quota spécial */}
            <div className="flex items-center justify-between p-3 rounded-lg theme-bg hover:bg-pink-500/10 transition group">
              <div className="flex items-center gap-3">
                <img src="/images/icons/event.svg" alt="" className="w-5 h-5 icon-filter-rose" />
                <div>
                  <span className="theme-text">{t('event')}</span>
                  <p className="text-xs theme-text-secondary">{t('specialCompetitions')}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {data.can_join_event_free ? (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-pink-500/20 text-pink-500">
                    {t('oneFree')}
                  </span>
                ) : data.event_slots_available > 0 ? (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-pink-500/20 text-pink-500">
                    {t('slotsCount', { n: data.event_slots_available })}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/20 theme-text-secondary">
                    Quota atteint
                  </span>
                )}
              </div>
            </div>

            {/* Lien + d'infos */}
            <div className="pt-2 text-center">
              <Link
                href="/pricing"
                className="text-xs theme-text-secondary hover-accent hover-underline transition"
              >
                {t('moreInfoOffers')}
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Action 2: Rejoindre un tournoi */}
      <div className="rounded-xl border-2 border-green-500/30 overflow-hidden transition-all hover:border-green-500/60">
        <Link
          href="/dashboard?action=join"
          className="w-full p-4 flex items-center gap-4 text-left"
        >
          <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center flex-shrink-0">
            <Users className="w-6 h-6 text-green-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold theme-text">{t('joinTournament')}</p>
            <p className="text-sm theme-text-secondary truncate">
              {getJoinSummary()}
            </p>
          </div>
          <ChevronRight className="w-5 h-5 theme-text-secondary" />
        </Link>
      </div>

      {/* Action 3: Voir mes tournois */}
      {data.total_active_tournaments > 0 && (
        <div className="rounded-xl border-2 border-blue-500/30 overflow-hidden transition-all hover:border-blue-500/60">
          <button
            onClick={() => toggleSection('tournaments')}
            className="w-full p-4 flex items-center gap-4 text-left"
          >
            <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center flex-shrink-0">
              <Eye className="w-6 h-6 text-blue-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold theme-text">{t('myActiveTournaments')}</p>
              <p className="text-sm theme-text-secondary">
                {t('tournamentsCount', { n: data.total_active_tournaments })}
                {data.total_as_captain > 0 && t('asCaptain', { n: data.total_as_captain })}
              </p>
            </div>
            <ChevronRight className={`w-5 h-5 theme-text-secondary transition-transform ${expandedSection === 'tournaments' ? 'rotate-90' : ''}`} />
          </button>

          {/* Liste des tournois */}
          {expandedSection === 'tournaments' && (
            <div className="px-4 pb-4 space-y-2 border-t theme-border pt-3">
              {data.tournaments.map((tournament) => (
                <Link
                  key={tournament.id}
                  href={`/vestiaire/${tournament.slug}`}
                  className="flex items-center justify-between p-3 rounded-lg theme-bg hover:opacity-80 transition group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={`/images/icons/${
                        tournament.is_event ? 'event' :
                        tournament.tournament_type === 'free' ? 'free-tour' :
                        tournament.tournament_type === 'oneshot' ? 'on-shot-tour' :
                        tournament.tournament_type === 'elite' ? 'team-elite-tour' :
                        'premium-tour'
                      }.svg`}
                      alt=""
                      className={`w-4 h-4 ${
                        tournament.is_event ? 'icon-filter-rose' :
                        tournament.tournament_type === 'free' ? 'icon-filter-blue' :
                        tournament.tournament_type === 'oneshot' ? 'icon-filter-green' :
                        tournament.tournament_type === 'elite' ? 'icon-filter-orange' :
                        'icon-filter-yellow'
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="theme-text text-sm font-medium truncate">{tournament.name}</p>
                      <p className="text-xs theme-text-secondary">
                        {t('playersCount', { current: tournament.current_players, max: tournament.max_players })}
                        {tournament.participant_role === 'captain' && (
                          <span className="text-[#ff9900] ml-1">{t('captainSuffix')}</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      tournament.status === 'active'
                        ? 'bg-green-500/20 text-green-600 dark:text-green-400'
                        : tournament.status === 'warmup'
                        ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400'
                        : 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                    }`}>
                      {tournament.status === 'active' ? t('statusActive') :
                       tournament.status === 'warmup' ? t('statusWarmup') : t('statusPending')}
                    </span>
                    <ChevronRight className="w-4 h-4 theme-text-secondary opacity-0 group-hover:opacity-100 transition" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Action 4: Mes crédits */}
      <div className="rounded-xl border-2 border-purple-500/30 overflow-hidden transition-all hover:border-purple-500/60">
        <button
          onClick={() => toggleSection('credits')}
          className="w-full p-4 flex items-center gap-4 text-left"
        >
          <div className="w-12 h-12 bg-purple-500/10 rounded-full flex items-center justify-center flex-shrink-0">
            <Wallet className="w-6 h-6 text-purple-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold theme-text">{t('myCredits')}</p>
            <p className="text-sm theme-text-secondary">
              {t('creditsAvailable', { n: getTotalCredits() })}
            </p>
          </div>
          <ChevronRight className={`w-5 h-5 theme-text-secondary transition-transform ${expandedSection === 'credits' ? 'rotate-90' : ''}`} />
        </button>

        {/* Détails Crédits */}
        {expandedSection === 'credits' && (
          <div className="px-4 pb-4 space-y-3 border-t theme-border pt-3">
            {/* Crédits de création */}
            <div className="space-y-2">
              <p className="text-xs font-semibold theme-text-secondary uppercase tracking-wide">{t('creationSection')}</p>

              {/* Free-Kick slots */}
              <div className="flex items-center justify-between p-2 rounded-lg theme-bg">
                <div className="flex items-center gap-2">
                  <img src="/images/icons/free-tour.svg" alt="" className="w-4 h-4 icon-filter-blue" />
                  <div>
                    <span className="text-sm theme-text">Free-Kick</span>
                    <p className="text-xs theme-text-secondary">{t('maxActive', { n: data.free_tournaments_max })}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {freeCreationSlots > 0 ? (
                    <>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-500">
                        {t('available', { n: freeCreationSlots })}
                      </span>
                      <Link href="/vestiaire?type=free" className="text-xs text-blue-500 hover:underline">
                        {t('create')}
                      </Link>
                    </>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/20 theme-text-secondary">
                      {t('none')}
                    </span>
                  )}
                </div>
              </div>

              {/* One-Shot */}
              <div className="flex items-center justify-between p-2 rounded-lg theme-bg">
                <div className="flex items-center gap-2">
                  <img src="/images/icons/on-shot-tour.svg" alt="" className="w-4 h-4 icon-filter-green" />
                  <span className="text-sm theme-text">One-Shot</span>
                </div>
                <div className="flex items-center gap-2">
                  {(data.credits?.oneshot || 0) > 0 ? (
                    <>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-500">
                        {t('creditsCount', { n: data.credits?.oneshot || 0 })}
                      </span>
                      <Link href="/vestiaire?type=oneshot&use_credit=true" className="text-xs text-green-500 hover:underline">
                        {t('create')}
                      </Link>
                    </>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/20 theme-text-secondary">
                      {t('none')}
                    </span>
                  )}
                </div>
              </div>

              {/* Elite */}
              <div className="flex items-center justify-between p-2 rounded-lg theme-bg">
                <div className="flex items-center gap-2">
                  <img src="/images/icons/team-elite-tour.svg" alt="" className="w-4 h-4 icon-filter-orange" />
                  <span className="text-sm theme-text">Elite Team</span>
                </div>
                <div className="flex items-center gap-2">
                  {(data.credits?.elite || 0) > 0 ? (
                    <>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[#ff9900]/20 text-[#ff9900]">
                        {t('creditsCount', { n: data.credits?.elite || 0 })}
                      </span>
                      <Link href="/vestiaire?type=elite&use_credit=true" className="text-xs text-[#ff9900] hover:underline">
                        {t('create')}
                      </Link>
                    </>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/20 theme-text-secondary">
                      {t('none')}
                    </span>
                  )}
                </div>
              </div>

              {/* Platinium Solo */}
              <div className="flex items-center justify-between p-2 rounded-lg theme-bg">
                <div className="flex items-center gap-2">
                  <img src="/images/icons/premium-tour.svg" alt="" className="w-4 h-4 icon-filter-yellow" />
                  <span className="text-sm theme-text">Platinium Solo</span>
                </div>
                <div className="flex items-center gap-2">
                  {(data.credits?.platinium_solo || 0) > 0 ? (
                    <>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-500">
                        {t('creditsCount', { n: data.credits?.platinium_solo || 0 })}
                      </span>
                      <Link href="/vestiaire?type=platinium&use_credit=true" className="text-xs text-yellow-500 hover:underline">
                        {t('create')}
                      </Link>
                    </>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/20 theme-text-secondary">
                      {t('none')}
                    </span>
                  )}
                </div>
              </div>

              {/* Platinium Groupe */}
              <div className="flex items-center justify-between p-2 rounded-lg theme-bg">
                <div className="flex items-center gap-2">
                  <img src="/images/icons/premium-tour.svg" alt="" className="w-4 h-4 icon-filter-yellow" />
                  <span className="text-sm theme-text">{t('platiniumGroupLabel')}</span>
                </div>
                <div className="flex items-center gap-2">
                  {(data.credits?.platinium_group || 0) > 0 ? (
                    <>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-500">
                        {t('creditsCount', { n: data.credits?.platinium_group || 0 })}
                      </span>
                      <Link href="/vestiaire?type=platinium&use_credit=true&group=true" className="text-xs text-yellow-500 hover:underline">
                        {t('create')}
                      </Link>
                    </>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/20 theme-text-secondary">
                      {t('none')}
                    </span>
                  )}
                </div>
              </div>

              {/* Événement */}
              <div className="flex items-center justify-between p-2 rounded-lg theme-bg">
                <div className="flex items-center gap-2">
                  <img src="/images/icons/event.svg" alt="" className="w-4 h-4 icon-filter-rose" />
                  <div>
                    <span className="text-sm theme-text">{t('event')}</span>
                    <p className="text-xs theme-text-secondary">{t('oneFreeParticipation')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {data.can_join_event_free ? (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-pink-500/20 text-pink-500">
                      {t('oneFree')}
                    </span>
                  ) : data.event_slots_available > 0 ? (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-pink-500/20 text-pink-500">
                      {t('slotsCount', { n: data.event_slots_available })}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/20 theme-text-secondary">
                      {t('used')}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Crédits pour rejoindre */}
            <div className="space-y-2 pt-2 border-t theme-border">
              <p className="text-xs font-semibold theme-text-secondary uppercase tracking-wide">{t('joinTournament')}</p>

              {/* Invitation gratuite premium */}
              <div className="p-2 rounded-lg theme-bg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Users className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <span className="text-sm theme-text">{t('freeInvitation')}</span>
                      <p className="text-xs theme-text-secondary hidden sm:block">{t('onePerPremium')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {data.can_join_premium_free ? (
                      <>
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-500 whitespace-nowrap">
                          {t('oneAvailable')}
                        </span>
                        <Link href="/rejoindre" className="text-xs text-green-500 hover:underline whitespace-nowrap">
                          {t('join')}
                        </Link>
                      </>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/20 theme-text-secondary">
                        {t('usedFem')}
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-xs theme-text-secondary sm:hidden mt-1 ml-6">{t('onePerPremium')}</p>
              </div>

              {/* Slots invités payés */}
              <div className="p-2 rounded-lg theme-bg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Users className="w-4 h-4 text-purple-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <span className="text-sm theme-text">{t('paidInviteSlots')}</span>
                      <p className="text-xs theme-text-secondary hidden sm:block">{t('toJoinPaid')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {(data.credits?.slot_invite || 0) > 0 ? (
                      <>
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/20 text-purple-500 whitespace-nowrap">
                          {t('available', { n: data.credits?.slot_invite || 0 })}
                        </span>
                        <Link href="/rejoindre" className="text-xs text-purple-500 hover:underline whitespace-nowrap">
                          {t('join')}
                        </Link>
                      </>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/20 theme-text-secondary">
                        {t('none')}
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-xs theme-text-secondary sm:hidden mt-1 ml-6">{t('toJoinPaid')}</p>
              </div>
            </div>

            {/* Crédits d'extension */}
            {((data.credits?.duration_extension || 0) > 0 || (data.credits?.player_extension || 0) > 0) && (
              <div className="space-y-2 pt-2 border-t theme-border">
                <p className="text-xs font-semibold theme-text-secondary uppercase tracking-wide">{t('extensionsSection')}</p>

                {/* Extension de durée */}
                {(data.credits?.duration_extension || 0) > 0 && (
                  <div className="flex items-center justify-between p-2 rounded-lg theme-bg">
                    <div className="flex items-center gap-2">
                      <img src="/images/icons/calendar.svg" alt="" className="w-4 h-4 icon-filter-blue" />
                      <div>
                        <span className="text-sm theme-text">{t('durationExtension')}</span>
                        <p className="text-xs theme-text-secondary">{t('upTo10Matchdays')}</p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-500">
                      {t('creditsCount', { n: data.credits?.duration_extension || 0 })}
                    </span>
                  </div>
                )}

                {/* Extension de joueurs */}
                {(data.credits?.player_extension || 0) > 0 && (
                  <div className="flex items-center justify-between p-2 rounded-lg theme-bg">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-green-500" />
                      <div>
                        <span className="text-sm theme-text">{t('playerExtension')}</span>
                        <p className="text-xs theme-text-secondary">{t('plus5Seats')}</p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-500">
                      {t('creditsCount', { n: data.credits?.player_extension || 0 })}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Séparateur */}
      <div className="border-t theme-border my-6"></div>

      {/* CTA Acheter */}
      <Link
        href="/pricing"
        className="flex items-center justify-center gap-2 w-full p-4 rounded-xl bg-gradient-to-r from-[#ff9900] to-[#e68a00] text-black font-semibold hover:brightness-110 transition"
      >
        <PlusCircle className="w-5 h-5" />
        {t('buyCredits')}
      </Link>

      {/* Note explicative */}
      <p className="text-xs theme-text-secondary text-center">
        {t('extensionsNote')}
      </p>
    </div>
  )
}
