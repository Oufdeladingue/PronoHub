'use client'

import { useState } from 'react'
import StatsModal from './StatsModal'
import StatsExplanationModal from './StatsExplanationModal'

interface StatsButtonProps {
  matchId: string
  tournamentId: string
  competitionId: number
  homeTeamId: number
  awayTeamId: number
  homeTeamName: string
  awayTeamName: string
  hasAccess: boolean
  size?: 'sm' | 'md'
  returnUrl?: string
}

// Inline SVG for stats icon (inherits color from parent via currentColor)
function StatsIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className="pointer-events-none"
    >
      {/* 3 barres verticales de hauteurs différentes */}
      <rect x="4" y="10" width="4" height="10" rx="1" />
      <rect x="10" y="4" width="4" height="16" rx="1" />
      <rect x="16" y="8" width="4" height="12" rx="1" />
    </svg>
  )
}

export default function StatsButton({
  matchId,
  tournamentId,
  competitionId,
  homeTeamId,
  awayTeamId,
  homeTeamName,
  awayTeamName,
  hasAccess,
  size = 'md',
  returnUrl
}: StatsButtonProps) {
  const [showStatsModal, setShowStatsModal] = useState(false)
  const [showExplanationModal, setShowExplanationModal] = useState(false)

  const handleClick = () => {
    if (hasAccess) {
      setShowStatsModal(true)
    } else {
      setShowExplanationModal(true)
    }
  }

  const iconSize = size === 'sm' ? 14 : 16
  const buttonSize = size === 'sm' ? 'w-7 h-7' : 'w-8 h-8'

  return (
    <>
      <button
        onClick={handleClick}
        onContextMenu={(e) => e.preventDefault()}
        className={`${buttonSize} flex items-center justify-center rounded-full border transition-all duration-200 select-none touch-manipulation ${
          hasAccess
            ? 'border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-orange-400 hover:text-orange-500 dark:hover:border-orange-500 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20'
            : 'border-slate-200 dark:border-slate-700 text-slate-300 dark:text-slate-600 opacity-70 hover:opacity-100 hover:border-slate-300 dark:hover:border-slate-500 hover:text-slate-400 dark:hover:text-slate-500'
        }`}
        title={hasAccess ? 'Voir les stats du match' : 'Débloquer les statistiques'}
        style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}
      >
        <StatsIcon size={iconSize} />
      </button>

      {showStatsModal && (
        <StatsModal
          matchId={matchId}
          tournamentId={tournamentId}
          competitionId={competitionId}
          homeTeamId={homeTeamId}
          awayTeamId={awayTeamId}
          homeTeamName={homeTeamName}
          awayTeamName={awayTeamName}
          onClose={() => setShowStatsModal(false)}
        />
      )}

      {showExplanationModal && (
        <StatsExplanationModal
          tournamentId={tournamentId}
          returnUrl={returnUrl}
          onClose={() => setShowExplanationModal(false)}
        />
      )}
    </>
  )
}
