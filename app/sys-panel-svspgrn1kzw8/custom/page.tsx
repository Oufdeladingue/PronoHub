'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AdminLayout from '@/components/AdminLayout'
import { Plus, Calendar, Trash2, Edit3, Star, ToggleLeft, ToggleRight, X } from 'lucide-react'

interface CustomCompetition {
  id: string
  name: string
  code: string
  description: string | null
  competition_type: string
  matches_per_matchday: number
  is_active: boolean
  season: string | null
  current_matchday: number
  total_matchdays: number
  matchdaysCount: number
  created_at: string
  custom_emblem_color: string | null
}

export default function AdminCustomCompetitionsPage() {
  const router = useRouter()
  const [competitions, setCompetitions] = useState<CustomCompetition[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)

  // Modal de création
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newCompetition, setNewCompetition] = useState({
    name: '',
    code: '',
    description: '',
    competition_type: 'best_of_week',
    matches_per_matchday: 8,
    season: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`
  })

  // Modal d'édition de description
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingCompetition, setEditingCompetition] = useState<CustomCompetition | null>(null)
  const [editDescription, setEditDescription] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchCompetitions = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/custom-competitions')
      if (!response.ok) throw new Error('Failed to fetch competitions')
      const data = await response.json()
      setCompetitions(data.competitions || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const createCompetition = async () => {
    if (!newCompetition.name || !newCompetition.code) {
      setError('Nom et code requis')
      return
    }

    setCreating(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/custom-competitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCompetition)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create competition')
      }

      setSuccess(data.message)
      setShowCreateModal(false)
      setNewCompetition({
        name: '',
        code: '',
        description: '',
        competition_type: 'best_of_week',
        matches_per_matchday: 8,
        season: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`
      })
      await fetchCompetitions()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  const toggleActive = async (id: string, currentStatus: boolean) => {
    setToggling(id)
    setError(null)
    try {
      const response = await fetch('/api/admin/custom-competitions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: !currentStatus })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Échec de la mise à jour')
      }

      setSuccess(data.message)
      await fetchCompetitions()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setToggling(null)
    }
  }

  const deleteCompetition = async (id: string, name: string) => {
    if (!confirm(`Supprimer la compétition "${name}" ? Cette action est irréversible.`)) {
      return
    }

    setError(null)
    try {
      const response = await fetch(`/api/admin/custom-competitions?id=${id}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to delete competition')

      setSuccess('Compétition supprimée')
      await fetchCompetitions()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const openEditModal = (comp: CustomCompetition) => {
    setEditingCompetition(comp)
    setEditDescription(comp.description || '')
    setShowEditModal(true)
  }

  const saveDescription = async () => {
    if (!editingCompetition) return

    setSaving(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/custom-competitions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingCompetition.id, description: editDescription })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Échec de la mise à jour')
      }

      setSuccess('Description mise à jour')
      setShowEditModal(false)
      setEditingCompetition(null)
      await fetchCompetitions()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    fetchCompetitions()
  }, [])

  return (
    <AdminLayout currentPage="custom">
      <div className="min-h-screen bg-gray-50">
        <main className="max-w-7xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Compétitions personnalisées</h1>
              <p className="text-gray-600">Créez des compétitions custom comme "Best of Week"</p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
            >
              <Plus className="w-5 h-5" />
              Nouvelle compétition
            </button>
          </div>

          {/* Messages */}
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

          {/* Liste des compétitions */}
          {loading ? (
            <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500">
              Chargement...
            </div>
          ) : competitions.length === 0 ? (
            <div className="bg-white p-8 rounded-lg shadow text-center">
              <Star className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">Aucune compétition personnalisée</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="text-purple-600 hover:text-purple-700 font-medium"
              >
                Créer votre première compétition
              </button>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {competitions.map((comp) => (
                <div
                  key={comp.id}
                  className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200 hover:shadow-lg transition"
                >
                  {/* Header de la carte */}
                  <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-4 text-white relative">
                    {/* Logo en haut à droite */}
                    {comp.custom_emblem_color && (
                      <div className="absolute top-3 right-3 w-12 h-12 bg-white/20 rounded-lg p-1.5 backdrop-blur-sm">
                        <img
                          src={comp.custom_emblem_color}
                          alt={comp.name}
                          className="w-full h-full object-contain"
                        />
                      </div>
                    )}
                    <div className="flex items-center justify-between pr-14">
                      <span className="text-xs font-medium bg-white/20 px-2 py-1 rounded">
                        {comp.code}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleActive(comp.id, comp.is_active)
                        }}
                        disabled={toggling === comp.id}
                        className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded transition-all ${
                          comp.is_active
                            ? 'bg-green-400/30 hover:bg-green-400/50'
                            : 'bg-red-400/30 hover:bg-red-400/50'
                        } ${toggling === comp.id ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
                        title={comp.is_active ? 'Cliquer pour désactiver' : 'Cliquer pour activer'}
                      >
                        {toggling === comp.id ? (
                          <span className="animate-spin">⏳</span>
                        ) : comp.is_active ? (
                          <ToggleRight className="w-4 h-4" />
                        ) : (
                          <ToggleLeft className="w-4 h-4" />
                        )}
                        {comp.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </div>
                    <h3 className="text-xl font-bold mt-2">{comp.name}</h3>
                    <div className="flex items-start gap-2 mt-1">
                      <p className="text-sm text-white/80 flex-1 line-clamp-2">
                        {comp.description || 'Aucune description'}
                      </p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          openEditModal(comp)
                        }}
                        className="p-1 hover:bg-white/20 rounded transition flex-shrink-0"
                        title="Modifier la description"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Corps de la carte */}
                  <div className="p-4">
                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex justify-between">
                        <span>Type:</span>
                        <span className="font-medium text-gray-900">
                          {comp.competition_type === 'best_of_week' ? 'Best of Week' : 'Custom'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Matchs/journée:</span>
                        <span className="font-medium text-gray-900">{comp.matches_per_matchday}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Saison:</span>
                        <span className="font-medium text-gray-900">{comp.season || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Journées créées:</span>
                        <span className="font-medium text-gray-900">{comp.matchdaysCount}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-4 pt-4 border-t border-gray-100 flex gap-2">
                      <button
                        onClick={() => router.push(`/sys-panel-svspgrn1kzw8/custom/${comp.id}`)}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition text-sm font-medium"
                      >
                        <Calendar className="w-4 h-4" />
                        Gérer les journées
                      </button>
                      <button
                        onClick={() => deleteCompetition(comp.id, comp.name)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
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

          {/* Modal de création */}
          {showCreateModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
                <div className="p-6 border-b border-gray-200">
                  <h2 className="text-xl font-bold text-gray-900">Nouvelle compétition</h2>
                  <p className="text-sm text-gray-500 mt-1">Créez une compétition personnalisée</p>
                </div>

                <div className="p-6 space-y-4">
                  {/* Nom */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nom de la compétition *
                    </label>
                    <input
                      type="text"
                      value={newCompetition.name}
                      onChange={(e) => setNewCompetition({ ...newCompetition, name: e.target.value })}
                      placeholder="ex: Best of Week"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>

                  {/* Code */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Code unique *
                    </label>
                    <input
                      type="text"
                      value={newCompetition.code}
                      onChange={(e) => setNewCompetition({ ...newCompetition, code: e.target.value.toUpperCase() })}
                      placeholder="ex: BOTW"
                      maxLength={10}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent uppercase"
                    />
                    <p className="text-xs text-gray-500 mt-1">Code unique pour identifier la compétition</p>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={newCompetition.description}
                      onChange={(e) => setNewCompetition({ ...newCompetition, description: e.target.value })}
                      placeholder="Description de la compétition..."
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                    />
                  </div>

                  {/* Type et Matchs par journée */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Type
                      </label>
                      <select
                        value={newCompetition.competition_type}
                        onChange={(e) => setNewCompetition({ ...newCompetition, competition_type: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      >
                        <option value="best_of_week">Best of Week</option>
                        <option value="custom">Custom</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Matchs/journée
                      </label>
                      <input
                        type="number"
                        min={4}
                        max={15}
                        value={newCompetition.matches_per_matchday}
                        onChange={(e) => setNewCompetition({ ...newCompetition, matches_per_matchday: parseInt(e.target.value) || 8 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* Saison */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Saison
                    </label>
                    <input
                      type="text"
                      value={newCompetition.season}
                      onChange={(e) => setNewCompetition({ ...newCompetition, season: e.target.value })}
                      placeholder="ex: 2024-2025"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={createCompetition}
                    disabled={creating || !newCompetition.name || !newCompetition.code}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {creating ? 'Création...' : 'Créer la compétition'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal d'édition de description */}
          {showEditModal && editingCompetition && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
                <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Modifier la description</h2>
                    <p className="text-sm text-gray-500 mt-1">{editingCompetition.name}</p>
                  </div>
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description affichée aux utilisateurs
                  </label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Ex: Les plus belles affiches de la semaine - Sélection des meilleurs matchs de toutes les compétitions"
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-gray-900"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Cette description sera visible par les utilisateurs sur la page de sélection des compétitions.
                  </p>
                </div>

                <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={saveDescription}
                    disabled={saving}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Enregistrement...' : 'Enregistrer'}
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
