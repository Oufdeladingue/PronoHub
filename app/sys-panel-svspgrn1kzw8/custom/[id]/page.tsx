'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import AdminLayout from '@/components/AdminLayout'
import { ArrowLeft, Plus, Calendar, Trash2, Check, X, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Eye } from 'lucide-react'

interface CustomCompetition {
  id: string
  name: string
  code: string
  matches_per_matchday: number
}

interface Matchday {
  id: string
  matchday_number: number
  week_start: string
  week_end: string
  status: 'draft' | 'published' | 'completed'
  matchesCount: number
}

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
  imported_match_id: string
  cached_home_team: string
  cached_away_team: string
  cached_home_logo: string | null
  cached_away_logo: string | null
  cached_utc_date: string
  cached_competition_name: string
}

export default function CustomCompetitionMatchdaysPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const [competition, setCompetition] = useState<CustomCompetition | null>(null)
  const [matchdays, setMatchdays] = useState<Matchday[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Modal de création de journée
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [selectedWeek, setSelectedWeek] = useState<{ start: string; end: string }>({
    start: getMonday(new Date()).toISOString().split('T')[0],
    end: getSunday(new Date()).toISOString().split('T')[0]
  })

  // Modal de sélection de matchs
  const [showMatchesModal, setShowMatchesModal] = useState(false)
  const [selectedMatchday, setSelectedMatchday] = useState<Matchday | null>(null)
  const [availableMatches, setAvailableMatches] = useState<Record<string, Match[]>>({})
  const [selectedMatches, setSelectedMatches] = useState<SelectedMatch[]>([])
  const [loadingMatches, setLoadingMatches] = useState(false)
  const [expandedCompetitions, setExpandedCompetitions] = useState<Set<string>>(new Set())

  // Modal de prévisualisation des matchs
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [previewMatchday, setPreviewMatchday] = useState<Matchday | null>(null)
  const [previewMatches, setPreviewMatches] = useState<any[]>([])
  const [loadingPreview, setLoadingPreview] = useState(false)

  function getMonday(d: Date): Date {
    const date = new Date(d)
    const day = date.getDay()
    const diff = date.getDate() - day + (day === 0 ? -6 : 1)
    return new Date(date.setDate(diff))
  }

  function getSunday(d: Date): Date {
    const monday = getMonday(d)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    return sunday
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    })
  }

  function formatDateTime(dateStr: string): string {
    return new Date(dateStr).toLocaleString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const fetchCompetition = async () => {
    try {
      const response = await fetch('/api/admin/custom-competitions')
      if (!response.ok) throw new Error('Failed to fetch')
      const data = await response.json()
      const comp = data.competitions?.find((c: any) => c.id === id)
      setCompetition(comp || null)
    } catch (err: any) {
      setError(err.message)
    }
  }

  const fetchMatchdays = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/custom-competitions/${id}/matchdays`)
      if (!response.ok) throw new Error('Failed to fetch matchdays')
      const data = await response.json()
      setMatchdays(data.matchdays || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const createMatchday = async () => {
    setCreating(true)
    setError(null)
    try {
      const response = await fetch(`/api/admin/custom-competitions/${id}/matchdays`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          week_start: selectedWeek.start,
          week_end: selectedWeek.end
        })
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      setSuccess(data.message)
      setShowCreateModal(false)
      await fetchMatchdays()

      // Avancer à la semaine suivante
      const nextMonday = new Date(selectedWeek.start)
      nextMonday.setDate(nextMonday.getDate() + 7)
      setSelectedWeek({
        start: nextMonday.toISOString().split('T')[0],
        end: getSunday(nextMonday).toISOString().split('T')[0]
      })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  const deleteMatchday = async (matchdayId: string) => {
    if (!confirm('Supprimer cette journée et tous ses matchs ?')) return

    try {
      const response = await fetch(`/api/admin/custom-competitions/${id}/matchdays?matchdayId=${matchdayId}`, {
        method: 'DELETE'
      })
      if (!response.ok) throw new Error('Failed to delete')
      setSuccess('Journée supprimée')
      await fetchMatchdays()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const openMatchesModal = async (matchday: Matchday) => {
    setSelectedMatchday(matchday)
    setShowMatchesModal(true)
    setLoadingMatches(true)

    try {
      // Charger les matchs disponibles
      const availableRes = await fetch(
        `/api/admin/custom-competitions/available-matches?week_start=${matchday.week_start}&week_end=${matchday.week_end}`
      )
      const availableData = await availableRes.json()
      setAvailableMatches(availableData.matchesByCompetition || {})

      // Charger les matchs déjà sélectionnés
      const selectedRes = await fetch(
        `/api/admin/custom-competitions/${id}/matchdays/${matchday.id}/matches`
      )
      const selectedData = await selectedRes.json()
      setSelectedMatches(selectedData.matches || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoadingMatches(false)
    }
  }

  const addMatch = async (match: Match) => {
    if (!selectedMatchday) return

    try {
      const response = await fetch(
        `/api/admin/custom-competitions/${id}/matchdays/${selectedMatchday.id}/matches`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imported_match_id: match.id })
        }
      )

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      // Recharger les matchs sélectionnés
      const selectedRes = await fetch(
        `/api/admin/custom-competitions/${id}/matchdays/${selectedMatchday.id}/matches`
      )
      const selectedData = await selectedRes.json()
      setSelectedMatches(selectedData.matches || [])

      // Mettre à jour le compteur
      setMatchdays(prev => prev.map(md =>
        md.id === selectedMatchday.id
          ? { ...md, matchesCount: md.matchesCount + 1 }
          : md
      ))
    } catch (err: any) {
      setError(err.message)
    }
  }

  const removeMatch = async (matchId: string) => {
    if (!selectedMatchday) return

    try {
      const response = await fetch(
        `/api/admin/custom-competitions/${id}/matchdays/${selectedMatchday.id}/matches?matchId=${matchId}`,
        { method: 'DELETE' }
      )

      if (!response.ok) throw new Error('Failed to remove match')

      setSelectedMatches(prev => prev.filter(m => m.id !== matchId))

      // Mettre à jour le compteur
      setMatchdays(prev => prev.map(md =>
        md.id === selectedMatchday.id
          ? { ...md, matchesCount: Math.max(0, md.matchesCount - 1) }
          : md
      ))
    } catch (err: any) {
      setError(err.message)
    }
  }

  const isMatchSelected = (matchId: string) => {
    return selectedMatches.some(m => m.imported_match_id === matchId)
  }

  const toggleCompetitionExpansion = (compName: string) => {
    setExpandedCompetitions(prev => {
      const newSet = new Set(prev)
      if (newSet.has(compName)) {
        newSet.delete(compName)
      } else {
        newSet.add(compName)
      }
      return newSet
    })
  }

  // Fermer tous les accordéons par défaut quand les matchs sont chargés
  useEffect(() => {
    setExpandedCompetitions(new Set())
  }, [availableMatches])

  // Ouvrir le popup de prévisualisation des matchs
  const openPreviewModal = async (matchday: Matchday) => {
    setPreviewMatchday(matchday)
    setShowPreviewModal(true)
    setLoadingPreview(true)

    try {
      const response = await fetch(
        `/api/admin/custom-competitions/${id}/matchdays/${matchday.id}/matches`
      )
      const data = await response.json()

      if (data.success) {
        // Trier les matchs par date
        const sortedMatches = (data.matches || []).sort(
          (a: any, b: any) => new Date(a.utc_date).getTime() - new Date(b.utc_date).getTime()
        )
        setPreviewMatches(sortedMatches)
      }
    } catch (err) {
      console.error('Error fetching preview matches:', err)
    } finally {
      setLoadingPreview(false)
    }
  }

  // Vérifier si une semaine est déjà utilisée par une journée existante
  const isWeekUsed = (weekStart: string): { used: boolean; matchdayNumber: number | null } => {
    const matchday = matchdays.find(md => md.week_start === weekStart)
    if (matchday) {
      return { used: true, matchdayNumber: matchday.matchday_number }
    }
    return { used: false, matchdayNumber: null }
  }

  const currentWeekStatus = isWeekUsed(selectedWeek.start)

  const changeWeek = (direction: 'prev' | 'next') => {
    const currentMonday = new Date(selectedWeek.start)
    currentMonday.setDate(currentMonday.getDate() + (direction === 'next' ? 7 : -7))
    setSelectedWeek({
      start: currentMonday.toISOString().split('T')[0],
      end: getSunday(currentMonday).toISOString().split('T')[0]
    })
  }

  useEffect(() => {
    fetchCompetition()
    fetchMatchdays()
  }, [id])

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [success])

  return (
    <AdminLayout currentPage="custom">
      <div className="min-h-screen bg-gray-50">
        <main className="max-w-7xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => router.push('/sys-panel-svspgrn1kzw8/custom')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour aux compétitions
            </button>

            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {competition?.name || 'Chargement...'}
                </h1>
                <p className="text-gray-600 mt-1">
                  Gérez les journées et sélectionnez les matchs
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
              >
                <Plus className="w-5 h-5" />
                Nouvelle journée
              </button>
            </div>
          </div>

          {/* Messages */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
              {error}
              <button onClick={() => setError(null)} className="ml-2 font-bold">×</button>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
              {success}
            </div>
          )}

          {/* Liste des journées */}
          {loading ? (
            <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500">
              Chargement...
            </div>
          ) : matchdays.length === 0 ? (
            <div className="bg-white p-8 rounded-lg shadow text-center">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">Aucune journée créée</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="text-purple-600 hover:text-purple-700 font-medium"
              >
                Créer la première journée
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {matchdays.map((matchday) => (
                <div
                  key={matchday.id}
                  className="bg-white rounded-lg shadow-md border-2 border-gray-300 overflow-hidden"
                >
                  <div className="p-4 flex items-center justify-between bg-gradient-to-r from-white to-gray-50">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center shadow-sm">
                        <span className="text-xl font-bold text-white">
                          J{matchday.matchday_number}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          Journée {matchday.matchday_number}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {formatDate(matchday.week_start)} → {formatDate(matchday.week_end)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Compteur de matchs */}
                      <div className={`px-3 py-1 rounded-full text-sm font-medium border ${
                        matchday.matchesCount >= (competition?.matches_per_matchday || 8)
                          ? 'bg-green-100 text-green-700 border-green-300'
                          : 'bg-amber-100 text-amber-700 border-amber-300'
                      }`}>
                        {matchday.matchesCount}/{competition?.matches_per_matchday || 8} matchs
                      </div>

                      {/* Statut */}
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
                        matchday.status === 'published'
                          ? 'bg-green-100 text-green-700 border-green-300'
                          : matchday.status === 'completed'
                          ? 'bg-gray-200 text-gray-700 border-gray-400'
                          : 'bg-yellow-100 text-yellow-700 border-yellow-300'
                      }`}>
                        {matchday.status === 'published' ? 'Publiée' : matchday.status === 'completed' ? 'Terminée' : 'Brouillon'}
                      </span>

                      {/* Actions */}
                      <button
                        onClick={() => openMatchesModal(matchday)}
                        className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition text-sm font-medium border border-purple-300"
                      >
                        Gérer les matchs
                      </button>
                      <button
                        onClick={() => openPreviewModal(matchday)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition border border-blue-200"
                        title="Aperçu des matchs"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteMatchday(matchday.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition border border-red-200"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Modal de création de journée */}
          {showCreateModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
                <div className="p-6 border-b border-gray-200">
                  <h2 className="text-xl font-bold text-gray-900">Nouvelle journée</h2>
                  <p className="text-sm text-gray-500 mt-1">Sélectionnez la semaine</p>
                </div>

                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <button
                      onClick={() => changeWeek('prev')}
                      className="p-2 hover:bg-gray-100 rounded-lg transition border border-gray-200"
                    >
                      <ChevronLeft className="w-5 h-5 text-gray-700" />
                    </button>
                    <div className="text-center">
                      <p className="font-medium text-gray-900">
                        {formatDate(selectedWeek.start)} - {formatDate(selectedWeek.end)}
                      </p>
                      <p className="text-sm text-gray-500">
                        Semaine du {new Date(selectedWeek.start).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                      </p>
                    </div>
                    <button
                      onClick={() => changeWeek('next')}
                      className="p-2 hover:bg-gray-100 rounded-lg transition border border-gray-200"
                    >
                      <ChevronRight className="w-5 h-5 text-gray-700" />
                    </button>
                  </div>

                  {currentWeekStatus.used ? (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-center">
                      <p className="text-amber-800 font-medium">
                        Semaine déjà utilisée
                      </p>
                      <p className="text-sm text-amber-600 mt-1">
                        Cette semaine est assignée à la Journée {currentWeekStatus.matchdayNumber}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 text-center">
                      Cette journée sera la <strong>Journée {matchdays.length + 1}</strong>
                    </p>
                  )}
                </div>

                <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={createMatchday}
                    disabled={creating || currentWeekStatus.used}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {creating ? 'Création...' : currentWeekStatus.used ? 'Semaine indisponible' : 'Créer la journée'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal de sélection des matchs */}
          {showMatchesModal && selectedMatchday && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-xl max-w-5xl w-full max-h-[90vh] flex flex-col">
                <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      Journée {selectedMatchday.matchday_number}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {formatDate(selectedMatchday.week_start)} → {formatDate(selectedMatchday.week_end)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      selectedMatches.length >= (competition?.matches_per_matchday || 8)
                        ? 'bg-green-100 text-green-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {selectedMatches.length}/{competition?.matches_per_matchday || 8} matchs
                    </span>
                    <button
                      onClick={() => {
                        setShowMatchesModal(false)
                        fetchMatchdays()
                      }}
                      className="p-2 hover:bg-gray-100 rounded-lg transition"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-hidden flex">
                  {/* Colonne gauche: Matchs disponibles */}
                  <div className="flex-1 border-r border-gray-200 overflow-y-auto p-4">
                    <h3 className="font-semibold text-gray-900 mb-4">Matchs disponibles</h3>

                    {loadingMatches ? (
                      <div className="text-center text-gray-500 py-8">Chargement...</div>
                    ) : Object.keys(availableMatches).length === 0 ? (
                      <div className="text-center text-gray-500 py-8">
                        Aucun match trouvé pour cette semaine
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {Object.entries(availableMatches).map(([compName, matches]) => {
                          const isExpanded = expandedCompetitions.has(compName)
                          const selectedCount = matches.filter(m => isMatchSelected(m.id)).length

                          return (
                            <div key={compName} className="border-2 border-gray-300 rounded-lg overflow-hidden shadow-sm">
                              {/* Accordion Header */}
                              <button
                                onClick={() => toggleCompetitionExpansion(compName)}
                                className="w-full px-4 py-3 bg-gradient-to-r from-purple-50 to-purple-100 hover:from-purple-100 hover:to-purple-150 flex items-center justify-between transition border-b border-gray-200"
                              >
                                <div className="flex items-center gap-3">
                                  {matches[0]?.competition_emblem && (
                                    <img src={matches[0].competition_emblem} alt="" className="w-6 h-6" />
                                  )}
                                  <span className="font-semibold text-gray-900">{compName}</span>
                                  <span className="text-sm text-gray-600 bg-white px-2 py-0.5 rounded-full border border-gray-300">
                                    {matches.length} match{matches.length > 1 ? 's' : ''}
                                  </span>
                                  {selectedCount > 0 && (
                                    <span className="px-2 py-0.5 bg-green-500 text-white text-xs rounded-full font-medium">
                                      {selectedCount} sélectionné{selectedCount > 1 ? 's' : ''}
                                    </span>
                                  )}
                                </div>
                                {isExpanded ? (
                                  <ChevronUp className="w-5 h-5 text-purple-600" />
                                ) : (
                                  <ChevronDown className="w-5 h-5 text-purple-600" />
                                )}
                              </button>

                              {/* Accordion Content */}
                              {isExpanded && (
                                <div className="p-3 space-y-2 bg-gray-50">
                                  {matches.map((match) => (
                                    <div
                                      key={match.id}
                                      className={`p-3 rounded-lg border-2 transition cursor-pointer ${
                                        isMatchSelected(match.id)
                                          ? 'bg-green-100 border-green-400 shadow-sm'
                                          : 'bg-white border-gray-300 hover:border-purple-400 hover:bg-purple-50 shadow-sm'
                                      }`}
                                      onClick={() => !isMatchSelected(match.id) && addMatch(match)}
                                    >
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 flex-1">
                                          {match.home_team_crest && (
                                            <img src={match.home_team_crest} alt="" className="w-5 h-5" />
                                          )}
                                          <span className="text-sm font-medium truncate text-gray-900">{match.home_team}</span>
                                          <span className="text-gray-500 text-sm">vs</span>
                                          <span className="text-sm font-medium truncate text-gray-900">{match.away_team}</span>
                                          {match.away_team_crest && (
                                            <img src={match.away_team_crest} alt="" className="w-5 h-5" />
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs text-gray-600">
                                            {formatDateTime(match.utc_date)}
                                          </span>
                                          {isMatchSelected(match.id) ? (
                                            <Check className="w-4 h-4 text-green-600" />
                                          ) : (
                                            <Plus className="w-4 h-4 text-purple-500" />
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Colonne droite: Matchs sélectionnés */}
                  <div className="w-80 overflow-y-auto p-4 bg-gray-100 border-l-2 border-gray-300">
                    <h3 className="font-semibold text-gray-900 mb-4">
                      Matchs sélectionnés
                      <span className="text-xs text-gray-600 font-normal ml-2">(triés par date)</span>
                    </h3>

                    {selectedMatches.length === 0 ? (
                      <div className="text-center text-gray-600 py-8 text-sm border-2 border-dashed border-gray-300 rounded-lg bg-white">
                        Cliquez sur un match pour l'ajouter
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {[...selectedMatches]
                          .sort((a, b) => new Date(a.cached_utc_date).getTime() - new Date(b.cached_utc_date).getTime())
                          .map((match, index) => (
                          <div
                            key={match.id}
                            className="p-3 bg-white rounded-lg border-2 border-green-300 shadow-sm group hover:border-green-400 transition"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-purple-700 bg-purple-100 px-2 py-0.5 rounded border border-purple-200">
                                {formatDateTime(match.cached_utc_date)}
                              </span>
                              <button
                                onClick={() => removeMatch(match.id)}
                                className="p-1 text-red-600 hover:bg-red-100 rounded opacity-0 group-hover:opacity-100 transition border border-transparent hover:border-red-300"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                            <div className="mt-2">
                              <div className="flex items-center gap-1.5 text-sm">
                                {match.cached_home_logo && (
                                  <img src={match.cached_home_logo} alt="" className="w-4 h-4" />
                                )}
                                <span className="font-medium truncate text-gray-900">{match.cached_home_team}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-sm">
                                {match.cached_away_logo && (
                                  <img src={match.cached_away_logo} alt="" className="w-4 h-4" />
                                )}
                                <span className="font-medium truncate text-gray-900">{match.cached_away_team}</span>
                              </div>
                              <p className="text-xs text-gray-600 mt-1 font-medium">
                                {match.cached_competition_name}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-4 border-t border-gray-200 flex justify-end">
                  <button
                    onClick={() => {
                      setShowMatchesModal(false)
                      fetchMatchdays()
                    }}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                  >
                    Terminé
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal de prévisualisation des matchs */}
          {showPreviewModal && previewMatchday && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col">
                <div className="p-5 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-purple-50 to-purple-100">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      Aperçu - Journée {previewMatchday.matchday_number}
                    </h2>
                    <p className="text-sm text-gray-600">
                      {formatDate(previewMatchday.week_start)} → {formatDate(previewMatchday.week_end)}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowPreviewModal(false)}
                    className="p-2 hover:bg-gray-200 rounded-lg transition"
                  >
                    <X className="w-5 h-5 text-gray-600" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                  {loadingPreview ? (
                    <div className="text-center text-gray-500 py-8">
                      Chargement des matchs...
                    </div>
                  ) : previewMatches.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                      <p>Aucun match sélectionné pour cette journée</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {previewMatches.map((match, index) => (
                        <div
                          key={match.id}
                          className="p-4 bg-white rounded-lg border-2 border-gray-200 shadow-sm hover:border-purple-300 transition"
                        >
                          {/* Date et heure */}
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-semibold text-purple-700 bg-purple-100 px-2 py-1 rounded border border-purple-200">
                              {formatDateTime(match.utc_date)}
                            </span>
                            {match.competition_emblem && (
                              <img src={match.competition_emblem} alt="" className="w-5 h-5" />
                            )}
                          </div>

                          {/* Équipes */}
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              {match.home_logo ? (
                                <img src={match.home_logo} alt="" className="w-6 h-6" />
                              ) : (
                                <div className="w-6 h-6 bg-gray-200 rounded-full"></div>
                              )}
                              <span className="font-medium text-gray-900">{match.home_team}</span>
                              {match.status === 'FINISHED' && (
                                <span className="ml-auto font-bold text-gray-900">{match.home_score}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              {match.away_logo ? (
                                <img src={match.away_logo} alt="" className="w-6 h-6" />
                              ) : (
                                <div className="w-6 h-6 bg-gray-200 rounded-full"></div>
                              )}
                              <span className="font-medium text-gray-900">{match.away_team}</span>
                              {match.status === 'FINISHED' && (
                                <span className="ml-auto font-bold text-gray-900">{match.away_score}</span>
                              )}
                            </div>
                          </div>

                          {/* Compétition */}
                          <p className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100">
                            {match.competition_name}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
                  <span className="text-sm text-gray-600">
                    {previewMatches.length} match{previewMatches.length > 1 ? 's' : ''} sélectionné{previewMatches.length > 1 ? 's' : ''}
                  </span>
                  <button
                    onClick={() => setShowPreviewModal(false)}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </AdminLayout>
  )
}
