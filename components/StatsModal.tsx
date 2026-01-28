'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'

interface TeamFormMatch {
  matchId: string
  utcDate: string
  opponentName: string
  opponentCrest: string | null
  isHome: boolean
  goalsFor: number
  goalsAgainst: number
  result: 'W' | 'D' | 'L'
}

interface PredictionTrends {
  totalPredictions: number
  homeWin: { count: number; percentage: number }
  draw: { count: number; percentage: number }
  awayWin: { count: number; percentage: number }
}

interface StatsData {
  homeTeamForm: TeamFormMatch[]
  awayTeamForm: TeamFormMatch[]
  predictionTrends: PredictionTrends | null
  homeTeamName: string
  awayTeamName: string
}

interface StatsModalProps {
  matchId: string
  tournamentId: string
  competitionId: number
  homeTeamId: number
  awayTeamId: number
  homeTeamName: string
  awayTeamName: string
  onClose: () => void
}

function ResultBadge({ result, goalsFor, goalsAgainst }: { result: 'W' | 'D' | 'L'; goalsFor: number; goalsAgainst: number }) {
  const bgColor = result === 'W' ? 'bg-green-500' : result === 'D' ? 'bg-yellow-500' : 'bg-red-500'
  const label = result === 'W' ? 'V' : result === 'D' ? 'N' : 'D'

  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-6 h-6 flex items-center justify-center rounded-full text-white text-xs font-bold ${bgColor}`}>
        {label}
      </span>
      <span className="text-xs theme-text-secondary">
        {goalsFor}-{goalsAgainst}
      </span>
    </div>
  )
}

function TeamFormSection({ teamName, matches, isHome }: { teamName: string; matches: TeamFormMatch[]; isHome: boolean }) {
  if (matches.length === 0) {
    return (
      <div className="text-sm theme-text-secondary text-center py-4">
        Aucun match terminé trouvé
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold theme-text flex items-center gap-2">
        {isHome ? (
          <span className="w-2 h-2 rounded-full bg-blue-500"></span>
        ) : (
          <span className="w-2 h-2 rounded-full bg-[#ff9900]"></span>
        )}
        {teamName}
      </h4>
      <div className="space-y-1.5">
        {matches.map((match) => (
          <div
            key={match.matchId}
            className="flex items-center justify-between p-2 theme-bg rounded-lg border theme-border"
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {match.opponentCrest && (
                <Image
                  src={match.opponentCrest}
                  alt={match.opponentName}
                  width={20}
                  height={20}
                  className="flex-shrink-0"
                />
              )}
              <span className="text-sm theme-text truncate">
                {match.isHome ? 'vs' : '@'} {match.opponentName}
              </span>
            </div>
            <ResultBadge result={match.result} goalsFor={match.goalsFor} goalsAgainst={match.goalsAgainst} />
          </div>
        ))}
      </div>
      <div className="flex gap-1 justify-center pt-1">
        {matches.map((match) => {
          const bgColor = match.result === 'W' ? 'bg-green-500' : match.result === 'D' ? 'bg-yellow-500' : 'bg-red-500'
          return (
            <div
              key={match.matchId}
              className={`w-4 h-4 rounded-full ${bgColor}`}
              title={`${match.goalsFor}-${match.goalsAgainst} vs ${match.opponentName}`}
            />
          )
        })}
      </div>
    </div>
  )
}

function TrendsBar({ label, percentage, count, color }: { label: string; percentage: number; count: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="theme-text-secondary">{label}</span>
        <span className="font-semibold theme-text">{percentage}%</span>
      </div>
      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="text-xs theme-text-secondary text-right">
        {count} pronostic{count > 1 ? 's' : ''}
      </div>
    </div>
  )
}

export default function StatsModal({
  matchId,
  tournamentId,
  competitionId,
  homeTeamId,
  awayTeamId,
  homeTeamName,
  awayTeamName,
  onClose
}: StatsModalProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<StatsData | null>(null)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true)
        setError(null)

        const params = new URLSearchParams({
          tournamentId,
          competitionId: String(competitionId),
          homeTeamId: String(homeTeamId),
          awayTeamId: String(awayTeamId),
          homeTeamName,
          awayTeamName
        })

        const response = await fetch(`/api/stats/match/${matchId}?${params}`)

        if (!response.ok) {
          throw new Error('Erreur lors du chargement des statistiques')
        }

        const statsData = await response.json()
        setData(statsData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Une erreur est survenue')
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [matchId, tournamentId, competitionId, homeTeamId, awayTeamId, homeTeamName, awayTeamName])

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="theme-card max-w-lg w-full max-h-[85vh] flex flex-col !p-0 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b theme-border flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-lg font-bold theme-text">Stats du match</h3>
            <p className="text-sm theme-text-secondary">
              {homeTeamName} vs {awayTeamName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <svg className="w-5 h-5 theme-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ff9900]"></div>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-500">{error}</p>
              <button
                onClick={onClose}
                className="mt-4 px-4 py-2 theme-bg rounded-lg text-sm border theme-border hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Fermer
              </button>
            </div>
          ) : data ? (
            <>
              {/* Forme des équipes */}
              <div>
                <h4 className="text-sm font-semibold theme-text mb-4 flex items-center gap-2">
                  <svg className="w-4 h-4 text-[#ff9900]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  Forme récente (5 derniers matchs)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <TeamFormSection teamName={data.homeTeamName} matches={data.homeTeamForm} isHome={true} />
                  <TeamFormSection teamName={data.awayTeamName} matches={data.awayTeamForm} isHome={false} />
                </div>
              </div>

              {/* Tendances de pronostics */}
              <div>
                <h4 className="text-sm font-semibold theme-text mb-4 flex items-center gap-2">
                  <svg className="w-4 h-4 text-[#ff9900]" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="4" y="10" width="4" height="10" rx="1" />
                    <rect x="10" y="4" width="4" height="16" rx="1" />
                    <rect x="16" y="8" width="4" height="12" rx="1" />
                  </svg>
                  Tendances des pronostics
                </h4>
                {data.predictionTrends ? (
                  <div className="space-y-4 p-4 theme-bg rounded-lg border theme-border">
                    <TrendsBar
                      label={`Victoire ${data.homeTeamName}`}
                      percentage={data.predictionTrends.homeWin.percentage}
                      count={data.predictionTrends.homeWin.count}
                      color="bg-blue-500"
                    />
                    <TrendsBar
                      label="Match nul"
                      percentage={data.predictionTrends.draw.percentage}
                      count={data.predictionTrends.draw.count}
                      color="bg-yellow-500"
                    />
                    <TrendsBar
                      label={`Victoire ${data.awayTeamName}`}
                      percentage={data.predictionTrends.awayWin.percentage}
                      count={data.predictionTrends.awayWin.count}
                      color="bg-[#ff9900]"
                    />
                    <p className="text-xs theme-text-secondary text-center mt-2">
                      Basé sur {data.predictionTrends.totalPredictions} pronostics (tous tournois confondus)
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-6 theme-bg rounded-lg border theme-border">
                    <p className="text-sm theme-text-secondary">
                      Pas assez de pronostics pour afficher les tendances
                    </p>
                    <p className="text-xs theme-text-secondary mt-1">
                      (minimum 5 pronostics requis)
                    </p>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-4 border-t theme-border flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 theme-bg theme-text rounded-lg border theme-border hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors font-medium"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}
