'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Crown, Sparkles, AlertTriangle, ArrowRight } from 'lucide-react'
import { UserQuotas, TournamentTypeResult, ACCOUNT_LIMITS } from '@/types/monetization'

interface UpgradeBannerProps {
  variant?: 'compact' | 'full'
  context?: 'create' | 'dashboard' | 'profile'
}

export function UpgradeBanner({ variant = 'full', context = 'dashboard' }: UpgradeBannerProps) {
  const router = useRouter()
  const [quotas, setQuotas] = useState<UserQuotas | null>(null)
  const [tournamentType, setTournamentType] = useState<TournamentTypeResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchQuotas()
  }, [])

  const fetchQuotas = async () => {
    try {
      const [quotasRes, typeRes] = await Promise.all([
        fetch('/api/user/quotas'),
        fetch('/api/user/quotas', { method: 'POST' })
      ])

      const quotasData = await quotasRes.json()
      const typeData = await typeRes.json()

      if (quotasData.success) setQuotas(quotasData.quotas)
      if (typeData.success) setTournamentType(typeData.result)
    } catch (error) {
      console.error('Error fetching quotas:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading || !quotas) return null

  const isPremium = quotas.subscription_status === 'active'
  const canCreate = quotas.can_create_tournament
  const currentType = tournamentType?.tournament_type || 'free'
  const maxPlayers = tournamentType?.max_players || ACCOUNT_LIMITS.free.maxPlayersPerTournament

  // Ne pas afficher si l'utilisateur est premium avec des slots dispo
  if (isPremium && canCreate) return null

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
                {currentType === 'premium' && `Tournoi Premium - Max ${maxPlayers} joueurs`}
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

  // Banniere complete pour le dashboard
  if (!canCreate) {
    return (
      <div className="bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/30 rounded-xl p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-6 h-6 text-red-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-white mb-1">Quota de tournois atteint</h3>
            <p className="text-gray-400 text-sm mb-4">
              Vous avez atteint la limite de {quotas.free_tournaments_max} tournois gratuits actifs.
              Passez a Premium pour creer jusqu'a 5 tournois avec 20 joueurs chacun.
            </p>
            <div className="flex items-center gap-4 flex-wrap">
              <button
                onClick={() => router.push('/pricing')}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 rounded-lg font-medium text-white transition-all"
              >
                <Crown className="w-5 h-5" />
                Voir les offres Premium
                <ArrowRight className="w-4 h-4" />
              </button>
              <div className="text-sm text-gray-500">
                A partir de 4,99 EUR
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Banniere d'upsell pour les utilisateurs gratuits
  if (currentType === 'free') {
    return (
      <div className="bg-gradient-to-r from-orange-500/5 to-purple-500/5 border-2 border-[#ff9900] rounded-xl p-3 md:p-5 mb-6">
        <div className="flex flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-[#ff9900] rounded-full flex items-center justify-center flex-shrink-0">
              <img src="/images/icons/futebol.svg" alt="Tournois" className="w-4 h-4 md:w-5 md:h-5 brightness-0" />
            </div>
            <div>
              <p className="font-medium text-white text-sm md:text-base">
                Tournois gratuits: {quotas.free_tournaments_active}/{quotas.free_tournaments_max}
              </p>
              <p className="text-xs md:text-sm text-gray-400">
                Max {ACCOUNT_LIMITS.free.maxPlayersPerTournament} joueurs par tournoi
              </p>
            </div>
          </div>
          <button
            onClick={() => router.push('/pricing')}
            className="premium-btn-shimmer flex items-center justify-center p-2 md:px-4 md:py-2 md:gap-2 bg-orange-500/20 hover:bg-orange-500/30 rounded-lg text-sm font-medium text-orange-400 transition-all flex-shrink-0"
            title="Passer Pro"
          >
            <img src="/images/icons/premium.svg" alt="Premium" className="w-5 h-5 md:w-4 md:h-4" style={{ filter: 'brightness(0) saturate(100%) invert(58%) sepia(98%) saturate(1000%) hue-rotate(360deg) brightness(103%) contrast(101%)' }} />
            <span className="hidden md:inline">Passer Pro</span>
          </button>
        </div>
      </div>
    )
  }

  return null
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

  const typeConfig = {
    free: {
      icon: '/images/icons/futebol.svg',
      label: 'Tournoi Gratuit',
    },
    oneshot: {
      icon: '/images/icons/futebol.svg',
      label: 'Tournoi One-Shot',
    },
    premium: {
      icon: '/images/icons/futebol.svg',
      label: 'Tournoi Premium',
    },
    enterprise: {
      icon: '/images/icons/futebol.svg',
      label: 'Tournoi Entreprise',
    },
  }

  const config = typeConfig[tournamentType.tournament_type]

  return (
    <div className="bg-gradient-to-r from-orange-500/5 to-purple-500/5 border-2 border-[#ff9900] rounded-xl p-3 md:p-5 mb-6">
      <div className="flex flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="w-8 h-8 md:w-10 md:h-10 bg-[#ff9900] rounded-full flex items-center justify-center flex-shrink-0">
            <img src={config.icon} alt="Tournois" className="w-4 h-4 md:w-5 md:h-5 brightness-0" />
          </div>
          <div>
            <p className="font-medium text-white text-sm md:text-base">
              {config.label}
            </p>
            <p className="text-xs md:text-sm text-gray-400">
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
            <img src="/images/icons/premium.svg" alt="Premium" className="w-5 h-5 md:w-4 md:h-4" style={{ filter: 'brightness(0) saturate(100%) invert(58%) sepia(98%) saturate(1000%) hue-rotate(360deg) brightness(103%) contrast(101%)' }} />
            <span className="hidden md:inline">Passer Pro</span>
          </button>
        )}
      </div>
    </div>
  )
}
