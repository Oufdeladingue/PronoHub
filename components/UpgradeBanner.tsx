'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Crown, Sparkles, AlertTriangle, X } from 'lucide-react'
import { UserQuotas, TournamentTypeResult, ACCOUNT_LIMITS } from '@/types/monetization'

interface UserCredits {
  oneshot_credits: number
  elite_credits: number
  platinium_solo_credits: number
  platinium_group_slots: number
  slot_invite_credits: number
  duration_extension_credits: number
  player_extension_credits: number
}

// Configuration d'une bannière
interface BannerConfig {
  icon: string
  iconFilter: string
  bgColor: string
  btnBg: string
  btnText: string
  title: string
  subtitleMobile: string
  subtitleDesktop: string
  buttonText: string
  buttonIcon?: string
  redirectTo: string
}

// Composant de bannière réutilisable - style pendante depuis la nav
interface BannerProps {
  config: BannerConfig
  isClosing: boolean
  onDismiss: () => void
  onAction: () => void
}

function Banner({ config, isClosing, onDismiss, onAction }: BannerProps) {
  return (
    <div className={`upgrade-banner-wrapper ${isClosing ? 'banner-closing' : ''}`}>
      <div>
        <div className="upgrade-banner border-2 p-3 md:p-5 pb-8 md:pb-5">
          <div className="flex flex-row items-center justify-between gap-3 pr-8 md:pr-10">
            <div className="flex items-center gap-2 md:gap-3">
              <div className={`w-8 h-8 md:w-10 md:h-10 ${config.bgColor} rounded-full flex items-center justify-center flex-shrink-0`}>
                <img src={config.icon} alt="" className="w-4 h-4 md:w-5 md:h-5 brightness-0" />
              </div>
              <div>
                <p className="font-medium upgrade-banner-title text-sm md:text-base">
                  {config.title}
                </p>
                <p className="text-xs md:text-sm upgrade-banner-subtitle">
                  <span className="md:hidden">{config.subtitleMobile}</span>
                  <span className="hidden md:inline">{config.subtitleDesktop}</span>
                </p>
              </div>
            </div>
            <button
              onClick={onAction}
              className={`premium-btn-shimmer flex items-center justify-center p-2 md:px-4 md:py-2 md:gap-2 ${config.btnBg} rounded-lg text-sm font-medium ${config.btnText} transition-all flex-shrink-0`}
              title={config.buttonText}
            >
              <img
                src={config.buttonIcon || config.icon}
                alt=""
                className={`w-5 h-5 md:w-4 md:h-4 ${config.iconFilter}`}
              />
              <span className="hidden md:inline">{config.buttonText}</span>
            </button>
          </div>
          {/* Bouton fermer en bas à droite */}
          <button
            onClick={onDismiss}
            className="banner-close-btn"
            title="Fermer"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  )
}

// Props pour passer les données pré-fetchées côté serveur (optimisation perf)
interface ServerQuotasData {
  free_tournaments_active: number
  free_tournaments_max: number
  can_create_tournament: boolean
}

interface ServerCreditsData {
  oneshot_credits: number
  elite_credits: number
  platinium_solo_credits: number
  platinium_group_slots: number
  slot_invite_credits: number
  duration_extension_credits: number
  player_extension_credits: number
}

interface UpgradeBannerProps {
  variant?: 'compact' | 'full'
  context?: 'create' | 'dashboard' | 'profile'
  // Props optionnelles pour passer les données pré-fetchées (évite les appels API côté client)
  serverQuotas?: ServerQuotasData
  serverCredits?: ServerCreditsData
}

export function UpgradeBanner({ variant = 'full', context = 'dashboard', serverQuotas, serverCredits }: UpgradeBannerProps) {
  const router = useRouter()
  const [quotas, setQuotas] = useState<UserQuotas | null>(serverQuotas ? {
    user_id: '',
    username: '',
    subscription_status: 'none' as const,
    subscription_type: null,
    subscription_expires_at: null,
    free_tournaments_active: serverQuotas.free_tournaments_active,
    free_tournaments_max: serverQuotas.free_tournaments_max,
    oneshot_tournaments_active: 0,
    oneshot_tournaments_max: 0,
    oneshot_slots_available: 0,
    premium_tournaments_active: 0,
    premium_tournaments_max: 0,
    enterprise_accounts_active: 0,
    can_create_tournament: serverQuotas.can_create_tournament
  } : null)
  const [tournamentType, setTournamentType] = useState<TournamentTypeResult | null>(null)
  const [credits, setCredits] = useState<UserCredits | null>(serverCredits || null)
  const [loading, setLoading] = useState(!serverQuotas) // Pas de loading si données serveur fournies
  const [dismissed, setDismissed] = useState(false)
  const [isClosing, setIsClosing] = useState(false)

  const handleDismiss = () => {
    setIsClosing(true)
  }

  useEffect(() => {
    // Si les données serveur sont fournies, on n'a pas besoin de fetcher
    if (serverQuotas) return
    fetchQuotas()
  }, [serverQuotas])

  const fetchQuotas = async () => {
    try {
      const [quotasRes, typeRes, creditsRes] = await Promise.all([
        fetch('/api/user/quotas'),
        fetch('/api/user/quotas', { method: 'POST' }),
        fetch('/api/user/credits')
      ])

      const quotasData = await quotasRes.json()
      const typeData = await typeRes.json()
      const creditsData = await creditsRes.json()

      if (quotasData.success) setQuotas(quotasData.quotas)
      if (typeData.success) setTournamentType(typeData.result)
      setCredits(creditsData)
    } catch (error) {
      console.error('Error fetching quotas:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading || !quotas || dismissed) return null

  const canCreate = quotas.can_create_tournament
  const currentType = tournamentType?.tournament_type || 'free'
  const maxPlayers = tournamentType?.max_players || ACCOUNT_LIMITS.free.maxPlayersPerTournament

  // Calculer si le quota Free-Kick est atteint
  const freeQuotaReached = quotas.free_tournaments_active >= quotas.free_tournaments_max

  // Calculer les crédits de création disponibles
  const hasOneshotCredits = (credits?.oneshot_credits || 0) > 0
  const hasEliteCredits = (credits?.elite_credits || 0) > 0
  const hasPlatiniumCredits = (credits?.platinium_solo_credits || 0) > 0 || (credits?.platinium_group_slots || 0) > 0
  const hasCreationCredits = hasOneshotCredits || hasEliteCredits || hasPlatiniumCredits

  // Compter le nombre de types de crédits différents
  const creditTypes = [hasOneshotCredits, hasEliteCredits, hasPlatiniumCredits].filter(Boolean).length

  // Ne pas afficher si l'utilisateur peut créer un tournoi gratuit (quota non atteint)
  if (canCreate && !freeQuotaReached) return null

  // Banniere compacte pour les pages de creation
  if (variant === 'compact') {
    return (
      <div className="bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border border-orange-500/30 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            {currentType === 'free' ? (
              <Sparkles className="w-5 h-5 text-orange-500" />
            ) : (
              <Crown className="w-5 h-5 text-orange-500" />
            )}
            <div>
              <p className="text-sm font-medium text-gray-200">
                {currentType === 'free' && `Tournoi gratuit - Max ${maxPlayers} joueurs`}
                {currentType === 'oneshot' && `Tournoi One-Shot - Max ${maxPlayers} joueurs`}
                {currentType === 'elite' && `Tournoi Elite - Max ${maxPlayers} joueurs`}
                {currentType === 'platinium' && `Tournoi Platinium - Max ${maxPlayers} joueurs`}
              </p>
              {currentType === 'free' && (
                <p className="text-xs text-gray-400">
                  Passez a Premium pour inviter jusqu'a 20 joueurs
                </p>
              )}
            </div>
          </div>
          {currentType === 'free' && (
            <button
              onClick={() => router.push('/pricing')}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 rounded-lg text-sm font-medium text-white transition-all"
            >
              <Crown className="w-4 h-4" />
              Passer Premium
            </button>
          )}
        </div>
      </div>
    )
  }

  // Determiner la configuration de la bannière selon le contexte
  const getBannerConfig = (): BannerConfig | null => {
    // Quota atteint sans crédits -> Passer Pro
    if (!canCreate) {
      return {
        icon: '/images/icons/double.svg',
        iconFilter: 'icon-filter-premium',
        bgColor: 'bg-[#ff9900]',
        btnBg: 'bg-orange-500/20 hover:bg-orange-500/30',
        btnText: 'text-orange-400',
        title: 'Magnifique doublé !',
        subtitleMobile: `Limite de ${quotas.free_tournaments_max} tournois gratuits atteinte !\nPasse Pro pour créer un autre tournoi...`,
        subtitleDesktop: `Limite de ${quotas.free_tournaments_max} tournois gratuits actifs atteinte ! Signe ton premier contrat Pro pour poursuivre ta carrière...`,
        buttonText: 'Passer Pro',
        buttonIcon: '/images/icons/premium.svg',
        redirectTo: '/pricing'
      }
    }

    // Quota Free-Kick atteint AVEC crédits disponibles
    if (freeQuotaReached && hasCreationCredits) {
      // Plusieurs types de crédits
      if (creditTypes > 1) {
        const creditsList: string[] = []
        if (hasOneshotCredits) creditsList.push(`${credits?.oneshot_credits} One-Shot`)
        if (hasEliteCredits) creditsList.push(`${credits?.elite_credits} Elite`)
        if (hasPlatiniumCredits) {
          const platTotal = (credits?.platinium_solo_credits || 0) + (credits?.platinium_group_slots || 0)
          creditsList.push(`${platTotal} Platinium`)
        }
        return {
          icon: '/images/icons/premium.svg',
          iconFilter: 'icon-filter-orange',
          bgColor: 'bg-[#ff9900]',
          btnBg: 'bg-orange-500/20 hover:bg-orange-500/30',
          btnText: 'text-orange-400',
          title: 'Crédits disponibles',
          subtitleMobile: creditsList.join(', '),
          subtitleDesktop: `Limite de ${quotas.free_tournaments_max} tournois Free-Kick atteinte · Crédits disponibles : ${creditsList.join(', ')}`,
          buttonText: 'Choisir',
          redirectTo: '/vestiaire'
        }
      }

      // Un seul type de crédit
      if (hasOneshotCredits) {
        return {
          icon: '/images/icons/on-shot-tour.svg',
          iconFilter: 'icon-filter-green',
          bgColor: 'bg-green-500',
          btnBg: 'bg-green-500/20 hover:bg-green-500/30',
          btnText: 'text-green-400',
          title: 'Tournoi One-Shot disponible',
          subtitleMobile: `Limite Free-Kick atteinte · ${credits?.oneshot_credits} crédit${(credits?.oneshot_credits || 0) > 1 ? 's' : ''} One-Shot`,
          subtitleDesktop: `Limite de ${quotas.free_tournaments_max} tournois Free-Kick atteinte · Vous avez un crédit One-Shot disponible pour un tournoi jusqu'à 10 joueurs`,
          buttonText: 'Utiliser',
          redirectTo: '/vestiaire?type=oneshot'
        }
      }

      if (hasEliteCredits) {
        return {
          icon: '/images/icons/team-elite-tour.svg',
          iconFilter: 'icon-filter-orange',
          bgColor: 'bg-[#ff9900]',
          btnBg: 'bg-orange-500/20 hover:bg-orange-500/30',
          btnText: 'text-orange-400',
          title: 'Tournoi Elite Team disponible',
          subtitleMobile: `Limite Free-Kick atteinte · ${credits?.elite_credits} crédit${(credits?.elite_credits || 0) > 1 ? 's' : ''} Elite`,
          subtitleDesktop: `Limite de ${quotas.free_tournaments_max} tournois Free-Kick atteinte · Vous avez un crédit Elite Team disponible pour un tournoi jusqu'à 20 joueurs`,
          buttonText: 'Utiliser',
          redirectTo: '/vestiaire?type=elite'
        }
      }

      // Platinium
      const platTotal = (credits?.platinium_solo_credits || 0) + (credits?.platinium_group_slots || 0)
      return {
        icon: '/images/icons/premium-tour.svg',
        iconFilter: 'icon-filter-yellow',
        bgColor: 'bg-yellow-500',
        btnBg: 'bg-yellow-500/20 hover:bg-yellow-500/30',
        btnText: 'text-yellow-400',
        title: 'Tournoi Platinium disponible',
        subtitleMobile: `Limite Free-Kick atteinte · ${platTotal} crédit${platTotal > 1 ? 's' : ''} Platinium`,
        subtitleDesktop: `Limite de ${quotas.free_tournaments_max} tournois Free-Kick atteinte · Vous avez un crédit Platinium disponible pour un tournoi jusqu'à 30 joueurs`,
        buttonText: 'Utiliser',
        redirectTo: '/vestiaire?type=platinium'
      }
    }

    // Quota Free-Kick atteint avec possibilité de créer un autre type
    if (freeQuotaReached && canCreate && currentType !== 'free') {
      if (currentType === 'oneshot') {
        return {
          icon: '/images/icons/on-shot-tour.svg',
          iconFilter: 'icon-filter-green',
          bgColor: 'bg-green-500',
          btnBg: 'bg-green-500/20 hover:bg-green-500/30',
          btnText: 'text-green-400',
          title: 'Tournoi One-Shot disponible',
          subtitleMobile: 'Limite Free-Kick atteinte · 1 crédit One-Shot',
          subtitleDesktop: `Limite de ${quotas.free_tournaments_max} tournois Free-Kick atteinte · Vous avez un crédit One-Shot disponible pour un tournoi jusqu'à 10 joueurs`,
          buttonText: 'Créer',
          redirectTo: '/vestiaire'
        }
      }

      if (currentType === 'elite') {
        return {
          icon: '/images/icons/team-elite-tour.svg',
          iconFilter: 'icon-filter-orange',
          bgColor: 'bg-[#ff9900]',
          btnBg: 'bg-orange-500/20 hover:bg-orange-500/30',
          btnText: 'text-orange-400',
          title: 'Tournoi Elite Team disponible',
          subtitleMobile: 'Limite Free-Kick atteinte · 1 crédit Elite',
          subtitleDesktop: `Limite de ${quotas.free_tournaments_max} tournois Free-Kick atteinte · Vous avez un crédit Elite Team disponible pour un tournoi jusqu'à ${maxPlayers} joueurs`,
          buttonText: 'Créer',
          redirectTo: '/vestiaire'
        }
      }

      // Platinium
      return {
        icon: '/images/icons/premium-tour.svg',
        iconFilter: 'icon-filter-yellow',
        bgColor: 'bg-yellow-500',
        btnBg: 'bg-yellow-500/20 hover:bg-yellow-500/30',
        btnText: 'text-yellow-400',
        title: 'Tournoi Platinium disponible',
        subtitleMobile: 'Limite Free-Kick atteinte · 1 crédit Platinium',
        subtitleDesktop: `Limite de ${quotas.free_tournaments_max} tournois Free-Kick atteinte · Vous avez un crédit Platinium disponible pour un tournoi jusqu'à 30 joueurs`,
        buttonText: 'Créer',
        redirectTo: '/vestiaire'
      }
    }

    // Utilisateur gratuit - upsell
    if (currentType === 'free') {
      return {
        icon: '/images/icons/futebol.svg',
        iconFilter: 'icon-filter-premium',
        bgColor: 'bg-[#ff9900]',
        btnBg: 'bg-orange-500/20 hover:bg-orange-500/30',
        btnText: 'text-orange-400',
        title: `Tournois gratuits: ${quotas.free_tournaments_active}/${quotas.free_tournaments_max}`,
        subtitleMobile: `Max ${ACCOUNT_LIMITS.free.maxPlayersPerTournament} joueurs par tournoi`,
        subtitleDesktop: `Max ${ACCOUNT_LIMITS.free.maxPlayersPerTournament} joueurs par tournoi`,
        buttonText: 'Passer Pro',
        buttonIcon: '/images/icons/premium.svg',
        redirectTo: '/pricing'
      }
    }

    return null
  }

  const config = getBannerConfig()
  if (!config) return null

  return (
    <Banner
      config={config}
      isClosing={isClosing}
      onDismiss={handleDismiss}
      onAction={() => router.push(config.redirectTo)}
    />
  )
}

// Composant pour afficher le type de tournoi qui sera cree
export function TournamentTypeIndicator() {
  const router = useRouter()
  const [tournamentType, setTournamentType] = useState<TournamentTypeResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTournamentType()
  }, [])

  const fetchTournamentType = async () => {
    try {
      const response = await fetch('/api/user/quotas', { method: 'POST' })
      const data = await response.json()
      if (data.success) {
        setTournamentType(data.result)
      }
    } catch (error) {
      console.error('Error fetching tournament type:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse h-16 bg-gray-700/50 rounded-lg"></div>
    )
  }

  if (!tournamentType || !tournamentType.tournament_type) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <div>
            <p className="font-medium text-red-400">Impossible de creer un tournoi</p>
            <p className="text-sm text-gray-400">{tournamentType?.reason || 'Quota atteint'}</p>
          </div>
        </div>
        <button
          onClick={() => router.push('/pricing')}
          className="mt-3 w-full py-2 bg-orange-500 hover:bg-orange-400 rounded-lg text-sm font-medium text-white transition-all"
        >
          Debloquer plus de tournois
        </button>
      </div>
    )
  }

  const typeConfig: Record<string, { icon: string; label: string }> = {
    free: {
      icon: '/images/icons/futebol.svg',
      label: 'Tournoi Gratuit',
    },
    oneshot: {
      icon: '/images/icons/futebol.svg',
      label: 'Tournoi One-Shot',
    },
    elite: {
      icon: '/images/icons/futebol.svg',
      label: 'Tournoi Elite',
    },
    platinium: {
      icon: '/images/icons/futebol.svg',
      label: 'Tournoi Platinium',
    },
    enterprise: {
      icon: '/images/icons/futebol.svg',
      label: 'Tournoi Entreprise',
    },
  }

  const config = typeConfig[tournamentType.tournament_type]

  return (
    <div className="upgrade-banner border-2 border-[#ff9900] rounded-xl p-3 md:p-5 mb-6">
      <div className="flex flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="w-8 h-8 md:w-10 md:h-10 bg-[#ff9900] rounded-full flex items-center justify-center flex-shrink-0">
            <img src={config.icon} alt="Tournois" className="w-4 h-4 md:w-5 md:h-5 brightness-0" />
          </div>
          <div>
            <p className="font-medium upgrade-banner-title text-sm md:text-base">
              {config.label}
            </p>
            <p className="text-xs md:text-sm upgrade-banner-subtitle">
              Max {tournamentType.max_players} joueurs
            </p>
          </div>
        </div>
        {tournamentType.tournament_type === 'free' && (
          <button
            onClick={() => router.push('/pricing')}
            className="premium-btn-shimmer flex items-center justify-center p-2 md:px-4 md:py-2 md:gap-2 bg-orange-500/20 hover:bg-orange-500/30 rounded-lg text-sm font-medium text-orange-400 transition-all flex-shrink-0"
            title="Passer Pro"
          >
            <img src="/images/icons/premium.svg" alt="Premium" className="w-5 h-5 md:w-4 md:h-4 icon-filter-premium" />
            <span className="hidden md:inline">Passer Pro</span>
          </button>
        )}
      </div>
    </div>
  )
}
