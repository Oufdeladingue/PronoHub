'use client'

import { useState, useEffect, useCallback } from 'react'

interface StandingRow {
  team_id: number
  team_name: string
  team_crest: string | null
  position: number
  played_games: number
  won: number
  draw: number
  lost: number
  goals_for: number
  goals_against: number
  goal_difference: number
  points: number
  form: string | null
}

interface StandingsModalProps {
  competitionId: number
  competitionName?: string
  competitionEmblem?: string | null
  competitionCustomEmblemColor?: string | null  // Logo coloré pour thème clair
  competitionCustomEmblemWhite?: string | null  // Logo blanc pour thème sombre
  highlightTeamIds: number[]
  onClose: () => void
}

export default function StandingsModal({
  competitionId,
  competitionName,
  competitionEmblem,
  competitionCustomEmblemColor,
  competitionCustomEmblemWhite,
  highlightTeamIds,
  onClose
}: StandingsModalProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [standings, setStandings] = useState<StandingRow[]>([])

  // Bloquer le scroll du body quand la modale est ouverte
  useEffect(() => {
    const originalOverflow = document.body.style.overflow
    const originalPosition = document.body.style.position
    const originalWidth = document.body.style.width
    const scrollY = window.scrollY

    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.width = '100%'
    document.body.style.top = `-${scrollY}px`

    return () => {
      document.body.style.overflow = originalOverflow
      document.body.style.position = originalPosition
      document.body.style.width = originalWidth
      document.body.style.top = ''
      window.scrollTo(0, scrollY)
    }
  }, [])

  useEffect(() => {
    const fetchStandings = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(`/api/standings/${competitionId}`)

        if (!response.ok) {
          throw new Error('Erreur lors du chargement du classement')
        }

        const data = await response.json()
        setStandings(data.standings || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Une erreur est survenue')
      } finally {
        setLoading(false)
      }
    }

    fetchStandings()
  }, [competitionId])

  const isHighlighted = (teamId: number) => highlightTeamIds.includes(teamId)

  // Logos adaptés au thème
  // Thème clair: logo coloré ou emblème par défaut
  // Thème sombre: logo blanc ou emblème par défaut
  const logoLight = competitionCustomEmblemColor || competitionEmblem
  const logoDark = competitionCustomEmblemWhite || competitionEmblem

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[10000] p-4" onClick={onClose}>
      <div
        className="theme-card max-w-lg w-full max-h-[85vh] flex flex-col !p-0 overflow-hidden bg-white dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b theme-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            {/* Logo adapté au thème */}
            {(logoLight || logoDark) && (
              <>
                {/* Logo coloré pour thème clair */}
                {logoLight && (
                  <img
                    src={logoLight}
                    alt="Competition"
                    className="w-8 h-8 object-contain dark:hidden"
                  />
                )}
                {/* Logo blanc pour thème sombre */}
                {logoDark && (
                  <img
                    src={logoDark}
                    alt="Competition"
                    className="w-8 h-8 object-contain hidden dark:block"
                  />
                )}
              </>
            )}
            <h3 className="text-base font-bold text-blue-600 dark:text-[#ff9900]">
              {competitionName || 'Classement'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg theme-text-secondary hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 dark:border-[#ff9900]"></div>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-500">{error}</p>
            </div>
          ) : standings.length === 0 ? (
            <div className="text-center py-8">
              <p className="theme-text-secondary">Aucun classement disponible</p>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0">
                <tr className="text-left theme-text-secondary">
                  <th className="py-2 px-2 w-8 text-center">#</th>
                  <th className="py-2 px-2">Equipe</th>
                  <th className="py-2 px-1 text-center w-8">J</th>
                  <th className="py-2 px-1 text-center w-8">G</th>
                  <th className="py-2 px-1 text-center w-8">N</th>
                  <th className="py-2 px-1 text-center w-8">P</th>
                  <th className="py-2 px-1 text-center w-10">Diff</th>
                  <th className="py-2 px-2 text-center w-10 font-bold">Pts</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((team) => (
                  <tr
                    key={team.team_id}
                    className={`border-b theme-border transition-colors ${
                      isHighlighted(team.team_id)
                        ? 'bg-blue-500/10 dark:bg-[#ff9900]/20'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <td className="py-2 px-2 text-center font-medium theme-text">
                      {team.position}
                    </td>
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-2">
                        {team.team_crest && (
                          <img
                            src={team.team_crest}
                            alt={team.team_name}
                            className="w-4 h-4 object-contain shrink-0"
                          />
                        )}
                        <span className={`truncate ${isHighlighted(team.team_id) ? 'font-semibold text-blue-600 dark:text-[#ff9900]' : 'theme-text'}`}>
                          {team.team_name}
                        </span>
                      </div>
                    </td>
                    <td className="py-2 px-1 text-center theme-text-secondary">{team.played_games}</td>
                    <td className="py-2 px-1 text-center text-green-600 dark:text-green-500">{team.won}</td>
                    <td className="py-2 px-1 text-center text-yellow-600 dark:text-yellow-500">{team.draw}</td>
                    <td className="py-2 px-1 text-center text-red-600 dark:text-red-500">{team.lost}</td>
                    <td className="py-2 px-1 text-center theme-text-secondary">
                      {team.goal_difference > 0 ? '+' : ''}{team.goal_difference}
                    </td>
                    <td className="py-2 px-2 text-center font-bold theme-text">{team.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t theme-border shrink-0">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 bg-blue-500 dark:bg-[#ff9900] text-white dark:text-black rounded-lg hover:bg-blue-600 dark:hover:bg-[#e68a00] transition-colors font-medium text-sm"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}
