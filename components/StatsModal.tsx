'use client'

import { useState, useEffect } from 'react'
import StandingsModal from './StandingsModal'

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
  homeTeamCrest: string | null
  awayTeamCrest: string | null
  competitionEmblem: string | null
  competitionCustomEmblemColor: string | null  // Logo coloré pour thème clair
  competitionCustomEmblemWhite: string | null  // Logo blanc pour thème sombre
  homeTeamPosition: number | null
  awayTeamPosition: number | null
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

// Composant pour un rond de resultat
function ResultCircle({
  result,
  label,
  isSelected,
  onClick,
  isUpcoming = false
}: {
  result?: 'W' | 'D' | 'L'
  label: string
  isSelected: boolean
  onClick?: () => void
  isUpcoming?: boolean
}) {
  let bgColor = 'bg-gray-500'
  if (!isUpcoming) {
    bgColor = result === 'W' ? 'bg-green-500' : result === 'D' ? 'bg-yellow-500' : 'bg-red-500'
  }

  return (
    <div className="flex flex-col items-center">
      <button
        onClick={onClick}
        disabled={isUpcoming}
        className={`w-7 h-7 flex items-center justify-center rounded-full text-white text-xs font-bold transition-all ${bgColor} ${
          !isUpcoming ? 'hover:scale-110 cursor-pointer' : 'cursor-default'
        } ${isSelected ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 ring-blue-500 dark:ring-[#ff9900]' : ''}`}
      >
        {label}
      </button>
      {/* Fleche indicateur */}
      <div className={`mt-1 h-3 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0'}`}>
        <svg className="w-3 h-3 text-blue-500 dark:text-[#ff9900]" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 4l-8 8h16l-8-8z" />
        </svg>
      </div>
    </div>
  )
}

// Composant pour afficher le detail d'un match avec logo adapté au thème
function MatchDetailCard({
  match,
  competitionEmblem,
  competitionCustomEmblemColor,
  competitionCustomEmblemWhite
}: {
  match: TeamFormMatch | null
  competitionEmblem: string | null
  competitionCustomEmblemColor: string | null
  competitionCustomEmblemWhite: string | null
}) {
  if (!match) {
    return (
      <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-center min-h-[72px] flex items-center justify-center">
        <p className="text-xs text-slate-500 dark:text-slate-400">Cliquez sur un rond</p>
      </div>
    )
  }

  const resultBg = match.result === 'W' ? 'bg-green-500/10 border-green-500/30' :
                   match.result === 'D' ? 'bg-yellow-500/10 border-yellow-500/30' :
                   'bg-red-500/10 border-red-500/30'
  const resultText = match.result === 'W' ? 'Victoire' : match.result === 'D' ? 'Nul' : 'Défaite'

  // Logo pour thème clair: custom coloré ou emblème par défaut
  // Logo pour thème sombre: custom blanc ou emblème par défaut
  const logoLight = competitionCustomEmblemColor || competitionEmblem
  const logoDark = competitionCustomEmblemWhite || competitionEmblem

  return (
    <div className={`p-3 rounded-lg border ${resultBg} flex gap-3`}>
      {/* Logo competition agrandi - adapté au thème */}
      {(logoLight || logoDark) && (
        <div className="shrink-0 flex items-center">
          {/* Logo pour thème clair (coloré) */}
          {logoLight && (
            <img
              src={logoLight}
              alt="Competition"
              className="w-10 h-10 object-contain dark:hidden"
            />
          )}
          {/* Logo pour thème sombre (blanc) */}
          {logoDark && (
            <img
              src={logoDark}
              alt="Competition"
              className="w-10 h-10 object-contain hidden dark:block"
            />
          )}
        </div>
      )}

      {/* Contenu */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {match.opponentCrest && (
              <img
                src={match.opponentCrest}
                alt={match.opponentName}
                className="w-5 h-5 object-contain shrink-0"
              />
            )}
            <span className="text-xs theme-text truncate">
              {match.isHome ? 'vs' : '@'} {match.opponentName}
            </span>
          </div>
          <span className="text-sm font-bold theme-text ml-2">
            {match.goalsFor}-{match.goalsAgainst}
          </span>
        </div>
        <div className="flex items-center justify-between text-[10px]">
          <span className="theme-text-secondary">
            {new Date(match.utcDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
          </span>
          <span className={`font-medium ${
            match.result === 'W' ? 'text-green-500 dark:text-green-400' :
            match.result === 'D' ? 'text-yellow-600 dark:text-yellow-400' :
            'text-red-500 dark:text-red-400'
          }`}>
            {resultText}
          </span>
        </div>
      </div>
    </div>
  )
}

// Composant pour la forme d'une equipe
function TeamFormSection({
  teamName,
  teamCrest,
  matches,
  selectedIndex,
  onSelectIndex,
  dotColor,
  competitionEmblem,
  competitionCustomEmblemColor,
  competitionCustomEmblemWhite,
  position
}: {
  teamName: string
  teamCrest: string | null
  matches: TeamFormMatch[]
  selectedIndex: number
  onSelectIndex: (index: number) => void
  dotColor: string
  competitionEmblem: string | null
  competitionCustomEmblemColor: string | null
  competitionCustomEmblemWhite: string | null
  position: number | null
}) {
  // Inverser les matchs pour avoir le plus ancien a gauche, plus recent a droite
  const reversedMatches = [...matches].reverse()

  return (
    <div className="flex-1">
      {/* Nom equipe avec logo et position */}
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-2 h-2 rounded-full ${dotColor}`}></span>
        {teamCrest && (
          <img
            src={teamCrest}
            alt={teamName}
            className="w-5 h-5 object-contain shrink-0"
          />
        )}
        <span className="text-sm font-semibold theme-text truncate">{teamName}</span>
        {position && (
          <span className="text-xs theme-text-secondary bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded shrink-0">
            {position}{position === 1 ? 'er' : 'ème'}
          </span>
        )}
      </div>

      {/* Ronds de resultat */}
      {matches.length === 0 ? (
        <div className="text-xs theme-text-secondary text-center py-2">
          Aucun match
        </div>
      ) : (
        <>
          <div className="flex items-start justify-center gap-1 mb-1">
            {reversedMatches.map((match, idx) => {
              // Convertir l'index inverse en index original (pour la selection)
              const originalIndex = matches.length - 1 - idx
              const label = match.result === 'W' ? 'V' : match.result === 'D' ? 'N' : 'D'
              return (
                <ResultCircle
                  key={match.matchId}
                  result={match.result}
                  label={label}
                  isSelected={selectedIndex === originalIndex}
                  onClick={() => onSelectIndex(originalIndex)}
                />
              )
            })}
            {/* Rond "?" pour le match a venir */}
            <ResultCircle
              label="?"
              isSelected={false}
              isUpcoming={true}
            />
          </div>

          {/* Carte detail du match selectionne */}
          <MatchDetailCard
            match={selectedIndex >= 0 && selectedIndex < matches.length ? matches[selectedIndex] : null}
            competitionEmblem={competitionEmblem}
            competitionCustomEmblemColor={competitionCustomEmblemColor}
            competitionCustomEmblemWhite={competitionCustomEmblemWhite}
          />
        </>
      )}
    </div>
  )
}

// Composant pour les barres de tendance
function TrendsBar({ label, percentage, count, color }: { label: string; percentage: number; count: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="theme-text-secondary truncate mr-2">{label}</span>
        <span className="font-semibold theme-text">{percentage}%</span>
      </div>
      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="text-xs theme-text-secondary text-right">
        {count} prono{count > 1 ? 's' : ''}
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
  const [homeSelectedIndex, setHomeSelectedIndex] = useState(0)
  const [awaySelectedIndex, setAwaySelectedIndex] = useState(0)
  const [showStandings, setShowStandings] = useState(false)

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
        // Initialiser la selection sur le match le plus recent (index 0)
        setHomeSelectedIndex(0)
        setAwaySelectedIndex(0)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Une erreur est survenue')
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [matchId, tournamentId, competitionId, homeTeamId, awayTeamId, homeTeamName, awayTeamName])

  return (
    <>
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div
          className="theme-card max-w-md w-full max-h-[85vh] flex flex-col !p-0 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header avec titre centre */}
          <div className="p-4 border-b theme-border shrink-0">
            <div className="flex items-center justify-between">
              <div className="w-8" /> {/* Spacer for centering */}
              <h3 className="text-base font-bold text-blue-600 dark:text-[#ff9900] text-center flex-1">Stats du match</h3>
              <button
                onClick={onClose}
                className="p-2 rounded-lg theme-text-secondary hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Match teams centré avec logos */}
            <div className="flex items-center justify-center gap-2 mt-2">
              {data?.homeTeamCrest && (
                <img
                  src={data.homeTeamCrest}
                  alt={homeTeamName}
                  className="w-6 h-6 object-contain"
                />
              )}
              <p className="text-sm theme-text">
                {homeTeamName} <span className="text-blue-600 dark:text-[#ff9900] font-semibold">vs</span> {awayTeamName}
              </p>
              {data?.awayTeamCrest && (
                <img
                  src={data.awayTeamCrest}
                  alt={awayTeamName}
                  className="w-6 h-6 object-contain"
                />
              )}
            </div>
          </div>

          {/* Content */}
          <div className="p-4 overflow-y-auto flex-1 space-y-5">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 dark:border-[#ff9900]"></div>
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <p className="text-red-500">{error}</p>
                <button
                  onClick={onClose}
                  className="mt-4 px-4 py-2 bg-blue-500 dark:bg-[#ff9900] text-white rounded-lg text-sm hover:bg-blue-600 dark:hover:bg-[#e68a00] transition-colors"
                >
                  Fermer
                </button>
              </div>
            ) : data ? (
              <>
                {/* Forme des equipes */}
                <div>
                  <h4 className="text-sm font-semibold theme-text mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-600 dark:text-[#ff9900]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    Forme recente
                  </h4>
                  <div className="space-y-4">
                    <TeamFormSection
                      teamName={data.homeTeamName}
                      teamCrest={data.homeTeamCrest}
                      matches={data.homeTeamForm}
                      selectedIndex={homeSelectedIndex}
                      onSelectIndex={setHomeSelectedIndex}
                      dotColor="bg-blue-500"
                      competitionEmblem={data.competitionEmblem}
                      competitionCustomEmblemColor={data.competitionCustomEmblemColor}
                      competitionCustomEmblemWhite={data.competitionCustomEmblemWhite}
                      position={data.homeTeamPosition}
                    />
                    <TeamFormSection
                      teamName={data.awayTeamName}
                      teamCrest={data.awayTeamCrest}
                      matches={data.awayTeamForm}
                      selectedIndex={awaySelectedIndex}
                      onSelectIndex={setAwaySelectedIndex}
                      dotColor="bg-[#ff9900]"
                      competitionEmblem={data.competitionEmblem}
                      competitionCustomEmblemColor={data.competitionCustomEmblemColor}
                      competitionCustomEmblemWhite={data.competitionCustomEmblemWhite}
                      position={data.awayTeamPosition}
                    />
                  </div>
                </div>

                {/* Lien vers le classement */}
                <button
                  onClick={() => setShowStandings(true)}
                  className="w-full flex items-center justify-center gap-2 py-2 text-sm text-blue-600 dark:text-[#ff9900] hover:text-blue-700 dark:hover:text-[#ffaa33] transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Voir le classement
                </button>

                {/* Tendances de pronostics - masqué si pas de données */}
                {data.predictionTrends && (
                  <div>
                    <h4 className="text-sm font-semibold theme-text mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4 text-blue-600 dark:text-[#ff9900]" fill="currentColor" viewBox="0 0 24 24">
                        <rect x="4" y="10" width="4" height="10" rx="1" />
                        <rect x="10" y="4" width="4" height="16" rx="1" />
                        <rect x="16" y="8" width="4" height="12" rx="1" />
                      </svg>
                      Tendances des pronostics
                    </h4>
                    <div className="space-y-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
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
                      <p className="text-[10px] theme-text-secondary text-center pt-1">
                        Base sur {data.predictionTrends.totalPredictions} pronostics
                      </p>
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </div>

          {/* Footer */}
          <div className="p-3 border-t theme-border shrink-0">
            <button
              onClick={onClose}
              className="w-full px-4 py-2.5 bg-blue-500 dark:bg-[#ff9900] text-white rounded-lg hover:bg-blue-600 dark:hover:bg-[#e68a00] transition-colors font-medium text-sm"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>

      {/* Modal Classement */}
      {showStandings && (
        <StandingsModal
          competitionId={competitionId}
          competitionEmblem={data?.competitionEmblem}
          competitionCustomEmblemColor={data?.competitionCustomEmblemColor}
          competitionCustomEmblemWhite={data?.competitionCustomEmblemWhite}
          highlightTeamIds={[homeTeamId, awayTeamId]}
          onClose={() => setShowStandings(false)}
        />
      )}
    </>
  )
}
