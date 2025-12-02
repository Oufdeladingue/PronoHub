'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AdminLayout from '@/components/AdminLayout'
import { msToMinutes, minutesToMs, formatTimeUntilRefresh } from '@/lib/auto-refresh-utils'

interface Settings {
  auto_refresh_enabled: string
  auto_refresh_interval: string
  auto_refresh_smart_mode: string
  auto_refresh_pause_inactive: string
  points_exact_score: string
  points_correct_result: string
  points_incorrect_result: string
}

export default function AdminSettingsPage() {
  const router = useRouter()
  const [settings, setSettings] = useState<Settings>({
    auto_refresh_enabled: 'true',
    auto_refresh_interval: '300000',
    auto_refresh_smart_mode: 'true',
    auto_refresh_pause_inactive: 'true',
    points_exact_score: '3',
    points_correct_result: '1',
    points_incorrect_result: '0'
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Charger les paramètres
  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/settings')
      if (!response.ok) throw new Error('Erreur lors du chargement des paramètres')

      const data = await response.json()
      if (data.success && data.settings) {
        setSettings({
          auto_refresh_enabled: data.settings.auto_refresh_enabled ?? 'true',
          auto_refresh_interval: data.settings.auto_refresh_interval ?? '300000',
          auto_refresh_smart_mode: data.settings.auto_refresh_smart_mode ?? 'true',
          auto_refresh_pause_inactive: data.settings.auto_refresh_pause_inactive ?? 'true',
          points_exact_score: data.settings.points_exact_score ?? '3',
          points_correct_result: data.settings.points_correct_result ?? '1',
          points_incorrect_result: data.settings.points_incorrect_result ?? '0'
        })
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)
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

      setSuccess('Paramètres sauvegardés avec succès!')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const intervalMinutes = msToMinutes(parseInt(settings.auto_refresh_interval || '300000'))
  const intervalMs = parseInt(settings.auto_refresh_interval || '300000')

  if (loading) {
    return (
      <AdminLayout currentPage="settings">
        <div className="min-h-screen bg-gray-50">
          <main className="max-w-7xl mx-auto px-4 py-8">
            <div className="text-center py-12 text-gray-500">
              Chargement des paramètres...
            </div>
          </main>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout currentPage="settings">
      <div className="min-h-screen bg-gray-50">

      <main className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Réglages</h1>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
            <strong>Erreur:</strong> {error}
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
            <strong>Succès:</strong> {success}
          </div>
        )}

        <div className="space-y-6">
          {/* Rafraîchissement automatique */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Rafraîchissement automatique des matchs
            </h2>

            <div className="space-y-6">
              {/* Activer/Désactiver */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <label className="text-sm font-medium text-gray-900 block mb-1">
                    Activer le rafraîchissement automatique
                  </label>
                  <p className="text-xs text-gray-500">
                    Les résultats des matchs seront actualisés automatiquement
                  </p>
                </div>
                <button
                  onClick={() => setSettings(prev => ({
                    ...prev,
                    auto_refresh_enabled: prev.auto_refresh_enabled === 'true' ? 'false' : 'true'
                  }))}
                  className={`relative inline-flex h-8 w-16 items-center rounded-full transition ${
                    settings.auto_refresh_enabled === 'true' ? 'bg-green-600' : 'bg-red-600'
                  }`}
                >
                  <span
                    className={`inline-block h-6 w-6 transform rounded-full bg-white transition flex items-center justify-center text-xs font-bold ${
                      settings.auto_refresh_enabled === 'true'
                        ? 'translate-x-9 text-green-600'
                        : 'translate-x-1 text-red-600'
                    }`}
                  >
                    {settings.auto_refresh_enabled === 'true' ? '✓' : '✗'}
                  </span>
                </button>
              </div>

              {/* Intervalle */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Intervalle de rafraîchissement: {intervalMinutes} minute{intervalMinutes > 1 ? 's' : ''}
                </label>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-600">1 min</span>
                  <input
                    type="range"
                    min="60000"
                    max="1800000"
                    step="60000"
                    value={intervalMs}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      auto_refresh_interval: e.target.value
                    }))}
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                    disabled={settings.auto_refresh_enabled === 'false'}
                  />
                  <span className="text-sm text-gray-600">30 min</span>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Temps entre chaque actualisation automatique
                </p>
              </div>

              {/* Mode intelligent */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <label className="text-sm font-medium text-gray-900 block mb-1">
                    Mode intelligent
                  </label>
                  <p className="text-xs text-gray-500">
                    Rafraîchit plus souvent pendant les matchs en cours
                  </p>
                </div>
                <button
                  onClick={() => setSettings(prev => ({
                    ...prev,
                    auto_refresh_smart_mode: prev.auto_refresh_smart_mode === 'true' ? 'false' : 'true'
                  }))}
                  disabled={settings.auto_refresh_enabled === 'false'}
                  className={`relative inline-flex h-8 w-16 items-center rounded-full transition ${
                    settings.auto_refresh_smart_mode === 'true' ? 'bg-green-600' : 'bg-gray-400'
                  } ${settings.auto_refresh_enabled === 'false' ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span
                    className={`inline-block h-6 w-6 transform rounded-full bg-white transition flex items-center justify-center text-xs font-bold ${
                      settings.auto_refresh_smart_mode === 'true'
                        ? 'translate-x-9 text-green-600'
                        : 'translate-x-1 text-gray-600'
                    }`}
                  >
                    {settings.auto_refresh_smart_mode === 'true' ? '✓' : '✗'}
                  </span>
                </button>
              </div>

              {/* Pause quand inactif */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <label className="text-sm font-medium text-gray-900 block mb-1">
                    Pause quand l'onglet est inactif
                  </label>
                  <p className="text-xs text-gray-500">
                    Économise les ressources quand vous n'êtes pas sur la page
                  </p>
                </div>
                <button
                  onClick={() => setSettings(prev => ({
                    ...prev,
                    auto_refresh_pause_inactive: prev.auto_refresh_pause_inactive === 'true' ? 'false' : 'true'
                  }))}
                  disabled={settings.auto_refresh_enabled === 'false'}
                  className={`relative inline-flex h-8 w-16 items-center rounded-full transition ${
                    settings.auto_refresh_pause_inactive === 'true' ? 'bg-green-600' : 'bg-gray-400'
                  } ${settings.auto_refresh_enabled === 'false' ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span
                    className={`inline-block h-6 w-6 transform rounded-full bg-white transition flex items-center justify-center text-xs font-bold ${
                      settings.auto_refresh_pause_inactive === 'true'
                        ? 'translate-x-9 text-green-600'
                        : 'translate-x-1 text-gray-600'
                    }`}
                  >
                    {settings.auto_refresh_pause_inactive === 'true' ? '✓' : '✗'}
                  </span>
                </button>
              </div>

              {/* Aperçu */}
              {settings.auto_refresh_enabled === 'true' && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-900">
                    <strong>Aperçu:</strong> Les matchs seront actualisés automatiquement toutes les{' '}
                    <strong>{intervalMinutes} minute{intervalMinutes > 1 ? 's' : ''}</strong>
                    {settings.auto_refresh_smart_mode === 'true' && (
                      <> (plus souvent pendant les matchs en cours)</>
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>

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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900"
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

          {/* Paramètres des tournois (points par defaut) */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Systeme de points par defaut</h2>
            <p className="text-sm text-gray-500 mb-4">
              Ces valeurs sont utilisees comme valeurs par defaut lors de la creation d'un tournoi.
              Chaque tournoi peut avoir ses propres reglages.
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
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {saving ? 'Sauvegarde en cours...' : 'Sauvegarder les réglages'}
          </button>
        </div>
      </main>
      </div>
    </AdminLayout>
  )
}
