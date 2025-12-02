'use client'

import { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Crown } from 'lucide-react'
import { Feature, TournamentType, ACCOUNT_LIMITS } from '@/types/monetization'

interface FeatureGateProps {
  feature: Feature
  tournamentType: TournamentType | null
  children: ReactNode
  fallback?: ReactNode
  showUpgradeButton?: boolean
}

// Composant qui affiche le contenu si la feature est disponible, sinon un message de blocage
export function FeatureGate({
  feature,
  tournamentType,
  children,
  fallback,
  showUpgradeButton = true,
}: FeatureGateProps) {
  const router = useRouter()

  const hasAccess = tournamentType
    ? (ACCOUNT_LIMITS[tournamentType].features as readonly Feature[]).includes(feature)
    : false

  if (hasAccess) {
    return <>{children}</>
  }

  if (fallback) {
    return <>{fallback}</>
  }

  return (
    <FeatureLockedCard
      feature={feature}
      showUpgradeButton={showUpgradeButton}
      onUpgrade={() => router.push('/pricing')}
    />
  )
}

interface FeatureLockedCardProps {
  feature: Feature
  showUpgradeButton?: boolean
  onUpgrade?: () => void
}

// Carte affichee quand une feature est bloquee
export function FeatureLockedCard({
  feature,
  showUpgradeButton = true,
  onUpgrade,
}: FeatureLockedCardProps) {
  const featureLabels: Record<Feature, { title: string; description: string }> = {
    basic_rankings: {
      title: 'Classements basiques',
      description: 'Classement general des joueurs',
    },
    simple_predictions: {
      title: 'Pronostics simples',
      description: 'Faire des pronostics sur les matchs',
    },
    trophies: {
      title: 'Trophees',
      description: 'Debloquez des trophees et recompenses',
    },
    team_play: {
      title: 'Jeu en equipe',
      description: 'Jouez en equipe avec vos amis',
    },
    prize: {
      title: 'Prix a gagner',
      description: 'Participez a des tournois avec des prix',
    },
    extended_stats: {
      title: 'Statistiques etendues',
      description: 'Acces aux statistiques detaillees et graphiques avances',
    },
    private_tournaments: {
      title: 'Tournois prives',
      description: 'Creer des tournois accessibles uniquement sur invitation',
    },
    advanced_history: {
      title: 'Historique complet',
      description: 'Acces a l\'historique complet de tous vos tournois passes',
    },
    advanced_management: {
      title: 'Gestion avancee',
      description: 'Outils de gestion avancee pour vos tournois',
    },
    custom_branding: {
      title: 'Branding personnalise',
      description: 'Personnalisez l\'apparence avec votre logo et couleurs',
    },
    admin_tools: {
      title: 'Outils d\'administration',
      description: 'Acces aux outils d\'administration avances',
    },
    team_management: {
      title: 'Gestion d\'equipes',
      description: 'Organisez les participants en equipes',
    },
    all: {
      title: 'Toutes les fonctionnalites',
      description: 'Acces a toutes les fonctionnalites de la plateforme',
    },
  }

  const featureInfo = featureLabels[feature]

  return (
    <div className="theme-card p-6 border-2 border-dashed border-gray-600 bg-gray-800/30">
      <div className="flex flex-col items-center text-center">
        <div className="w-16 h-16 bg-gray-700/50 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-8 h-8 text-gray-500" />
        </div>
        <h3 className="text-lg font-semibold mb-2">{featureInfo.title}</h3>
        <p className="text-gray-400 text-sm mb-4 max-w-xs">
          {featureInfo.description}
        </p>
        <div className="flex items-center gap-2 text-sm text-orange-400 mb-4">
          <Crown className="w-4 h-4" />
          <span>Disponible avec Premium</span>
        </div>
        {showUpgradeButton && onUpgrade && (
          <button
            onClick={onUpgrade}
            className="px-6 py-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 rounded-lg font-medium text-sm transition-all"
          >
            Passer a Premium
          </button>
        )}
      </div>
    </div>
  )
}

// Badge pour indiquer qu'une feature est premium
export function PremiumBadge({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
  }

  return (
    <span className={`inline-flex items-center gap-1 bg-orange-500/20 text-orange-400 rounded-full ${sizeClasses[size]}`}>
      <Crown className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />
      Premium
    </span>
  )
}

// Composant pour afficher le nombre max de joueurs selon le type
export function MaxPlayersIndicator({ tournamentType }: { tournamentType: TournamentType | null }) {
  const maxPlayers = tournamentType
    ? ACCOUNT_LIMITS[tournamentType].maxPlayersPerTournament
    : ACCOUNT_LIMITS.free.maxPlayersPerTournament

  return (
    <div className="text-sm text-gray-400">
      Max <span className="font-semibold text-white">{maxPlayers}</span> joueurs
    </div>
  )
}
