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
  competition_emblem: string | null
  competition_id: number
  created_at: string
  creator_username: string
  participants_count: number
  total_revenue: number
  end_date: string | null
  last_prediction_at: string | null
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

interface UserDetailPurchase {
  id: string
  purchase_type: string
  tournament_subtype: string | null
  amount: number
  status: string
  created_at: string
  tournament_name?: string
}

interface UserDetailTrophy {
  trophy_type: string
  unlocked_at: string
}

interface UserNotificationPreferences {
  email_reminder: boolean
  email_tournament_started: boolean
  email_day_recap: boolean
  email_tournament_end: boolean
  email_invite: boolean
  email_player_joined: boolean
  email_mention: boolean
  email_badge_unlocked: boolean
  email_new_matches: boolean
}

interface UserDetail {
  id: string
  username: string
  avatar: string
  email: string | null
  created_at: string
  last_seen_at: string | null
  role: string
  tournaments: {
    total: number
    active: number
    finished: number
    draft: number
  }
  credits: Record<string, number>
  purchases: {
    total: number
    totalSpent: number
    details: UserDetailPurchase[]
  }
  trophies: UserDetailTrophy[]
  notificationPreferences: UserNotificationPreferences
}

interface UserDetailModalState {
  userId: string | null
  username: string | null
  detail: UserDetail | null
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

interface AdminUser {
  id: string
  username: string
  email: string | null
  country: string | null
  created_at: string
  last_seen_at: string | null
  active_tournaments_count: number
  active_tournaments: Array<{ id: string; name: string; slug: string; status: string }>
  suspect_reasons: string[]
}

interface ActiveTournamentsModalState {
  username: string
  tournaments: Array<{ id: string; name: string; slug: string; status: string }>
}

type UsersSortBy = 'username' | 'email' | 'country' | 'created_at' | 'last_seen_at' | 'active_tournaments_count'

type TabType = 'tournaments' | 'users' | 'credits'

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
          {toast.type === 'success'
            ? (toast.creditType ? 'Crédit ajouté !' : 'Succès')
            : 'Erreur'}
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

  const [userDetailModal, setUserDetailModal] = useState<UserDetailModalState>({
    userId: null,
    username: null,
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
  const [tournamentsPageSize, setTournamentsPageSize] = useState(20)

  // ===== ÉTATS USERS =====
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [usersSearch, setUsersSearch] = useState('')
  const [usersPage, setUsersPage] = useState(1)
  const [usersPageSize, setUsersPageSize] = useState(20)
  const [usersTotalCount, setUsersTotalCount] = useState(0)
  const [usersSortBy, setUsersSortBy] = useState<UsersSortBy>('created_at')
  const [usersSortDir, setUsersSortDir] = useState<'asc' | 'desc'>('desc')
  const [activeTournamentsModal, setActiveTournamentsModal] = useState<ActiveTournamentsModalState | null>(null)
  const [usersFilter, setUsersFilter] = useState<'' | 'suspect'>('')
  const [userDeleteModal, setUserDeleteModal] = useState<{ userId: string; username: string } | null>(null)
  const [userDeleteLoading, setUserDeleteLoading] = useState(false)
  const [userDeleteError, setUserDeleteError] = useState<string | null>(null)
  const [userDeleteBlockers, setUserDeleteBlockers] = useState<string[]>([])

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

  // ===== FONCTIONS USERS =====

  const fetchAdminUsers = useCallback(async () => {
    setUsersLoading(true)
    try {
      const sortParam = usersSortBy === 'active_tournaments_count' ? 'created_at' : usersSortBy
      const filterParam = usersFilter ? `&filter=${usersFilter}` : ''
      const response = await fetch(
        `/api/admin/users?search=${encodeURIComponent(usersSearch)}&page=${usersPage}&pageSize=${usersPageSize}&sortBy=${sortParam}&sortDir=${usersSortDir}${filterParam}`
      )
      const data = await response.json()

      if (data.success) {
        let fetchedUsers = data.users as AdminUser[]
        // Tri côté client pour active_tournaments_count
        if (usersSortBy === 'active_tournaments_count') {
          fetchedUsers = [...fetchedUsers].sort((a, b) => {
            const diff = a.active_tournaments_count - b.active_tournaments_count
            return usersSortDir === 'asc' ? diff : -diff
          })
        }
        setAdminUsers(fetchedUsers)
        setUsersTotalCount(data.totalCount)
      }
    } catch (error) {
      console.error('Error fetching admin users:', error)
    }
    setUsersLoading(false)
  }, [usersSearch, usersPage, usersPageSize, usersSortBy, usersSortDir, usersFilter])

  const handleUsersSort = (column: UsersSortBy) => {
    if (usersSortBy === column) {
      setUsersSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setUsersSortBy(column)
      setUsersSortDir(column === 'created_at' || column === 'last_seen_at' ? 'desc' : 'asc')
    }
  }

  const usersTotalPages = Math.ceil(usersTotalCount / usersPageSize)

  const handleDeleteUser = async (userId: string) => {
    setUserDeleteLoading(true)
    setUserDeleteError(null)
    setUserDeleteBlockers([])

    try {
      const response = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' })
      const data = await response.json()

      if (response.status === 409) {
        setUserDeleteBlockers(data.blockers || [])
        setUserDeleteError(data.error)
        return
      }

      if (!response.ok) {
        setUserDeleteError(data.error || 'Erreur lors de la suppression')
        return
      }

      // Succès
      setUserDeleteModal(null)
      setToasts(prev => [...prev, { id: Date.now(), type: 'success', message: data.message }])
      fetchAdminUsers()
    } catch {
      setUserDeleteError('Erreur réseau')
    } finally {
      setUserDeleteLoading(false)
    }
  }

  const handleExportCSV = () => {
    const params = new URLSearchParams({
      search: usersSearch,
      sortBy: usersSortBy === 'active_tournaments_count' ? 'created_at' : usersSortBy,
      sortDir: usersSortDir
    })
    window.open(`/api/admin/users/export?${params.toString()}`, '_blank')
  }

  const formatRelativeDate = (dateStr: string | null) => {
    if (!dateStr) return 'Jamais'
    const date = new Date(dateStr)
    const now = new Date()
    // Comparer les jours calendaires (pas la différence brute en ms)
    const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const diffDays = Math.round((today.getTime() - dateDay.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return "Aujourd'hui"
    if (diffDays === 1) return 'Hier'
    if (diffDays < 7) return `Il y a ${diffDays}j`
    if (diffDays < 30) return `Il y a ${Math.floor(diffDays / 7)} sem.`
    if (diffDays < 365) return `Il y a ${Math.floor(diffDays / 30)} mois`
    return `Il y a ${Math.floor(diffDays / 365)} an(s)`
  }

  const SortArrow = ({ column }: { column: UsersSortBy }) => {
    if (usersSortBy !== column) return <span className="text-gray-300 ml-1">↕</span>
    return <span className="text-purple-500 ml-1">{usersSortDir === 'asc' ? '↑' : '↓'}</span>
  }

  const countryFlag = (code: string | null) => {
    if (!code) return ''
    return String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1F1E6 - 65 + c.charCodeAt(0)))
  }

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

  // Ouvrir la modale de détail utilisateur
  const openUserDetailModal = async (userId: string, username: string) => {
    setUserDetailModal({ userId, username, detail: null, loading: true })
    try {
      const response = await fetch(`/api/admin/user/${userId}`)
      if (response.ok) {
        const data = await response.json()
        setUserDetailModal(prev => ({ ...prev, detail: data.user, loading: false }))
      } else {
        setUserDetailModal(prev => ({ ...prev, loading: false }))
      }
    } catch {
      setUserDetailModal(prev => ({ ...prev, loading: false }))
    }
  }

  const closeUserDetailModal = () => {
    setUserDetailModal({ userId: null, username: null, detail: null, loading: false })
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
      // 'finished' filtre aussi 'completed' (les deux sont "Terminé")
      if (filterStatus === 'finished') {
        result = result.filter(t => t.status === 'finished' || t.status === 'completed')
      } else {
        result = result.filter(t => t.status === filterStatus)
      }
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

        if (sortColumn === 'created_at' || sortColumn === 'end_date' || sortColumn === 'last_prediction_at') {
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

  const totalPages = Math.ceil(filteredAndSortedTournaments.length / tournamentsPageSize)
  const paginatedTournaments = useMemo(() => {
    const start = (currentPage - 1) * tournamentsPageSize
    return filteredAndSortedTournaments.slice(start, start + tournamentsPageSize)
  }, [filteredAndSortedTournaments, currentPage, tournamentsPageSize])

  useEffect(() => {
    setCurrentPage(1)
  }, [filterText, filterType, filterStatus, tournamentsPageSize])

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
      completed: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Terminé' },
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
    } else if (activeTab === 'users') {
      fetchAdminUsers()
    } else {
      fetchUsers()
    }
  }, [activeTab])

  useEffect(() => {
    if (activeTab === 'credits') {
      fetchUsers()
    }
  }, [creditsPage, fetchUsers, activeTab])

  // Debounce search users
  useEffect(() => {
    const timer = setTimeout(() => {
      setUsersPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [usersSearch, usersPageSize])

  // Fetch users quand page/tri/search change
  useEffect(() => {
    if (activeTab === 'users') {
      fetchAdminUsers()
    }
  }, [usersPage, fetchAdminUsers, activeTab])

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
              onClick={() => setActiveTab('users')}
              className={`px-6 py-3 font-medium text-sm transition-colors relative ${
                activeTab === 'users'
                  ? 'text-purple-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Users
              {usersTotalCount > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded-full">
                  {usersTotalCount}
                </span>
              )}
              {activeTab === 'users' && (
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
                          <th className="w-10 px-2 py-3"></th>
                          <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-600 select-none" onClick={() => handleSort('name')}>
                            Tournoi <SortIndicator column="name" />
                          </th>
                          <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-600 select-none" onClick={() => handleSort('tournament_type')}>
                            Type <SortIndicator column="tournament_type" />
                          </th>
                          <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-600 select-none" onClick={() => handleSort('status')}>
                            Statut <SortIndicator column="status" />
                          </th>
                          <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-600 select-none" onClick={() => handleSort('creator_username')}>
                            Créateur <SortIndicator column="creator_username" />
                          </th>
                          <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-600 select-none" onClick={() => handleSort('participants_count')}>
                            Joueurs <SortIndicator column="participants_count" />
                          </th>
                          <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-600 select-none" onClick={() => handleSort('created_at')}>
                            Créé le <SortIndicator column="created_at" />
                          </th>
                          <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-600 select-none" onClick={() => handleSort('end_date')}>
                            Fin prévue <SortIndicator column="end_date" />
                          </th>
                          <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-600 select-none" onClick={() => handleSort('last_prediction_at')}>
                            Dernier prono <SortIndicator column="last_prediction_at" />
                          </th>
                          <th className="w-20 px-2 py-3 text-center text-xs font-semibold uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-300">
                        {paginatedTournaments.map((tournament, index) => (
                          <tr key={tournament.id} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-purple-50 transition-colors`}>
                            <td className="w-10 px-2 py-3 text-center">
                              {tournament.competition_emblem ? (
                                <img src={tournament.competition_emblem} alt="" className="w-6 h-6 mx-auto object-contain" />
                              ) : (
                                <span className="text-gray-300 text-lg">⚽</span>
                              )}
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">{tournament.name}</div>
                              <div className="text-xs text-gray-400 font-mono">{tournament.slug}</div>
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap">
                              {getTournamentTypeBadge(tournament.tournament_type)}
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap">
                              {getStatusBadge(tournament.status)}
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap">
                              <span className="text-sm font-medium text-gray-700">{tournament.creator_username}</span>
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap text-center">
                              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 text-purple-700 text-sm font-semibold">
                                {tournament.participants_count}
                              </span>
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-600">
                              {new Date(tournament.created_at).toLocaleDateString('fr-FR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: '2-digit',
                              })}
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-600">
                              {tournament.end_date
                                ? new Date(tournament.end_date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })
                                : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap text-sm">
                              {tournament.last_prediction_at
                                ? (() => {
                                    const days = Math.floor((Date.now() - new Date(tournament.last_prediction_at).getTime()) / (1000 * 60 * 60 * 24))
                                    return (
                                      <span className={days > 14 ? 'text-red-500 font-medium' : days > 7 ? 'text-orange-500' : 'text-gray-600'}>
                                        {new Date(tournament.last_prediction_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                                        {days > 7 && <span className="ml-1 text-xs">({days}j)</span>}
                                      </span>
                                    )
                                  })()
                                : <span className="text-gray-300">Aucun</span>}
                            </td>
                            <td className="w-20 px-2 py-3 whitespace-nowrap text-center">
                              <div className="flex gap-1.5 justify-center">
                                <button
                                  onClick={() => openDetailModal(tournament)}
                                  className="p-1.5 bg-purple-100 text-purple-600 rounded-md hover:bg-purple-200 transition"
                                  title="Détail"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                </button>
                                <button
                                  onClick={() => openDeleteModal(tournament)}
                                  className="p-1.5 bg-red-100 text-red-600 rounded-md hover:bg-red-200 transition"
                                  title="Supprimer"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
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
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {tournament.competition_emblem ? (
                              <img src={tournament.competition_emblem} alt="" className="w-7 h-7 object-contain flex-shrink-0" />
                            ) : (
                              <span className="text-gray-300 text-xl flex-shrink-0">⚽</span>
                            )}
                            <div className="min-w-0">
                              <h3 className="text-sm font-bold text-gray-900 mb-1 truncate">{tournament.name}</h3>
                              <p className="text-xs text-gray-400 font-mono truncate">{tournament.slug}</p>
                            </div>
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
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">Fin prévue:</span>
                            <span className="text-gray-600">
                              {tournament.end_date
                                ? new Date(tournament.end_date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })
                                : '—'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">Dernier prono:</span>
                            {tournament.last_prediction_at
                              ? (() => {
                                  const days = Math.floor((Date.now() - new Date(tournament.last_prediction_at).getTime()) / (1000 * 60 * 60 * 24))
                                  return (
                                    <span className={days > 14 ? 'text-red-500 font-medium' : days > 7 ? 'text-orange-500' : 'text-gray-600'}>
                                      {new Date(tournament.last_prediction_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                                      {days > 7 && <span className="ml-1 text-xs">({days}j)</span>}
                                    </span>
                                  )
                                })()
                              : <span className="text-gray-300">Aucun</span>}
                          </div>
                        </div>

                        <div className="flex gap-2 pt-3 border-t border-gray-100">
                          <button
                            onClick={() => openDetailModal(tournament)}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-purple-100 text-purple-700 text-sm font-medium rounded-md hover:bg-purple-200 transition"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                            Détail
                          </button>
                          <button
                            onClick={() => openDeleteModal(tournament)}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-red-100 text-red-700 text-sm font-medium rounded-md hover:bg-red-200 transition"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            Supprimer
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Pagination */}
              {filteredAndSortedTournaments.length > 0 && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-4 p-4 bg-slate-800 rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-white">
                      <span className="font-semibold text-purple-400">{filteredAndSortedTournaments.length}</span> tournoi{filteredAndSortedTournaments.length > 1 ? 's' : ''}
                      {filteredAndSortedTournaments.length > 0 && (
                        <span className="text-slate-400 ml-2">
                          ({(currentPage - 1) * tournamentsPageSize + 1}-{Math.min(currentPage * tournamentsPageSize, filteredAndSortedTournaments.length)})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-slate-300">Afficher :</label>
                      <select
                        value={tournamentsPageSize}
                        onChange={(e) => setTournamentsPageSize(Number(e.target.value))}
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
                      Page <span className="font-semibold text-white">{currentPage}</span> / {totalPages || 1}
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 border border-slate-600 rounded-lg bg-slate-700 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-600 text-sm font-medium"
                    >
                      ←
                    </button>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages || 1, p + 1))}
                      disabled={currentPage >= totalPages}
                      className="px-3 py-1.5 border border-slate-600 rounded-lg bg-slate-700 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-600 text-sm font-medium"
                    >
                      →
                    </button>
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

            </>
          )}

          {/* ===== ONGLET USERS ===== */}
          {activeTab === 'users' && (
            <>
              {/* Barre de recherche + Export */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div className="relative flex-1 w-full sm:max-w-md">
                  <input
                    type="text"
                    value={usersSearch}
                    onChange={(e) => setUsersSearch(e.target.value)}
                    placeholder="Rechercher par pseudo ou email..."
                    className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                <button
                  onClick={handleExportCSV}
                  className="hidden sm:inline-flex items-center gap-2 px-4 py-3 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors whitespace-nowrap"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export CSV
                </button>
              </div>

              {/* Filtre Suspects */}
              <div className="flex items-center gap-2 mb-4">
                <button
                  onClick={() => { setUsersFilter(usersFilter === 'suspect' ? '' : 'suspect'); setUsersPage(1) }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full border transition-colors ${
                    usersFilter === 'suspect'
                      ? 'bg-red-100 text-red-700 border-red-300'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  Suspects
                </button>
                {usersFilter === 'suspect' && (
                  <span className="text-xs text-gray-500">
                    Comptes jamais connect{'\u00e9'}s, cr{'\u00e9'}{'\u00e9'}s depuis +24h
                  </span>
                )}
              </div>

              {/* Tableau Desktop */}
              <div className="hidden md:block bg-white rounded-lg shadow">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th
                          onClick={() => handleUsersSort('email')}
                          className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 select-none"
                        >
                          Email <SortArrow column="email" />
                        </th>
                        <th
                          onClick={() => handleUsersSort('username')}
                          className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 select-none"
                        >
                          Pseudo <SortArrow column="username" />
                        </th>
                        <th
                          onClick={() => handleUsersSort('created_at')}
                          className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 select-none"
                        >
                          Créé le <SortArrow column="created_at" />
                        </th>
                        <th
                          onClick={() => handleUsersSort('last_seen_at')}
                          className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 select-none"
                        >
                          Dernière connexion <SortArrow column="last_seen_at" />
                        </th>
                        <th
                          onClick={() => handleUsersSort('country')}
                          className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 select-none"
                        >
                          Pays <SortArrow column="country" />
                        </th>
                        <th
                          onClick={() => handleUsersSort('active_tournaments_count')}
                          className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 select-none"
                        >
                          Tournois actifs <SortArrow column="active_tournaments_count" />
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {usersLoading ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                            Chargement...
                          </td>
                        </tr>
                      ) : adminUsers.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                            Aucun utilisateur trouvé
                          </td>
                        </tr>
                      ) : (
                        adminUsers.map((u) => (
                          <tr key={u.id} className={`hover:bg-gray-50 ${u.suspect_reasons.length > 0 ? 'bg-red-50/50' : ''}`}>
                            <td className="px-4 py-3 text-sm text-gray-900 max-w-[200px] truncate" title={u.email || ''}>
                              {u.email || <span className="text-gray-400 italic">Aucun</span>}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                              <span className="flex items-center gap-2">
                                {u.username}
                                {u.suspect_reasons.length > 0 && (
                                  <span
                                    className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold bg-red-100 text-red-700 rounded"
                                    title={u.suspect_reasons.join(' / ')}
                                  >
                                    SUSPECT
                                  </span>
                                )}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                              {new Date(u.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap" title={u.last_seen_at ? new Date(u.last_seen_at).toLocaleString('fr-FR') : ''}>
                              {formatRelativeDate(u.last_seen_at)}
                            </td>
                            <td className="px-4 py-3 text-center text-sm whitespace-nowrap" title={u.country || ''}>
                              {u.country ? (
                                <span>{countryFlag(u.country)} {u.country}</span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {u.active_tournaments_count > 0 ? (
                                <button
                                  onClick={() => setActiveTournamentsModal({ username: u.username, tournaments: u.active_tournaments })}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-100 text-purple-700 text-sm font-medium rounded-full hover:bg-purple-200 transition-colors"
                                >
                                  {u.active_tournaments_count}
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                </button>
                              ) : (
                                <span className="text-gray-400 text-sm">0</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => { setUserDeleteModal({ userId: u.id, username: u.username }); setUserDeleteError(null); setUserDeleteBlockers([]) }}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Supprimer cet utilisateur"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Vue Mobile : Tri + Cartes */}
              <div className="md:hidden space-y-3">
                {/* Sélecteur de tri mobile */}
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-500 whitespace-nowrap">Trier par :</label>
                  <select
                    value={usersSortBy}
                    onChange={(e) => {
                      const col = e.target.value as UsersSortBy
                      setUsersSortBy(col)
                      setUsersSortDir(col === 'created_at' || col === 'last_seen_at' ? 'desc' : 'asc')
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900"
                  >
                    <option value="created_at">Date de création</option>
                    <option value="last_seen_at">Dernière connexion</option>
                    <option value="username">Pseudo</option>
                    <option value="email">Email</option>
                    <option value="country">Pays</option>
                    <option value="active_tournaments_count">Tournois actifs</option>
                  </select>
                  <button
                    onClick={() => setUsersSortDir(prev => prev === 'asc' ? 'desc' : 'asc')}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 hover:bg-gray-50"
                    title={usersSortDir === 'asc' ? 'Croissant' : 'Décroissant'}
                  >
                    {usersSortDir === 'asc' ? '↑' : '↓'}
                  </button>
                </div>

                {usersLoading ? (
                  <div className="text-center py-8 text-gray-500">Chargement...</div>
                ) : adminUsers.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">Aucun utilisateur trouvé</div>
                ) : (
                  adminUsers.map((u) => (
                    <div key={u.id} className={`bg-white rounded-lg shadow p-4 border ${u.suspect_reasons.length > 0 ? 'border-red-300 bg-red-50/50' : 'border-gray-200'}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900 truncate">{u.username}</p>
                            {u.suspect_reasons.length > 0 && (
                              <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold bg-red-100 text-red-700 rounded flex-shrink-0">
                                SUSPECT
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 truncate">{u.email || 'Pas d\'email'}</p>
                          {u.suspect_reasons.length > 0 && (
                            <p className="text-xs text-red-600 mt-0.5">{u.suspect_reasons.join(' \u00b7 ')}</p>
                          )}
                        </div>
                        {u.active_tournaments_count > 0 ? (
                          <button
                            onClick={() => setActiveTournamentsModal({ username: u.username, tournaments: u.active_tournaments })}
                            className="ml-2 inline-flex items-center gap-1 px-2.5 py-1 bg-purple-100 text-purple-700 text-sm font-medium rounded-full hover:bg-purple-200 transition-colors flex-shrink-0"
                          >
                            {u.active_tournaments_count} tournoi{u.active_tournaments_count > 1 ? 's' : ''}
                          </button>
                        ) : (
                          <span className="ml-2 text-gray-400 text-sm flex-shrink-0">0 tournoi</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                          <span>
                            Créé le {new Date(u.created_at).toLocaleDateString('fr-FR')}
                          </span>
                          <span>
                            Vu {formatRelativeDate(u.last_seen_at).toLowerCase()}
                          </span>
                          {u.country && (
                            <span>{countryFlag(u.country)} {u.country}</span>
                          )}
                        </div>
                        <button
                          onClick={() => { setUserDeleteModal({ userId: u.id, username: u.username }); setUserDeleteError(null); setUserDeleteBlockers([]) }}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors flex-shrink-0"
                          title="Supprimer"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Pagination */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-6 p-4 bg-slate-800 rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="text-sm text-white">
                    <span className="font-semibold text-purple-400">{usersTotalCount}</span> utilisateur{usersTotalCount > 1 ? 's' : ''}
                    {usersTotalCount > 0 && (
                      <span className="text-slate-400 ml-2">
                        ({(usersPage - 1) * usersPageSize + 1}-{Math.min(usersPage * usersPageSize, usersTotalCount)})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-slate-300">Afficher :</label>
                    <select
                      value={usersPageSize}
                      onChange={(e) => setUsersPageSize(Number(e.target.value))}
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
                    Page <span className="font-semibold text-white">{usersPage}</span> / {usersTotalPages || 1}
                  </span>
                  <button
                    onClick={() => setUsersPage(Math.max(1, usersPage - 1))}
                    disabled={usersPage === 1}
                    className="px-3 py-1.5 border border-slate-600 rounded-lg bg-slate-700 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-600 text-sm font-medium"
                  >
                    ←
                  </button>
                  <button
                    onClick={() => setUsersPage(Math.min(usersTotalPages || 1, usersPage + 1))}
                    disabled={usersPage >= usersTotalPages}
                    className="px-3 py-1.5 border border-slate-600 rounded-lg bg-slate-700 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-600 text-sm font-medium"
                  >
                    →
                  </button>
                </div>
              </div>
              {/* Modale de suppression utilisateur */}
              {userDeleteModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => !userDeleteLoading && setUserDeleteModal(null)}>
                  <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900">Supprimer l&apos;utilisateur</h3>
                    </div>

                    <p className="text-gray-600 mb-4">
                      Êtes-vous sûr de vouloir supprimer <strong className="text-gray-900">{userDeleteModal.username}</strong> ? Cette action est <strong className="text-red-600">irréversible</strong>.
                    </p>

                    {userDeleteBlockers.length > 0 && (
                      <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-sm font-semibold text-amber-800 mb-2">Suppression impossible :</p>
                        <ul className="text-sm text-amber-700 space-y-1">
                          {userDeleteBlockers.map((b, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-amber-500 mt-0.5">•</span>
                              {b}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {userDeleteError && userDeleteBlockers.length === 0 && (
                      <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-700">{userDeleteError}</p>
                      </div>
                    )}

                    <div className="flex gap-3 justify-end">
                      <button
                        onClick={() => setUserDeleteModal(null)}
                        disabled={userDeleteLoading}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
                      >
                        Annuler
                      </button>
                      {userDeleteBlockers.length === 0 && (
                        <button
                          onClick={() => handleDeleteUser(userDeleteModal.userId)}
                          disabled={userDeleteLoading}
                          className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                          {userDeleteLoading ? (
                            <>
                              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                              Suppression...
                            </>
                          ) : (
                            'Confirmer la suppression'
                          )}
                        </button>
                      )}
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

      {/* Modal de détail tournoi (global, accessible depuis tous les onglets) */}
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
                                {detailModal.detail.tournament_type !== 'elite' && detailModal.detail.tournament_type !== 'platinium' && (
                                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Stats</th>
                                )}
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Rejoint le</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {detailModal.detail.participants.map((p) => (
                                <tr
                                  key={p.user_id}
                                  className="hover:bg-purple-50 cursor-pointer transition-colors"
                                  onClick={() => openUserDetailModal(p.user_id, p.username)}
                                >
                                  <td className="px-3 py-2 text-gray-500">{p.rank || '-'}</td>
                                  <td className="px-3 py-2">
                                    <div className="flex items-center gap-2">
                                      <img
                                        src={getAvatarUrl(p.avatar || 'avatar1')}
                                        alt={p.username}
                                        className="w-6 h-6 rounded-full"
                                        onError={(e) => { (e.target as HTMLImageElement).src = '/avatars/avatar1.png' }}
                                      />
                                      <span className="font-medium text-gray-900 hover:text-purple-700">{p.username}</span>
                                    </div>
                                  </td>
                                  <td className="px-3 py-2 text-center font-semibold text-purple-700">{p.total_points}</td>
                                  <td className="px-3 py-2 text-center text-gray-600">{p.predictions_count}</td>
                                  {detailModal.detail?.tournament_type !== 'elite' && detailModal.detail?.tournament_type !== 'platinium' && (
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
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            handleAddCredit(p.user_id, 'stats_access_tournament', p.username, detailModal.detail?.id)
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
                                  )}
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
                            <div
                              key={p.user_id}
                              className="p-3 border border-gray-200 rounded-lg bg-white"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-500 font-medium">#{p.rank || '-'}</span>
                                  <img
                                    src={getAvatarUrl(p.avatar || 'avatar1')}
                                    alt={p.username}
                                    className="w-6 h-6 rounded-full"
                                    onError={(e) => { (e.target as HTMLImageElement).src = '/avatars/avatar1.png' }}
                                  />
                                  <button
                                    onClick={() => openUserDetailModal(p.user_id, p.username)}
                                    className="font-medium text-purple-700 text-sm underline underline-offset-2 hover:text-purple-900 active:text-purple-900"
                                  >
                                    {p.username}
                                  </button>
                                  {detailModal.detail?.tournament_type !== 'elite' && detailModal.detail?.tournament_type !== 'platinium' && (
                                    <>
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
                                          onClick={(e) => {
                                            e.stopPropagation()
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
                                    </>
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

            <div className="p-4 border-t border-gray-200 flex justify-between flex-shrink-0">
              <button
                onClick={() => {
                  if (detailModal.detail) {
                    const url = `/${detailModal.detail.slug}/opposition`
                    window.open(url, '_blank', 'noopener,noreferrer')
                  }
                }}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Visiter en guest
              </button>
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

      {/* Modal tournois actifs (onglet Users) */}
      {activeTournamentsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setActiveTournamentsModal(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[70vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Tournois actifs
                  </h3>
                  <p className="text-sm text-gray-500">
                    {activeTournamentsModal.username} — {activeTournamentsModal.tournaments.length} tournoi{activeTournamentsModal.tournaments.length > 1 ? 's' : ''}
                  </p>
                </div>
                <button
                  onClick={() => setActiveTournamentsModal(null)}
                  className="p-1 rounded-lg hover:bg-gray-100 transition"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              <div className="space-y-2">
                {activeTournamentsModal.tournaments.map((t) => (
                  <button
                    key={t.id}
                    className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-orange-50 hover:ring-1 hover:ring-orange-200 transition cursor-pointer text-left"
                    onClick={() => {
                      setActiveTournamentsModal(null)
                      openDetailModal({ ...t, tournament_type: '', competition_name: '', competition_emblem: null, competition_id: 0, created_at: '', creator_username: '', participants_count: 0, total_revenue: 0, end_date: null, last_prediction_at: null })
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 text-sm truncate">{t.name}</p>
                      <p className="text-xs text-gray-500 truncate">{t.slug}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        t.status === 'active' || t.status === 'in_progress'
                          ? 'bg-green-100 text-green-700'
                          : t.status === 'registration'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {t.status}
                      </span>
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex-shrink-0">
              <button
                onClick={() => setActiveTournamentsModal(null)}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm font-medium"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Modal détail utilisateur */}
      {userDetailModal.userId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]" onClick={closeUserDetailModal}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Détail du joueur
                </h3>
                <button
                  onClick={closeUserDetailModal}
                  className="p-1 rounded-lg hover:bg-gray-100 transition"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-4 overflow-y-auto flex-1">
              {userDetailModal.loading ? (
                <div className="text-center py-8 text-gray-500">
                  <svg className="animate-spin h-6 w-6 mx-auto mb-2" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Chargement...
                </div>
              ) : userDetailModal.detail ? (
                <div className="space-y-4">
                  {/* Header: Avatar + Nom + Email */}
                  <div className="flex items-center gap-4 pb-4 border-b border-gray-200">
                    <img
                      src={getAvatarUrl(userDetailModal.detail.avatar || 'avatar1')}
                      alt={userDetailModal.detail.username}
                      className="w-14 h-14 rounded-full border-2 border-purple-200"
                    />
                    <div className="flex-1">
                      <h4 className="text-lg font-bold text-gray-900">{userDetailModal.detail.username}</h4>
                      {userDetailModal.detail.email && (
                        <p className="text-sm text-gray-500">{userDetailModal.detail.email}</p>
                      )}
                      <p className="text-xs text-gray-500">
                        Inscrit le {new Date(userDetailModal.detail.created_at).toLocaleDateString('fr-FR', {
                          day: '2-digit', month: 'long', year: 'numeric'
                        })}
                        {userDetailModal.detail.last_seen_at && (
                          <span className="ml-2 text-green-600 font-medium">
                            • Dernière visite : {new Date(userDetailModal.detail.last_seen_at).toLocaleDateString('fr-FR', {
                              day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                            })}
                          </span>
                        )}
                        {!userDetailModal.detail.last_seen_at && (
                          <span className="ml-2 text-orange-500 font-medium">• Jamais connecté</span>
                        )}
                      </p>
                    </div>
                    {userDetailModal.detail.role && userDetailModal.detail.role !== 'user' && (
                      <span className="px-2 py-1 text-xs font-medium rounded bg-purple-100 text-purple-700 uppercase">
                        {userDetailModal.detail.role}
                      </span>
                    )}
                  </div>

                  {/* Tournois */}
                  <div>
                    <h5 className="text-sm font-semibold text-gray-700 mb-2">Tournois</h5>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div className="p-2 bg-blue-50 rounded-lg">
                        <div className="text-xl font-bold text-blue-700">{userDetailModal.detail.tournaments.total}</div>
                        <div className="text-xs text-blue-600">Total</div>
                      </div>
                      <div className="p-2 bg-green-50 rounded-lg">
                        <div className="text-xl font-bold text-green-700">{userDetailModal.detail.tournaments.active}</div>
                        <div className="text-xs text-green-600">En cours</div>
                      </div>
                      <div className="p-2 bg-gray-50 rounded-lg">
                        <div className="text-xl font-bold text-gray-700">{userDetailModal.detail.tournaments.finished}</div>
                        <div className="text-xs text-gray-600">Terminés</div>
                      </div>
                      <div className="p-2 bg-yellow-50 rounded-lg">
                        <div className="text-xl font-bold text-yellow-700">{userDetailModal.detail.tournaments.draft}</div>
                        <div className="text-xs text-yellow-600">Brouillon</div>
                      </div>
                    </div>
                  </div>

                  {/* Crédits */}
                  <div>
                    <h5 className="text-sm font-semibold text-gray-700 mb-2">Crédits disponibles</h5>
                    {Object.keys(userDetailModal.detail.credits).length === 0 ? (
                      <p className="text-sm text-gray-400">Aucun crédit</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {userDetailModal.detail.credits.free_kick && (
                          <span className="px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-700">
                            Free-Kick: {userDetailModal.detail.credits.free_kick}
                          </span>
                        )}
                        {userDetailModal.detail.credits.one_shot && (
                          <span className="px-2 py-1 text-xs font-medium rounded bg-cyan-100 text-cyan-700">
                            One-Shot: {userDetailModal.detail.credits.one_shot}
                          </span>
                        )}
                        {userDetailModal.detail.credits.elite && (
                          <span className="px-2 py-1 text-xs font-medium rounded bg-amber-100 text-amber-700">
                            Elite: {userDetailModal.detail.credits.elite}
                          </span>
                        )}
                        {userDetailModal.detail.credits.platinium && (
                          <span className="px-2 py-1 text-xs font-medium rounded bg-purple-100 text-purple-700">
                            Platinium: {userDetailModal.detail.credits.platinium}
                          </span>
                        )}
                        {userDetailModal.detail.credits.slots && (
                          <span className="px-2 py-1 text-xs font-medium rounded bg-indigo-100 text-indigo-700">
                            Slots: {userDetailModal.detail.credits.slots}
                          </span>
                        )}
                        {userDetailModal.detail.credits.stats_lifetime && (
                          <span className="px-2 py-1 text-xs font-medium rounded bg-pink-100 text-pink-700">
                            Stats ∞: {userDetailModal.detail.credits.stats_lifetime}
                          </span>
                        )}
                        {userDetailModal.detail.credits.stats_tournament && (
                          <span className="px-2 py-1 text-xs font-medium rounded bg-rose-100 text-rose-700">
                            Stats T: {userDetailModal.detail.credits.stats_tournament}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Achats */}
                  <div>
                    <h5 className="text-sm font-semibold text-gray-700 mb-2">
                      Achats ({userDetailModal.detail.purchases.total})
                      {userDetailModal.detail.purchases.totalSpent > 0 && (
                        <span className="ml-2 font-normal text-green-600">
                          Total: {userDetailModal.detail.purchases.totalSpent.toFixed(2)}€
                        </span>
                      )}
                    </h5>
                    {userDetailModal.detail.purchases.details.length === 0 ? (
                      <p className="text-sm text-gray-400">Aucun achat</p>
                    ) : (
                      <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-lg">
                        <table className="min-w-full text-xs">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="px-2 py-1 text-left text-gray-500">Type</th>
                              <th className="px-2 py-1 text-left text-gray-500">Détail</th>
                              <th className="px-2 py-1 text-right text-gray-500">Montant</th>
                              <th className="px-2 py-1 text-right text-gray-500">Date</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {userDetailModal.detail.purchases.details.map((p) => (
                              <tr key={p.id}>
                                <td className="px-2 py-1 text-gray-700">
                                  {p.purchase_type === 'tournament_creation' ? 'Création' :
                                   p.purchase_type === 'participant_slot' ? 'Slot' :
                                   p.purchase_type === 'stats_access_lifetime' ? 'Stats ∞' :
                                   p.purchase_type === 'stats_access_tournament' ? 'Stats T' :
                                   p.purchase_type}
                                </td>
                                <td className="px-2 py-1 text-gray-500">
                                  {p.tournament_subtype || p.tournament_name || '-'}
                                </td>
                                <td className="px-2 py-1 text-right text-gray-700">
                                  {p.amount > 0 ? `${p.amount.toFixed(2)}€` : 'Gratuit'}
                                </td>
                                <td className="px-2 py-1 text-right text-gray-400">
                                  {new Date(p.created_at).toLocaleDateString('fr-FR', {
                                    day: '2-digit', month: '2-digit', year: '2-digit'
                                  })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Trophées */}
                  <div>
                    <h5 className="text-sm font-semibold text-gray-700 mb-2">
                      Trophées débloqués ({userDetailModal.detail.trophies.length})
                    </h5>
                    {userDetailModal.detail.trophies.length === 0 ? (
                      <p className="text-sm text-gray-400">Aucun trophée</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {userDetailModal.detail.trophies.map((t) => {
                          const trophyLabels: Record<string, string> = {
                            'correct_result': 'Veinard',
                            'exact_score': 'Analyste',
                            'king_of_day': 'King of Day',
                            'double_king': 'Roi du Doublé',
                            'opportunist': 'Opportuniste',
                            'nostradamus': 'Nostradamus',
                            'lantern': 'Lanterne-rouge',
                            'downward_spiral': 'Spirale infernale',
                            'bonus_profiteer': 'Profiteur',
                            'bonus_optimizer': 'Optimisateur',
                            'ultra_dominator': 'Ultra-dominateur',
                            'poulidor': 'Poulidor',
                            'cursed': 'Maudit',
                            'tournament_winner': 'Ballon d\'or',
                            'legend': 'Légende',
                            'abyssal': 'Abyssal'
                          }
                          return (
                            <span
                              key={t.trophy_type}
                              className="px-2 py-1 text-xs font-medium rounded bg-yellow-100 text-yellow-800"
                              title={`Débloqué le ${new Date(t.unlocked_at).toLocaleDateString('fr-FR')}`}
                            >
                              🏆 {trophyLabels[t.trophy_type] || t.trophy_type}
                            </span>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Préférences de notifications */}
                  <div>
                    <h5 className="text-sm font-semibold text-gray-700 mb-2">
                      Préférences de notifications
                    </h5>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-xs">
                      {[
                        { key: 'email_reminder', label: 'Rappels' },
                        { key: 'email_tournament_started', label: 'Lancement tournoi' },
                        { key: 'email_day_recap', label: 'Récap journée' },
                        { key: 'email_tournament_end', label: 'Fin tournoi' },
                        { key: 'email_invite', label: 'Invitations' },
                        { key: 'email_player_joined', label: 'Nouveau joueur' },
                        { key: 'email_mention', label: 'Mentions' },
                        { key: 'email_badge_unlocked', label: 'Badges' },
                        { key: 'email_new_matches', label: 'Nouveaux matchs' },
                      ].map(({ key, label }) => {
                        const isEnabled = userDetailModal.detail?.notificationPreferences?.[key as keyof UserNotificationPreferences]
                        return (
                          <div
                            key={key}
                            className={`px-2 py-1 rounded text-center ${
                              isEnabled
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-600'
                            }`}
                          >
                            {isEnabled ? '✓' : '✗'} {label}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-red-500">
                  Erreur lors du chargement des informations.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
