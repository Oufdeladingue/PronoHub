'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Zap, Trophy, Users, Award, Building2, AlertTriangle, Plus, Clock, UserPlus, Sparkles, ChevronRight } from 'lucide-react'
import { PRICES, formatPrice } from '@/types/monetization'
import Image from 'next/image'
import Link from 'next/link'

interface UserTournament {
  id: string
  name: string
  slug: string
  tournament_type: string
  status: string
  participant_role: string
  invite_type: string
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
  duration_extension: number
  player_extension: number
}

interface ZoneVIPData {
  // Quotas
  free_tournaments_active: number
  free_tournaments_max: number
  premium_invites_active: number
  premium_invites_max: number
  can_create_free_tournament: boolean
  can_join_premium_free: boolean

  // Crédits disponibles
  credits?: Credits
  creditDetails?: Array<{
    id: string
    type: string
    subtype: string | null
    slots: number | null
    amount: number
    created_at: string
  }>

  // Tournois actifs par type
  tournaments: UserTournament[]

  // Résumé
  total_active_tournaments: number
  total_as_captain: number
}

export default function UserQuotasCard() {
  const router = useRouter()
  const [data, setData] = useState<ZoneVIPData | null>(null)
  const [loading, setLoading] = useState(true)

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
      <div className="animate-pulse">
        <div className="h-6 theme-bg rounded w-1/3 mb-4"></div>
        <div className="space-y-3">
          <div className="h-4 theme-bg rounded w-full"></div>
          <div className="h-4 theme-bg rounded w-2/3"></div>
        </div>
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

  // Grouper les tournois par type
  const freeTournaments = data.tournaments.filter(t => t.tournament_type === 'free')
  const oneshotTournaments = data.tournaments.filter(t => t.tournament_type === 'oneshot')
  const eliteTournaments = data.tournaments.filter(t => t.tournament_type === 'elite')
  const platiniumTournaments = data.tournaments.filter(t => t.tournament_type === 'platinium')

  return (
    <div className="space-y-6">
      {/* En-tête Zone VIP */}
      <div className="flex items-center gap-3 pb-4 border-b theme-border">
        <div className="w-12 h-12 bg-gradient-to-br from-[#ff9900] to-[#e68a00] rounded-full flex items-center justify-center">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="font-bold text-xl theme-accent-text-always">Zone VIP</h3>
          <p className="text-sm theme-text-secondary">
            {data.total_active_tournaments} tournoi{data.total_active_tournaments > 1 ? 's' : ''} actif{data.total_active_tournaments > 1 ? 's' : ''}
            {data.total_as_captain > 0 && ` · ${data.total_as_captain} en tant que capitaine`}
          </p>
        </div>
      </div>

      {/* Section Quotas */}
      <div className="space-y-4">
        <h4 className="font-semibold theme-text flex items-center gap-2">
          <Image src="/images/icons/free-tour.svg" alt="" width={20} height={20} className="icon-filter-orange" />
          Mes quotas Free-Kick
        </h4>

        {/* Barre de progression tournois gratuits */}
        <div className="stat-card border-blue-200 dark:border-blue-800/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm theme-text-secondary">Tournois gratuits actifs</span>
            <span className={`font-bold ${data.free_tournaments_active >= data.free_tournaments_max ? 'text-red-500' : 'text-blue-600 dark:text-blue-400'}`}>
              {data.free_tournaments_active}/{data.free_tournaments_max}
            </span>
          </div>
          <div className="h-3 theme-bg rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                data.free_tournaments_active >= data.free_tournaments_max
                  ? 'bg-red-500'
                  : 'bg-blue-500'
              }`}
              style={{ width: `${Math.min((data.free_tournaments_active / data.free_tournaments_max) * 100, 100)}%` }}
            />
          </div>
          {data.free_tournaments_active >= data.free_tournaments_max && (
            <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Limite atteinte - Achetez un slot pour rejoindre un autre tournoi
            </p>
          )}
        </div>

        {/* Invitation premium */}
        <div className="stat-card border-green-200 dark:border-green-800/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm theme-text-secondary">Invitation premium gratuite</span>
            <span className={`font-bold ${data.premium_invites_active >= data.premium_invites_max ? 'text-orange-500' : 'text-green-600 dark:text-green-400'}`}>
              {data.can_join_premium_free ? 'Disponible' : 'Utilisée'}
            </span>
          </div>
          <p className="text-xs theme-text-secondary">
            Vous pouvez être invité gratuitement dans 1 tournoi One-Shot ou Elite Team
          </p>
        </div>
      </div>

      {/* Séparateur */}
      <div className="border-t theme-border"></div>

      {/* Section Crédits disponibles */}
      {data.credits && (data.credits.oneshot > 0 || data.credits.elite > 0 || data.credits.platinium_solo > 0 || data.credits.platinium_group > 0 || data.credits.slot_invite > 0) && (
        <>
          <div className="space-y-4">
            <h4 className="font-semibold theme-text flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#ff9900]" />
              Mes crédits disponibles
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Crédits One-Shot */}
              {data.credits.oneshot > 0 && (
                <Link
                  href="/vestiaire?type=oneshot&use_credit=true"
                  className="stat-card border-green-200 dark:border-green-800/50 bg-green-50/50 dark:bg-green-900/10 hover:border-green-400 dark:hover:border-green-600 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                      <Trophy className="w-5 h-5 text-green-500 dark:text-green-400" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium theme-text">One-Shot</p>
                      <p className="text-xs theme-text-secondary">Tournoi à créer</p>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold text-green-600 dark:text-green-400">{data.credits.oneshot}</span>
                      <p className="text-xs theme-text-secondary">crédit{data.credits.oneshot > 1 ? 's' : ''}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-green-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              )}

              {/* Crédits Elite */}
              {data.credits.elite > 0 && (
                <Link
                  href="/vestiaire?type=elite&use_credit=true"
                  className="stat-card border-orange-200 dark:border-orange-800/50 bg-orange-50/50 dark:bg-orange-900/10 hover:border-orange-400 dark:hover:border-orange-600 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                      <Users className="w-5 h-5 text-[#ff9900]" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium theme-text">Elite Team</p>
                      <p className="text-xs theme-text-secondary">Tournoi à créer</p>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold text-[#ff9900]">{data.credits.elite}</span>
                      <p className="text-xs theme-text-secondary">crédit{data.credits.elite > 1 ? 's' : ''}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-[#ff9900] opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              )}

              {/* Crédits Platinium solo */}
              {data.credits.platinium_solo > 0 && (
                <div className="stat-card border-yellow-200 dark:border-yellow-800/50 bg-yellow-50/50 dark:bg-yellow-900/10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-yellow-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                      <Award className="w-5 h-5 text-yellow-500 dark:text-yellow-400" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium theme-text">Platinium</p>
                      <p className="text-xs theme-text-secondary">Participation (rejoindre un tournoi)</p>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{data.credits.platinium_solo}</span>
                      <p className="text-xs theme-text-secondary">crédit{data.credits.platinium_solo > 1 ? 's' : ''}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Crédits Platinium groupe */}
              {data.credits.platinium_group > 0 && (
                <Link
                  href="/vestiaire?type=platinium&use_credit=true"
                  className="stat-card border-yellow-200 dark:border-yellow-800/50 bg-yellow-50/50 dark:bg-yellow-900/10 hover:border-yellow-400 dark:hover:border-yellow-600 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-yellow-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                      <Award className="w-5 h-5 text-yellow-500 dark:text-yellow-400" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium theme-text">Platinium Groupe</p>
                      <p className="text-xs theme-text-secondary">Places prépayées à utiliser</p>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{data.credits.platinium_group}</span>
                      <p className="text-xs theme-text-secondary">place{data.credits.platinium_group > 1 ? 's' : ''}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-yellow-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              )}

              {/* Crédits Slot invite */}
              {data.credits.slot_invite > 0 && (
                <Link
                  href="/dashboard?action=join"
                  className="stat-card border-blue-200 dark:border-blue-800/50 bg-blue-50/50 dark:bg-blue-900/10 hover:border-blue-400 dark:hover:border-blue-600 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                      <UserPlus className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium theme-text">Slot supplémentaire</p>
                      <p className="text-xs theme-text-secondary">Rejoindre un tournoi</p>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">{data.credits.slot_invite}</span>
                      <p className="text-xs theme-text-secondary">crédit{data.credits.slot_invite > 1 ? 's' : ''}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              )}
            </div>

            <p className="text-xs theme-text-secondary text-center">
              Cliquez sur un crédit pour l'utiliser
            </p>
          </div>

          {/* Séparateur */}
          <div className="border-t theme-border"></div>
        </>
      )}

      {/* Mes tournois actifs */}
      <div className="space-y-4">
        <h4 className="font-semibold theme-text">Mes tournois actifs</h4>

        {data.tournaments.length === 0 ? (
          <div className="text-center py-8 theme-text-secondary">
            <p className="mb-4">Vous ne participez à aucun tournoi pour le moment</p>
            <Link
              href="/dashboard"
              className="theme-btn-primary inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Créer ou rejoindre un tournoi
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Tournois FREE */}
            {freeTournaments.length > 0 && (
              <TournamentGroup
                title="Free-Kick"
                icon={<Zap className="w-5 h-5 text-blue-500 dark:text-blue-400" />}
                tournaments={freeTournaments}
                color="blue"
              />
            )}

            {/* Tournois ONE-SHOT */}
            {oneshotTournaments.length > 0 && (
              <TournamentGroup
                title="One-Shot"
                icon={<Trophy className="w-5 h-5 text-green-500 dark:text-green-400" />}
                tournaments={oneshotTournaments}
                color="green"
              />
            )}

            {/* Tournois ELITE */}
            {eliteTournaments.length > 0 && (
              <TournamentGroup
                title="Elite Team"
                icon={<Users className="w-5 h-5 text-[#ff9900]" />}
                tournaments={eliteTournaments}
                color="orange"
              />
            )}

            {/* Tournois PLATINIUM */}
            {platiniumTournaments.length > 0 && (
              <TournamentGroup
                title="Platinium"
                icon={<Award className="w-5 h-5 text-yellow-500 dark:text-yellow-400" />}
                tournaments={platiniumTournaments}
                color="yellow"
              />
            )}
          </div>
        )}
      </div>

      {/* Séparateur */}
      <div className="border-t theme-border"></div>

      {/* Section Achats */}
      <div className="space-y-4">
        <h4 className="font-semibold theme-text flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[#ff9900]" />
          Acheter des formules
        </h4>

        {/* Grille des offres */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* One-Shot */}
          <button
            onClick={() => router.push('/pricing')}
            className="stat-card border-green-200 dark:border-green-800/50 hover:border-green-400 dark:hover:border-green-600 transition-all text-left group"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-green-500 dark:text-green-400" />
                <span className="font-medium theme-text">One-Shot</span>
              </div>
              <span className="font-bold text-green-600 dark:text-green-400">{formatPrice(PRICES.ONESHOT_CREATION)}</span>
            </div>
            <p className="text-xs theme-text-secondary">
              1 tournoi · {PRICES.ONESHOT_MAX_PLAYERS} joueurs · Durée illimitée
            </p>
            <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 mt-2 group-hover:underline">
              Créer un One-Shot <ChevronRight className="w-3 h-3" />
            </div>
          </button>

          {/* Elite Team */}
          <button
            onClick={() => router.push('/pricing')}
            className="stat-card border-blue-200 dark:border-blue-800/50 hover:border-blue-400 dark:hover:border-blue-600 transition-all text-left group"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                <span className="font-medium theme-text">Elite Team</span>
              </div>
              <span className="font-bold text-blue-600 dark:text-blue-400">{formatPrice(PRICES.ELITE_CREATION)}</span>
            </div>
            <p className="text-xs theme-text-secondary">
              1 tournoi · {PRICES.ELITE_MAX_PLAYERS} joueurs · Jeu en équipe
            </p>
            <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 mt-2 group-hover:underline">
              Créer un Elite Team <ChevronRight className="w-3 h-3" />
            </div>
          </button>

          {/* Platinium */}
          <button
            onClick={() => router.push('/pricing')}
            className="stat-card border-yellow-200 dark:border-yellow-800/50 hover:border-yellow-400 dark:hover:border-yellow-600 transition-all text-left group"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-yellow-500 dark:text-yellow-400" />
                <span className="font-medium theme-text">Platinium</span>
              </div>
              <span className="font-bold text-yellow-600 dark:text-yellow-400">{formatPrice(PRICES.PLATINIUM_CREATION)}/pers.</span>
            </div>
            <p className="text-xs theme-text-secondary">
              11-30 joueurs · Lot pour le vainqueur
            </p>
            <div className="flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400 mt-2 group-hover:underline">
              Créer un Platinium <ChevronRight className="w-3 h-3" />
            </div>
          </button>

          {/* Entreprise */}
          <button
            onClick={() => router.push('/contact?type=enterprise')}
            className="stat-card border-purple-200 dark:border-purple-800/50 hover:border-purple-400 dark:hover:border-purple-600 transition-all text-left group"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-purple-500 dark:text-purple-400" />
                <span className="font-medium theme-text">Corpo</span>
              </div>
              <span className="font-bold text-purple-600 dark:text-purple-400">Sur devis</span>
            </div>
            <p className="text-xs theme-text-secondary">
              Jusqu'à 300 joueurs · Branding personnalisé
            </p>
            <div className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 mt-2 group-hover:underline">
              Nous contacter <ChevronRight className="w-3 h-3" />
            </div>
          </button>
        </div>
      </div>

      {/* Séparateur */}
      <div className="border-t theme-border"></div>

      {/* Extensions Free-Kick */}
      <div className="space-y-4">
        <h4 className="font-semibold theme-text flex items-center gap-2">
          <Plus className="w-5 h-5 text-blue-500 dark:text-blue-400" />
          Pas de salary cap chez nous !
        </h4>

        <div className="grid grid-cols-1 gap-3">
          {/* Recrue du mercato - 0.99€ */}
          <div className="stat-card border-blue-200 dark:border-blue-800/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 theme-bg rounded-full flex items-center justify-center flex-shrink-0">
                <UserPlus className="w-5 h-5 text-blue-500 dark:text-blue-400" />
              </div>
              <div className="text-left">
                <p className="font-medium theme-text">Recrue du mercato</p>
                <p className="text-xs theme-text-secondary">Rejoindre ou créer un 3ème tournoi gratuit</p>
              </div>
            </div>
            <span className="font-bold text-blue-600 dark:text-blue-400 flex-shrink-0">{formatPrice(PRICES.SLOT_INVITE)}</span>
          </div>

          {/* Renfort du banc - 1.99€ */}
          <div className="stat-card border-orange-200 dark:border-orange-800/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 theme-bg rounded-full flex items-center justify-center flex-shrink-0">
                <Users className="w-5 h-5 text-[#ff9900]" />
              </div>
              <div className="text-left">
                <p className="font-medium theme-text">Renfort du banc</p>
                <p className="text-xs theme-text-secondary">Augmenter la capacité du tournoi de 5 joueurs supplémentaires</p>
              </div>
            </div>
            <span className="font-bold text-[#ff9900] flex-shrink-0">{formatPrice(PRICES.PLAYER_EXTENSION)}</span>
          </div>

          {/* Joue les prolongations - 3.99€ */}
          <div className="stat-card border-green-200 dark:border-green-800/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 theme-bg rounded-full flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5 text-green-500 dark:text-green-400" />
              </div>
              <div className="text-left">
                <p className="font-medium theme-text">Joue les prolongations</p>
                <p className="text-xs theme-text-secondary">Prolonger le tournoi jusqu'à la fin de la compétition</p>
              </div>
            </div>
            <span className="font-bold text-green-600 dark:text-green-400 flex-shrink-0">{formatPrice(PRICES.DURATION_EXTENSION)}</span>
          </div>
        </div>

        <p className="text-xs theme-text-secondary text-center">
          Les extensions sont achetables depuis la page du tournoi concerné
        </p>
      </div>

      {/* Lien vers tarifs complets */}
      <div className="pt-4 text-center">
        <Link
          href="/pricing"
          className="inline-flex items-center gap-2 text-sm text-[#ff9900] hover:text-[#e68a00] transition"
        >
          Voir tous les tarifs <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  )
}

// Composant pour afficher un groupe de tournois
function TournamentGroup({
  title,
  icon,
  tournaments,
  color,
}: {
  title: string
  icon: React.ReactNode
  tournaments: UserTournament[]
  color: 'blue' | 'green' | 'orange' | 'yellow' | 'purple'
}) {
  const borderColors = {
    blue: 'border-blue-200 dark:border-blue-800/50',
    green: 'border-green-200 dark:border-green-800/50',
    orange: 'border-orange-200 dark:border-orange-800/50',
    yellow: 'border-yellow-200 dark:border-yellow-800/50',
    purple: 'border-purple-200 dark:border-purple-800/50',
  }

  return (
    <div className={`rounded-lg theme-card border ${borderColors[color]} overflow-hidden`}>
      <div className="px-4 py-2 border-b theme-border flex items-center gap-2 theme-bg">
        {icon}
        <span className="font-medium theme-text text-sm">{title}</span>
        <span className="text-xs theme-text-secondary ml-auto">{tournaments.length} tournoi{tournaments.length > 1 ? 's' : ''}</span>
      </div>
      <div className="divide-y theme-border">
        {tournaments.map((tournament) => (
          <Link
            key={tournament.id}
            href={`/vestiaire/${tournament.slug}`}
            className="flex items-center justify-between px-4 py-3 hover:theme-bg transition"
          >
            <div>
              <p className="font-medium theme-text text-sm">{tournament.name}</p>
              <p className="text-xs theme-text-secondary">
                {tournament.competition_name} · {tournament.current_players}/{tournament.max_players} joueurs
                {tournament.participant_role === 'captain' && (
                  <span className="ml-2 text-[#ff9900]">(Capitaine)</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                tournament.status === 'active'
                  ? 'bg-green-500/20 text-green-600 dark:text-green-400'
                  : tournament.status === 'warmup'
                  ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400'
                  : tournament.status === 'pending'
                  ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                  : 'bg-gray-500/20 theme-text-secondary'
              }`}>
                {tournament.status === 'active' ? 'En cours' : tournament.status === 'warmup' ? 'Échauffement' : tournament.status === 'pending' ? 'En attente' : tournament.status}
              </span>
              <ChevronRight className="w-4 h-4 theme-text-secondary" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
