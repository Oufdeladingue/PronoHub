'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AdminNav from '@/components/AdminNav'

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
  }
  isImported: boolean
  isActive: boolean
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

  useEffect(() => {
    fetchImportedCompetitions()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <style jsx>{`
        .competitions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 2rem;
        }
      `}</style>
      <AdminNav />

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
                <div key={comp.id} style={{
                  position: 'relative',
                  backgroundColor: 'white',
                  borderRadius: '1rem',
                  border: comp.isImported && comp.isActive ? '2px solid #22c55e' : '2px solid #e5e7eb',
                  boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  transition: 'border-color 0.3s, box-shadow 0.2s'
                }} onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 10px 15px -3px rgb(0 0 0 / 0.1)'} onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 1px 3px 0 rgb(0 0 0 / 0.1)'}>

                  {/* Bouton d'activation (toggle switch) - Coin supérieur droit */}
                  {comp.isImported && (
                    <div style={{ position: 'absolute', top: '12px', right: '12px' }}>
                      <button
                        onClick={() => toggleActive(comp.id, comp.isActive)}
                        disabled={toggling === comp.id}
                        style={{
                          position: 'relative',
                          display: 'inline-flex',
                          height: '32px',
                          width: '64px',
                          alignItems: 'center',
                          borderRadius: '9999px',
                          border: 'none',
                          cursor: toggling === comp.id ? 'not-allowed' : 'pointer',
                          backgroundColor: comp.isActive ? '#22c55e' : '#ef4444',
                          transition: 'background-color 0.3s',
                          opacity: toggling === comp.id ? 0.5 : 1,
                          padding: '4px'
                        }}
                        title={comp.isActive ? 'Activé - Cliquez pour désactiver' : 'Désactivé - Cliquez pour activer'}
                      >
                        <span style={{
                          display: 'flex',
                          height: '24px',
                          width: '24px',
                          borderRadius: '9999px',
                          backgroundColor: 'white',
                          transform: comp.isActive ? 'translateX(32px)' : 'translateX(0)',
                          transition: 'transform 0.3s',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '14px',
                          fontWeight: 'bold',
                          color: comp.isActive ? '#22c55e' : '#ef4444'
                        }}>
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
                    </div>
                  )}

                  {/* Date dernière MAJ */}
                  {comp.isImported && comp.lastUpdatedAt && (
                    <div className="text-xs text-gray-500 mb-3 text-center">
                      MAJ: le {new Date(comp.lastUpdatedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })} à {new Date(comp.lastUpdatedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}

                  {/* Boutons d'action */}
                  <div className="w-full mt-auto" style={{ display: 'flex', flexDirection: comp.isImported ? 'row' : 'column', gap: '0.75rem' }}>
                    {comp.isImported && (
                      <button
                        onClick={() => window.open(`/admin/import/view/${comp.id}`, '_blank')}
                        style={{
                          flex: 1,
                          padding: '12px 16px',
                          border: 'none',
                          borderRadius: '8px',
                          fontWeight: '500',
                          fontSize: '14px',
                          cursor: 'pointer',
                          backgroundColor: '#3b82f6',
                          color: 'white',
                          boxShadow: '0 0 0 0 rgba(59, 130, 246, 0.4)',
                          transition: 'all 0.3s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-2px)'
                          e.currentTarget.style.boxShadow = '0 8px 16px rgba(59, 130, 246, 0.3)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)'
                          e.currentTarget.style.boxShadow = '0 0 0 0 rgba(59, 130, 246, 0.4)'
                        }}
                      >
                        Visualiser
                      </button>
                    )}
                    <button
                      onClick={() => importCompetition(comp.id)}
                      disabled={importing === comp.id}
                      style={{
                        flex: 1,
                        padding: '12px 16px',
                        border: 'none',
                        borderRadius: '8px',
                        fontWeight: '500',
                        fontSize: '14px',
                        cursor: importing === comp.id ? 'not-allowed' : 'pointer',
                        backgroundColor: comp.isImported ? '#fef3c7' : '#9333ea',
                        color: comp.isImported ? '#92400e' : 'white',
                        boxShadow: comp.isImported
                          ? '0 0 0 0 rgba(251, 191, 36, 0.4)'
                          : '0 0 0 0 rgba(147, 51, 234, 0.4)',
                        transition: 'all 0.3s ease',
                        opacity: importing === comp.id ? 0.6 : 1,
                      }}
                      onMouseEnter={(e) => {
                        if (importing !== comp.id) {
                          e.currentTarget.style.transform = 'translateY(-2px)'
                          e.currentTarget.style.boxShadow = comp.isImported
                            ? '0 8px 16px rgba(251, 191, 36, 0.3)'
                            : '0 8px 16px rgba(147, 51, 234, 0.3)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)'
                        e.currentTarget.style.boxShadow = comp.isImported
                          ? '0 0 0 0 rgba(251, 191, 36, 0.4)'
                          : '0 0 0 0 rgba(147, 51, 234, 0.4)'
                      }}
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
  )
}
