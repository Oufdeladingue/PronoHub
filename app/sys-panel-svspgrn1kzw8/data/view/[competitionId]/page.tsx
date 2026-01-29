'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import AdminLayout from '@/components/AdminLayout'
import { getStageShortLabel, getStageLabel, getLegNumber, type StageType } from '@/lib/stage-formatter'

interface Match {
  id: string
  football_data_match_id: number
  matchday: number
  stage?: string | null
  utc_date: string
  status: string
  home_team_id: number
  home_team_name: string
  home_team_crest: string | null
  away_team_id: number
  away_team_name: string
  away_team_crest: string | null
  home_score: number | null
  away_score: number | null
  winner: string | null
  duration: string | null
}

interface Competition {
  id: number
  name: string
  code: string
  emblem: string | null
  area_name: string
  current_matchday: number
  current_season_start_date: string
  current_season_end_date: string
}

interface CompetitionData {
  competition: Competition
  matches: Match[]
  matchesByMatchday: Record<number, Match[]>
  totalMatches: number
  matchdays: number[]
  stagesByMatchday?: Record<number, string | null>
  matchdaysByStage?: Record<string, number[]>
}

export default function ViewCompetitionPage() {
  const params = useParams()
  const router = useRouter()
  const competitionId = params.competitionId as string

  const [data, setData] = useState<CompetitionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedMatchday, setSelectedMatchday] = useState<number | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const fetchCompetitionData = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/football/competition-matches?competitionId=${competitionId}`)
      if (!response.ok) throw new Error('Failed to fetch competition data')

      const result = await response.json()
      setData(result)

      // Sélectionner la journée actuelle par défaut
      if (result.competition.current_matchday && result.matchdays.includes(result.competition.current_matchday)) {
        setSelectedMatchday(result.competition.current_matchday)
      } else if (result.matchdays.length > 0) {
        setSelectedMatchday(result.matchdays[0])
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleManualRefresh = async () => {
    setIsRefreshing(true)
    await fetchCompetitionData()
    setIsRefreshing(false)
  }

  useEffect(() => {
    fetchCompetitionData()
  }, [competitionId])

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      SCHEDULED: 'Programmé',
      TIMED: 'Programmé',
      IN_PLAY: 'En cours',
      PAUSED: 'Pause',
      FINISHED: 'Terminé',
      POSTPONED: 'Reporté',
      SUSPENDED: 'Suspendu',
      CANCELLED: 'Annulé'
    }
    return labels[status] || status
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      SCHEDULED: 'bg-blue-100 text-blue-800',
      TIMED: 'bg-blue-100 text-blue-800',
      IN_PLAY: 'bg-green-100 text-green-800',
      PAUSED: 'bg-yellow-100 text-yellow-800',
      FINISHED: 'bg-gray-100 text-gray-800',
      POSTPONED: 'bg-orange-100 text-orange-800',
      SUSPENDED: 'bg-red-100 text-red-800',
      CANCELLED: 'bg-red-100 text-red-800'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  if (loading) {
    return (
      <AdminLayout currentPage="data">
        <div className="min-h-screen bg-gray-50">
          <main className="max-w-7xl mx-auto px-4 py-8">
            <div className="text-center py-12">
              <div className="text-gray-500">Chargement des données...</div>
            </div>
          </main>
        </div>
      </AdminLayout>
    )
  }

  if (error || !data) {
    return (
      <AdminLayout currentPage="data">
        <div className="min-h-screen bg-gray-50">
          <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
            <strong>Erreur :</strong> {error || 'Données non disponibles'}
          </div>
          <button
            onClick={() => router.back()}
            className="mt-4 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Retour
          </button>
        </main>
        </div>
      </AdminLayout>
    )
  }

  const currentMatches = selectedMatchday ? data.matchesByMatchday[selectedMatchday] || [] : []

  return (
    <AdminLayout currentPage="data">
      <div className="min-h-screen bg-gray-50">

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* En-tête */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="mb-4 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
          >
            ← Retour
          </button>

          <div className="flex items-center gap-4">
            {data.competition.emblem && (
              <img
                src={data.competition.emblem}
                alt={data.competition.name}
                className="w-16 h-16 object-contain"
              />
            )}
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{data.competition.name}</h1>
              <div className="mt-1 flex items-center gap-4 text-sm text-gray-600">
                <span>Code: {data.competition.code}</span>
                <span>Zone: {data.competition.area_name}</span>
                <span>Total: {data.totalMatches} matchs</span>
              </div>
              <div className="mt-1 text-sm text-gray-500">
                Saison: {new Date(data.competition.current_season_start_date).toLocaleDateString('fr-FR')} → {new Date(data.competition.current_season_end_date).toLocaleDateString('fr-FR')}
              </div>
            </div>
          </div>
        </div>

        {/* Bouton de rafraîchissement manuel */}
        <div className="mb-6 flex justify-end">
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <svg className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {isRefreshing ? 'Actualisation...' : 'Actualiser les données'}
          </button>
        </div>

        {/* Onglets des journées avec phases */}
        <div className="mb-6 border-b border-gray-200">
          <div className="flex flex-wrap gap-2 pb-2">
            {data.matchdays.map((matchday) => {
              const stage = data.stagesByMatchday?.[matchday] as StageType | null
              const stagesMap = (data.stagesByMatchday || {}) as Record<number, StageType | null>
              const leg = getLegNumber(matchday, stagesMap)
              const matchdayLabel = getStageShortLabel(stage, matchday, undefined, leg)
              const isKnockout = stage && ['ROUND_OF_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'FINAL', 'THIRD_PLACE', 'LAST_32', 'PLAYOFFS'].includes(stage)

              return (
                <button
                  key={matchday}
                  onClick={() => setSelectedMatchday(matchday)}
                  className={`px-4 py-2 rounded-t-lg font-medium transition ${
                    selectedMatchday === matchday
                      ? 'bg-white border border-b-0 border-gray-200 text-purple-600'
                      : isKnockout
                        ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {matchdayLabel}
                  {matchday === data.competition.current_matchday && (
                    <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                      En cours
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Liste des matchs */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-900">
              {getStageLabel(data.stagesByMatchday?.[selectedMatchday!] as StageType | null, selectedMatchday!)} - {currentMatches.length} match{currentMatches.length > 1 ? 's' : ''}
            </h2>
          </div>

          <div className="divide-y divide-gray-200">
            {currentMatches.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                Aucun match pour cette journée
              </div>
            ) : (
              currentMatches.map((match) => (
                <div key={match.id} className="p-6 hover:bg-gray-50 transition">
                  <div className="flex items-center justify-between gap-6">
                    {/* Match sur une seule ligne */}
                    <div className="flex items-center gap-4 flex-1">
                      {/* Logo domicile */}
                      <div className="w-[100px] h-[100px] flex items-center justify-center flex-shrink-0">
                        {match.home_team_crest ? (
                          <img
                            src={match.home_team_crest}
                            alt={match.home_team_name}
                            className="max-w-full max-h-full object-contain"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                            }}
                          />
                        ) : (
                          <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center text-gray-400 text-xs">
                            N/A
                          </div>
                        )}
                      </div>

                      {/* Équipe domicile */}
                      <div className="flex-1 text-right">
                        <span className="font-semibold text-gray-900 text-lg">
                          {match.home_team_name}
                        </span>
                      </div>

                      {/* Score domicile */}
                      <div className="w-16 text-center">
                        {match.home_score !== null ? (
                          <span className={`text-3xl font-bold ${
                            match.winner === 'HOME_TEAM' ? 'text-green-600' : 'text-gray-700'
                          }`}>
                            {match.home_score}
                          </span>
                        ) : (
                          <span className="text-2xl text-gray-400">-</span>
                        )}
                      </div>

                      {/* Séparateur */}
                      <div className="text-2xl text-gray-400 font-bold px-2">-</div>

                      {/* Score extérieur */}
                      <div className="w-16 text-center">
                        {match.away_score !== null ? (
                          <span className={`text-3xl font-bold ${
                            match.winner === 'AWAY_TEAM' ? 'text-green-600' : 'text-gray-700'
                          }`}>
                            {match.away_score}
                          </span>
                        ) : (
                          <span className="text-2xl text-gray-400">-</span>
                        )}
                      </div>

                      {/* Équipe extérieur */}
                      <div className="flex-1 text-left">
                        <span className="font-semibold text-gray-900 text-lg">
                          {match.away_team_name}
                        </span>
                      </div>

                      {/* Logo extérieur */}
                      <div className="w-[100px] h-[100px] flex items-center justify-center flex-shrink-0">
                        {match.away_team_crest ? (
                          <img
                            src={match.away_team_crest}
                            alt={match.away_team_name}
                            className="max-w-full max-h-full object-contain"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                            }}
                          />
                        ) : (
                          <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center text-gray-400 text-xs">
                            N/A
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Infos du match */}
                    <div className="text-right flex-shrink-0">
                      <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(match.status)}`}>
                        {getStatusLabel(match.status)}
                      </div>
                      <div className="mt-2 text-sm text-gray-600">
                        {new Date(match.utc_date).toLocaleDateString('fr-FR', {
                          weekday: 'short',
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        })}
                      </div>
                      <div className="text-sm font-medium text-gray-900">
                        {new Date(match.utc_date).toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        ID: {match.football_data_match_id}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
      </div>
    </AdminLayout>
  )
}
