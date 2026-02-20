'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Image from 'next/image'
import { createClient, fetchWithAuth } from '@/lib/supabase/client'
import { getAvatarUrl } from '@/lib/avatars'
import { getStageShortLabel, getLegNumber, type StageType } from '@/lib/stage-formatter'

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

interface TeamStats {
  teamId: string
  teamName: string
  teamAvatar: string
  memberCount: number
  avgPoints: number
  totalPoints: number
  avgExactScores: number
  avgCorrectResults: number
  rank: number
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
  hasPendingMatchdays?: boolean
}

interface TournamentRankingsProps {
  tournamentId: string
  availableMatchdays: number[]
  tournamentName?: string
  allMatches?: any[]
  teamsEnabled?: boolean
  tournamentType?: string
  currentUserId?: string // OPTIMISATION: Recevoir l'ID utilisateur depuis le parent
  isCustomCompetition?: boolean
}

export default function TournamentRankings({ tournamentId, availableMatchdays, tournamentName, allMatches, teamsEnabled, tournamentType, currentUserId: propUserId, isCustomCompetition }: TournamentRankingsProps) {
  const [selectedView, setSelectedView] = useState<'general' | 'teams' | number>('general')
  const [rankingsData, setRankingsData] = useState<RankingsData | null>(null)
  const [teamRankings, setTeamRankings] = useState<TeamStats[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(propUserId || null)
  const [matchdayStages, setMatchdayStages] = useState<Record<number, StageType | null>>({})

  // =====================================================
  // OPTIMISATION: Cache client pour éviter les re-fetch
  // Stocke les résultats par vue pour ne pas refetch inutilement
  // =====================================================
  const rankingsCache = useRef<Map<string, { data: RankingsData | TeamStats[], timestamp: number }>>(new Map())
  const CACHE_TTL = 30000 // 30 secondes de cache

  // Verifier si les equipes sont supportees (Elite ou Platinium)
  const supportsTeams = tournamentType === 'elite' || tournamentType === 'platinium'

  // Ref et états pour la navigation des vues avec flèches
  const viewsContainerRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  // Fonction pour vérifier si une journée a déjà commencé
  const hasMatchdayStarted = (matchday: number): boolean => {
    if (!allMatches) {
      return false // Par défaut, considérer comme NON commencé si pas de données
    }

    const matchesForDay = allMatches.filter((m: any) => m.matchday === matchday)
    if (matchesForDay.length === 0) {
      return false // Pas de matchs = pas encore commencé
    }

    const now = new Date()
    const firstMatchTime = new Date(Math.min(...matchesForDay.map((m: any) => new Date(m.utc_date).getTime())))
    const hasStarted = now >= firstMatchTime

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

  // Extraire les stages des matchs (sauf pour les compétitions custom qui gardent un nommage simple J1, J2...)
  useEffect(() => {
    if (isCustomCompetition || !allMatches || allMatches.length === 0) return
    const stagesByMatchday: Record<number, StageType | null> = {}
    allMatches.forEach((match: any) => {
      const md = match.virtual_matchday || match.matchday
      if (md && !stagesByMatchday[md]) {
        stagesByMatchday[md] = match.stage || null
      }
    })
    setMatchdayStages(stagesByMatchday)
  }, [allMatches, isCustomCompetition])

  // Vérifier les boutons de scroll au chargement et au resize
  useEffect(() => {
    checkScrollButtons()
    window.addEventListener('resize', checkScrollButtons)
    return () => window.removeEventListener('resize', checkScrollButtons)
  }, [checkScrollButtons, availableMatchdays])

  // =====================================================
  // OPTIMISATION: fetchCurrentUser une seule fois au montage
  // et seulement si pas déjà fourni par le parent
  // =====================================================
  useEffect(() => {
    if (!propUserId && !currentUserId) {
      fetchCurrentUser()
    }
  }, []) // Une seule fois au montage

  useEffect(() => {
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
    // =====================================================
    // OPTIMISATION: Vérifier le cache avant de fetch
    // =====================================================
    const cacheKey = `${tournamentId}-${selectedView}`
    const cached = rankingsCache.current.get(cacheKey)
    const now = Date.now()

    if (cached && (now - cached.timestamp) < CACHE_TTL) {
      // Utiliser les données en cache
      if (selectedView === 'teams') {
        setTeamRankings(cached.data as TeamStats[])
      } else {
        setRankingsData(cached.data as RankingsData)
      }
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Si vue equipes, charger le classement par equipe
      if (selectedView === 'teams') {
        const response = await fetchWithAuth(`/api/tournaments/${tournamentId}/teams/rankings`)
        if (response.ok) {
          const data = await response.json()
          const rankings = data.rankings || []
          setTeamRankings(rankings)
          // Mettre en cache
          rankingsCache.current.set(cacheKey, { data: rankings, timestamp: now })
        } else {
          setTeamRankings([])
        }
        setLoading(false)
        return
      }

      // Construire l'URL avec le paramètre matchday si nécessaire
      const url = selectedView === 'general'
        ? `/api/tournaments/${tournamentId}/rankings`
        : `/api/tournaments/${tournamentId}/rankings?matchday=${selectedView}`

      const response = await fetchWithAuth(url)

      if (!response.ok) {
        throw new Error('Erreur lors de la récupération du classement')
      }

      const data = await response.json()
      setRankingsData(data)
      // Mettre en cache
      rankingsCache.current.set(cacheKey, { data, timestamp: now })
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
      // Triangle vert pointant vers le haut
      return (
        <svg className="w-3 h-3 md:w-4 md:h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L2 22h20L12 2z" className="text-green-500" />
        </svg>
      )
    }

    if (rankChange === 'down') {
      // Triangle rouge pointant vers le bas
      return (
        <svg className="w-3 h-3 md:w-4 md:h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 22L2 2h20L12 22z" className="text-red-500" />
        </svg>
      )
    }

    // Signe égal orange
    return (
      <svg className="w-3 h-3 md:w-4 md:h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
        <path d="M5 9h14M5 15h14" className="text-orange-500" />
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
            {/* Bouton Équipes (uniquement si supporte et active) */}
            {supportsTeams && teamsEnabled && (
              <button
                onClick={() => setSelectedView('teams')}
                className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-sm md:text-base font-semibold transition whitespace-nowrap flex-shrink-0 flex items-center gap-1 ${
                  selectedView === 'teams'
                    ? 'bg-[#ff9900] text-[#111]'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-[#ff9900] hover:text-[#111]'
                }`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 20C17 18.3431 14.7614 17 12 17C9.23858 17 7 18.3431 7 20M21 17C21 15.77 19.77 14.71 18 14.25M3 17C3 15.77 4.23 14.71 6 14.25M18 10.24C18.61 9.69 19 8.89 19 8C19 6.34 17.66 5 16 5C15.23 5 14.53 5.29 14 5.76M6 10.24C5.39 9.69 5 8.89 5 8C5 6.34 6.34 5 8 5C8.77 5 9.47 5.29 10 5.76M12 14C10.34 14 9 12.66 9 11C9 9.34 10.34 8 12 8C13.66 8 15 9.34 15 11C15 12.66 13.66 14 12 14Z" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Équipes
              </button>
            )}
            {availableMatchdays
              .filter(matchday => hasMatchdayStarted(matchday))
              .map(matchday => {
                const stage = matchdayStages[matchday]
                const leg = getLegNumber(matchday, matchdayStages)
                const matchdayLabel = getStageShortLabel(stage, matchday, undefined, leg)
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
          <div className="loading-spinner-inline"></div>
          <p className="mt-4 theme-text-secondary">Chargement du classement...</p>
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-red-500">{error}</p>
        </div>
      ) : selectedView === 'teams' ? (
        // Vue classement par equipes
        teamRankings.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-16 h-16 mx-auto mb-4 theme-text-secondary opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M17 20C17 18.3431 14.7614 17 12 17C9.23858 17 7 18.3431 7 20M21 17C21 15.77 19.77 14.71 18 14.25M3 17C3 15.77 4.23 14.71 6 14.25M18 10.24C18.61 9.69 19 8.89 19 8C19 6.34 17.66 5 16 5C15.23 5 14.53 5.29 14 5.76M6 10.24C5.39 9.69 5 8.89 5 8C5 6.34 6.34 5 8 5C8.77 5 9.47 5.29 10 5.76M12 14C10.34 14 9 12.66 9 11C9 9.34 10.34 8 12 8C13.66 8 15 9.34 15 11C15 12.66 13.66 14 12 14Z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <p className="theme-text-secondary">
              Aucune equipe creee pour le moment.
            </p>
            <p className="text-sm theme-text-secondary mt-2">
              Le capitaine doit creer des equipes sur la page d&apos;echauffement.
            </p>
          </div>
        ) : (
          <div>
            {/* Info classement équipes */}
            <div className="mb-3 md:mb-4 p-2 md:p-3 rounded-lg info-bg-container">
              <p className="text-xs md:text-sm theme-text-secondary">
                Classement basé sur la moyenne des points de chaque équipe
              </p>
            </div>

            {/* Tableau des équipes */}
            <div className="overflow-x-auto -mx-2 md:mx-0">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 theme-border">
                    <th className="text-left py-2 md:py-3 px-1 md:px-2 theme-text font-semibold text-xs md:text-base">#</th>
                    <th className="text-left py-2 md:py-3 px-1 md:px-2 theme-text font-semibold text-xs md:text-base">Équipe</th>
                    <th className="text-center py-2 md:py-3 px-1 md:px-2 theme-text font-semibold text-xs md:text-base" title="Moyenne Points">
                      <span className="md:hidden">Pts</span>
                      <span className="hidden md:inline">Moy. Points</span>
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
                    <th className="text-center py-2 md:py-3 px-1 md:px-2 theme-text font-semibold text-xs md:text-base hidden md:table-cell">Membres</th>
                  </tr>
                </thead>
                <tbody>
                  {teamRankings.map((team) => (
                    <tr
                      key={team.teamId}
                      className="border-b theme-border hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                    >
                      {/* Rang */}
                      <td className="py-2 md:py-4 px-1 md:px-2 theme-text font-bold text-xs md:text-base">
                        <span className="w-4 md:w-6 text-center">{team.rank}</span>
                      </td>

                      {/* Nom equipe avec avatar */}
                      <td className="py-2 md:py-4 px-1 md:px-2 font-medium">
                        <div className="flex items-center gap-1 md:gap-2">
                          <img
                            src={`/images/team-avatars/${team.teamAvatar}.svg`}
                            alt={team.teamName}
                            className="w-6 h-6 md:w-8 md:h-8 flex-shrink-0"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/images/team-avatars/team1.svg'
                            }}
                          />
                          <span className="text-xs md:text-base truncate max-w-[100px] md:max-w-none theme-text">
                            {team.teamName}
                          </span>
                        </div>
                      </td>

                      {/* Moyenne Points */}
                      <td className="py-2 md:py-4 px-1 md:px-2 text-center">
                        {team.rank <= 3 ? (
                          <span className={`inline-block px-2 py-0.5 md:px-3 md:py-1 rounded-full font-bold text-xs md:text-base ${
                            team.rank === 1
                              ? 'bg-yellow-500 text-[#0f172a]'
                              : team.rank === 2
                                ? 'bg-gray-400 text-[#0f172a]'
                                : 'bg-amber-600 text-[#0f172a]'
                          }`}>
                            {team.avgPoints.toFixed(1)}
                          </span>
                        ) : (
                          <span className="theme-text font-bold text-xs md:text-base">
                            {team.avgPoints.toFixed(1)}
                          </span>
                        )}
                      </td>

                      {/* Bons résultats (moyenne) */}
                      <td className="py-2 md:py-4 px-1 md:px-2 text-center theme-text text-xs md:text-base">
                        {team.avgCorrectResults.toFixed(1)}
                      </td>

                      {/* Scores exacts (moyenne) */}
                      <td className="py-2 md:py-4 px-1 md:px-2 text-center theme-text text-xs md:text-base">
                        {team.avgExactScores.toFixed(1)}
                      </td>

                      {/* Nombre de membres */}
                      <td className="py-2 md:py-4 px-1 md:px-2 text-center theme-text-secondary text-xs md:text-base hidden md:table-cell">
                        {team.memberCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Légende pour mobile */}
            <div className="mt-3 p-2 rounded-lg md:hidden info-bg-container">
              <div className="space-y-1">
                <p className="text-xs theme-text-secondary flex items-center gap-1">
                  <span>* ✓ =</span>
                  <span>moyenne bons résultats</span>
                </p>
                <p className="text-xs theme-text-secondary flex items-center gap-1">
                  <span>*</span>
                  <img src="/images/icons/target.svg" alt="Target" className="w-3 h-3 inline-block icon-filter-theme" />
                  <span>= moyenne scores exacts</span>
                </p>
              </div>
            </div>
          </div>
        )
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
                    {rankingsData.matchesFinished === rankingsData.matchesTotal && rankingsData.matchesTotal > 0 && !rankingsData.hasPendingMatchdays && ' : classement final'}
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
                    <th className="text-center py-2 md:py-3 px-0.5 md:px-1 theme-text font-semibold w-6 md:w-8"></th>
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
                      <td className="py-2 md:py-4 px-0.5 md:px-1 text-center">
                        {getRankChangeIcon(player.rankChange)}
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
