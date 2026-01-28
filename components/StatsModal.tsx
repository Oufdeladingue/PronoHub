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
      <span className="text-xs text-slate-500 dark:text-slate-400">
        {goalsFor}-{goalsAgainst}
      </span>
    </div>
  )
}

function TeamFormSection({ teamName, matches, isHome }: { teamName: string; matches: TeamFormMatch[]; isHome: boolean }) {
  if (matches.length === 0) {
    return (
      <div className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
        Aucun match terminé trouvé
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
        {isHome ? (
          <span className="w-2 h-2 rounded-full bg-blue-500"></span>
        ) : (
          <span className="w-2 h-2 rounded-full bg-orange-500"></span>
        )}
        {teamName}
      </h4>
      <div className="space-y-1.5">
        {matches.map((match) => (
          <div
            key={match.matchId}
            className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg"
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
              <span className="text-sm text-slate-600 dark:text-slate-300 truncate">
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
        <span className="text-slate-600 dark:text-slate-400">{label}</span>
        <span className="font-semibold text-slate-700 dark:text-slate-300">{percentage}%</span>
      </div>
      <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="text-xs text-slate-500 dark:text-slate-500 text-right">
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Stats du match</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {homeTeamName} vs {awayTeamName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-500 dark:text-red-400">{error}</p>
              <button
                onClick={onClose}
                className="mt-4 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                Fermer
              </button>
            </div>
          ) : data ? (
            <>
              {/* Forme des équipes */}
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Tendances des pronostics
                </h4>
                {data.predictionTrends ? (
                  <div className="space-y-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
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
                      color="bg-orange-500"
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400 text-center mt-2">
                      Basé sur {data.predictionTrends.totalPredictions} pronostics (tous tournois confondus)
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-6 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Pas assez de pronostics pour afficher les tendances
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                      (minimum 5 pronostics requis)
                    </p>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors font-medium"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}
