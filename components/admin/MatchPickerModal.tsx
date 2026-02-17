'use client'

import { useState, useEffect, useCallback } from 'react'

interface Match {
  id: string
  home_team: string
  away_team: string
  home_team_crest: string | null
  away_team_crest: string | null
  utc_date: string
  status: string
  competition_name: string
  competition_emblem: string | null
}

interface SelectedMatch {
  id: string
  utc_date: string
}

interface MatchPickerModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectMatches: (matchIds: string[]) => void
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function weekLaterStr(): string {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  return d.toISOString().slice(0, 10)
}

export default function MatchPickerModal({ isOpen, onClose, onSelectMatches }: MatchPickerModalProps) {
  const [dateFrom, setDateFrom] = useState(todayStr)
  const [dateTo, setDateTo] = useState(weekLaterStr)
  const [matchesByCompetition, setMatchesByCompetition] = useState<Record<string, Match[]>>({})
  const [totalMatches, setTotalMatches] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)
  const [selected, setSelected] = useState<Map<string, string>>(new Map()) // id -> utc_date

  // Recherche automatique à l'ouverture
  useEffect(() => {
    if (isOpen) {
      fetchMatches()
      setSelected(new Map())
    } else {
      setSearched(false)
      setMatchesByCompetition({})
      setSelected(new Map())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  async function fetchMatches() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/communications/search-matches?date_from=${dateFrom}&date_to=${dateTo}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur')
      setMatchesByCompetition(data.matchesByCompetition || {})
      setTotalMatches(data.totalMatches || 0)
      setSearched(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleMatch = useCallback((id: string, utcDate: string) => {
    setSelected(prev => {
      const next = new Map(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.set(id, utcDate)
      }
      return next
    })
  }, [])

  const handleInsert = useCallback(() => {
    if (selected.size === 0) return
    // Trier par date croissante
    const sorted = Array.from(selected.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id]) => id)
    onSelectMatches(sorted)
  }, [selected, onSelectMatches])

  if (!isOpen) return null

  const competitions = Object.keys(matchesByCompetition)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">⚽ Insérer des matchs</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Filtres */}
        <div className="flex items-end gap-3 px-5 py-3 border-b border-gray-100 bg-gray-50">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">Du</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">Au</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>
          <button
            type="button"
            onClick={fetchMatches}
            disabled={loading}
            className="px-4 py-1.5 text-sm font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 disabled:opacity-50"
          >
            {loading ? '...' : 'Rechercher'}
          </button>
        </div>

        {/* Résultats */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {error && (
            <div className="text-red-600 text-sm text-center py-4">{error}</div>
          )}

          {loading && (
            <div className="text-gray-500 text-sm text-center py-8">Recherche en cours...</div>
          )}

          {!loading && searched && competitions.length === 0 && (
            <div className="text-gray-500 text-sm text-center py-8">
              Aucun match trouvé pour cette période
            </div>
          )}

          {!loading && competitions.map(compName => (
            <div key={compName} className="mb-4">
              {/* Compétition header */}
              <div className="flex items-center gap-2 mb-2 sticky top-0 bg-white py-1">
                {matchesByCompetition[compName][0]?.competition_emblem && (
                  <img
                    src={`/api/proxy-image?url=${encodeURIComponent(matchesByCompetition[compName][0].competition_emblem!)}`}
                    alt=""
                    width={20}
                    height={20}
                    className="rounded"
                  />
                )}
                <span className="text-sm font-semibold text-gray-800">{compName}</span>
                <span className="text-xs text-gray-400">({matchesByCompetition[compName].length})</span>
              </div>

              {/* Matchs */}
              <div className="space-y-1">
                {matchesByCompetition[compName].map(match => {
                  const isSelected = selected.has(match.id)
                  return (
                    <button
                      key={match.id}
                      type="button"
                      onClick={() => toggleMatch(match.id, match.utc_date)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left border ${
                        isSelected
                          ? 'bg-orange-50 border-orange-300'
                          : 'hover:bg-gray-50 border-transparent hover:border-gray-200'
                      }`}
                    >
                      {/* Checkbox */}
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-orange-500 border-orange-500 text-white'
                          : 'border-gray-300'
                      }`}>
                        {isSelected && (
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>

                      {/* Equipe domicile */}
                      <div className="flex items-center gap-1.5 flex-1 justify-end">
                        <span className="text-sm text-gray-800 truncate text-right">{match.home_team}</span>
                        {match.home_team_crest ? (
                          <img
                            src={`/api/proxy-image?url=${encodeURIComponent(match.home_team_crest)}`}
                            alt=""
                            width={20}
                            height={20}
                            className="flex-shrink-0"
                          />
                        ) : (
                          <span className="text-sm">⚽</span>
                        )}
                      </div>

                      {/* Date/heure */}
                      <div className="flex-shrink-0 text-center px-2">
                        <div className="text-[10px] text-gray-400 leading-tight">{formatDate(match.utc_date)}</div>
                        <div className="text-xs font-medium text-orange-600">{formatTime(match.utc_date)}</div>
                      </div>

                      {/* Equipe extérieur */}
                      <div className="flex items-center gap-1.5 flex-1">
                        {match.away_team_crest ? (
                          <img
                            src={`/api/proxy-image?url=${encodeURIComponent(match.away_team_crest)}`}
                            alt=""
                            width={20}
                            height={20}
                            className="flex-shrink-0"
                          />
                        ) : (
                          <span className="text-sm">⚽</span>
                        )}
                        <span className="text-sm text-gray-800 truncate">{match.away_team}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200 flex items-center justify-between">
          <span className="text-xs text-gray-400">
            {selected.size > 0
              ? `${selected.size} match${selected.size > 1 ? 's' : ''} sélectionné${selected.size > 1 ? 's' : ''}`
              : searched && totalMatches > 0
                ? `${totalMatches} match${totalMatches > 1 ? 's' : ''} trouvé${totalMatches > 1 ? 's' : ''}`
                : ''
            }
          </span>
          <button
            type="button"
            onClick={handleInsert}
            disabled={selected.size === 0}
            className="px-5 py-2 text-sm font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Insérer {selected.size > 0 ? `(${selected.size})` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}
