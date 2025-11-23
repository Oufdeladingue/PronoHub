'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Crown, Zap, Building2, AlertTriangle, ExternalLink, Loader2 } from 'lucide-react'
import { UserQuotas } from '@/types/monetization'

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
      <div className="theme-card p-6 animate-pulse">
        <div className="h-6 bg-gray-700 rounded w-1/3 mb-4"></div>
        <div className="space-y-3">
          <div className="h-4 bg-gray-700 rounded w-full"></div>
          <div className="h-4 bg-gray-700 rounded w-2/3"></div>
        </div>
      </div>
    )
  }

  if (!quotas) {
    return null
  }

  const getAccountTypeIcon = () => {
    if (quotas.subscription_status === 'active') {
      return <Crown className="w-6 h-6 text-orange-500" />
    }
    if (quotas.oneshot_slots_available > 0 || quotas.oneshot_tournaments_active > 0) {
      return <Zap className="w-6 h-6 text-blue-500" />
    }
    if (quotas.enterprise_accounts_active > 0) {
      return <Building2 className="w-6 h-6 text-purple-500" />
    }
    return <Zap className="w-6 h-6 text-gray-500" />
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

  const totalTournaments = quotas.free_tournaments_active + quotas.oneshot_tournaments_active + quotas.premium_tournaments_active

  return (
    <div className="theme-card p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {getAccountTypeIcon()}
          <div>
            <h3 className="font-bold text-lg">Compte {getAccountTypeName()}</h3>
            {quotas.subscription_status === 'active' && quotas.subscription_expires_at && (
              <p className="text-sm text-gray-400">
                Renouvellement: {new Date(quotas.subscription_expires_at).toLocaleDateString('fr-FR')}
              </p>
            )}
          </div>
        </div>
        {quotas.subscription_status === 'active' && (
          <button
            onClick={openPortal}
            disabled={portalLoading}
            className="text-sm text-orange-500 hover:text-orange-400 flex items-center gap-1"
          >
            {portalLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                Gerer <ExternalLink className="w-4 h-4" />
              </>
            )}
          </button>
        )}
      </div>

      {/* Quotas display */}
      <div className="space-y-4">
        {/* Tournois gratuits */}
        <QuotaBar
          label="Tournois gratuits"
          current={quotas.free_tournaments_active}
          max={quotas.free_tournaments_max}
          color="gray"
        />

        {/* Tournois one-shot */}
        {(quotas.oneshot_slots_available > 0 || quotas.oneshot_tournaments_active > 0) && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Slots one-shot disponibles</span>
            <span className="font-medium text-blue-400">{quotas.oneshot_slots_available}</span>
          </div>
        )}

        {/* Tournois premium */}
        {quotas.subscription_status === 'active' && (
          <QuotaBar
            label="Tournois premium"
            current={quotas.premium_tournaments_active}
            max={quotas.premium_tournaments_max}
            color="orange"
          />
        )}
      </div>

      {/* Warning if quota exceeded */}
      {!quotas.can_create_tournament && (
        <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-yellow-200">Quota atteint</p>
            <p className="text-xs text-gray-400 mt-1">
              Vous avez atteint votre limite de tournois. Passez a l'offre superieure pour creer plus de tournois.
            </p>
            <button
              onClick={() => router.push('/pricing')}
              className="mt-2 text-sm text-orange-500 hover:text-orange-400"
            >
              Voir les offres →
            </button>
          </div>
        </div>
      )}

      {/* CTA for free users */}
      {quotas.subscription_status !== 'active' && quotas.can_create_tournament && (
        <div className="mt-6 pt-6 border-t border-gray-700">
          <button
            onClick={() => router.push('/pricing')}
            className="w-full py-2 px-4 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 rounded-lg font-medium text-sm transition-all"
          >
            Passer a Premium - Plus de tournois et joueurs
          </button>
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
}: {
  label: string
  current: number
  max: number
  color: 'gray' | 'orange' | 'blue' | 'purple'
}) {
  const percentage = max > 0 ? Math.min((current / max) * 100, 100) : 0
  const isAtLimit = current >= max

  const colorClasses = {
    gray: 'bg-gray-500',
    orange: 'bg-orange-500',
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
  }

  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-gray-400">{label}</span>
        <span className={`font-medium ${isAtLimit ? 'text-red-400' : 'text-white'}`}>
          {current}/{max}
        </span>
      </div>
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${colorClasses[color]} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
