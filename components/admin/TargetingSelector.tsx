'use client'

import { useState, useEffect } from 'react'
import type { TargetingFilters } from '@/lib/admin/email-templates'

interface TargetingSelectorProps {
  value: TargetingFilters
  onChange: (filters: TargetingFilters) => void
}

export default function TargetingSelector({ value, onChange }: TargetingSelectorProps) {
  const [filters, setFilters] = useState<TargetingFilters>(value)

  // Mettre à jour le parent quand les filtres changent
  useEffect(() => {
    onChange(filters)
  }, [filters, onChange])

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
        </div>
      </div>

      {/* Activité */}
      <div className="border border-gray-200 rounded-lg p-4">
        <h4 className="font-semibold text-gray-900 mb-3">📊 Activité</h4>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-700 mb-1">
              Inactif depuis X jours (laisser vide = ignorer ce filtre):
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
              Actif dans les X derniers jours (laisser vide = ignorer ce filtre):
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
  )
}
