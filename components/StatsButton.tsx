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
      viewBox="0 -0.5 21 21"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M14.55,17 C14.55,17.552 14.0796,18 13.5,18 C12.9204,18 12.45,17.552 12.45,17 L12.45,3 C12.45,2.448 12.9204,2 13.5,2 C14.0796,2 14.55,2.448 14.55,3 L14.55,17 Z M14.55,0 L12.45,0 C11.28975,0 10.35,0.895 10.35,2 L10.35,18 C10.35,19.105 11.28975,20 12.45,20 L14.55,20 C15.71025,20 16.65,19.105 16.65,18 L16.65,2 C16.65,0.895 15.71025,0 14.55,0 L14.55,0 Z M7.2,17 C7.2,17.552 6.7296,18 6.15,18 C5.5704,18 5.1,17.552 5.1,17 L5.1,7 C5.1,6.448 5.5704,6 6.15,6 C6.7296,6 7.2,6.448 7.2,7 L7.2,17 Z M7.2,4 L5.1,4 C3.93975,4 3,4.895 3,6 L3,18 C3,19.105 3.93975,20 5.1,20 L7.2,20 C8.36025,20 9.3,19.105 9.3,18 L9.3,6 C9.3,4.895 8.36025,4 7.2,4 L7.2,4 Z M21.9,17 C21.9,17.552 21.4296,18 20.85,18 C20.2704,18 19.8,17.552 19.8,17 L19.8,13 C19.8,12.448 20.2704,12 20.85,12 C21.4296,12 21.9,12.448 21.9,13 L21.9,17 Z M21.9,10 L19.8,10 C18.63975,10 17.7,10.895 17.7,12 L17.7,18 C17.7,19.105 18.63975,20 19.8,20 L21.9,20 C23.06025,20 24,19.105 24,18 L24,12 C24,10.895 23.06025,10 21.9,10 L21.9,10 Z" />
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
        className={`${buttonSize} flex items-center justify-center rounded-full border transition-all duration-200 ${
          hasAccess
            ? 'border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-orange-400 hover:text-orange-500 dark:hover:border-orange-500 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20'
            : 'border-slate-200 dark:border-slate-700 text-slate-300 dark:text-slate-600 opacity-70 hover:opacity-100 hover:border-slate-300 dark:hover:border-slate-500 hover:text-slate-400 dark:hover:text-slate-500'
        }`}
        title={hasAccess ? 'Voir les stats du match' : 'Débloquer les statistiques'}
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
