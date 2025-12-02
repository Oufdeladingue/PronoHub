'use client'

import { useState, useEffect } from 'react'
import AdminLayout from '@/components/AdminLayout'
import { Euro, Save, AlertCircle, CheckCircle, Users, Calendar, Zap, Crown } from 'lucide-react'

interface PricingItem {
  id: string
  config_key: string
  config_value: number
  config_type: string
  label: string
  description: string
  category: string
  sort_order: number
}

interface GroupedPricing {
  tournament_creation: PricingItem[]
  extensions: PricingItem[]
  limits: PricingItem[]
  platinium: PricingItem[]
}

const categoryLabels: Record<string, { title: string, description: string, icon: React.ReactNode }> = {
  tournament_creation: {
    title: 'Prix de creation des tournois',
    description: 'Prix pour creer un nouveau tournoi selon le type',
    icon: <Crown className="w-5 h-5 text-yellow-500" />
  },
  extensions: {
    title: 'Extensions Free-Kick',
    description: 'Prix des extensions pour les tournois gratuits',
    icon: <Zap className="w-5 h-5 text-blue-500" />
  },
  limits: {
    title: 'Limites des tournois',
    description: 'Configuration des limites de joueurs et journees',
    icon: <Users className="w-5 h-5 text-green-500" />
  },
  platinium: {
    title: 'Options Platinium',
    description: 'Configuration specifique au mode Platinium',
    icon: <Calendar className="w-5 h-5 text-purple-500" />
  }
}

export default function AdminPricingPage() {
  const [pricing, setPricing] = useState<PricingItem[]>([])
  const [grouped, setGrouped] = useState<GroupedPricing | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [changes, setChanges] = useState<Record<string, number>>({})

  useEffect(() => {
    fetchPricing()
  }, [])

  const fetchPricing = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/pricing')
      if (!response.ok) throw new Error('Erreur lors du chargement des prix')

      const data = await response.json()
      if (data.success) {
        setPricing(data.pricing || [])
        setGrouped(data.grouped || null)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleValueChange = (configKey: string, value: string) => {
    const numValue = parseFloat(value)
    if (!isNaN(numValue)) {
      setChanges(prev => ({
        ...prev,
        [configKey]: numValue
      }))
    }
  }

  const getCurrentValue = (item: PricingItem) => {
    if (changes[item.config_key] !== undefined) {
      return changes[item.config_key]
    }
    return item.config_value
  }

  const hasChanges = Object.keys(changes).length > 0

  const handleSave = async () => {
    if (!hasChanges) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const updates = Object.entries(changes).map(([config_key, config_value]) => ({
        config_key,
        config_value
      }))

      const response = await fetch('/api/admin/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates })
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Erreur lors de la sauvegarde')
      }

      setSuccess('Prix mis a jour avec succes!')
      setChanges({})
      await fetchPricing() // Recharger les donnees
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const renderPricingInput = (item: PricingItem) => {
    const value = getCurrentValue(item)
    const isModified = changes[item.config_key] !== undefined

    return (
      <div key={item.config_key} className="bg-gray-50 p-4 rounded-lg">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-900 mb-1">
              {item.label}
              {isModified && (
                <span className="ml-2 text-xs text-orange-500 font-normal">(modifie)</span>
              )}
            </label>
            {item.description && (
              <p className="text-xs text-gray-500 mb-2">{item.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              step={item.config_type === 'price' ? '0.01' : '1'}
              min="0"
              value={value}
              onChange={(e) => handleValueChange(item.config_key, e.target.value)}
              className={`w-24 px-3 py-2 border rounded-md text-right font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                isModified
                  ? 'border-orange-400 bg-orange-50 text-orange-700'
                  : 'border-gray-300 text-gray-900'
              }`}
            />
            {item.config_type === 'price' && (
              <span className="text-gray-500 font-medium">EUR</span>
            )}
            {item.config_type === 'percentage' && (
              <span className="text-gray-500 font-medium">%</span>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <AdminLayout currentPage="pricing">
        <div className="min-h-screen bg-gray-50">
          <main className="max-w-7xl mx-auto px-4 py-8">
            <div className="text-center py-12 text-gray-500">
              Chargement des tarifs...
            </div>
          </main>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout currentPage="pricing">
      <div className="min-h-screen bg-gray-50">
        <main className="max-w-7xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <Euro className="w-8 h-8 text-purple-600" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Gestion des Tarifs</h1>
                <p className="text-gray-500">Configurez les prix et limites des offres</p>
              </div>
            </div>
            {hasChanges && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                <Save className="w-5 h-5" />
                {saving ? 'Sauvegarde...' : 'Sauvegarder les modifications'}
              </button>
            )}
          </div>

          {/* Messages */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-800">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span><strong>Erreur:</strong> {error}</span>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3 text-green-800">
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* Warning si modifications non sauvegardees */}
          {hasChanges && (
            <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg flex items-center gap-3 text-orange-800">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>Vous avez {Object.keys(changes).length} modification(s) non sauvegardee(s)</span>
            </div>
          )}

          {/* Categories de prix */}
          <div className="space-y-8">
            {grouped && Object.entries(grouped).map(([category, items]) => {
              const categoryInfo = categoryLabels[category]
              if (!items || items.length === 0) return null

              return (
                <div key={category} className="bg-white rounded-lg shadow overflow-hidden">
                  {/* Header de categorie */}
                  <div className="bg-gray-100 px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                      {categoryInfo?.icon}
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900">
                          {categoryInfo?.title || category}
                        </h2>
                        <p className="text-sm text-gray-500">
                          {categoryInfo?.description}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Liste des prix */}
                  <div className="p-6">
                    <div className="space-y-4">
                      {items.map(item => renderPricingInput(item))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Apercu du prix groupe Platinium */}
          {grouped?.tournament_creation && grouped?.platinium && (
            <div className="mt-8 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-yellow-800 mb-2">Apercu: Prix Groupe Platinium</h3>
              <p className="text-sm text-yellow-700">
                Avec les parametres actuels, le prix du pack groupe sera de:{' '}
                <strong className="text-xl">
                  {(() => {
                    const platiniumPrice = getCurrentValue(
                      grouped.tournament_creation.find(p => p.config_key === 'platinium_creation_price') ||
                      { config_key: '', config_value: 6.99 } as PricingItem
                    )
                    const groupSize = getCurrentValue(
                      grouped.platinium.find(p => p.config_key === 'platinium_group_size') ||
                      { config_key: '', config_value: 11 } as PricingItem
                    )
                    const discount = getCurrentValue(
                      grouped.platinium.find(p => p.config_key === 'platinium_group_discount') ||
                      { config_key: '', config_value: 0 } as PricingItem
                    )
                    const total = platiniumPrice * groupSize * (1 - discount / 100)
                    return total.toFixed(2)
                  })()}{' '}
                  EUR
                </strong>
                {' '}pour {getCurrentValue(
                  grouped.platinium.find(p => p.config_key === 'platinium_group_size') ||
                  { config_key: '', config_value: 11 } as PricingItem
                )} places
              </p>
            </div>
          )}

          {/* Bouton de sauvegarde en bas */}
          {hasChanges && (
            <div className="mt-8 flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-8 py-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed text-lg font-medium"
              >
                <Save className="w-6 h-6" />
                {saving ? 'Sauvegarde en cours...' : 'Sauvegarder toutes les modifications'}
              </button>
            </div>
          )}
        </main>
      </div>
    </AdminLayout>
  )
}
