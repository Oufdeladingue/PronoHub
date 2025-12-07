'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, Loader2, Trophy, Users, PlusCircle, Eye, Wallet } from 'lucide-react'
import Link from 'next/link'

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
}

interface Credits {
  oneshot: number
  elite: number
  platinium_solo: number
  platinium_group: number
  slot_invite: number
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
  credits?: Credits
  tournaments: UserTournament[]
  total_active_tournaments: number
  total_as_captain: number
}

export default function UserQuotasCard() {
  const router = useRouter()
  const [data, setData] = useState<ZoneVIPData | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedSection, setExpandedSection] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const response = await fetch('/api/user/zone-vip')
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
        Impossible de charger les données
      </div>
    )
  }

  // Calculer les crédits de création disponibles
  const freeCreationSlots = data.free_tournaments_max - data.free_tournaments_active
  const totalCreationCredits =
    freeCreationSlots +
    (data.credits?.oneshot || 0) +
    (data.credits?.elite || 0) +
    (data.credits?.platinium_solo || 0) +
    (data.credits?.platinium_group || 0)

  // Calculer les crédits pour rejoindre
  const freeJoinSlots = data.can_join_premium_free ? 1 : 0
  const paidJoinSlots = (data.credits?.slot_invite || 0) + (data.paid_slots_total - data.paid_slots_used)
  const totalJoinCredits = freeJoinSlots + paidJoinSlots

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
    return parts.length > 0 ? parts.join(' · ') : 'Aucun crédit'
  }

  // Construire le résumé pour "Rejoindre"
  const getJoinSummary = () => {
    if (freeJoinSlots > 0) {
      return '1 invitation gratuite disponible'
    }
    if (paidJoinSlots > 0) {
      return `${paidJoinSlots} slot${paidJoinSlots > 1 ? 's' : ''} disponible${paidJoinSlots > 1 ? 's' : ''}`
    }
    return 'Quota atteint'
  }

  // Calculer le total des crédits
  const getTotalCredits = () => {
    return (
      freeCreationSlots +
      (data.credits?.oneshot || 0) +
      (data.credits?.elite || 0) +
      (data.credits?.platinium_solo || 0) +
      (data.credits?.platinium_group || 0) +
      (data.credits?.slot_invite || 0) +
      (data.can_join_premium_free ? 1 : 0)
    )
  }

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section)
  }

  return (
    <div className="space-y-4">
      {/* Titre simplifié */}
      <div className="text-center pb-4">
        <h3 className="text-lg font-bold theme-text">Que voulez-vous faire ?</h3>
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
            <p className="font-semibold theme-text">Créer un tournoi</p>
            <p className="text-sm theme-text-secondary truncate">
              {totalCreationCredits > 0 ? getCreateSummary() : 'Quota atteint'}
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
                    <p className="text-xs theme-text-secondary">Quota de {data.free_tournaments_max} atteint</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {freeCreationSlots > 0 ? (
                  <>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-500">
                      {freeCreationSlots} dispo
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/20 theme-text-secondary">Gratuit</span>
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
                    {data.credits?.oneshot} crédit{(data.credits?.oneshot || 0) > 1 ? 's' : ''}
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
                    {data.credits?.elite} crédit{(data.credits?.elite || 0) > 1 ? 's' : ''}
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
                    {(data.credits?.platinium_solo || 0) + (data.credits?.platinium_group || 0)} crédit{((data.credits?.platinium_solo || 0) + (data.credits?.platinium_group || 0)) > 1 ? 's' : ''}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-500">6,99€</span>
                )}
                <ChevronRight className="w-4 h-4 text-yellow-500 opacity-0 group-hover:opacity-100 transition" />
              </div>
            </Link>

            {/* Lien + d'infos */}
            <div className="pt-2 text-center">
              <Link
                href="/pricing"
                className="text-xs theme-text-secondary hover-accent hover-underline transition"
              >
                + d'infos sur les offres
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Action 2: Rejoindre un tournoi */}
      <div className="rounded-xl border-2 border-green-500/30 overflow-hidden transition-all hover:border-green-500/60">
        <Link
          href="/rejoindre"
          className="w-full p-4 flex items-center gap-4 text-left"
        >
          <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center flex-shrink-0">
            <Users className="w-6 h-6 text-green-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold theme-text">Rejoindre un tournoi</p>
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
              <p className="font-semibold theme-text">Mes tournois actifs</p>
              <p className="text-sm theme-text-secondary">
                {data.total_active_tournaments} tournoi{data.total_active_tournaments > 1 ? 's' : ''}
                {data.total_as_captain > 0 && ` · ${data.total_as_captain} en capitaine`}
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
                        tournament.tournament_type === 'free' ? 'free-tour' :
                        tournament.tournament_type === 'oneshot' ? 'on-shot-tour' :
                        tournament.tournament_type === 'elite' ? 'team-elite-tour' :
                        'premium-tour'
                      }.svg`}
                      alt=""
                      className={`w-4 h-4 ${
                        tournament.tournament_type === 'free' ? 'icon-filter-blue' :
                        tournament.tournament_type === 'oneshot' ? 'icon-filter-green' :
                        tournament.tournament_type === 'elite' ? 'icon-filter-orange' :
                        'icon-filter-yellow'
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="theme-text text-sm font-medium truncate">{tournament.name}</p>
                      <p className="text-xs theme-text-secondary">
                        {tournament.current_players}/{tournament.max_players} joueurs
                        {tournament.participant_role === 'captain' && (
                          <span className="text-[#ff9900] ml-1">· Capitaine</span>
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
                      {tournament.status === 'active' ? 'En cours' :
                       tournament.status === 'warmup' ? 'Échauffement' : 'En attente'}
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
            <p className="font-semibold theme-text">Mes crédits</p>
            <p className="text-sm theme-text-secondary">
              {getTotalCredits()} crédit{getTotalCredits() > 1 ? 's' : ''} disponible{getTotalCredits() > 1 ? 's' : ''}
            </p>
          </div>
          <ChevronRight className={`w-5 h-5 theme-text-secondary transition-transform ${expandedSection === 'credits' ? 'rotate-90' : ''}`} />
        </button>

        {/* Détails Crédits */}
        {expandedSection === 'credits' && (
          <div className="px-4 pb-4 space-y-3 border-t theme-border pt-3">
            {/* Crédits de création */}
            <div className="space-y-2">
              <p className="text-xs font-semibold theme-text-secondary uppercase tracking-wide">Création de tournoi</p>

              {/* Free-Kick slots */}
              <div className="flex items-center justify-between p-2 rounded-lg theme-bg">
                <div className="flex items-center gap-2">
                  <img src="/images/icons/free-tour.svg" alt="" className="w-4 h-4 icon-filter-blue" />
                  <div>
                    <span className="text-sm theme-text">Free-Kick</span>
                    <p className="text-xs theme-text-secondary">Max {data.free_tournaments_max} actifs</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {freeCreationSlots > 0 ? (
                    <>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-500">
                        {freeCreationSlots} dispo
                      </span>
                      <Link href="/vestiaire?type=free" className="text-xs text-blue-500 hover:underline">
                        Créer
                      </Link>
                    </>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/20 theme-text-secondary">
                      Aucun
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
                        {data.credits?.oneshot} crédit{(data.credits?.oneshot || 0) > 1 ? 's' : ''}
                      </span>
                      <Link href="/vestiaire?type=oneshot&use_credit=true" className="text-xs text-green-500 hover:underline">
                        Créer
                      </Link>
                    </>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/20 theme-text-secondary">
                      Aucun
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
                        {data.credits?.elite} crédit{(data.credits?.elite || 0) > 1 ? 's' : ''}
                      </span>
                      <Link href="/vestiaire?type=elite&use_credit=true" className="text-xs text-[#ff9900] hover:underline">
                        Créer
                      </Link>
                    </>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/20 theme-text-secondary">
                      Aucun
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
                        {data.credits?.platinium_solo} crédit{(data.credits?.platinium_solo || 0) > 1 ? 's' : ''}
                      </span>
                      <Link href="/vestiaire?type=platinium&use_credit=true" className="text-xs text-yellow-500 hover:underline">
                        Créer
                      </Link>
                    </>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/20 theme-text-secondary">
                      Aucun
                    </span>
                  )}
                </div>
              </div>

              {/* Platinium Groupe */}
              <div className="flex items-center justify-between p-2 rounded-lg theme-bg">
                <div className="flex items-center gap-2">
                  <img src="/images/icons/premium-tour.svg" alt="" className="w-4 h-4 icon-filter-yellow" />
                  <span className="text-sm theme-text">Platinium Groupe (11 places)</span>
                </div>
                <div className="flex items-center gap-2">
                  {(data.credits?.platinium_group || 0) > 0 ? (
                    <>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-500">
                        {data.credits?.platinium_group} crédit{(data.credits?.platinium_group || 0) > 1 ? 's' : ''}
                      </span>
                      <Link href="/vestiaire?type=platinium&use_credit=true&group=true" className="text-xs text-yellow-500 hover:underline">
                        Créer
                      </Link>
                    </>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/20 theme-text-secondary">
                      Aucun
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Crédits pour rejoindre */}
            <div className="space-y-2 pt-2 border-t theme-border">
              <p className="text-xs font-semibold theme-text-secondary uppercase tracking-wide">Rejoindre un tournoi</p>

              {/* Invitation gratuite premium */}
              <div className="flex items-center justify-between p-2 rounded-lg theme-bg">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-green-500" />
                  <div>
                    <span className="text-sm theme-text">Invitation gratuite</span>
                    <p className="text-xs theme-text-secondary">1 par tournoi premium</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {data.can_join_premium_free ? (
                    <>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-500">
                        1 dispo
                      </span>
                      <Link href="/rejoindre" className="text-xs text-green-500 hover:underline">
                        Rejoindre
                      </Link>
                    </>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/20 theme-text-secondary">
                      Utilisée
                    </span>
                  )}
                </div>
              </div>

              {/* Slots invités payés */}
              <div className="flex items-center justify-between p-2 rounded-lg theme-bg">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-500" />
                  <div>
                    <span className="text-sm theme-text">Slots invités achetés</span>
                    <p className="text-xs theme-text-secondary">Pour rejoindre des tournois payants</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {(data.credits?.slot_invite || 0) > 0 ? (
                    <>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/20 text-purple-500">
                        {data.credits?.slot_invite} dispo
                      </span>
                      <Link href="/rejoindre" className="text-xs text-purple-500 hover:underline">
                        Rejoindre
                      </Link>
                    </>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/20 theme-text-secondary">
                      Aucun
                    </span>
                  )}
                </div>
              </div>
            </div>
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
        Acheter des crédits
      </Link>

      {/* Note explicative */}
      <p className="text-xs theme-text-secondary text-center">
        Les extensions de tournoi sont disponibles depuis la page de chaque tournoi
      </p>
    </div>
  )
}
