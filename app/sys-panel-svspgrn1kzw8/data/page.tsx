'use client'

import { useState, useEffect } from 'react'
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

type TabType = 'active' | 'available'

export default function AdminDataPage() {
  const [activeTab, setActiveTab] = useState<TabType>('active')
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [availableCompetitions, setAvailableCompetitions] = useState<Competition[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingAvailable, setLoadingAvailable] = useState(false)
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
      setCompetitions(data.competitions || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Actualiser la liste complète depuis Football-Data API (pour l'onglet "Autres compétitions")
  const fetchAvailableCompetitions = async () => {
    setLoadingAvailable(true)
    setError(null)
    try {
      const response = await fetch('/api/football/competitions')
      if (!response.ok) throw new Error('Failed to fetch all competitions')
      const data = await response.json()
      // Filtrer pour ne garder que celles qui ne sont pas déjà importées
      const importedIds = new Set(competitions.map(c => c.id))
      const notImported = (data.competitions || []).filter((c: Competition) => !c.isImported)
      setAvailableCompetitions(notImported)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoadingAvailable(false)
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

      // Refresh les listes
      await fetchImportedCompetitions()
      // Retirer de la liste des disponibles
      setAvailableCompetitions(prev => prev.filter(c => c.id !== competitionId))
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

  // Charger les compétitions disponibles quand on passe à l'onglet
  useEffect(() => {
    if (activeTab === 'available' && availableCompetitions.length === 0) {
      fetchAvailableCompetitions()
    }
  }, [activeTab])

  const activeCompetitions = competitions.filter(c => c.isActive)
  const inactiveCompetitions = competitions.filter(c => !c.isActive)

  return (
    <AdminLayout currentPage="data">
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
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Gestion des Données</h1>
            <p className="text-gray-600">Gérez les compétitions Football-Data importées et disponibles</p>
          </div>

          {/* Sous-onglets */}
          <div className="flex gap-2 mb-6 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('active')}
              className={`px-6 py-3 font-medium text-sm transition-colors relative ${
                activeTab === 'active'
                  ? 'text-purple-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Compétitions activées
              {activeCompetitions.length > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">
                  {activeCompetitions.length}
                </span>
              )}
              {activeTab === 'active' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('available')}
              className={`px-6 py-3 font-medium text-sm transition-colors relative ${
                activeTab === 'available'
                  ? 'text-purple-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Autres compétitions
              {activeTab === 'available' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600" />
              )}
            </button>
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

          {/* Onglet Compétitions activées */}
          {activeTab === 'active' && (
            <div>
              {loading ? (
                <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500">
                  Chargement des compétitions...
                </div>
              ) : activeCompetitions.length === 0 && inactiveCompetitions.length === 0 ? (
                <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500">
                  <p className="mb-4">Aucune compétition importée</p>
                  <button
                    onClick={() => setActiveTab('available')}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                  >
                    Importer des compétitions
                  </button>
                </div>
              ) : (
                <>
                  {/* Compétitions actives */}
                  {activeCompetitions.length > 0 && (
                    <div className="mb-8">
                      <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                        Compétitions actives ({activeCompetitions.length})
                      </h2>
                      <div className="competitions-grid">
                        {activeCompetitions.map((comp) => (
                          <CompetitionCard
                            key={comp.id}
                            competition={comp}
                            importing={importing}
                            toggling={toggling}
                            togglingEvent={togglingEvent}
                            onImport={importCompetition}
                            onToggleActive={toggleActive}
                            onToggleEvent={toggleEvent}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Compétitions inactives (importées mais désactivées) */}
                  {inactiveCompetitions.length > 0 && (
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <span className="w-3 h-3 bg-gray-400 rounded-full"></span>
                        Compétitions désactivées ({inactiveCompetitions.length})
                      </h2>
                      <div className="competitions-grid">
                        {inactiveCompetitions.map((comp) => (
                          <CompetitionCard
                            key={comp.id}
                            competition={comp}
                            importing={importing}
                            toggling={toggling}
                            togglingEvent={togglingEvent}
                            onImport={importCompetition}
                            onToggleActive={toggleActive}
                            onToggleEvent={toggleEvent}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Onglet Autres compétitions */}
          {activeTab === 'available' && (
            <div>
              <div className="flex gap-3 mb-6">
                <button
                  onClick={fetchAvailableCompetitions}
                  disabled={loadingAvailable}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {loadingAvailable ? 'Actualisation...' : 'Actualiser depuis Football-Data'}
                </button>
              </div>

              {loadingAvailable ? (
                <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500">
                  Chargement des compétitions disponibles...
                </div>
              ) : availableCompetitions.length === 0 ? (
                <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500">
                  <p>Toutes les compétitions disponibles ont déjà été importées.</p>
                  <p className="text-sm mt-2">Cliquez sur "Actualiser depuis Football-Data" pour mettre à jour la liste.</p>
                </div>
              ) : (
                <div className="competitions-grid">
                  {availableCompetitions.map((comp) => (
                    <div key={comp.id} className="admin-competition-card">
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
                      <h3 className="text-lg font-bold text-gray-900 text-center mb-3 min-h-[3.5rem] flex items-center justify-center">
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

                      {/* Bouton d'import */}
                      <div className="w-full mt-auto">
                        <button
                          onClick={() => importCompetition(comp.id)}
                          disabled={importing === comp.id}
                          className="btn-admin-import w-full"
                        >
                          {importing === comp.id ? 'Import...' : 'Importer'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-900">
                  <strong>Note :</strong> L'import récupère toutes les informations de la compétition et
                  l'ensemble de ses matchs (passés, en cours et à venir). Les données sont mises en cache
                  localement pour éviter de consommer l'API inutilement.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </AdminLayout>
  )
}

// Composant carte de compétition (pour les compétitions importées)
function CompetitionCard({
  competition: comp,
  importing,
  toggling,
  togglingEvent,
  onImport,
  onToggleActive,
  onToggleEvent
}: {
  competition: Competition
  importing: number | null
  toggling: number | null
  togglingEvent: number | null
  onImport: (id: number) => void
  onToggleActive: (id: number, status: boolean) => void
  onToggleEvent: (id: number, status: boolean) => void
}) {
  return (
    <div className={`admin-competition-card ${comp.isActive ? 'active' : ''}`}>
      {/* Bouton d'activation (toggle switch) - Coin supérieur droit */}
      <div className="absolute top-3 right-3">
        <button
          onClick={() => onToggleActive(comp.id, comp.isActive)}
          disabled={toggling === comp.id}
          className={`admin-toggle-switch ${comp.isActive ? 'active' : 'inactive'}`}
          title={comp.isActive ? 'Activé - Cliquez pour désactiver' : 'Désactivé - Cliquez pour activer'}
        >
          <span className="admin-toggle-knob">
            {comp.isActive ? '✓' : '✗'}
          </span>
        </button>
      </div>

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
      <h3 className="text-lg font-bold text-gray-900 text-center mb-3 min-h-[3.5rem] flex items-center justify-center">
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
      {comp.lastUpdatedAt && (
        <div className="text-xs text-gray-500 mb-3 text-center">
          MAJ: le {new Date(comp.lastUpdatedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })} à {new Date(comp.lastUpdatedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </div>
      )}

      {/* Toggle Événement */}
      <div className="mb-3 flex items-center justify-center gap-2">
        <button
          onClick={() => onToggleEvent(comp.id, comp.isEvent)}
          disabled={togglingEvent === comp.id}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            comp.isEvent
              ? 'bg-purple-600 text-white border border-purple-700 hover:bg-purple-700'
              : 'bg-amber-500 text-white border border-amber-600 hover:bg-amber-600'
          }`}
          title={comp.isEvent ? 'Compétition événementielle - Cliquez pour désactiver' : 'Cliquez pour marquer comme événement'}
        >
          {togglingEvent === comp.id ? '...' : comp.isEvent ? 'Événement' : 'Définir comme événement'}
        </button>
      </div>

      {/* Boutons d'action */}
      <div className="w-full mt-auto flex gap-3">
        <button
          onClick={() => window.open(`/${process.env.NEXT_PUBLIC_ADMIN_PANEL_PATH || 'sys-panel-svspgrn1kzw8'}/data/view/${comp.id}`, '_blank')}
          className="btn-admin-view"
        >
          Visualiser
        </button>
        <button
          onClick={() => onImport(comp.id)}
          disabled={importing === comp.id}
          className="btn-admin-refresh"
        >
          {importing === comp.id ? 'Import...' : 'Actualiser'}
        </button>
      </div>
    </div>
  )
}
