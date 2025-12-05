'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AdminLayout from '@/components/AdminLayout'

interface Competition {
  id: number
  name: string
  code: string
  emblem: string | null
  area: string
  currentSeason: {
    startDate: string
    endDate: string
    currentMatchday: number
    totalMatchdays?: number
  }
  isImported: boolean
  isActive: boolean
  isEvent: boolean
  importedAt?: string
  lastUpdatedAt?: string
}

export default function AdminImportPage() {
  const router = useRouter()
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [importing, setImporting] = useState<number | null>(null)
  const [toggling, setToggling] = useState<number | null>(null)
  const [togglingEvent, setTogglingEvent] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Charger uniquement les compétitions déjà importées (depuis la base locale)
  const fetchImportedCompetitions = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/football/imported-competitions')
      if (!response.ok) throw new Error('Failed to fetch imported competitions')
      const data = await response.json()
      setCompetitions(data.competitions)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Actualiser la liste complète depuis Football-Data API
  const refreshAllCompetitions = async () => {
    setRefreshing(true)
    setError(null)
    try {
      const response = await fetch('/api/football/competitions')
      if (!response.ok) throw new Error('Failed to fetch all competitions')
      const data = await response.json()
      setCompetitions(data.competitions)
      setSuccess('Liste des compétitions actualisée depuis Football-Data')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setRefreshing(false)
    }
  }

  const importCompetition = async (competitionId: number) => {
    setImporting(competitionId)
    setError(null)
    setSuccess(null)
    try {
      const response = await fetch('/api/football/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competitionId }),
      })

      if (!response.ok) throw new Error('Failed to import competition')

      const data = await response.json()
      setSuccess(`${data.competition} importée avec succès (${data.matchesCount} matchs)`)

      // Refresh la liste des compétitions importées
      await fetchImportedCompetitions()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setImporting(null)
    }
  }

  const toggleActive = async (competitionId: number, currentStatus: boolean) => {
    setToggling(competitionId)
    setError(null)
    setSuccess(null)
    try {
      const response = await fetch('/api/football/toggle-active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          competitionId,
          isActive: !currentStatus
        }),
      })

      if (!response.ok) throw new Error('Failed to toggle competition status')

      const data = await response.json()
      setSuccess(data.message)

      // Refresh la liste des compétitions importées
      await fetchImportedCompetitions()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setToggling(null)
    }
  }

  const toggleEvent = async (competitionId: number, currentStatus: boolean) => {
    setTogglingEvent(competitionId)
    setError(null)
    setSuccess(null)
    try {
      const response = await fetch('/api/football/toggle-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          competitionId,
          isEvent: !currentStatus
        }),
      })

      if (!response.ok) throw new Error('Failed to toggle event status')

      const data = await response.json()
      setSuccess(data.message)

      // Refresh la liste des compétitions importées
      await fetchImportedCompetitions()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setTogglingEvent(null)
    }
  }

  useEffect(() => {
    fetchImportedCompetitions()
  }, [])

  return (
    <AdminLayout currentPage="import">
      <div className="min-h-screen bg-gray-50">
        <style jsx>{`
          .competitions-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 2rem;
          }
        `}</style>

        <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Import de données Football</h1>

          <div className="flex gap-3">
            <button
              onClick={refreshAllCompetitions}
              disabled={refreshing || loading}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {refreshing ? 'Actualisation...' : 'Actualiser la liste des compétitions'}
            </button>
            <button
              onClick={fetchImportedCompetitions}
              disabled={loading || refreshing}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Chargement...' : 'Afficher mes compétitions'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
            <strong>Erreur :</strong> {error}
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
            <strong>Succès :</strong> {success}
          </div>
        )}

        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Compétitions disponibles ({competitions.length})
          </h2>

          {loading && competitions.length === 0 ? (
            <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500">
              Chargement des compétitions...
            </div>
          ) : competitions.length === 0 ? (
            <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500">
              Aucune compétition disponible
            </div>
          ) : (
            <div className="competitions-grid">
              {competitions
                .sort((a, b) => {
                  // Trier: actives d'abord, puis importées, puis par nom
                  if (a.isActive && !b.isActive) return -1
                  if (!a.isActive && b.isActive) return 1
                  if (a.isImported && !b.isImported) return -1
                  if (!a.isImported && b.isImported) return 1
                  return a.name.localeCompare(b.name)
                })
                .map((comp) => (
                <div key={comp.id} className={`admin-competition-card ${comp.isImported && comp.isActive ? 'active' : ''}`}>

                  {/* Bouton d'activation (toggle switch) - Coin supérieur droit */}
                  {comp.isImported && (
                    <div className="absolute top-3 right-3">
                      <button
                        onClick={() => toggleActive(comp.id, comp.isActive)}
                        disabled={toggling === comp.id}
                        className={`admin-toggle-switch ${comp.isActive ? 'active' : 'inactive'}`}
                        title={comp.isActive ? 'Activé - Cliquez pour désactiver' : 'Désactivé - Cliquez pour activer'}
                      >
                        <span className="admin-toggle-knob">
                          {comp.isActive ? '✓' : '✗'}
                        </span>
                      </button>
                    </div>
                  )}

                  {/* Logo */}
                  <div className="w-[150px] h-[150px] flex items-center justify-center mb-4">
                    {comp.emblem ? (
                      <img
                        src={comp.emblem}
                        alt={comp.name}
                        className="max-w-full max-h-full object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    ) : (
                      <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center text-gray-400 text-sm">
                        N/A
                      </div>
                    )}
                  </div>

                  {/* Nom */}
                  <h3 className="text-lg font-bold text-gray-900 text-center mb-3 min-h-[3.5rem] flex items-center">
                    {comp.name}
                  </h3>

                  {/* ID, Code, Zone */}
                  <div className="text-xs text-gray-600 text-center mb-2 space-y-1">
                    <div>ID: {comp.id} | Code: {comp.code}</div>
                    <div>Zone: {comp.area}</div>
                  </div>

                  {/* Saison */}
                  {comp.currentSeason && (
                    <div className="text-xs text-gray-500 text-center mb-2">
                      Saison: {comp.currentSeason.startDate} → {comp.currentSeason.endDate}
                    </div>
                  )}

                  {/* Journée actuelle */}
                  {comp.currentSeason && (
                    <div className="text-sm font-medium text-gray-700 mb-3">
                      Journée actuelle: {comp.currentSeason.currentMatchday}
                      {comp.currentSeason.totalMatchdays && `/${comp.currentSeason.totalMatchdays}`}
                    </div>
                  )}

                  {/* Date dernière MAJ */}
                  {comp.isImported && comp.lastUpdatedAt && (
                    <div className="text-xs text-gray-500 mb-3 text-center">
                      MAJ: le {new Date(comp.lastUpdatedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })} à {new Date(comp.lastUpdatedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}

                  {/* Toggle Événement */}
                  {comp.isImported && (
                    <div className="mb-3 flex items-center justify-center gap-2">
                      <button
                        onClick={() => toggleEvent(comp.id, comp.isEvent)}
                        disabled={togglingEvent === comp.id}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                          comp.isEvent
                            ? 'bg-purple-600 text-white border border-purple-700 hover:bg-purple-700'
                            : 'bg-amber-500 text-white border border-amber-600 hover:bg-amber-600'
                        }`}
                        title={comp.isEvent ? 'Compétition événementielle - Cliquez pour désactiver' : 'Cliquez pour marquer comme événement'}
                      >
                        {togglingEvent === comp.id ? '...' : comp.isEvent ? '🏆 Événement' : 'Définir comme événement'}
                      </button>
                    </div>
                  )}

                  {/* Boutons d'action */}
                  <div className={`w-full mt-auto flex gap-3 ${comp.isImported ? 'flex-row' : 'flex-col'}`}>
                    {comp.isImported && (
                      <button
                        onClick={() => window.open(`/admin/import/view/${comp.id}`, '_blank')}
                        className="btn-admin-view"
                      >
                        Visualiser
                      </button>
                    )}
                    <button
                      onClick={() => importCompetition(comp.id)}
                      disabled={importing === comp.id}
                      className={comp.isImported ? 'btn-admin-refresh' : 'btn-admin-import'}
                    >
                      {importing === comp.id
                        ? 'Import...'
                        : comp.isImported
                        ? 'Actualiser'
                        : 'Importer'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-900">
            <strong>Note :</strong> L'import récupère toutes les informations de la compétition et
            l'ensemble de ses matchs (passés, en cours et à venir). Les données sont mises en cache
            localement pour éviter de consommer l'API inutilement.
          </p>
        </div>
      </main>
      </div>
    </AdminLayout>
  )
}
