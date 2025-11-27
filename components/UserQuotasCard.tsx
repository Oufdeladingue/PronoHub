'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Crown, Zap, Building2, AlertTriangle, ExternalLink, Loader2, Star, Sparkles } from 'lucide-react'
import { UserQuotas, ACCOUNT_LIMITS, PRICING } from '@/types/monetization'
import Image from 'next/image'

export default function UserQuotasCard() {
  const router = useRouter()
  const [quotas, setQuotas] = useState<UserQuotas | null>(null)
  const [loading, setLoading] = useState(true)
  const [portalLoading, setPortalLoading] = useState(false)

  useEffect(() => {
    fetchQuotas()
  }, [])

  const fetchQuotas = async () => {
    try {
      const response = await fetch('/api/user/quotas')
      const data = await response.json()
      if (data.success) {
        setQuotas(data.quotas)
      }
    } catch (error) {
      console.error('Error fetching quotas:', error)
    } finally {
      setLoading(false)
    }
  }

  const openPortal = async () => {
    setPortalLoading(true)
    try {
      const response = await fetch('/api/stripe/portal')
      const data = await response.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch (error) {
      console.error('Error opening portal:', error)
    } finally {
      setPortalLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
        <div className="space-y-3">
          <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-full"></div>
          <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-2/3"></div>
        </div>
      </div>
    )
  }

  if (!quotas) {
    return null
  }

  const getAccountTypeIcon = () => {
    if (quotas.subscription_status === 'active') {
      return <Crown className="w-8 h-8 text-[#ff9900]" />
    }
    if (quotas.enterprise_accounts_active > 0) {
      return <Building2 className="w-8 h-8 text-purple-500" />
    }
    return (
      <Image
        src="/images/icons/free-tour.svg"
        alt="Gratuit"
        width={32}
        height={32}
        className="icon-filter-slate"
      />
    )
  }

  const getAccountTypeName = () => {
    if (quotas.subscription_status === 'active') {
      return 'Premium'
    }
    if (quotas.enterprise_accounts_active > 0) {
      return 'Entreprise'
    }
    return 'Gratuit'
  }

  const getAccountTypeColor = () => {
    if (quotas.subscription_status === 'active') {
      return 'text-[#ff9900]'
    }
    if (quotas.enterprise_accounts_active > 0) {
      return 'text-purple-500'
    }
    return 'theme-text'
  }

  return (
    <div className="space-y-6">
      {/* En-tête du type de compte */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {getAccountTypeIcon()}
          <div>
            <h3 className={`font-bold text-xl ${getAccountTypeColor()}`}>
              Compte {getAccountTypeName()}
            </h3>
            {quotas.subscription_status === 'active' && quotas.subscription_expires_at && (
              <p className="text-sm theme-text-secondary">
                Renouvellement : {new Date(quotas.subscription_expires_at).toLocaleDateString('fr-FR')}
              </p>
            )}
            {quotas.subscription_status !== 'active' && (
              <p className="text-sm theme-text-secondary">
                {ACCOUNT_LIMITS.free.maxTournaments} tournois max · {ACCOUNT_LIMITS.free.maxPlayersPerTournament} joueurs/tournoi
              </p>
            )}
          </div>
        </div>
        {quotas.subscription_status === 'active' && (
          <button
            onClick={openPortal}
            disabled={portalLoading}
            className="text-sm text-[#ff9900] hover:text-[#e68a00] flex items-center gap-1 transition-colors"
          >
            {portalLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                Gérer <ExternalLink className="w-4 h-4" />
              </>
            )}
          </button>
        )}
      </div>

      {/* Séparateur */}
      <div className="border-t theme-border"></div>

      {/* Quotas display */}
      <div className="space-y-5">
        {/* Tournois gratuits */}
        <QuotaBar
          label="Tournois gratuits actifs"
          current={quotas.free_tournaments_active}
          max={quotas.free_tournaments_max}
          color="orange"
          icon={
            <Image
              src="/images/icons/free-tour.svg"
              alt="Gratuit"
              width={20}
              height={20}
              className="icon-filter-orange"
            />
          }
        />

        {/* Tournois one-shot */}
        {(quotas.oneshot_slots_available > 0 || quotas.oneshot_tournaments_active > 0) && (
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-5 h-5 text-blue-500" />
              <span className="font-medium theme-text">Tournois One-Shot</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="theme-text-secondary">Slots disponibles</span>
              <span className="font-bold text-blue-500 text-lg">{quotas.oneshot_slots_available}</span>
            </div>
            {quotas.oneshot_tournaments_active > 0 && (
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="theme-text-secondary">En cours</span>
                <span className="font-medium text-blue-400">{quotas.oneshot_tournaments_active}</span>
              </div>
            )}
          </div>
        )}

        {/* Tournois premium */}
        {quotas.subscription_status === 'active' && (
          <QuotaBar
            label="Tournois premium actifs"
            current={quotas.premium_tournaments_active}
            max={quotas.premium_tournaments_max}
            color="premium"
            icon={<Crown className="w-5 h-5 text-[#ff9900]" />}
          />
        )}
      </div>

      {/* Warning if quota exceeded */}
      {!quotas.can_create_tournament && (
        <div className="p-4 quota-warning-box rounded-lg flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 quota-warning-icon flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium quota-warning-title">Quota atteint</p>
            <p className="text-sm theme-text-secondary mt-1">
              Vous avez atteint votre limite de tournois gratuits. Passez à l'offre supérieure pour créer plus de tournois.
            </p>
          </div>
        </div>
      )}

      {/* Séparateur */}
      <div className="border-t theme-border"></div>

      {/* Section Upgrade - pour les utilisateurs non premium */}
      {quotas.subscription_status !== 'active' && (
        <div className="space-y-4">
          <h4 className="font-semibold upgrade-section-title flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Débloquez plus de fonctionnalités
          </h4>

          {/* Bouton Premium */}
          <button
            onClick={() => router.push('/pricing')}
            className="w-full p-4 bg-[#ff9900] hover:bg-[#e68a00] rounded-lg transition-all transform hover:scale-[1.02] shadow-lg"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Crown className="w-6 h-6 text-[#0f172a]" />
                <div className="text-left">
                  <p className="font-bold text-[#0f172a]">Passer à Premium</p>
                  <p className="text-sm text-[#0f172a]/80">
                    {ACCOUNT_LIMITS.premium.maxActiveTournaments} tournois · {ACCOUNT_LIMITS.premium.maxPlayersPerTournament} joueurs/tournoi
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-[#0f172a]">{(PRICING.subscription.monthly.price / 100).toFixed(2)}€</p>
                <p className="text-xs text-[#0f172a]/80">/mois</p>
              </div>
            </div>
          </button>

          {/* Bouton One-Shot */}
          <button
            onClick={() => router.push('/pricing')}
            className="w-full p-4 bg-[#99a7c4] hover:bg-[#8a98b5] rounded-lg transition-all transform hover:scale-[1.02] shadow-md"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Zap className="w-6 h-6 text-[#0f172a]" />
                <div className="text-left">
                  <p className="font-bold text-[#0f172a]">Acheter un One-Shot</p>
                  <p className="text-sm text-[#0f172a]/80">
                    1 tournoi · {ACCOUNT_LIMITS.oneshot.maxPlayersPerTournament} joueurs max
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-[#0f172a]">{(PRICING.oneshot.price / 100).toFixed(2)}€</p>
                <p className="text-xs text-[#0f172a]/80">unique</p>
              </div>
            </div>
          </button>

          {/* Avantages Premium */}
          <div className="mt-4 p-4 premium-advantages-box rounded-lg">
            <p className="text-sm font-medium premium-advantages-title mb-2">Avantages Premium :</p>
            <ul className="text-sm theme-text-secondary space-y-1">
              <li className="flex items-center gap-2">
                <Star className="w-3 h-3 premium-advantages-star" /> Jusqu'à 5 tournois simultanés
              </li>
              <li className="flex items-center gap-2">
                <Star className="w-3 h-3 premium-advantages-star" /> 20 joueurs par tournoi
              </li>
              <li className="flex items-center gap-2">
                <Star className="w-3 h-3 premium-advantages-star" /> Statistiques avancées
              </li>
              <li className="flex items-center gap-2">
                <Star className="w-3 h-3 premium-advantages-star" /> Historique complet
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Section info pour les utilisateurs premium */}
      {quotas.subscription_status === 'active' && (
        <div className="p-4 bg-[#ff9900]/10 dark:bg-[#ff9900]/5 rounded-lg border border-[#ff9900]/30">
          <div className="flex items-center gap-2 mb-2">
            <Crown className="w-5 h-5 text-[#ff9900]" />
            <p className="font-medium theme-text">Vous êtes Premium !</p>
          </div>
          <p className="text-sm theme-text-secondary">
            Profitez de {ACCOUNT_LIMITS.premium.maxActiveTournaments} tournois simultanés avec jusqu'à {ACCOUNT_LIMITS.premium.maxPlayersPerTournament} joueurs chacun.
          </p>
        </div>
      )}
    </div>
  )
}

function QuotaBar({
  label,
  current,
  max,
  color,
  icon,
}: {
  label: string
  current: number
  max: number
  color: 'gray' | 'orange' | 'blue' | 'purple' | 'premium'
  icon?: React.ReactNode
}) {
  const percentage = max > 0 ? Math.min((current / max) * 100, 100) : 0
  const isAtLimit = current >= max

  const colorClasses = {
    gray: 'bg-gray-500',
    orange: 'bg-[#ff9900]',
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
    premium: 'bg-gradient-to-r from-[#ff9900] to-[#e68a00]',
  }

  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-2">
        <div className="flex items-center gap-2">
          {icon}
          <span className="theme-text-secondary">{label}</span>
        </div>
        <span className={`font-bold ${isAtLimit ? 'text-red-500' : 'theme-text'}`}>
          {current}/{max}
        </span>
      </div>
      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${colorClasses[color]} transition-all duration-300 rounded-full`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {isAtLimit && (
        <p className="text-xs text-red-500 mt-1">Limite atteinte</p>
      )}
    </div>
  )
}
