'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { TargetingFilters } from '@/lib/admin/email-templates'

interface Tournament {
  id: string
  name: string
  status: string
}

interface TargetingSelectorProps {
  value: TargetingFilters
  onChange: (filters: TargetingFilters) => void
}

export default function TargetingSelector({ value, onChange }: TargetingSelectorProps) {
  const [filters, setFilters] = useState<TargetingFilters>(value)
  const [tournaments, setTournaments] = useState<Tournament[]>([])

  // Charger la liste des tournois
  useEffect(() => {
    const fetchTournaments = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('tournaments')
        .select('id, name, status')
        .order('created_at', { ascending: false })
      setTournaments(data || [])
    }
    fetchTournaments()
  }, [])

  // Mettre à jour le parent quand les filtres changent
  useEffect(() => {
    onChange(filters)
  }, [filters])

  const toggleBooleanFilter = (key: keyof TargetingFilters, checked: boolean) => {
    setFilters(prev => {
      const newFilters = { ...prev }
      if (checked) {
        // @ts-ignore
        newFilters[key] = true
      } else {
        delete newFilters[key]
      }
      return newFilters
    })
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Sélectionnez un ou plusieurs critères de ciblage. Les utilisateurs correspondant à <strong>tous</strong> les critères cochés recevront la communication.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Colonne gauche */}
        <div className="space-y-4">
          {/* Tournois */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-3">🏆 Tournois</h4>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.hasActiveTournament === true}
                  onChange={(e) => toggleBooleanFilter('hasActiveTournament', e.target.checked)}
                  className="w-4 h-4 text-purple-600 rounded"
                />
                <span className="text-sm text-gray-700">A un tournoi actif</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.hasNoActiveTournament === true}
                  onChange={(e) => toggleBooleanFilter('hasNoActiveTournament', e.target.checked)}
                  className="w-4 h-4 text-purple-600 rounded"
                />
                <span className="text-sm text-gray-700">N'a pas de tournoi actif</span>
              </label>

              <div className="pt-2 border-t border-gray-100">
                <label className="block text-sm text-gray-700 mb-1">
                  Participants d'un tournoi :
                </label>
                <select
                  value={filters.specificTournamentId || ''}
                  onChange={(e) => {
                    setFilters(prev => {
                      const newFilters = { ...prev }
                      if (e.target.value) {
                        newFilters.specificTournamentId = e.target.value
                      } else {
                        delete newFilters.specificTournamentId
                      }
                      return newFilters
                    })
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
                >
                  <option value="">Tous les tournois</option>
                  {tournaments.filter(t => t.status !== 'completed').length > 0 && (
                    <optgroup label="En cours">
                      {tournaments.filter(t => t.status !== 'completed').map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </optgroup>
                  )}
                  {tournaments.filter(t => t.status === 'completed').length > 0 && (
                    <optgroup label="Terminés">
                      {tournaments.filter(t => t.status === 'completed').map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
            </div>
          </div>

          {/* Activité */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-3">📊 Activité</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  Inactif depuis X jours:
                </label>
                <input
                  type="number"
                  value={filters.inactiveDays || ''}
                  onChange={(e) => {
                    const val = parseInt(e.target.value)
                    setFilters(prev => {
                      const newFilters = { ...prev }
                      if (val && val > 0) {
                        newFilters.inactiveDays = val
                      } else {
                        delete newFilters.inactiveDays
                      }
                      return newFilters
                    })
                  }}
                  placeholder="Ex: 7, 30, 90..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  Actif dans les X derniers jours:
                </label>
                <input
                  type="number"
                  value={filters.activeDays || ''}
                  onChange={(e) => {
                    const val = parseInt(e.target.value)
                    setFilters(prev => {
                      const newFilters = { ...prev }
                      if (val && val > 0) {
                        newFilters.activeDays = val
                      } else {
                        delete newFilters.activeDays
                      }
                      return newFilters
                    })
                  }}
                  placeholder="Ex: 7, 14, 30..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
                  min="0"
                />
              </div>
            </div>
          </div>

          {/* Plateforme */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-3">📱 Plateforme</h4>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.hasFcmToken === true}
                  onChange={(e) => toggleBooleanFilter('hasFcmToken', e.target.checked)}
                  className="w-4 h-4 text-purple-600 rounded"
                />
                <span className="text-sm text-gray-700">A l'app Android (FCM token)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.hasNoFcmToken === true}
                  onChange={(e) => toggleBooleanFilter('hasNoFcmToken', e.target.checked)}
                  className="w-4 h-4 text-purple-600 rounded"
                />
                <span className="text-sm text-gray-700">N'a pas l'app Android</span>
              </label>
            </div>
          </div>
        </div>

        {/* Colonne droite */}
        <div className="space-y-4">
          {/* Engagement */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-3">🎯 Engagement</h4>
            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.hasTrophies === true}
                  onChange={(e) => toggleBooleanFilter('hasTrophies', e.target.checked)}
                  className="w-4 h-4 text-purple-600 rounded"
                />
                <span className="text-sm text-gray-700">A des trophées</span>
              </label>

              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  Nombre minimum de pronos:
                </label>
                <input
                  type="number"
                  value={filters.minPredictions || ''}
                  onChange={(e) => {
                    const val = parseInt(e.target.value)
                    setFilters(prev => {
                      const newFilters = { ...prev }
                      if (val && val > 0) {
                        newFilters.minPredictions = val
                      } else {
                        delete newFilters.minPredictions
                      }
                      return newFilters
                    })
                  }}
                  placeholder="Ex: 10"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  Nombre minimum de tournois:
                </label>
                <input
                  type="number"
                  value={filters.minTournaments || ''}
                  onChange={(e) => {
                    const val = parseInt(e.target.value)
                    setFilters(prev => {
                      const newFilters = { ...prev }
                      if (val && val > 0) {
                        newFilters.minTournaments = val
                      } else {
                        delete newFilters.minTournaments
                      }
                      return newFilters
                    })
                  }}
                  placeholder="Ex: 2"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
                  min="0"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
