'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { getAvatarUrl } from '@/lib/avatars'

interface PlayerStats {
  playerId: string
  playerName: string
  avatar?: string
  totalPoints: number
  exactScores: number
  correctResults: number
  matchesPlayed: number
  matchesAvailable: number
  rank: number
  previousRank?: number
  rankChange?: 'up' | 'down' | 'same'
}

interface RankingsData {
  rankings: PlayerStats[]
  matchday: number | null
  pointsSettings: {
    exactScore: number
    correctResult: number
    incorrectResult: number
  }
  matchesFinished: number
  matchesTotal: number
}

interface TournamentRankingsProps {
  tournamentId: string
  availableMatchdays: number[]
}

export default function TournamentRankings({ tournamentId, availableMatchdays }: TournamentRankingsProps) {
  const [selectedView, setSelectedView] = useState<'general' | number>('general')
  const [rankingsData, setRankingsData] = useState<RankingsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    fetchCurrentUser()
    fetchRankings()
  }, [selectedView, tournamentId])

  const fetchCurrentUser = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
      }
    } catch (err) {
      console.error('Error fetching current user:', err)
    }
  }

  const fetchRankings = async () => {
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      // Construire l'URL avec le paramètre matchday si nécessaire
      const url = selectedView === 'general'
        ? `/api/tournaments/${tournamentId}/rankings`
        : `/api/tournaments/${tournamentId}/rankings?matchday=${selectedView}`

      const response = await fetch(url)

      if (!response.ok) {
        throw new Error('Erreur lors de la récupération du classement')
      }

      const data = await response.json()
      setRankingsData(data)
    } catch (err: any) {
      console.error('Erreur:', err)
      setError(err.message || 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  const getRankChangeIcon = (rankChange?: 'up' | 'down' | 'same') => {
    if (!rankChange) return null

    if (rankChange === 'up') {
      return (
        <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
      )
    }

    if (rankChange === 'down') {
      return (
        <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      )
    }

    return (
      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
      </svg>
    )
  }

  return (
    <div className="theme-card">
      <h2 className="text-2xl font-bold theme-text mb-6">Classement</h2>

      {/* Navigation des vues */}
      <div className="mb-6 pb-4 border-b theme-border overflow-x-auto">
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedView('general')}
            className={`px-4 py-2 rounded-lg font-semibold transition whitespace-nowrap ${
              selectedView === 'general'
                ? 'bg-[#ff9900] text-[#111]'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-[#ff9900] hover:text-[#111]'
            }`}
          >
            Général
          </button>
          {availableMatchdays.map(matchday => (
            <button
              key={matchday}
              onClick={() => setSelectedView(matchday)}
              className={`px-4 py-2 rounded-lg font-semibold transition whitespace-nowrap ${
                selectedView === matchday
                  ? 'bg-[#ff9900] text-[#111]'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-[#ff9900] hover:text-[#111]'
              }`}
            >
              J{matchday}
            </button>
          ))}
        </div>
      </div>

      {/* Contenu du classement */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#ff9900]"></div>
          <p className="mt-4 theme-text-secondary">Chargement du classement...</p>
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-red-500">{error}</p>
        </div>
      ) : !rankingsData ? (
        <div className="text-center py-12">
          <p className="theme-text-secondary">
            Aucune donnée de classement disponible pour le moment.
          </p>
        </div>
      ) : rankingsData.rankings.length === 0 ? (
        <div className="text-center py-12">
          <p className="theme-text-secondary">
            Aucun participant inscrit à ce tournoi.
          </p>
        </div>
      ) : (
        <div>
          {/* Informations sur le classement */}
          <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-sm theme-text-secondary">
              {rankingsData.matchesFinished} match{rankingsData.matchesFinished > 1 ? 's' : ''} terminé{rankingsData.matchesFinished > 1 ? 's' : ''}
              {' / '}
              {rankingsData.matchesTotal} match{rankingsData.matchesTotal > 1 ? 's' : ''} total{rankingsData.matchesTotal > 1 ? 'aux' : ''}
            </p>
          </div>

          {/* Tableau de classement */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 theme-border">
                  <th className="text-left py-3 px-2 theme-text font-semibold">#</th>
                  {selectedView === 'general' && (
                    <th className="text-center py-3 px-2 theme-text font-semibold w-12"></th>
                  )}
                  <th className="text-left py-3 px-2 theme-text font-semibold">Joueur</th>
                  <th className="text-center py-3 px-2 theme-text font-semibold">Points</th>
                  <th className="text-center py-3 px-2 theme-text font-semibold hidden md:table-cell">
                    Scores exacts
                  </th>
                  <th className="text-center py-3 px-2 theme-text font-semibold hidden lg:table-cell">
                    Bons résultats
                  </th>
                  <th className="text-center py-3 px-2 theme-text font-semibold hidden xl:table-cell">
                    Matchs joués
                  </th>
                </tr>
              </thead>
              <tbody>
                {rankingsData.rankings.map((player) => (
                  <tr
                    key={player.playerId}
                    className="border-b theme-border hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                  >
                    {/* Rang */}
                    <td className="py-4 px-2 theme-text font-bold">
                      <div className="flex items-center gap-2">
                        {player.rank <= 3 ? (
                          <span className={`
                            w-6 h-6 rounded-full flex items-center justify-center text-white text-sm font-bold
                            ${player.rank === 1 ? 'bg-yellow-500' : ''}
                            ${player.rank === 2 ? 'bg-gray-400' : ''}
                            ${player.rank === 3 ? 'bg-amber-600' : ''}
                          `}>
                            {player.rank}
                          </span>
                        ) : (
                          <span className="w-6 text-center">{player.rank}</span>
                        )}
                      </div>
                    </td>

                    {/* Indicateur de progression (uniquement pour le classement général) */}
                    {selectedView === 'general' && (
                      <td className="py-4 px-2 text-center">
                        {getRankChangeIcon(player.rankChange)}
                      </td>
                    )}

                    {/* Nom du joueur avec avatar */}
                    <td className="py-4 px-2 font-medium">
                      <div className="flex items-center gap-2">
                        <div className="relative w-8 h-8 rounded-full overflow-hidden border-2 border-[#ff9900] flex-shrink-0">
                          <Image
                            src={getAvatarUrl(player.avatar || 'avatar1')}
                            alt={player.playerName}
                            fill
                            className="object-cover"
                            sizes="32px"
                          />
                        </div>
                        <span className={player.playerId === currentUserId ? 'text-[#ff9900] font-bold' : 'theme-text'}>
                          {player.playerName}
                        </span>
                      </div>
                    </td>

                    {/* Points */}
                    <td className="py-4 px-2 text-center">
                      <span className="inline-block px-3 py-1 bg-[#ff9900] text-[#111] rounded-full font-bold">
                        {player.totalPoints}
                      </span>
                    </td>

                    {/* Scores exacts */}
                    <td className="py-4 px-2 text-center theme-text hidden md:table-cell">
                      {player.exactScores}
                    </td>

                    {/* Bons résultats */}
                    <td className="py-4 px-2 text-center theme-text hidden lg:table-cell">
                      {player.correctResults}
                    </td>

                    {/* Matchs joués */}
                    <td className="py-4 px-2 text-center theme-text-secondary hidden xl:table-cell">
                      {player.matchesPlayed} / {player.matchesAvailable}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Légende pour mobile */}
          <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg md:hidden">
            <p className="text-xs theme-text-secondary mb-2">Statistiques complètes :</p>
            {rankingsData.rankings.map((player) => (
              <div key={player.playerId} className="mb-2 pb-2 border-b theme-border last:border-0">
                <p className="text-sm theme-text font-medium">{player.playerName}</p>
                <p className="text-xs theme-text-secondary">
                  Scores exacts: {player.exactScores} • Bons résultats: {player.correctResults} •
                  Matchs joués: {player.matchesPlayed}/{player.matchesAvailable}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
