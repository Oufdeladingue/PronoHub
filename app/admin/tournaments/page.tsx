'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AdminLayout from '@/components/AdminLayout'

interface Tournament {
  id: string
  name: string
  slug: string
  status: string
  competition_name: string
  competition_id: number
  created_at: string
  creator_username: string
  participants_count: number
  predictions_count: number
}

export default function AdminTournamentsPage() {
  const router = useRouter()
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const fetchTournaments = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/tournaments')
      if (!response.ok) throw new Error('Failed to fetch tournaments')
      const data = await response.json()
      setTournaments(data.tournaments)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (tournamentId: string, tournamentName: string) => {
    setDeleting(tournamentId)
    setError(null)
    setSuccess(null)
    try {
      const response = await fetch('/api/admin/tournaments/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete tournament')
      }

      const data = await response.json()
      setSuccess(`Tournoi "${tournamentName}" supprimé avec succès`)
      setConfirmDelete(null)

      // Supprimer le tournoi de la liste locale immédiatement
      setTournaments(prev => prev.filter(t => t.id !== tournamentId))
    } catch (err: any) {
      setError(err.message)
      setConfirmDelete(null)
    } finally {
      setDeleting(null)
    }
  }

  useEffect(() => {
    fetchTournaments()
  }, [])

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
      pending: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'En attente' },
      warmup: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: "À l'échauffement" },
      active: { bg: 'bg-green-100', text: 'text-green-800', label: 'En cours' },
      finished: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Terminé' },
    }

    const config = statusConfig[status] || statusConfig.pending
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    )
  }

  return (
    <AdminLayout currentPage="general">
      <div className="min-h-screen bg-gray-50">
        <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Gestion des Tournois</h1>
            <p className="text-gray-600">Liste complète des tournois pour tests et administration</p>
          </div>
          <button
            onClick={() => router.push('/admin')}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
          >
            Retour
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

        {loading ? (
          <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500">
            Chargement des tournois...
          </div>
        ) : tournaments.length === 0 ? (
          <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500">
            Aucun tournoi trouvé
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tournoi
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Compétition
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Créateur
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Participants
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pronos
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Créé le
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tournaments.map((tournament) => (
                  <tr key={tournament.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{tournament.name}</div>
                      <div className="text-xs text-gray-500">{tournament.slug}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{tournament.competition_name}</div>
                      <div className="text-xs text-gray-500">ID: {tournament.competition_id}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(tournament.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {tournament.creator_username}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                      {tournament.participants_count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                      {tournament.predictions_count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(tournament.created_at).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: '2-digit',
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {confirmDelete === tournament.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleDelete(tournament.id, tournament.name)}
                            disabled={deleting === tournament.id}
                            className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                          >
                            {deleting === tournament.id ? 'Suppression...' : 'Confirmer'}
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            disabled={deleting === tournament.id}
                            className="px-3 py-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition disabled:cursor-not-allowed"
                          >
                            Annuler
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(tournament.id)}
                          className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition"
                        >
                          Supprimer
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-900">
            <strong>Attention :</strong> La suppression d'un tournoi est irréversible et supprimera également :
          </p>
          <ul className="text-sm text-yellow-800 mt-2 ml-4 list-disc">
            <li>Tous les participants du tournoi</li>
            <li>Tous les pronostics associés</li>
            <li>Toutes les données liées au tournoi</li>
          </ul>
        </div>
      </main>
      </div>
    </AdminLayout>
  )
}
