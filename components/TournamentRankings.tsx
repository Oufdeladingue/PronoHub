'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { getAvatarUrl } from '@/lib/avatars'
import { getStageShortLabel, type StageType } from '@/lib/stage-formatter'

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
  hasInProgressMatches?: boolean
}

interface TournamentRankingsProps {
  tournamentId: string
  availableMatchdays: number[]
  tournamentName?: string
  allMatches?: any[]
}

export default function TournamentRankings({ tournamentId, availableMatchdays, tournamentName, allMatches }: TournamentRankingsProps) {
  const [selectedView, setSelectedView] = useState<'general' | number>('general')
  const [rankingsData, setRankingsData] = useState<RankingsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [matchdayStages, setMatchdayStages] = useState<Record<number, StageType | null>>({})

  // Ref et états pour la navigation des vues avec flèches
  const viewsContainerRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  // Fonction pour vérifier si une journée a déjà commencé
  const hasMatchdayStarted = (matchday: number): boolean => {
    if (!allMatches) {
      console.log(`[Classement] J${matchday}: pas de données allMatches`)
      return false // Par défaut, considérer comme NON commencé si pas de données
    }

    const matchesForDay = allMatches.filter((m: any) => m.matchday === matchday)
    if (matchesForDay.length === 0) {
      console.log(`[Classement] J${matchday}: aucun match trouvé`)
      return false // Pas de matchs = pas encore commencé
    }

    const now = new Date()
    const firstMatchTime = new Date(Math.min(...matchesForDay.map((m: any) => new Date(m.utc_date).getTime())))
    const hasStarted = now >= firstMatchTime

    console.log(`[Classement] J${matchday}: ${matchesForDay.length} matchs, premier match: ${firstMatchTime.toISOString()}, a commencé: ${hasStarted}`)

    return hasStarted
  }

  // Fonction pour vérifier si tous les matchs d'une journée sont terminés
  const isMatchdayFinished = (matchday: number): boolean => {
    if (!allMatches) return false

    const matchesForDay = allMatches.filter((m: any) => m.matchday === matchday)
    if (matchesForDay.length === 0) return false

    // Tous les matchs doivent être terminés (status === 'FINISHED' ou finished === true)
    return matchesForDay.every((m: any) => m.status === 'FINISHED' || m.finished === true)
  }

  // Fonctions pour la navigation des vues avec flèches
  const checkScrollButtons = useCallback(() => {
    const container = viewsContainerRef.current
    if (container) {
      setCanScrollLeft(container.scrollLeft > 0)
      setCanScrollRight(container.scrollLeft < container.scrollWidth - container.clientWidth - 1)
    }
  }, [])

  const scrollViews = useCallback((direction: 'left' | 'right') => {
    const container = viewsContainerRef.current
    if (container) {
      const scrollAmount = 200
      const newScrollLeft = direction === 'left'
        ? container.scrollLeft - scrollAmount
        : container.scrollLeft + scrollAmount
      container.scrollTo({ left: newScrollLeft, behavior: 'smooth' })
    }
  }, [])

  // Extraire les stages des matchs
  useEffect(() => {
    if (allMatches && allMatches.length > 0) {
      const stagesByMatchday: Record<number, StageType | null> = {}
      allMatches.forEach((match: any) => {
        if (match.matchday && !stagesByMatchday[match.matchday]) {
          stagesByMatchday[match.matchday] = match.stage || null
        }
      })
      setMatchdayStages(stagesByMatchday)
    }
  }, [allMatches])

  // Vérifier les boutons de scroll au chargement et au resize
  useEffect(() => {
    checkScrollButtons()
    window.addEventListener('resize', checkScrollButtons)
    return () => window.removeEventListener('resize', checkScrollButtons)
  }, [checkScrollButtons, availableMatchdays])

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

  // Calculer les meilleurs scores exacts et bons résultats
  const getBestStats = () => {
    if (!rankingsData || rankingsData.rankings.length === 0) {
      return { maxExactScores: 0, maxCorrectResults: 0 }
    }
    const maxExactScores = Math.max(...rankingsData.rankings.map(p => p.exactScores))
    const maxCorrectResults = Math.max(...rankingsData.rankings.map(p => p.correctResults))
    return { maxExactScores, maxCorrectResults }
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
      <h2 className="text-xl md:text-2xl font-bold theme-text mb-4 md:mb-6">Classement</h2>

      {/* Navigation des vues */}
      <div className="mb-4 md:mb-6 pb-3 md:pb-4 border-b theme-border">
        <div className="relative flex items-center">
          {/* Flèche gauche */}
          {canScrollLeft && (
            <button
              onClick={() => scrollViews('left')}
              className="absolute left-0 z-10 flex items-center justify-center w-8 h-full bg-gradient-to-r from-slate-800 via-slate-800 to-transparent hover:from-slate-700"
              aria-label="Vues précédentes"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {/* Container des vues */}
          <div
            ref={viewsContainerRef}
            onScroll={checkScrollButtons}
            className="flex gap-2 overflow-x-auto scrollbar-hide px-1"
          >
            <button
              onClick={() => setSelectedView('general')}
              className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-sm md:text-base font-semibold transition whitespace-nowrap flex-shrink-0 ${
                selectedView === 'general'
                  ? 'bg-[#ff9900] text-[#111]'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-[#ff9900] hover:text-[#111]'
              }`}
            >
              Général
            </button>
            {availableMatchdays
              .filter(matchday => hasMatchdayStarted(matchday))
              .map(matchday => {
                const stage = matchdayStages[matchday]
                const matchdayLabel = getStageShortLabel(stage, matchday)
                const isFinished = isMatchdayFinished(matchday)
                return (
                  <button
                    key={matchday}
                    onClick={() => setSelectedView(matchday)}
                    className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-sm md:text-base font-semibold transition whitespace-nowrap flex-shrink-0 ${
                      selectedView === matchday
                        ? 'bg-[#ff9900] text-[#111]'
                        : isFinished
                          ? 'bg-[#99a1b0] text-[#0f172a] hover:bg-[#ff9900] hover:text-[#111]'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-[#ff9900] hover:text-[#111]'
                    }`}
                  >
                    {matchdayLabel}
                  </button>
                )
              })}
          </div>

          {/* Flèche droite */}
          {canScrollRight && (
            <button
              onClick={() => scrollViews('right')}
              className="absolute right-0 z-10 flex items-center justify-center w-8 h-full bg-gradient-to-l from-slate-800 via-slate-800 to-transparent hover:from-slate-700"
              aria-label="Vues suivantes"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
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
          <div className="mb-3 md:mb-4 p-2 md:p-3 rounded-lg info-bg-container">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 md:gap-4">
              <p className="text-xs md:text-sm theme-text-secondary">
                {selectedView === 'general' ? (
                  // Vue générale du tournoi
                  <>
                    {rankingsData.matchesFinished} match{rankingsData.matchesFinished > 1 ? 's' : ''} joué{rankingsData.matchesFinished > 1 ? 's' : ''}
                    {' / '}
                    {rankingsData.matchesTotal} match{rankingsData.matchesTotal > 1 ? 's' : ''} du tournoi{tournamentName ? ` ${tournamentName}` : ''}
                    {rankingsData.matchesFinished === rankingsData.matchesTotal && rankingsData.matchesTotal > 0 && ' : classement final'}
                  </>
                ) : rankingsData.matchesFinished === 0 ? (
                  // Journée où aucun match n'a encore eu lieu
                  <>Aucune rencontre n&apos;a encore eu lieu pour la journée {selectedView}</>
                ) : rankingsData.matchesFinished === rankingsData.matchesTotal ? (
                  // Journée terminée (tous les matchs terminés)
                  <>
                    {rankingsData.matchesFinished} match{rankingsData.matchesFinished > 1 ? 's' : ''} joué{rankingsData.matchesFinished > 1 ? 's' : ''}
                    {' / '}
                    {rankingsData.matchesTotal} match{rankingsData.matchesTotal > 1 ? 's' : ''} sur la journée {selectedView} : classement final
                  </>
                ) : (
                  // Journée en cours (au moins un match terminé mais pas tous)
                  <>
                    {rankingsData.matchesFinished} match{rankingsData.matchesFinished > 1 ? 's' : ''} joué{rankingsData.matchesFinished > 1 ? 's' : ''}
                    {' / '}
                    {rankingsData.matchesTotal} match{rankingsData.matchesTotal > 1 ? 's' : ''} sur la journée {selectedView} : classement provisoire
                  </>
                )}
              </p>
              {rankingsData.hasInProgressMatches && (
                <div className="flex items-center gap-2 px-3 py-1 quota-warning-box rounded-lg animate-pulse">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 quota-warning-icon" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                  <span className="text-xs font-semibold quota-warning-title">
                    Classement provisoire - Matchs en cours
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Tableau de classement */}
          <div className="overflow-x-auto -mx-2 md:mx-0">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 theme-border">
                  <th className="text-left py-2 md:py-3 px-1 md:px-2 theme-text font-semibold text-xs md:text-base">#</th>
                  {selectedView === 'general' && (
                    <th className="text-center py-2 md:py-3 px-1 md:px-2 theme-text font-semibold w-8 md:w-12 hidden md:table-cell"></th>
                  )}
                  <th className="text-left py-2 md:py-3 px-1 md:px-2 theme-text font-semibold text-xs md:text-base">Joueur</th>
                  <th className="text-center py-2 md:py-3 px-1 md:px-2 theme-text font-semibold text-xs md:text-base" title="Points">
                    <span className="md:hidden">Pts</span>
                    <span className="hidden md:inline">Points</span>
                  </th>
                  <th className="text-center py-2 md:py-3 px-1 md:px-2 theme-text font-semibold text-xs md:text-base" title="Bons résultats">
                    <span className="md:hidden">✓</span>
                    <span className="hidden md:inline">Bons résultats</span>
                  </th>
                  <th className="text-center py-2 md:py-3 px-1 md:px-2 theme-text font-semibold text-xs md:text-base" title="Scores exacts">
                    <span className="md:hidden flex justify-center">
                      <img src="/images/icons/target.svg" alt="Scores exacts" className="w-4 h-4 icon-filter-theme" />
                    </span>
                    <span className="hidden md:inline">Scores exacts</span>
                  </th>
                  <th className="text-center py-2 md:py-3 px-1 md:px-2 theme-text font-semibold text-xs md:text-base hidden xl:table-cell">
                    {selectedView === 'general' ? 'Pronos placés' : 'Matchs joués'}
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
                    <td className="py-2 md:py-4 px-1 md:px-2 theme-text font-bold text-xs md:text-base">
                      <div className="flex items-center gap-1 md:gap-2">
                        <span className="w-4 md:w-6 text-center">{player.rank}</span>
                      </div>
                    </td>

                    {/* Indicateur de progression (uniquement pour le classement général) */}
                    {selectedView === 'general' && (
                      <td className="py-2 md:py-4 px-1 md:px-2 text-center hidden md:table-cell">
                        <div className="scale-75 md:scale-100">
                          {getRankChangeIcon(player.rankChange)}
                        </div>
                      </td>
                    )}

                    {/* Nom du joueur avec avatar */}
                    <td className="py-2 md:py-4 px-1 md:px-2 font-medium">
                      <div className="flex items-center gap-1 md:gap-2">
                        <div className="relative w-6 h-6 md:w-8 md:h-8 rounded-full overflow-hidden border-2 border-[#ff9900] flex-shrink-0">
                          <Image
                            src={getAvatarUrl(player.avatar || 'avatar1')}
                            alt={player.playerName}
                            fill
                            className="object-cover"
                            sizes="32px"
                          />
                        </div>
                        <span className={`text-xs md:text-base truncate max-w-[80px] md:max-w-none ${player.playerId === currentUserId ? 'text-[#ff9900] font-bold' : 'theme-text'}`}>
                          {player.playerName}
                        </span>
                      </div>
                    </td>

                    {/* Points */}
                    <td className="py-2 md:py-4 px-1 md:px-2 text-center">
                      {selectedView === 'general' && player.rank <= 3 ? (
                        <span className={`inline-block px-2 py-0.5 md:px-3 md:py-1 rounded-full font-bold text-xs md:text-base ${
                          player.rank === 1
                            ? 'bg-yellow-500 text-[#0f172a]'
                            : player.rank === 2
                              ? 'bg-gray-400 text-[#0f172a]'
                              : 'bg-amber-600 text-[#0f172a]'
                        }`}>
                          {player.totalPoints}
                        </span>
                      ) : (
                        <span className="theme-text font-bold text-xs md:text-base">
                          {player.totalPoints}
                        </span>
                      )}
                    </td>

                    {/* Bons résultats */}
                    <td className="py-2 md:py-4 px-0.5 md:px-2 text-center theme-text text-xs md:text-base">
                      <div className="flex items-center justify-center">
                        <span className="text-right">{player.correctResults}</span>
                        <span className="w-3 md:w-4 text-left">
                          {player.correctResults === getBestStats().maxCorrectResults && player.correctResults > 0 && (
                            <span className="text-yellow-500 text-xs md:text-base">★</span>
                          )}
                        </span>
                      </div>
                    </td>

                    {/* Scores exacts */}
                    <td className="py-2 md:py-4 px-0.5 md:px-2 text-center theme-text text-xs md:text-base">
                      <div className="flex items-center justify-center">
                        <span className="text-right">{player.exactScores}</span>
                        <span className="w-3 md:w-4 text-left">
                          {player.exactScores === getBestStats().maxExactScores && player.exactScores > 0 && (
                            <span className="text-yellow-500 text-xs md:text-base">★</span>
                          )}
                        </span>
                      </div>
                    </td>

                    {/* Matchs joués */}
                    <td className="py-2 md:py-4 px-1 md:px-2 text-center theme-text-secondary text-xs md:text-base hidden xl:table-cell">
                      {player.matchesPlayed} / {player.matchesAvailable}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Légende pour mobile */}
          <div className="mt-3 p-2 rounded-lg xl:hidden info-bg-container">
            <div className="space-y-1">
              <p className="text-xs theme-text-secondary flex items-center gap-1">
                <span>* ✓ =</span>
                <span>nombre de bons résultats</span>
              </p>
              <p className="text-xs theme-text-secondary flex items-center gap-1">
                <span>*</span>
                <img src="/images/icons/target.svg" alt="Target" className="w-3 h-3 inline-block icon-filter-theme" />
                <span>= nombre de scores exacts</span>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
