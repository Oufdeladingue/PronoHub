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

  const toggleFilter = (key: keyof TargetingFilters, checkValue: boolean | number | string[]) => {
    setFilters(prev => {
      const newFilters = { ...prev }

      // Si c'est un boolean et qu'il est déjà défini, on le supprime
      if (typeof checkValue === 'boolean' && newFilters[key] === checkValue) {
        delete newFilters[key]
      } else {
        // @ts-ignore - Type complex à typer
        newFilters[key] = checkValue
      }

      return newFilters
    })
  }

  return (
    <div className="space-y-4">
      {/* Tournois */}
      <div className="border border-gray-200 rounded-lg p-4">
        <h4 className="font-semibold text-gray-900 mb-3">🏆 Tournois</h4>
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.hasActiveTournament === true}
              onChange={(e) => {
                if (e.target.checked) {
                  setFilters(prev => {
                    const newFilters = { ...prev, hasActiveTournament: true }
                    delete newFilters.hasNoActiveTournament
                    return newFilters
                  })
                } else {
                  setFilters(prev => {
                    const newFilters = { ...prev }
                    delete newFilters.hasActiveTournament
                    return newFilters
                  })
                }
              }}
              className="w-4 h-4 text-purple-600 rounded"
            />
            <span className="text-sm text-gray-700">A un tournoi actif</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.hasNoActiveTournament === true}
              onChange={(e) => {
                if (e.target.checked) {
                  setFilters(prev => {
                    const newFilters = { ...prev, hasNoActiveTournament: true }
                    delete newFilters.hasActiveTournament
                    return newFilters
                  })
                } else {
                  setFilters(prev => {
                    const newFilters = { ...prev }
                    delete newFilters.hasNoActiveTournament
                    return newFilters
                  })
                }
              }}
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
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.inactiveDays === 7}
              onChange={(e) => toggleFilter('inactiveDays', e.target.checked ? 7 : 0)}
              className="w-4 h-4 text-purple-600 rounded"
            />
            <span className="text-sm text-gray-700">Inactif depuis 7 jours</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.inactiveDays === 30}
              onChange={(e) => {
                setFilters(prev => {
                  const newFilters = { ...prev }
                  if (e.target.checked) {
                    newFilters.inactiveDays = 30
                  } else {
                    delete newFilters.inactiveDays
                  }
                  return newFilters
                })
              }}
              className="w-4 h-4 text-purple-600 rounded"
            />
            <span className="text-sm text-gray-700">Inactif depuis 30 jours</span>
          </label>
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
              onChange={(e) => {
                if (e.target.checked) {
                  setFilters(prev => {
                    const newFilters = { ...prev, hasFcmToken: true }
                    delete newFilters.hasNoFcmToken
                    return newFilters
                  })
                } else {
                  setFilters(prev => {
                    const newFilters = { ...prev }
                    delete newFilters.hasFcmToken
                    return newFilters
                  })
                }
              }}
              className="w-4 h-4 text-purple-600 rounded"
            />
            <span className="text-sm text-gray-700">A l'app Android (FCM token)</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.hasNoFcmToken === true}
              onChange={(e) => {
                if (e.target.checked) {
                  setFilters(prev => {
                    const newFilters = { ...prev, hasNoFcmToken: true }
                    delete newFilters.hasFcmToken
                    return newFilters
                  })
                } else {
                  setFilters(prev => {
                    const newFilters = { ...prev }
                    delete newFilters.hasNoFcmToken
                    return newFilters
                  })
                }
              }}
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
              onChange={(e) => toggleFilter('hasTrophies', e.target.checked)}
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              min="0"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
