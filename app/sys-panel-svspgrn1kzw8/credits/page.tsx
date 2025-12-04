'use client'

import { useState, useEffect, useCallback } from 'react'
import AdminLayout from '@/components/AdminLayout'
import { createClient } from '@/lib/supabase/client'

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
}

export default function CreditsPage() {
  const [users, setUsers] = useState<UserStats[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [addingCredit, setAddingCredit] = useState<{ userId: string; type: string } | null>(null)
  const pageSize = 10

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/credits?search=${encodeURIComponent(search)}&page=${page}&pageSize=${pageSize}`)
      const data = await response.json()

      if (data.success) {
        setUsers(data.users)
        setTotalCount(data.totalCount)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    }
    setLoading(false)
  }, [search, page])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const handleAddCredit = async (userId: string, creditType: string) => {
    setAddingCredit({ userId, type: creditType })
    try {
      const response = await fetch('/api/admin/credits/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, creditType })
      })

      const data = await response.json()
      if (data.success) {
        // Rafraichir les donnees
        fetchUsers()
        alert(`Credit "${creditType}" ajouté avec succès !`)
      } else {
        alert(data.error || 'Erreur lors de l\'ajout du crédit')
      }
    } catch (error) {
      console.error('Error adding credit:', error)
      alert('Erreur lors de l\'ajout du crédit')
    }
    setAddingCredit(null)
  }

  const totalPages = Math.ceil(totalCount / pageSize)

  return (
    <AdminLayout currentPage="credits">
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Gestion des Crédits</h1>
          <div className="text-sm text-gray-500">
            {totalCount} utilisateur{totalCount > 1 ? 's' : ''} au total
          </div>
        </div>

        {/* Barre de recherche */}
        <div className="mb-6">
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Utilisateur
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Free-Kick
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    One-Shot
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Elite Team
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Platinium
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Corpo
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Slots dispo
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                      Chargement...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                      Aucun utilisateur trouvé
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.userId} className="hover:bg-gray-50">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <img
                            src={`/images/avatars/${user.avatar || 'avatar1'}.svg`}
                            alt={user.username}
                            className="w-8 h-8 rounded-full"
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
                        <span className="text-gray-500">{user.corpo.total}</span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        <span className={`font-medium ${user.availableSlots > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                          {user.availableSlots}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        <div className="relative inline-block text-left">
                          <CreditDropdown
                            userId={user.userId}
                            username={user.username}
                            onAddCredit={handleAddCredit}
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
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <div className="text-sm text-gray-500">
              Page {page} sur {totalPages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Précédent
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Suivant
              </button>
            </div>
          </div>
        )}

        {/* Legende */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
          <strong>Légende :</strong> Le nombre entre parenthèses indique les participations payantes (slot acheté ou créateur payant).
        </div>
      </main>
    </AdminLayout>
  )
}

// Composant Dropdown pour ajouter des credits
function CreditDropdown({
  userId,
  username,
  onAddCredit,
  isLoading
}: {
  userId: string
  username: string
  onAddCredit: (userId: string, type: string) => void
  isLoading: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null)
  const buttonRef = useState<HTMLButtonElement | null>(null)

  const creditTypes = [
    { key: 'slot_invite', label: 'Slot Free-Kick', price: '0.99€', color: 'bg-blue-500', textColor: 'text-blue-400' },
    { key: 'oneshot_creation', label: 'Crédit One-Shot', price: '4.99€', color: 'bg-green-500', textColor: 'text-green-400' },
    { key: 'elite_creation', label: 'Crédit Elite', price: '9.99€', color: 'bg-orange-500', textColor: 'text-orange-400' },
    { key: 'platinium_participation', label: 'Crédit Platinium', price: '6.99€', color: 'bg-yellow-500', textColor: 'text-yellow-400' },
    { key: 'platinium_prepaid_11', label: 'Platinium Prepaid 11j', price: '69.20€', color: 'bg-purple-500', textColor: 'text-purple-400' },
  ]

  const handleOpenDropdown = (e: React.MouseEvent<HTMLButtonElement>) => {
    const button = e.currentTarget
    const rect = button.getBoundingClientRect()
    // Positionner le dropdown sous le bouton, aligné à droite
    setDropdownPosition({
      top: rect.bottom + 8,
      left: rect.right - 256 // 256px = w-64
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
                    onAddCredit(userId, type.key)
                    setIsOpen(false)
                  }}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-slate-700/50 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${type.color}`}></div>
                    <span className="text-sm text-slate-200 group-hover:text-white">{type.label}</span>
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
