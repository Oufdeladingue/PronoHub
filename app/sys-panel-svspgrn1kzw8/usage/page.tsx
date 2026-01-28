'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import AdminLayout from '@/components/AdminLayout'
import { getAvatarUrl } from '@/lib/avatars'

// ============= INTERFACES =============

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

interface TournamentDetail {
  id: string
  name: string
  slug: string
  status: string
  tournament_type: string
  created_at: string
  creator_username: string
  starting_matchday: number | null
  ending_matchday: number | null
  planned_matchdays: number | null
  actual_matchdays: number | null
  scoring_exact_score: number
  scoring_correct_winner: number
  scoring_draw_with_default_prediction: number
  teams_enabled: boolean
  bonus_match_enabled: boolean
  early_prediction_bonus: boolean
  all_matchdays: boolean
  max_participants: number | null
  invite_code: string
  competition: {
    name: string
    code: string
    emblem: string | null
    is_custom: boolean
  } | null
  participants: Array<{
    user_id: string
    username: string
    avatar: string
    total_points: number
    rank: number | null
    predictions_count: number
    joined_at: string
    has_stats_access?: boolean
    stats_access_type?: 'lifetime' | 'tournament' | null
  }>
  total_predictions: number
}

interface DetailModalState {
  tournament: Tournament | null
  detail: TournamentDetail | null
  loading: boolean
}

interface UserStats {
  userId: string
  username: string
  avatar: string
  freeKick: { total: number; paidSlot: number }
  oneShot: { total: number; paid: number }
  elite: { total: number; paid: number }
  platinium: { total: number; paid: number }
  corpo: { total: number; paid: number }
  availableSlots: number
  platiniumCredits: number
  platiniumPrepaid11Credits: number
  durationExtensionCredits: number
}

interface Toast {
  id: number
  type: 'success' | 'error'
  message: string
  creditType?: string
  username?: string
}

type TabType = 'tournaments' | 'credits'

// ============= COMPOSANTS AUXILIAIRES =============

// Toast notification component
function ToastNotification({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-xl shadow-2xl border backdrop-blur-sm animate-slide-in ${
        toast.type === 'success'
          ? 'bg-green-900/90 border-green-700 text-green-100'
          : 'bg-red-900/90 border-red-700 text-red-100'
      }`}
      style={{ minWidth: '320px' }}
    >
      {toast.type === 'success' ? (
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
          <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      ) : (
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
          <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
      )}
      <div className="flex-1">
        <p className="font-semibold text-sm">
          {toast.type === 'success' ? 'Crédit ajouté !' : 'Erreur'}
        </p>
        <p className="text-sm opacity-90 mt-0.5">
          {toast.type === 'success' && toast.creditType && toast.username ? (
            <>
              <span className="font-medium">{toast.creditType}</span> ajouté à <span className="font-medium">{toast.username}</span>
            </>
          ) : (
            toast.message
          )}
        </p>
      </div>
      <button
        onClick={onClose}
        className="flex-shrink-0 p-1 rounded-lg hover:bg-white/10 transition-colors"
      >
        <svg className="w-4 h-4 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

// Labels pour les types de crédit
const creditTypeLabels: Record<string, string> = {
  slot_invite: 'Slot Free-Kick',
  oneshot_creation: 'Crédit One-Shot',
  elite_creation: 'Crédit Elite',
  platinium_participation: 'Crédit Platinium',
  platinium_prepaid_11: 'Platinium Prepaid 11j',
  duration_extension: 'Extension Durée',
  stats_access_tournament: 'Stats Tournoi',
  stats_access_lifetime: 'Stats à Vie',
}

// Composant Dropdown pour ajouter des credits
function CreditDropdown({
  userId,
  username,
  onAddCredit,
  onSelectStatsTournament,
  isLoading
}: {
  userId: string
  username: string
  onAddCredit: (userId: string, type: string, username: string) => void
  onSelectStatsTournament: (userId: string, username: string) => void
  isLoading: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null)

  const creditTypes = [
    { key: 'slot_invite', label: 'Slot Free-Kick', price: '0.99€', color: 'bg-blue-500', textColor: 'text-blue-400' },
    { key: 'oneshot_creation', label: 'Crédit One-Shot', price: '4.99€', color: 'bg-green-500', textColor: 'text-green-400' },
    { key: 'elite_creation', label: 'Crédit Elite', price: '9.99€', color: 'bg-orange-500', textColor: 'text-orange-400' },
    { key: 'platinium_participation', label: 'Crédit Platinium', price: '6.99€', color: 'bg-yellow-500', textColor: 'text-yellow-400' },
    { key: 'platinium_prepaid_11', label: 'Platinium Prepaid 11j', price: '69.20€', color: 'bg-purple-500', textColor: 'text-purple-400' },
    { key: 'duration_extension', label: 'Extension Durée', price: '3.99€', color: 'bg-teal-500', textColor: 'text-teal-400' },
    { key: 'stats_access_tournament', label: 'Stats Tournoi', price: '1.99€', color: 'bg-pink-500', textColor: 'text-pink-400', needsTournament: true },
    { key: 'stats_access_lifetime', label: 'Stats à Vie', price: '5.99€', color: 'bg-rose-500', textColor: 'text-rose-400' },
  ]

  const handleOpenDropdown = (e: React.MouseEvent<HTMLButtonElement>) => {
    const button = e.currentTarget
    const rect = button.getBoundingClientRect()
    const dropdownHeight = 320 // hauteur estimée du dropdown
    const spaceBelow = window.innerHeight - rect.bottom
    const openAbove = spaceBelow < dropdownHeight && rect.top > dropdownHeight

    setDropdownPosition({
      top: openAbove ? rect.top - dropdownHeight - 8 : rect.bottom + 8,
      left: Math.max(8, rect.right - 256)
    })
    setIsOpen(true)
  }

  return (
    <div className="relative">
      <button
        onClick={handleOpenDropdown}
        disabled={isLoading}
        className="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
      >
        {isLoading ? (
          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : (
          <>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Crédit
          </>
        )}
      </button>

      {isOpen && dropdownPosition && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div
            className="fixed w-64 bg-slate-800 rounded-xl shadow-2xl border border-slate-700 z-50 overflow-hidden"
            style={{
              top: dropdownPosition.top,
              left: dropdownPosition.left
            }}
          >
            <div className="px-4 py-3 bg-slate-900/50 border-b border-slate-700">
              <p className="text-sm font-medium text-white">Ajouter un crédit</p>
              <p className="text-xs text-slate-400">à {username}</p>
            </div>
            <div className="p-2">
              {creditTypes.map((type) => (
                <button
                  key={type.key}
                  onClick={() => {
                    if (type.needsTournament) {
                      onSelectStatsTournament(userId, username)
                    } else {
                      onAddCredit(userId, type.key, username)
                    }
                    setIsOpen(false)
                  }}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-slate-700/50 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${type.color}`}></div>
                    <span className="text-sm text-slate-200 group-hover:text-white">{type.label}</span>
                    {type.needsTournament && (
                      <span className="text-[10px] text-slate-400">→ tournoi</span>
                    )}
                  </div>
                  <span className={`text-xs font-semibold ${type.textColor}`}>{type.price}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ============= COMPOSANT PRINCIPAL =============

export default function AdminUsagePage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabType>('tournaments')

  // ===== ÉTATS TOURNOIS =====
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [tournamentsLoading, setTournamentsLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [tournamentsError, setTournamentsError] = useState<string | null>(null)
  const [tournamentsSuccess, setTournamentsSuccess] = useState<string | null>(null)
  const [deleteModal, setDeleteModal] = useState<DeleteModalState>({
    tournament: null,
    credits: null,
    canRefund: false,
    loading: false,
    refundCredits: true
  })
  const [detailModal, setDetailModal] = useState<DetailModalState>({
    tournament: null,
    detail: null,
    loading: false
  })

  // États pour tri, filtrage et pagination des tournois
  const [sortColumn, setSortColumn] = useState<keyof Tournament | ''>('')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [filterText, setFilterText] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // ===== ÉTATS CRÉDITS =====
  const [users, setUsers] = useState<UserStats[]>([])
  const [creditsLoading, setCreditsLoading] = useState(true)
  const [creditsSearch, setCreditsSearch] = useState('')
  const [creditsPage, setCreditsPage] = useState(1)
  const [creditsTotalCount, setCreditsTotalCount] = useState(0)
  const [addingCredit, setAddingCredit] = useState<{ userId: string; type: string } | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [statsTournamentModal, setStatsTournamentModal] = useState<{ userId: string; username: string } | null>(null)
  const [userTournaments, setUserTournaments] = useState<Array<{
    id: string
    name: string
    slug: string
    status: string
    tournament_type: string
    competition_name: string
    has_stats_access: boolean
  }>>([])
  const [userTournamentsLoading, setUserTournamentsLoading] = useState(false)
  const [userHasLifetimeAccess, setUserHasLifetimeAccess] = useState(false)
  const [creditsPageSize, setCreditsPageSize] = useState(20)

  // ===== FONCTIONS TOURNOIS =====

  const fetchTournaments = async () => {
    setTournamentsLoading(true)
    setTournamentsError(null)
    try {
      const response = await fetch('/api/admin/tournaments')
      if (!response.ok) throw new Error('Failed to fetch tournaments')
      const data = await response.json()
      setTournaments(data.tournaments)
    } catch (err: any) {
      setTournamentsError(err.message)
    } finally {
      setTournamentsLoading(false)
    }
  }

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
    setTournamentsError(null)
    setTournamentsSuccess(null)

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
      setTournamentsSuccess(data.message)
      closeDeleteModal()
      setTournaments(prev => prev.filter(t => t.id !== tournament.id))
    } catch (err: any) {
      setTournamentsError(err.message)
      closeDeleteModal()
    } finally {
      setDeleting(null)
    }
  }

  const openDetailModal = async (tournament: Tournament) => {
    setDetailModal({ tournament, detail: null, loading: true })
    try {
      const response = await fetch(`/api/admin/tournaments/${tournament.id}`)
      if (response.ok) {
        const data = await response.json()
        setDetailModal(prev => ({ ...prev, detail: data.tournament, loading: false }))
      } else {
        setDetailModal(prev => ({ ...prev, loading: false }))
      }
    } catch {
      setDetailModal(prev => ({ ...prev, loading: false }))
    }
  }

  const closeDetailModal = () => {
    setDetailModal({ tournament: null, detail: null, loading: false })
  }

  // Filtrage et tri des tournois
  const filteredAndSortedTournaments = useMemo(() => {
    let result = [...tournaments]

    if (filterText) {
      const searchLower = filterText.toLowerCase()
      result = result.filter(t =>
        t.name.toLowerCase().includes(searchLower) ||
        t.slug.toLowerCase().includes(searchLower) ||
        t.creator_username.toLowerCase().includes(searchLower) ||
        t.competition_name.toLowerCase().includes(searchLower)
      )
    }

    if (filterType !== 'all') {
      result = result.filter(t => t.tournament_type === filterType)
    }

    if (filterStatus !== 'all') {
      result = result.filter(t => t.status === filterStatus)
    }

    if (sortColumn) {
      result.sort((a, b) => {
        let aVal = a[sortColumn]
        let bVal = b[sortColumn]

        if (aVal === null || aVal === undefined) aVal = ''
        if (bVal === null || bVal === undefined) bVal = ''

        if (sortColumn === 'participants_count' || sortColumn === 'total_revenue') {
          return sortDirection === 'asc'
            ? (aVal as number) - (bVal as number)
            : (bVal as number) - (aVal as number)
        }

        if (sortColumn === 'created_at' || sortColumn === 'end_date') {
          const aTime = aVal ? new Date(aVal as string).getTime() : 0
          const bTime = bVal ? new Date(bVal as string).getTime() : 0
          return sortDirection === 'asc' ? aTime - bTime : bTime - aTime
        }

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

  const totalPages = Math.ceil(filteredAndSortedTournaments.length / itemsPerPage)
  const paginatedTournaments = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredAndSortedTournaments.slice(start, start + itemsPerPage)
  }, [filteredAndSortedTournaments, currentPage])

  useEffect(() => {
    setCurrentPage(1)
  }, [filterText, filterType, filterStatus])

  const handleSort = (column: keyof Tournament) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

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

  // ===== FONCTIONS CRÉDITS =====

  const addToast = (toast: Omit<Toast, 'id'>) => {
    const id = Date.now()
    setToasts(prev => [...prev, { ...toast, id }])
  }

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  const fetchUsers = useCallback(async () => {
    setCreditsLoading(true)
    try {
      const response = await fetch(`/api/admin/credits?search=${encodeURIComponent(creditsSearch)}&page=${creditsPage}&pageSize=${creditsPageSize}`)
      const data = await response.json()

      if (data.success) {
        setUsers(data.users)
        setCreditsTotalCount(data.totalCount)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    }
    setCreditsLoading(false)
  }, [creditsSearch, creditsPage, creditsPageSize])

  useEffect(() => {
    const timer = setTimeout(() => {
      setCreditsPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [creditsSearch, creditsPageSize])

  const handleAddCredit = async (userId: string, creditType: string, username: string, tournamentId?: string) => {
    setAddingCredit({ userId, type: creditType })
    try {
      const response = await fetch('/api/admin/credits/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, creditType, tournamentId })
      })

      const data = await response.json()
      if (data.success) {
        fetchUsers()
        addToast({
          type: 'success',
          message: '',
          creditType: creditTypeLabels[creditType] || creditType,
          username
        })
      } else {
        const errorMsg = data.details
          ? `${data.error}: ${data.details}`
          : data.error || 'Erreur lors de l\'ajout du crédit'
        addToast({
          type: 'error',
          message: errorMsg
        })
        console.error('Credit add error:', data)
      }
    } catch (error) {
      console.error('Error adding credit:', error)
      addToast({
        type: 'error',
        message: 'Erreur lors de l\'ajout du crédit'
      })
    }
    setAddingCredit(null)
  }

  const creditsTotalPages = Math.ceil(creditsTotalCount / creditsPageSize)

  const openStatsTournamentModal = async (userId: string, username: string) => {
    setStatsTournamentModal({ userId, username })
    setUserTournamentsLoading(true)
    setUserTournaments([])
    setUserHasLifetimeAccess(false)

    try {
      const response = await fetch(`/api/admin/users/${userId}/tournaments`)
      const data = await response.json()

      if (data.success) {
        setUserTournaments(data.tournaments)
        setUserHasLifetimeAccess(data.has_lifetime_access || false)
      }
    } catch (error) {
      console.error('Error fetching user tournaments:', error)
    }
    setUserTournamentsLoading(false)
  }

  // ===== EFFETS =====

  useEffect(() => {
    if (activeTab === 'tournaments') {
      fetchTournaments()
    } else {
      fetchUsers()
    }
  }, [activeTab])

  useEffect(() => {
    if (activeTab === 'credits') {
      fetchUsers()
    }
  }, [creditsPage, fetchUsers, activeTab])

  // ===== RENDU =====

  return (
    <AdminLayout currentPage="usage">
      {/* Toast notifications container */}
      {toasts.length > 0 && (
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-3">
          {toasts.map(toast => (
            <ToastNotification
              key={toast.id}
              toast={toast}
              onClose={() => removeToast(toast.id)}
            />
          ))}
        </div>
      )}

      <div className="min-h-screen bg-gray-50">
        <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Utilisation</h1>
            <p className="text-gray-600">Gérez les tournois et les crédits utilisateurs</p>
          </div>

          {/* Sous-onglets */}
          <div className="flex gap-2 mb-6 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('tournaments')}
              className={`px-6 py-3 font-medium text-sm transition-colors relative ${
                activeTab === 'tournaments'
                  ? 'text-purple-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Tournois
              {tournaments.length > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded-full">
                  {tournaments.length}
                </span>
              )}
              {activeTab === 'tournaments' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('credits')}
              className={`px-6 py-3 font-medium text-sm transition-colors relative ${
                activeTab === 'credits'
                  ? 'text-purple-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Crédits
              {activeTab === 'credits' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600" />
              )}
            </button>
          </div>

          {/* ===== ONGLET TOURNOIS ===== */}
          {activeTab === 'tournaments' && (
            <>
              {tournamentsError && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
                  <strong>Erreur :</strong> {tournamentsError}
                </div>
              )}

              {tournamentsSuccess && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
                  <strong>Succès :</strong> {tournamentsSuccess}
                </div>
              )}

              {/* Barre de filtres */}
              <div className="mb-4 bg-white p-4 rounded-lg shadow border border-gray-200">
                <div className="flex flex-wrap gap-4 items-end">
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

                <div className="mt-3 text-sm text-gray-600">
                  {filteredAndSortedTournaments.length} tournoi{filteredAndSortedTournaments.length > 1 ? 's' : ''} trouvé{filteredAndSortedTournaments.length > 1 ? 's' : ''}
                  {filterText || filterType !== 'all' || filterStatus !== 'all' ? ' (filtré)' : ''}
                </div>
              </div>

              {tournamentsLoading ? (
                <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500">
                  Chargement des tournois...
                </div>
              ) : filteredAndSortedTournaments.length === 0 ? (
                <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500">
                  {tournaments.length === 0 ? 'Aucun tournoi trouvé' : 'Aucun résultat pour ces filtres'}
                </div>
              ) : (
                <>
                  {/* Version desktop - tableau */}
                  <div className="hidden lg:block bg-white rounded-lg shadow overflow-hidden border border-gray-200">
                    <table className="min-w-full border-collapse">
                      <thead className="bg-gray-700 text-white">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-600 select-none" onClick={() => handleSort('name')}>
                            Tournoi <SortIndicator column="name" />
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-600 select-none" onClick={() => handleSort('tournament_type')}>
                            Type <SortIndicator column="tournament_type" />
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-600 select-none" onClick={() => handleSort('status')}>
                            Statut <SortIndicator column="status" />
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-600 select-none" onClick={() => handleSort('creator_username')}>
                            Créateur <SortIndicator column="creator_username" />
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-600 select-none" onClick={() => handleSort('participants_count')}>
                            Joueurs <SortIndicator column="participants_count" />
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-600 select-none" onClick={() => handleSort('created_at')}>
                            Créé le <SortIndicator column="created_at" />
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-300">
                        {paginatedTournaments.map((tournament, index) => (
                          <tr key={tournament.id} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-purple-50 transition-colors`}>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">{tournament.name}</div>
                              <div className="text-xs text-gray-400 font-mono">{tournament.slug}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {getTournamentTypeBadge(tournament.tournament_type)}
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
                            <td className="px-4 py-3 whitespace-nowrap text-right">
                              <div className="flex gap-2 justify-end">
                                <button
                                  onClick={() => openDetailModal(tournament)}
                                  className="px-3 py-1.5 bg-purple-500 text-white text-sm font-medium rounded-md hover:bg-purple-600 transition shadow-sm"
                                >
                                  Détail
                                </button>
                                <button
                                  onClick={() => openDeleteModal(tournament)}
                                  className="px-3 py-1.5 bg-red-500 text-white text-sm font-medium rounded-md hover:bg-red-600 transition shadow-sm"
                                >
                                  Supprimer
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Version mobile - cartes */}
                  <div className="lg:hidden space-y-4">
                    {paginatedTournaments.map((tournament) => (
                      <div key={tournament.id} className="bg-white rounded-lg shadow border border-gray-200 p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h3 className="text-sm font-bold text-gray-900 mb-1">{tournament.name}</h3>
                            <p className="text-xs text-gray-400 font-mono">{tournament.slug}</p>
                          </div>
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 text-purple-700 text-sm font-semibold ml-2">
                            {tournament.participants_count}
                          </span>
                        </div>

                        <div className="space-y-2 mb-3">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">Type:</span>
                            {getTournamentTypeBadge(tournament.tournament_type)}
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">Statut:</span>
                            {getStatusBadge(tournament.status)}
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">Créateur:</span>
                            <span className="font-medium text-gray-700">{tournament.creator_username}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">Créé le:</span>
                            <span className="text-gray-600">
                              {new Date(tournament.created_at).toLocaleDateString('fr-FR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: '2-digit',
                              })}
                            </span>
                          </div>
                        </div>

                        <div className="flex gap-2 pt-3 border-t border-gray-100">
                          <button
                            onClick={() => openDetailModal(tournament)}
                            className="flex-1 px-3 py-2 bg-purple-500 text-white text-sm font-medium rounded-md hover:bg-purple-600 transition shadow-sm"
                          >
                            Détail
                          </button>
                          <button
                            onClick={() => openDeleteModal(tournament)}
                            className="flex-1 px-3 py-2 bg-red-500 text-white text-sm font-medium rounded-md hover:bg-red-600 transition shadow-sm"
                          >
                            Supprimer
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Pagination */}
              {filteredAndSortedTournaments.length > 0 && totalPages > 1 && (
                <div className="bg-white rounded-lg shadow border border-gray-200 mt-4">
                  <div className="px-4 py-3 bg-gray-50 flex flex-col sm:flex-row items-center justify-between gap-2">
                    <div className="text-sm text-gray-600">
                      Page {currentPage} sur {totalPages}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Précédent
                      </button>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Suivant
                      </button>
                    </div>
                  </div>
                </div>
              )}

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
                          <strong>Action irréversible</strong> - Cette action supprimera définitivement le tournoi.
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

              {/* Modal de détail */}
              {detailModal.tournament && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={closeDetailModal}>
                  <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                    <div className="p-6 border-b border-gray-200 flex-shrink-0">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-900">
                          Détail du tournoi
                        </h3>
                        <button
                          onClick={closeDetailModal}
                          className="p-1 rounded-lg hover:bg-gray-100 transition"
                        >
                          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    <div className="p-6 overflow-y-auto flex-1">
                      {detailModal.loading ? (
                        <div className="text-center py-8 text-gray-500">
                          Chargement des détails...
                        </div>
                      ) : detailModal.detail ? (
                        <div className="space-y-4">
                          {/* Infos générales - compact */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-base font-semibold text-gray-900">{detailModal.detail.name}</h4>
                              <div className="flex items-center gap-2">
                                {getTournamentTypeBadge(detailModal.detail.tournament_type)}
                                {getStatusBadge(detailModal.detail.status)}
                              </div>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-sm">
                              <div>
                                <span className="text-gray-500">Créateur :</span>{' '}
                                <span className="font-medium text-gray-900">{detailModal.detail.creator_username}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Code :</span>{' '}
                                <span className="font-mono text-gray-700">{detailModal.detail.invite_code}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Créé le :</span>{' '}
                                <span className="text-gray-700">
                                  {new Date(detailModal.detail.created_at).toLocaleDateString('fr-FR', {
                                    day: '2-digit', month: '2-digit', year: 'numeric'
                                  })}
                                </span>
                              </div>
                              {detailModal.detail.competition && (
                                <div className="col-span-2 sm:col-span-1">
                                  <span className="text-gray-500">Compétition :</span>{' '}
                                  <span className="font-medium text-gray-900">
                                    {detailModal.detail.competition.name}
                                    {detailModal.detail.competition.is_custom && (
                                      <span className="ml-1 text-xs text-purple-600">(custom)</span>
                                    )}
                                  </span>
                                </div>
                              )}
                              <div>
                                <span className="text-gray-500">Joueurs max :</span>{' '}
                                <span className="font-medium text-gray-900">
                                  {detailModal.detail.max_participants || 'Illimité'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Journées + Scoring + Options - fusionnés */}
                          <div className="p-3 bg-gray-50 rounded-lg text-sm">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1">
                              <div>
                                <span className="text-gray-500">Journées :</span>{' '}
                                <span className="font-medium text-gray-900">
                                  {detailModal.detail.starting_matchday && detailModal.detail.ending_matchday
                                    ? `J${detailModal.detail.starting_matchday}→J${detailModal.detail.ending_matchday}`
                                    : detailModal.detail.all_matchdays
                                      ? 'Toutes'
                                      : 'Non défini'}
                                  {' '}({detailModal.detail.actual_matchdays || detailModal.detail.planned_matchdays || '-'})
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-500">Exact :</span>{' '}
                                <span className="font-semibold text-blue-800">{detailModal.detail.scoring_exact_score} pts</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Bon résultat :</span>{' '}
                                <span className="font-semibold text-blue-800">{detailModal.detail.scoring_correct_winner} pt</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Mauvais :</span>{' '}
                                <span className="font-semibold text-blue-800">{detailModal.detail.scoring_draw_with_default_prediction} pt</span>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {detailModal.detail.teams_enabled && (
                                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-medium rounded-full">Équipes</span>
                              )}
                              {detailModal.detail.bonus_match_enabled && (
                                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">Match bonus</span>
                              )}
                              {detailModal.detail.early_prediction_bonus && (
                                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">Bonus early</span>
                              )}
                              {detailModal.detail.all_matchdays && (
                                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">Toutes journées</span>
                              )}
                              {!detailModal.detail.teams_enabled && !detailModal.detail.bonus_match_enabled && !detailModal.detail.early_prediction_bonus && !detailModal.detail.all_matchdays && (
                                <span className="text-xs text-gray-400">Aucune option</span>
                              )}
                            </div>
                          </div>

                          {/* Participants */}
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-2">
                              Participants ({detailModal.detail.participants.length})
                              <span className="ml-2 text-gray-400 font-normal">
                                — {detailModal.detail.total_predictions} pronostic{detailModal.detail.total_predictions !== 1 ? 's' : ''} au total
                              </span>
                            </h4>
                            {detailModal.detail.participants.length === 0 ? (
                              <p className="text-sm text-gray-400">Aucun participant</p>
                            ) : (
                              <>
                                {/* Version desktop */}
                                <div className="hidden md:block border border-gray-200 rounded-lg overflow-hidden">
                                  <table className="min-w-full text-sm">
                                    <thead className="bg-gray-100">
                                      <tr>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Joueur</th>
                                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Points</th>
                                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Pronos</th>
                                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Stats</th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Rejoint le</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                      {detailModal.detail.participants.map((p) => (
                                        <tr key={p.user_id} className="hover:bg-gray-50">
                                          <td className="px-3 py-2 text-gray-500">{p.rank || '-'}</td>
                                          <td className="px-3 py-2">
                                            <div className="flex items-center gap-2">
                                              <img
                                                src={getAvatarUrl(p.avatar || 'avatar1')}
                                                alt={p.username}
                                                className="w-6 h-6 rounded-full"
                                                onError={(e) => { (e.target as HTMLImageElement).src = '/avatars/avatar1.png' }}
                                              />
                                              <span className="font-medium text-gray-900">{p.username}</span>
                                            </div>
                                          </td>
                                          <td className="px-3 py-2 text-center font-semibold text-purple-700">{p.total_points}</td>
                                          <td className="px-3 py-2 text-center text-gray-600">{p.predictions_count}</td>
                                          <td className="px-3 py-2 text-center">
                                            {p.has_stats_access ? (
                                              <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
                                                p.stats_access_type === 'lifetime'
                                                  ? 'bg-pink-100 text-pink-700'
                                                  : 'bg-rose-100 text-rose-700'
                                              }`}>
                                                {p.stats_access_type === 'lifetime' ? '∞' : 'T'}
                                              </span>
                                            ) : (
                                              <button
                                                onClick={() => {
                                                  handleAddCredit(p.user_id, 'stats_access_tournament', p.username, detailModal.detail?.id)
                                                  // Rafraîchir les données du tournoi après attribution
                                                  setTimeout(() => {
                                                    if (detailModal.tournament) {
                                                      openDetailModal(detailModal.tournament)
                                                    }
                                                  }, 500)
                                                }}
                                                disabled={addingCredit?.userId === p.user_id}
                                                className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-gray-100 text-gray-500 hover:bg-pink-100 hover:text-pink-700 transition-colors disabled:opacity-50"
                                                title="Attribuer accès stats pour ce tournoi"
                                              >
                                                {addingCredit?.userId === p.user_id ? '...' : '+'}
                                              </button>
                                            )}
                                          </td>
                                          <td className="px-3 py-2 text-gray-500">
                                            {new Date(p.joined_at).toLocaleDateString('fr-FR', {
                                              day: '2-digit', month: '2-digit', year: '2-digit'
                                            })}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>

                                {/* Version mobile */}
                                <div className="md:hidden space-y-2">
                                  {detailModal.detail.participants.map((p) => (
                                    <div key={p.user_id} className="p-3 border border-gray-200 rounded-lg bg-white">
                                      <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs text-gray-500 font-medium">#{p.rank || '-'}</span>
                                          <img
                                            src={getAvatarUrl(p.avatar || 'avatar1')}
                                            alt={p.username}
                                            className="w-6 h-6 rounded-full"
                                            onError={(e) => { (e.target as HTMLImageElement).src = '/avatars/avatar1.png' }}
                                          />
                                          <span className="font-medium text-gray-900 text-sm">{p.username}</span>
                                          {p.has_stats_access ? (
                                            <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
                                              p.stats_access_type === 'lifetime'
                                                ? 'bg-pink-100 text-pink-700'
                                                : 'bg-rose-100 text-rose-700'
                                            }`}>
                                              {p.stats_access_type === 'lifetime' ? '∞ Stats' : 'Stats'}
                                            </span>
                                          ) : (
                                            <button
                                              onClick={() => {
                                                handleAddCredit(p.user_id, 'stats_access_tournament', p.username, detailModal.detail?.id)
                                                setTimeout(() => {
                                                  if (detailModal.tournament) {
                                                    openDetailModal(detailModal.tournament)
                                                  }
                                                }, 500)
                                              }}
                                              disabled={addingCredit?.userId === p.user_id}
                                              className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-gray-100 text-gray-500 hover:bg-pink-100 hover:text-pink-700 transition-colors disabled:opacity-50"
                                              title="Attribuer accès stats"
                                            >
                                              {addingCredit?.userId === p.user_id ? '...' : '+ Stats'}
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                      <div className="flex items-center justify-between text-xs">
                                        <div className="flex gap-4">
                                          <div>
                                            <span className="text-gray-500">Points: </span>
                                            <span className="font-semibold text-purple-700">{p.total_points}</span>
                                          </div>
                                          <div>
                                            <span className="text-gray-500">Pronos: </span>
                                            <span className="text-gray-600">{p.predictions_count}</span>
                                          </div>
                                        </div>
                                        <div className="text-gray-400">
                                          {new Date(p.joined_at).toLocaleDateString('fr-FR', {
                                            day: '2-digit', month: '2-digit', year: '2-digit'
                                          })}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-red-500">
                          Erreur lors du chargement des détails.
                        </div>
                      )}
                    </div>

                    <div className="p-4 border-t border-gray-200 flex justify-end flex-shrink-0">
                      <button
                        onClick={closeDetailModal}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                      >
                        Fermer
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ===== ONGLET CRÉDITS ===== */}
          {activeTab === 'credits' && (
            <>
              <div className="flex items-center justify-between mb-6">
                <div className="text-sm text-gray-500">
                  {creditsTotalCount} utilisateur{creditsTotalCount > 1 ? 's' : ''} au total
                </div>
              </div>

              {/* Barre de recherche */}
              <div className="mb-6">
                <div className="relative">
                  <input
                    type="text"
                    value={creditsSearch}
                    onChange={(e) => setCreditsSearch(e.target.value)}
                    placeholder="Rechercher par pseudo..."
                    className="w-full md:w-96 px-4 py-3 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  <svg
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>

              {/* Tableau */}
              <div className="bg-white rounded-lg shadow">
                <div className="overflow-x-auto overflow-y-visible">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Utilisateur</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Free-Kick</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">One-Shot</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Elite Team</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Platinium</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Slots dispo</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Crédits Plat.</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Ext. Durée</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {creditsLoading ? (
                        <tr>
                          <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                            Chargement...
                          </td>
                        </tr>
                      ) : users.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                            Aucun utilisateur trouvé
                          </td>
                        </tr>
                      ) : (
                        users.map((user) => (
                          <tr key={user.userId} className="hover:bg-gray-50">
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-3">
                                <img
                                  src={getAvatarUrl(user.avatar || 'avatar1')}
                                  alt={user.username}
                                  className="w-8 h-8 rounded-full"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = '/avatars/avatar1.png'
                                  }}
                                />
                                <span className="font-medium text-gray-900">{user.username}</span>
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-center">
                              <span className="text-gray-900">{user.freeKick.total}</span>
                              {user.freeKick.paidSlot > 0 && (
                                <span className="text-xs text-orange-600 ml-1">({user.freeKick.paidSlot})</span>
                              )}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-center">
                              <span className="text-gray-900">{user.oneShot.total}</span>
                              {user.oneShot.paid > 0 && (
                                <span className="text-xs text-orange-600 ml-1">({user.oneShot.paid})</span>
                              )}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-center">
                              <span className="text-gray-900">{user.elite.total}</span>
                              {user.elite.paid > 0 && (
                                <span className="text-xs text-orange-600 ml-1">({user.elite.paid})</span>
                              )}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-center">
                              <span className="text-gray-900">{user.platinium.total}</span>
                              {user.platinium.paid > 0 && (
                                <span className="text-xs text-orange-600 ml-1">({user.platinium.paid})</span>
                              )}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-center">
                              <span className={`font-medium ${user.availableSlots > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                {user.availableSlots}
                              </span>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-center">
                              <span className={`font-medium ${user.platiniumCredits > 0 ? 'text-yellow-500' : 'text-gray-400'}`}>
                                {user.platiniumCredits}
                              </span>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-center">
                              <span className={`font-medium ${user.durationExtensionCredits > 0 ? 'text-teal-500' : 'text-gray-400'}`}>
                                {user.durationExtensionCredits}
                              </span>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-center">
                              <div className="relative inline-block text-left">
                                <CreditDropdown
                                  userId={user.userId}
                                  username={user.username}
                                  onAddCredit={handleAddCredit}
                                  onSelectStatsTournament={(userId, username) => openStatsTournamentModal(userId, username)}
                                  isLoading={addingCredit?.userId === user.userId}
                                />
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-6 p-4 bg-slate-800 rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="text-sm text-white">
                    <span className="font-semibold text-purple-400">{creditsTotalCount}</span> utilisateur{creditsTotalCount > 1 ? 's' : ''}
                    {creditsTotalCount > 0 && (
                      <span className="text-slate-400 ml-2">
                        ({(creditsPage - 1) * creditsPageSize + 1}-{Math.min(creditsPage * creditsPageSize, creditsTotalCount)})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-slate-300">Afficher :</label>
                    <select
                      value={creditsPageSize}
                      onChange={(e) => setCreditsPageSize(Number(e.target.value))}
                      className="px-2 py-1 border border-slate-600 rounded text-sm bg-slate-700 text-white"
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-300">
                    Page <span className="font-semibold text-white">{creditsPage}</span> / {creditsTotalPages || 1}
                  </span>
                  <button
                    onClick={() => setCreditsPage(Math.max(1, creditsPage - 1))}
                    disabled={creditsPage === 1}
                    className="px-3 py-1.5 border border-slate-600 rounded-lg bg-slate-700 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-600 text-sm font-medium"
                  >
                    ←
                  </button>
                  <button
                    onClick={() => setCreditsPage(Math.min(creditsTotalPages || 1, creditsPage + 1))}
                    disabled={creditsPage >= creditsTotalPages}
                    className="px-3 py-1.5 border border-slate-600 rounded-lg bg-slate-700 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-600 text-sm font-medium"
                  >
                    →
                  </button>
                </div>
              </div>

              {/* Legende */}
              <div className="mt-6 p-4 bg-slate-100 rounded-lg text-sm text-slate-700">
                <strong>Légende :</strong> Le nombre entre parenthèses indique les participations payantes.
              </div>
            </>
          )}
        </main>
      </div>

      {/* Modal de sélection de tournoi pour Stats */}
      {statsTournamentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setStatsTournamentModal(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[70vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Sélectionner un tournoi
                  </h3>
                  <p className="text-sm text-gray-500">
                    Stats Tournoi pour {statsTournamentModal.username}
                  </p>
                </div>
                <button
                  onClick={() => setStatsTournamentModal(null)}
                  className="p-1 rounded-lg hover:bg-gray-100 transition"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              {userTournamentsLoading ? (
                <div className="text-center py-8 text-gray-500">
                  <svg className="animate-spin h-6 w-6 mx-auto mb-2" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Chargement des tournois...
                </div>
              ) : userHasLifetimeAccess ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-pink-100 flex items-center justify-center">
                    <svg className="w-6 h-6 text-pink-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-gray-900 font-medium">Stats à Vie activé</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {statsTournamentModal.username} a déjà accès aux stats sur tous ses tournois
                  </p>
                </div>
              ) : userTournaments.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  {statsTournamentModal.username} ne participe à aucun tournoi
                </p>
              ) : (
                <div className="space-y-2">
                  {userTournaments.map((t) => (
                    <button
                      key={t.id}
                      onClick={async () => {
                        if (!t.has_stats_access) {
                          await handleAddCredit(statsTournamentModal.userId, 'stats_access_tournament', statsTournamentModal.username, t.id)
                          setStatsTournamentModal(null)
                        }
                      }}
                      disabled={addingCredit?.userId === statsTournamentModal.userId || t.has_stats_access}
                      className={`w-full flex items-center justify-between p-3 border rounded-lg transition-colors disabled:opacity-50 ${
                        t.has_stats_access
                          ? 'border-green-200 bg-green-50 cursor-not-allowed'
                          : 'border-gray-200 hover:bg-gray-50 hover:border-pink-300'
                      }`}
                    >
                      <div className="text-left">
                        <p className={`font-medium ${t.has_stats_access ? 'text-gray-500' : 'text-gray-900'}`}>{t.name}</p>
                        <p className="text-xs text-gray-500">{t.competition_name}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {getTournamentTypeBadge(t.tournament_type)}
                        {t.has_stats_access && (
                          <span className="px-2 py-0.5 text-xs font-medium rounded bg-green-100 text-green-700">
                            Activé
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
