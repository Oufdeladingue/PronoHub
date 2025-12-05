'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import AdminLayout from '@/components/AdminLayout'

interface Tournament {
  id: string
  name: string
  slug: string
  status: string
  tournament_type: string
  competition_name: string
  competition_id: number
  created_at: string
  creator_username: string
  participants_count: number
  total_revenue: number
  end_date: string | null
}

interface CreditInfo {
  creator: {
    id: string
    user_id: string
    purchase_type: string
    tournament_subtype: string
    amount: number
  } | null
  participants: Array<{
    id: string
    user_id: string
    purchase_type: string
    amount: number
  }>
  eventSlots: Array<{
    id: string
    user_id: string
    amount_paid: number
  }>
}

interface DeleteModalState {
  tournament: Tournament | null
  credits: CreditInfo | null
  canRefund: boolean
  loading: boolean
  refundCredits: boolean
}

export default function AdminTournamentsPage() {
  const router = useRouter()
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [deleteModal, setDeleteModal] = useState<DeleteModalState>({
    tournament: null,
    credits: null,
    canRefund: false,
    loading: false,
    refundCredits: true // Par défaut, on propose le remboursement
  })

  // États pour tri, filtrage et pagination
  const [sortColumn, setSortColumn] = useState<keyof Tournament | ''>('')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [filterText, setFilterText] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

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

  // Ouvrir la modal de suppression avec les infos de crédit
  const openDeleteModal = async (tournament: Tournament) => {
    setDeleteModal({
      tournament,
      credits: null,
      canRefund: false,
      loading: true,
      refundCredits: true
    })

    try {
      const response = await fetch(`/api/admin/tournaments/delete?tournamentId=${tournament.id}`)
      if (response.ok) {
        const data = await response.json()
        setDeleteModal(prev => ({
          ...prev,
          credits: data.credits,
          canRefund: data.canRefund,
          loading: false
        }))
      } else {
        setDeleteModal(prev => ({ ...prev, loading: false }))
      }
    } catch {
      setDeleteModal(prev => ({ ...prev, loading: false }))
    }
  }

  const closeDeleteModal = () => {
    setDeleteModal({
      tournament: null,
      credits: null,
      canRefund: false,
      loading: false,
      refundCredits: true
    })
  }

  const handleDelete = async () => {
    if (!deleteModal.tournament) return

    const { tournament, refundCredits } = deleteModal
    setDeleting(tournament.id)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/admin/tournaments/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId: tournament.id, refundCredits }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete tournament')
      }

      const data = await response.json()
      setSuccess(data.message)
      closeDeleteModal()

      // Supprimer le tournoi de la liste locale immédiatement
      setTournaments(prev => prev.filter(t => t.id !== tournament.id))
    } catch (err: any) {
      setError(err.message)
      closeDeleteModal()
    } finally {
      setDeleting(null)
    }
  }

  useEffect(() => {
    fetchTournaments()
  }, [])

  // Filtrage et tri des tournois
  const filteredAndSortedTournaments = useMemo(() => {
    let result = [...tournaments]

    // Filtrage par texte (nom, slug, créateur, compétition)
    if (filterText) {
      const searchLower = filterText.toLowerCase()
      result = result.filter(t =>
        t.name.toLowerCase().includes(searchLower) ||
        t.slug.toLowerCase().includes(searchLower) ||
        t.creator_username.toLowerCase().includes(searchLower) ||
        t.competition_name.toLowerCase().includes(searchLower)
      )
    }

    // Filtrage par type
    if (filterType !== 'all') {
      result = result.filter(t => t.tournament_type === filterType)
    }

    // Filtrage par statut
    if (filterStatus !== 'all') {
      result = result.filter(t => t.status === filterStatus)
    }

    // Tri
    if (sortColumn) {
      result.sort((a, b) => {
        let aVal = a[sortColumn]
        let bVal = b[sortColumn]

        // Gérer les valeurs null/undefined
        if (aVal === null || aVal === undefined) aVal = ''
        if (bVal === null || bVal === undefined) bVal = ''

        // Tri numérique pour participants_count et total_revenue
        if (sortColumn === 'participants_count' || sortColumn === 'total_revenue') {
          return sortDirection === 'asc'
            ? (aVal as number) - (bVal as number)
            : (bVal as number) - (aVal as number)
        }

        // Tri par date
        if (sortColumn === 'created_at' || sortColumn === 'end_date') {
          const aTime = aVal ? new Date(aVal as string).getTime() : 0
          const bTime = bVal ? new Date(bVal as string).getTime() : 0
          return sortDirection === 'asc' ? aTime - bTime : bTime - aTime
        }

        // Tri alphabétique par défaut
        const aStr = String(aVal).toLowerCase()
        const bStr = String(bVal).toLowerCase()
        if (sortDirection === 'asc') {
          return aStr.localeCompare(bStr)
        }
        return bStr.localeCompare(aStr)
      })
    }

    return result
  }, [tournaments, filterText, filterType, filterStatus, sortColumn, sortDirection])

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedTournaments.length / itemsPerPage)
  const paginatedTournaments = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredAndSortedTournaments.slice(start, start + itemsPerPage)
  }, [filteredAndSortedTournaments, currentPage])

  // Réinitialiser la page quand les filtres changent
  useEffect(() => {
    setCurrentPage(1)
  }, [filterText, filterType, filterStatus])

  // Fonction de tri
  const handleSort = (column: keyof Tournament) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  // Indicateur de tri
  const SortIndicator = ({ column }: { column: keyof Tournament }) => {
    if (sortColumn !== column) return <span className="ml-1 text-gray-400">↕</span>
    return <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
  }

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

  const getTournamentTypeBadge = (type: string) => {
    const typeConfig: Record<string, { bg: string; text: string; label: string }> = {
      free: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Free' },
      premium: { bg: 'bg-green-100', text: 'text-green-800', label: 'Premium' },
      oneshot: { bg: 'bg-green-100', text: 'text-green-800', label: 'One-Shot' },
      elite: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Elite' },
      platinium: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Platinium' },
      enterprise: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Entreprise' },
    }

    const config = typeConfig[type] || typeConfig.free
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

        {/* Barre de filtres */}
        <div className="mb-4 bg-white p-4 rounded-lg shadow border border-gray-200">
          <div className="flex flex-wrap gap-4 items-end">
            {/* Recherche textuelle */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">Rechercher</label>
              <input
                type="text"
                placeholder="Nom, slug, créateur, compétition..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
              />
            </div>

            {/* Filtre par type */}
            <div className="w-40">
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500 text-gray-900 bg-white"
              >
                <option value="all">Tous</option>
                <option value="free">Free</option>
                <option value="premium">Premium</option>
                <option value="oneshot">One-Shot</option>
                <option value="elite">Elite</option>
                <option value="platinium">Platinium</option>
                <option value="enterprise">Entreprise</option>
              </select>
            </div>

            {/* Filtre par statut */}
            <div className="w-40">
              <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500 text-gray-900 bg-white"
              >
                <option value="all">Tous</option>
                <option value="pending">En attente</option>
                <option value="warmup">À l&apos;échauffement</option>
                <option value="active">En cours</option>
                <option value="finished">Terminé</option>
              </select>
            </div>

            {/* Bouton réinitialiser */}
            {(filterText || filterType !== 'all' || filterStatus !== 'all') && (
              <button
                onClick={() => {
                  setFilterText('')
                  setFilterType('all')
                  setFilterStatus('all')
                }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Réinitialiser
              </button>
            )}
          </div>

          {/* Résumé des résultats */}
          <div className="mt-3 text-sm text-gray-600">
            {filteredAndSortedTournaments.length} tournoi{filteredAndSortedTournaments.length > 1 ? 's' : ''} trouvé{filteredAndSortedTournaments.length > 1 ? 's' : ''}
            {filterText || filterType !== 'all' || filterStatus !== 'all' ? ' (filtré)' : ''}
          </div>
        </div>

        {loading ? (
          <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500">
            Chargement des tournois...
          </div>
        ) : filteredAndSortedTournaments.length === 0 ? (
          <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500">
            {tournaments.length === 0 ? 'Aucun tournoi trouvé' : 'Aucun résultat pour ces filtres'}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
            <table className="min-w-full border-collapse">
              <thead className="bg-gray-700 text-white">
                <tr>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-600 select-none"
                    onClick={() => handleSort('name')}
                  >
                    Tournoi <SortIndicator column="name" />
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-600 select-none"
                    onClick={() => handleSort('tournament_type')}
                  >
                    Type <SortIndicator column="tournament_type" />
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-600 select-none"
                    onClick={() => handleSort('competition_name')}
                  >
                    Compétition <SortIndicator column="competition_name" />
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-600 select-none"
                    onClick={() => handleSort('status')}
                  >
                    Statut <SortIndicator column="status" />
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-600 select-none"
                    onClick={() => handleSort('creator_username')}
                  >
                    Créateur <SortIndicator column="creator_username" />
                  </th>
                  <th
                    className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-600 select-none"
                    onClick={() => handleSort('participants_count')}
                  >
                    Joueurs <SortIndicator column="participants_count" />
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-600 select-none"
                    onClick={() => handleSort('created_at')}
                  >
                    Créé le <SortIndicator column="created_at" />
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-600 select-none"
                    onClick={() => handleSort('end_date')}
                  >
                    Fin prévue <SortIndicator column="end_date" />
                  </th>
                  <th
                    className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-600 select-none"
                    onClick={() => handleSort('total_revenue')}
                  >
                    Gain <SortIndicator column="total_revenue" />
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-300">
                {paginatedTournaments.map((tournament, index) => (
                  <tr
                    key={tournament.id}
                    className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-purple-50 transition-colors`}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{tournament.name}</div>
                      <div className="text-xs text-gray-400 font-mono">{tournament.slug}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {getTournamentTypeBadge(tournament.tournament_type)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-900 max-w-[200px] truncate" title={tournament.competition_name}>
                        {tournament.competition_name}
                      </div>
                      <div className="text-xs text-gray-400 font-mono" title={String(tournament.competition_id)}>
                        ID: {String(tournament.competition_id).length > 8
                          ? `${String(tournament.competition_id).substring(0, 8)}...`
                          : tournament.competition_id}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {getStatusBadge(tournament.status)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-700">{tournament.creator_username}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 text-purple-700 text-sm font-semibold">
                        {tournament.participants_count}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                      {new Date(tournament.created_at).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                      {tournament.end_date
                        ? new Date(tournament.end_date).toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: '2-digit',
                          })
                        : <span className="text-gray-400">-</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      {tournament.total_revenue >= 100 ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                          {(tournament.total_revenue / 100).toFixed(2).replace('.', ',')}€
                        </span>
                      ) : tournament.total_revenue > 0 ? (
                        <span className="text-gray-400 text-sm" title="Données de test">
                          ({(tournament.total_revenue / 100).toFixed(2).replace('.', ',')}€)
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">0€</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <button
                        onClick={() => openDeleteModal(tournament)}
                        className="px-3 py-1.5 bg-red-500 text-white text-sm font-medium rounded-md hover:bg-red-600 transition shadow-sm"
                      >
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Page {currentPage} sur {totalPages} ({filteredAndSortedTournaments.length} résultat{filteredAndSortedTournaments.length > 1 ? 's' : ''})
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ««
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ‹ Précédent
                  </button>

                  {/* Numéros de page */}
                  <div className="flex gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(page => {
                        // Afficher seulement les pages proches de la page courante
                        const diff = Math.abs(page - currentPage)
                        return diff <= 2 || page === 1 || page === totalPages
                      })
                      .map((page, idx, arr) => {
                        // Ajouter des ellipses si nécessaire
                        const showEllipsisBefore = idx > 0 && page - arr[idx - 1] > 1
                        return (
                          <span key={page} className="flex items-center">
                            {showEllipsisBefore && <span className="px-2 text-gray-400">...</span>}
                            <button
                              onClick={() => setCurrentPage(page)}
                              className={`px-3 py-1 text-sm border rounded ${
                                currentPage === page
                                  ? 'bg-purple-600 text-white border-purple-600'
                                  : 'border-gray-300 hover:bg-gray-100'
                              }`}
                            >
                              {page}
                            </button>
                          </span>
                        )
                      })}
                  </div>

                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Suivant ›
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    »»
                  </button>
                </div>
              </div>
            )}
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

        {/* Modal de suppression */}
        {deleteModal.tournament && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Supprimer le tournoi
                </h3>

                <p className="text-gray-600 mb-4">
                  Êtes-vous sûr de vouloir supprimer le tournoi <strong>&quot;{deleteModal.tournament.name}&quot;</strong> ?
                </p>

                {deleteModal.loading ? (
                  <div className="text-center py-4 text-gray-500">
                    Chargement des informations de crédit...
                  </div>
                ) : deleteModal.canRefund ? (
                  <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2">Crédits liés à ce tournoi</h4>

                    {deleteModal.credits?.creator && (
                      <div className="text-sm text-blue-800 mb-1">
                        • Crédit créateur ({deleteModal.credits.creator.tournament_subtype}): {(deleteModal.credits.creator.amount / 100).toFixed(2).replace('.', ',')}€
                      </div>
                    )}

                    {deleteModal.credits?.participants && deleteModal.credits.participants.length > 0 && (
                      <div className="text-sm text-blue-800 mb-1">
                        • {deleteModal.credits.participants.length} crédit(s) participant(s) à restaurer
                      </div>
                    )}

                    {deleteModal.credits?.eventSlots && deleteModal.credits.eventSlots.length > 0 && (
                      <div className="text-sm text-blue-800 mb-1">
                        • {deleteModal.credits.eventSlots.length} slot(s) événement à restaurer
                      </div>
                    )}

                    <div className="mt-3 flex items-center">
                      <input
                        type="checkbox"
                        id="refundCredits"
                        checked={deleteModal.refundCredits}
                        onChange={(e) => setDeleteModal(prev => ({ ...prev, refundCredits: e.target.checked }))}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="refundCredits" className="ml-2 text-sm text-blue-900 font-medium">
                        Restaurer les crédits des utilisateurs
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
                    Aucun crédit payant associé à ce tournoi.
                  </div>
                )}

                <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
                  <p className="text-sm text-red-800">
                    <strong>⚠️ Action irréversible</strong> - Cette action supprimera définitivement le tournoi, ses participants et tous les pronostics.
                  </p>
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={closeDeleteModal}
                    disabled={deleting !== null}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition disabled:opacity-50"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting !== null}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                  >
                    {deleting ? 'Suppression...' : 'Supprimer'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
      </div>
    </AdminLayout>
  )
}
