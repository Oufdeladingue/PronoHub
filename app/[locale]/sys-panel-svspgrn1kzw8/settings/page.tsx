'use client'

import { useState, useEffect, useMemo } from 'react'
import AdminLayout from '@/components/AdminLayout'
import { Euro, Save, AlertCircle, CheckCircle, Users, Calendar, Zap, Crown, Globe, Search } from 'lucide-react'
import { COUNTRIES, DEFAULT_ALLOWED_COUNTRIES } from '@/lib/countries'

// ============= INTERFACES =============

interface Settings {
  points_exact_score: string
  points_correct_result: string
  points_incorrect_result: string
}

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

type TabType = 'configuration' | 'tarifs' | 'pays'

const categoryLabels: Record<string, { title: string, description: string, icon: React.ReactNode }> = {
  tournament_creation: {
    title: 'Prix de création des tournois',
    description: 'Prix pour créer un nouveau tournoi selon le type',
    icon: <Crown className="w-5 h-5 text-yellow-500" />
  },
  extensions: {
    title: 'Extensions Free-Kick',
    description: 'Prix des extensions pour les tournois gratuits',
    icon: <Zap className="w-5 h-5 text-blue-500" />
  },
  limits: {
    title: 'Limites des tournois',
    description: 'Configuration des limites de joueurs et journées',
    icon: <Users className="w-5 h-5 text-green-500" />
  },
  platinium: {
    title: 'Options Platinium',
    description: 'Configuration spécifique au mode Platinium',
    icon: <Calendar className="w-5 h-5 text-purple-500" />
  }
}

// ============= COMPOSANT PRINCIPAL =============

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('configuration')

  // ===== ÉTATS CONFIGURATION =====
  const [settings, setSettings] = useState<Settings>({
    points_exact_score: '3',
    points_correct_result: '1',
    points_incorrect_result: '0'
  })
  const [configLoading, setConfigLoading] = useState(true)
  const [configSaving, setConfigSaving] = useState(false)
  const [configError, setConfigError] = useState<string | null>(null)
  const [configSuccess, setConfigSuccess] = useState<string | null>(null)

  // ===== ÉTATS TARIFS =====
  const [pricing, setPricing] = useState<PricingItem[]>([])
  const [grouped, setGrouped] = useState<GroupedPricing | null>(null)
  const [pricingLoading, setPricingLoading] = useState(true)
  const [pricingSaving, setPricingSaving] = useState(false)
  const [pricingError, setPricingError] = useState<string | null>(null)
  const [pricingSuccess, setPricingSuccess] = useState<string | null>(null)
  const [pricingChanges, setPricingChanges] = useState<Record<string, number>>({})

  // ===== ÉTATS PAYS =====
  const [allowedCountries, setAllowedCountries] = useState<Set<string>>(new Set(DEFAULT_ALLOWED_COUNTRIES))
  const [initialCountries, setInitialCountries] = useState<Set<string>>(new Set(DEFAULT_ALLOWED_COUNTRIES))
  const [countriesLoading, setCountriesLoading] = useState(true)
  const [countriesSaving, setCountriesSaving] = useState(false)
  const [countriesError, setCountriesError] = useState<string | null>(null)
  const [countriesSuccess, setCountriesSuccess] = useState<string | null>(null)
  const [countrySearch, setCountrySearch] = useState('')

  // ===== FONCTIONS CONFIGURATION =====

  const fetchSettings = async () => {
    setConfigLoading(true)
    setConfigError(null)
    try {
      const response = await fetch('/api/admin/settings')
      if (!response.ok) throw new Error('Erreur lors du chargement des paramètres')

      const data = await response.json()
      if (data.success && data.settings) {
        setSettings({
          points_exact_score: data.settings.points_exact_score ?? '3',
          points_correct_result: data.settings.points_correct_result ?? '1',
          points_incorrect_result: data.settings.points_incorrect_result ?? '0'
        })
      }
    } catch (err: any) {
      setConfigError(err.message)
    } finally {
      setConfigLoading(false)
    }
  }

  const handleSaveConfig = async () => {
    setConfigSaving(true)
    setConfigError(null)
    setConfigSuccess(null)
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings })
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Erreur lors de la sauvegarde')
      }

      setConfigSuccess('Paramètres sauvegardés avec succès!')
      setTimeout(() => setConfigSuccess(null), 3000)
    } catch (err: any) {
      setConfigError(err.message)
    } finally {
      setConfigSaving(false)
    }
  }

  // ===== FONCTIONS TARIFS =====

  const fetchPricing = async () => {
    setPricingLoading(true)
    setPricingError(null)
    try {
      const response = await fetch('/api/admin/pricing')
      if (!response.ok) throw new Error('Erreur lors du chargement des prix')

      const data = await response.json()
      if (data.success) {
        setPricing(data.pricing || [])
        setGrouped(data.grouped || null)
      }
    } catch (err: any) {
      setPricingError(err.message)
    } finally {
      setPricingLoading(false)
    }
  }

  const handleValueChange = (configKey: string, value: string) => {
    const numValue = parseFloat(value)
    if (!isNaN(numValue)) {
      setPricingChanges(prev => ({
        ...prev,
        [configKey]: numValue
      }))
    }
  }

  const getCurrentValue = (item: PricingItem) => {
    if (pricingChanges[item.config_key] !== undefined) {
      return pricingChanges[item.config_key]
    }
    return item.config_value
  }

  const hasPricingChanges = Object.keys(pricingChanges).length > 0

  const handleSavePricing = async () => {
    if (!hasPricingChanges) return

    setPricingSaving(true)
    setPricingError(null)
    setPricingSuccess(null)

    try {
      const updates = Object.entries(pricingChanges).map(([config_key, config_value]) => ({
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

      setPricingSuccess('Prix mis à jour avec succès!')
      setPricingChanges({})
      await fetchPricing()
      setTimeout(() => setPricingSuccess(null), 3000)
    } catch (err: any) {
      setPricingError(err.message)
    } finally {
      setPricingSaving(false)
    }
  }

  // ===== FONCTIONS PAYS =====

  const fetchCountries = async () => {
    setCountriesLoading(true)
    setCountriesError(null)
    try {
      const response = await fetch('/api/admin/settings')
      if (!response.ok) throw new Error('Erreur lors du chargement')

      const data = await response.json()
      if (data.success && data.settings?.allowed_countries) {
        try {
          const codes: string[] = JSON.parse(data.settings.allowed_countries)
          setAllowedCountries(new Set(codes))
          setInitialCountries(new Set(codes))
        } catch {
          setAllowedCountries(new Set(DEFAULT_ALLOWED_COUNTRIES))
          setInitialCountries(new Set(DEFAULT_ALLOWED_COUNTRIES))
        }
      } else {
        // Pas encore de config → utiliser les défauts
        setAllowedCountries(new Set(DEFAULT_ALLOWED_COUNTRIES))
        setInitialCountries(new Set(DEFAULT_ALLOWED_COUNTRIES))
      }
    } catch (err: any) {
      setCountriesError(err.message)
    } finally {
      setCountriesLoading(false)
    }
  }

  const toggleCountry = (code: string) => {
    setAllowedCountries(prev => {
      const next = new Set(prev)
      if (next.has(code)) {
        next.delete(code)
      } else {
        next.add(code)
      }
      return next
    })
  }

  const selectAll = () => {
    setAllowedCountries(new Set(COUNTRIES.map(c => c.code)))
  }

  const deselectAll = () => {
    setAllowedCountries(new Set())
  }

  const handleSaveCountries = async () => {
    setCountriesSaving(true)
    setCountriesError(null)
    setCountriesSuccess(null)
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: {
            allowed_countries: JSON.stringify(Array.from(allowedCountries))
          }
        })
      })

      const data = await response.json()
      if (!data.success) throw new Error(data.error || 'Erreur lors de la sauvegarde')

      setInitialCountries(new Set(allowedCountries))
      setCountriesSuccess('Pays autorisés sauvegardés avec succès!')
      setTimeout(() => setCountriesSuccess(null), 3000)
    } catch (err: any) {
      setCountriesError(err.message)
    } finally {
      setCountriesSaving(false)
    }
  }

  const hasCountriesChanges = useMemo(() => {
    if (allowedCountries.size !== initialCountries.size) return true
    for (const code of allowedCountries) {
      if (!initialCountries.has(code)) return true
    }
    return false
  }, [allowedCountries, initialCountries])

  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return COUNTRIES
    const q = countrySearch.toLowerCase()
    return COUNTRIES.filter(c =>
      c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    )
  }, [countrySearch])

  const renderPricingInput = (item: PricingItem) => {
    const value = getCurrentValue(item)
    const isModified = pricingChanges[item.config_key] !== undefined

    return (
      <div key={item.config_key} className="bg-gray-50 p-4 rounded-lg">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-900 mb-1">
              {item.label}
              {isModified && (
                <span className="ml-2 text-xs text-orange-500 font-normal">(modifié)</span>
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

  // ===== EFFETS =====

  useEffect(() => {
    if (activeTab === 'configuration') {
      fetchSettings()
    } else if (activeTab === 'tarifs') {
      fetchPricing()
    } else if (activeTab === 'pays') {
      fetchCountries()
    }
  }, [activeTab])

  // ===== RENDU =====

  return (
    <AdminLayout currentPage="settings">
      <div className="min-h-screen bg-gray-50">
        <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Réglages</h1>
            <p className="text-gray-600">Configuration de l'application et gestion des tarifs</p>
          </div>

          {/* Sous-onglets */}
          <div className="flex gap-2 mb-6 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('configuration')}
              className={`px-6 py-3 font-medium text-sm transition-colors relative ${
                activeTab === 'configuration'
                  ? 'text-purple-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Configuration
              {activeTab === 'configuration' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('tarifs')}
              className={`px-6 py-3 font-medium text-sm transition-colors relative ${
                activeTab === 'tarifs'
                  ? 'text-purple-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Tarifs
              {activeTab === 'tarifs' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('pays')}
              className={`px-6 py-3 font-medium text-sm transition-colors relative ${
                activeTab === 'pays'
                  ? 'text-purple-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Pays couverts
              {activeTab === 'pays' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600" />
              )}
            </button>
          </div>

          {/* ===== ONGLET CONFIGURATION ===== */}
          {activeTab === 'configuration' && (
            <>
              {configError && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
                  <strong>Erreur:</strong> {configError}
                </div>
              )}

              {configSuccess && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
                  <strong>Succès:</strong> {configSuccess}
                </div>
              )}

              {configLoading ? (
                <div className="text-center py-12 text-gray-500">
                  Chargement des paramètres...
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Configuration API */}
                  <div className="bg-white p-6 rounded-lg shadow">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Configuration API</h2>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Clé API Football-Data
                        </label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 bg-gray-50"
                          placeholder="Votre clé API"
                          defaultValue={process.env.NEXT_PUBLIC_FOOTBALL_DATA_API_KEY || ''}
                          disabled
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          Configurée via les variables d'environnement (.env.local)
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Paramètres des tournois (points par défaut) */}
                  <div className="bg-white p-6 rounded-lg shadow">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Système de points par défaut</h2>
                    <p className="text-sm text-gray-500 mb-4">
                      Ces valeurs sont utilisées comme valeurs par défaut lors de la création d'un tournoi.
                      Chaque tournoi peut avoir ses propres réglages.
                    </p>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Points pour score exact
                        </label>
                        <input
                          type="number"
                          value={settings.points_exact_score}
                          onChange={(e) => setSettings(prev => ({
                            ...prev,
                            points_exact_score: e.target.value
                          }))}
                          min="0"
                          max="20"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Points pour bon résultat
                        </label>
                        <input
                          type="number"
                          value={settings.points_correct_result}
                          onChange={(e) => setSettings(prev => ({
                            ...prev,
                            points_correct_result: e.target.value
                          }))}
                          min="0"
                          max="20"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Points pour mauvais résultat
                        </label>
                        <input
                          type="number"
                          value={settings.points_incorrect_result}
                          onChange={(e) => setSettings(prev => ({
                            ...prev,
                            points_incorrect_result: e.target.value
                          }))}
                          min="0"
                          max="20"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleSaveConfig}
                    disabled={configSaving}
                    className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {configSaving ? 'Sauvegarde en cours...' : 'Sauvegarder les réglages'}
                  </button>
                </div>
              )}
            </>
          )}

          {/* ===== ONGLET TARIFS ===== */}
          {activeTab === 'tarifs' && (
            <>
              {pricingError && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-800">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span><strong>Erreur:</strong> {pricingError}</span>
                </div>
              )}

              {pricingSuccess && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3 text-green-800">
                  <CheckCircle className="w-5 h-5 flex-shrink-0" />
                  <span>{pricingSuccess}</span>
                </div>
              )}

              {hasPricingChanges && (
                <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg flex items-center gap-3 text-orange-800">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span>Vous avez {Object.keys(pricingChanges).length} modification(s) non sauvegardée(s)</span>
                </div>
              )}

              {pricingLoading ? (
                <div className="text-center py-12 text-gray-500">
                  Chargement des tarifs...
                </div>
              ) : (
                <>
                  {/* Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <Euro className="w-8 h-8 text-purple-600" />
                      <div>
                        <h2 className="text-xl font-bold text-gray-900">Gestion des Tarifs</h2>
                        <p className="text-gray-500 text-sm">Configurez les prix et limites des offres</p>
                      </div>
                    </div>
                    {hasPricingChanges && (
                      <button
                        onClick={handleSavePricing}
                        disabled={pricingSaving}
                        className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                      >
                        <Save className="w-5 h-5" />
                        {pricingSaving ? 'Sauvegarde...' : 'Sauvegarder les modifications'}
                      </button>
                    )}
                  </div>

                  {/* Catégories de prix */}
                  <div className="space-y-8">
                    {grouped && Object.entries(grouped).map(([category, items]) => {
                      const categoryInfo = categoryLabels[category]
                      if (!items || items.length === 0) return null

                      return (
                        <div key={category} className="bg-white rounded-lg shadow overflow-hidden">
                          {/* Header de catégorie */}
                          <div className="bg-gray-100 px-6 py-4 border-b border-gray-200">
                            <div className="flex items-center gap-3">
                              {categoryInfo?.icon}
                              <div>
                                <h3 className="text-lg font-semibold text-gray-900">
                                  {categoryInfo?.title || category}
                                </h3>
                                <p className="text-sm text-gray-500">
                                  {categoryInfo?.description}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Liste des prix */}
                          <div className="p-6">
                            <div className="space-y-4">
                              {items.map((item: PricingItem) => renderPricingInput(item))}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Aperçu du prix groupe Platinium */}
                  {grouped?.tournament_creation && grouped?.platinium && (
                    <div className="mt-8 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-yellow-800 mb-2">Aperçu: Prix Groupe Platinium</h3>
                      <p className="text-sm text-yellow-700">
                        Avec les paramètres actuels, le prix du pack groupe sera de:{' '}
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
                  {hasPricingChanges && (
                    <div className="mt-8 flex justify-end">
                      <button
                        onClick={handleSavePricing}
                        disabled={pricingSaving}
                        className="flex items-center gap-2 px-8 py-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed text-lg font-medium"
                      >
                        <Save className="w-6 h-6" />
                        {pricingSaving ? 'Sauvegarde en cours...' : 'Sauvegarder toutes les modifications'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* ===== ONGLET PAYS COUVERTS ===== */}
          {activeTab === 'pays' && (
            <>
              {countriesError && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-800">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span><strong>Erreur:</strong> {countriesError}</span>
                </div>
              )}

              {countriesSuccess && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3 text-green-800">
                  <CheckCircle className="w-5 h-5 flex-shrink-0" />
                  <span>{countriesSuccess}</span>
                </div>
              )}

              {countriesLoading ? (
                <div className="text-center py-12 text-gray-500">
                  Chargement des pays...
                </div>
              ) : (
                <>
                  {/* Header */}
                  <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                      <Globe className="w-8 h-8 text-purple-600" />
                      <div>
                        <h2 className="text-xl font-bold text-gray-900">Pays couverts</h2>
                        <p className="text-gray-500 text-sm">
                          {allowedCountries.size} pays autorisé{allowedCountries.size > 1 ? 's' : ''} sur {COUNTRIES.length}
                          {hasCountriesChanges && (
                            <span className="ml-2 text-orange-500 font-medium">(modifié)</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleSaveCountries}
                      disabled={countriesSaving || !hasCountriesChanges}
                      className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      <Save className="w-5 h-5" />
                      {countriesSaving ? 'Sauvegarde...' : 'Sauvegarder'}
                    </button>
                  </div>

                  {/* Barre de recherche + actions */}
                  <div className="bg-white rounded-lg shadow p-4 mb-6">
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          value={countrySearch}
                          onChange={(e) => setCountrySearch(e.target.value)}
                          placeholder="Rechercher un pays..."
                          className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={selectAll}
                          className="px-4 py-2 text-sm text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-50 transition"
                        >
                          Tout cocher
                        </button>
                        <button
                          type="button"
                          onClick={deselectAll}
                          className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                        >
                          Tout décocher
                        </button>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-gray-500">
                      Seuls les utilisateurs dont l'adresse IP correspond à un pays coché pourront s'inscrire. Les utilisateurs existants ne sont pas affectés.
                    </p>
                  </div>

                  {/* Grille des pays */}
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                      {filteredCountries.map(country => (
                        <label
                          key={country.code}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition ${
                            allowedCountries.has(country.code)
                              ? 'bg-purple-50 border border-purple-200'
                              : 'bg-gray-50 border border-gray-100 hover:bg-gray-100'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={allowedCountries.has(country.code)}
                            onChange={() => toggleCountry(country.code)}
                            className="w-4 h-4 text-purple-600 rounded"
                          />
                          <span className="text-lg leading-none">{country.flag}</span>
                          <span className={`text-sm ${
                            allowedCountries.has(country.code) ? 'text-purple-900 font-medium' : 'text-gray-700'
                          }`}>
                            {country.name}
                          </span>
                          <span className="text-xs text-gray-400 ml-auto">{country.code}</span>
                        </label>
                      ))}
                    </div>

                    {filteredCountries.length === 0 && (
                      <p className="text-center text-gray-500 py-8">
                        Aucun pays ne correspond à "{countrySearch}"
                      </p>
                    )}
                  </div>

                  {/* Bouton de sauvegarde en bas */}
                  {hasCountriesChanges && (
                    <div className="mt-8 flex justify-end">
                      <button
                        onClick={handleSaveCountries}
                        disabled={countriesSaving}
                        className="flex items-center gap-2 px-8 py-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed text-lg font-medium"
                      >
                        <Save className="w-6 h-6" />
                        {countriesSaving ? 'Sauvegarde en cours...' : 'Sauvegarder les pays autorisés'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </main>
      </div>
    </AdminLayout>
  )
}
