'use client'

import { useState, useEffect } from 'react'
import AdminLayout from '@/components/AdminLayout'

// Helper pour formater une date au format jj/mm/aa
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit'
  })
}

interface Competition {
  id: number
  name: string
  code: string
  emblem: string | null
  area: string
  currentSeason: {
    startDate: string
    endDate: string
    currentMatchday: number
    totalMatchdays?: number
  }
  isImported: boolean
  isActive: boolean
  isEvent: boolean
  importedAt?: string
  lastUpdatedAt?: string
}

type TabType = 'active' | 'finished' | 'available' | 'update-settings'

// Interface pour le système de MAJ intelligent
interface SmartCronSettings {
  // Sync quotidienne
  dailySyncEnabled: boolean
  dailySyncHour: string
  delayBetweenCompetitions: number

  // Mode temps réel
  realtimeEnabled: boolean
  smartModeEnabled: boolean
  realtimeFrequency: number
  marginBeforeKickoff: number
  marginAfterMatch: number

  // Mode fallback
  fallbackInterval: number
  fallbackTimeStart: string
  fallbackTimeEnd: string

  // Quotas API
  minDelayBetweenCalls: number
}

const defaultSmartSettings: SmartCronSettings = {
  dailySyncEnabled: true,
  dailySyncHour: '06:00',
  delayBetweenCompetitions: 5,
  realtimeEnabled: false,
  smartModeEnabled: true,
  realtimeFrequency: 2,
  marginBeforeKickoff: 5,
  marginAfterMatch: 30,
  fallbackInterval: 15,
  fallbackTimeStart: '14:00',
  fallbackTimeEnd: '23:59',
  minDelayBetweenCalls: 6
}

export default function AdminDataPage() {
  const [activeTab, setActiveTab] = useState<TabType>('active')
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [availableCompetitions, setAvailableCompetitions] = useState<Competition[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingAvailable, setLoadingAvailable] = useState(false)
  const [importing, setImporting] = useState<number | null>(null)
  const [toggling, setToggling] = useState<number | null>(null)
  const [togglingEvent, setTogglingEvent] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Aperçu des nouvelles saisons dispo à la source (1 appel football-data) : { [id]: {...} }
  const [renewalMap, setRenewalMap] = useState<Record<number, { hasNewSeason: boolean; sourceStart: string | null; sourceEnd: string | null }>>({})

  // État pour les réglages de MAJ auto (système intelligent)
  const [smartSettings, setSmartSettings] = useState<SmartCronSettings>(defaultSmartSettings)
  const [loadingSettings, setLoadingSettings] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [testingCron, setTestingCron] = useState(false)
  const [generatingWindows, setGeneratingWindows] = useState(false)
  const [pgCronConfigured, setPgCronConfigured] = useState(true)
  const [cronLogs, setCronLogs] = useState<any[]>([])
  const [matchWindows, setMatchWindows] = useState<any[]>([])
  const [apiCallsToday, setApiCallsToday] = useState(0)
  const [lastRun, setLastRun] = useState<string | null>(null)
  const [cronStatus, setCronStatus] = useState<any>(null)
  const [lastUpdateResults, setLastUpdateResults] = useState<any[] | null>(null)

  // État pour les stats API
  const [apiStats, setApiStats] = useState<any>(null)
  const [loadingApiStats, setLoadingApiStats] = useState(false)

  // Charger uniquement les compétitions déjà importées (depuis la base locale)
  const fetchImportedCompetitions = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/football/imported-competitions')
      if (!response.ok) throw new Error('Failed to fetch imported competitions')
      const data = await response.json()
      setCompetitions(data.competitions || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Actualiser la liste complète depuis Football-Data API (pour l'onglet "Autres compétitions")
  const fetchAvailableCompetitions = async () => {
    setLoadingAvailable(true)
    setError(null)
    try {
      const response = await fetch('/api/football/competitions')
      if (!response.ok) throw new Error('Failed to fetch all competitions')
      const data = await response.json()
      // Filtrer pour ne garder que celles qui ne sont pas déjà importées
      const importedIds = new Set(competitions.map(c => c.id))
      const notImported = (data.competitions || []).filter((c: Competition) => !c.isImported)
      setAvailableCompetitions(notImported)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoadingAvailable(false)
    }
  }

  const importCompetition = async (competitionId: number) => {
    setError(null)
    setSuccess(null)

    // 1) Vérifier la saison disponible à la source AVANT d'importer (évite de ré-importer
    //    bêtement une saison déjà terminée si la nouvelle n'est pas encore publiée)
    let confirmMsg = 'Lancer l\'import de cette compétition ?'
    try {
      const sres = await fetch(`/api/football/season-status?competitionId=${competitionId}`)
      const s = await sres.json()
      if (sres.ok) {
        if (s.neverImported) {
          confirmMsg = `Importer la saison ${s.sourceStart || '?'} → ${s.sourceEnd || '?'} ?`
        } else if (s.hasNewSeason) {
          confirmMsg = `✅ Nouvelle saison disponible : ${s.sourceStart} → ${s.sourceEnd}\n(saison actuellement importée : ${s.importedStart} → ${s.importedEnd})\n\nImporter la nouvelle saison maintenant ?`
        } else {
          confirmMsg = `⚠️ AUCUNE nouvelle saison sur football-data.\nLa saison courante à la source (${s.sourceStart} → ${s.sourceEnd}) est déjà celle qui est importée.\n\nRé-importer quand même (simple rafraîchissement) ?`
        }
      } else {
        confirmMsg = `Impossible de vérifier la saison à la source (${s.error || 'erreur'}).\nImporter quand même ?`
      }
    } catch {
      confirmMsg = 'Impossible de vérifier la saison à la source.\nImporter quand même ?'
    }
    if (!confirm(confirmMsg)) return

    // 2) Import effectif
    setImporting(competitionId)
    try {
      const response = await fetch('/api/football/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competitionId }),
      })

      if (!response.ok) throw new Error('Failed to import competition')

      const data = await response.json()
      setSuccess(`${data.competition} importée avec succès (${data.matchesCount} matchs)`)

      // Refresh les listes
      await fetchImportedCompetitions()
      // Retirer de la liste des disponibles
      setAvailableCompetitions(prev => prev.filter(c => c.id !== competitionId))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setImporting(null)
    }
  }

  const toggleActive = async (competitionId: number, currentStatus: boolean) => {
    setToggling(competitionId)
    setError(null)
    setSuccess(null)
    try {
      const response = await fetch('/api/football/toggle-active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          competitionId,
          isActive: !currentStatus
        }),
      })

      if (!response.ok) throw new Error('Failed to toggle competition status')

      const data = await response.json()
      setSuccess(data.message)
      await fetchImportedCompetitions()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setToggling(null)
    }
  }

  const toggleEvent = async (competitionId: number, currentStatus: boolean) => {
    setTogglingEvent(competitionId)
    setError(null)
    setSuccess(null)
    try {
      const response = await fetch('/api/football/toggle-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          competitionId,
          isEvent: !currentStatus
        }),
      })

      if (!response.ok) throw new Error('Failed to toggle event status')

      const data = await response.json()
      setSuccess(data.message)
      await fetchImportedCompetitions()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setTogglingEvent(null)
    }
  }

  // Charger les paramètres du système intelligent
  const fetchSmartSettings = async () => {
    setLoadingSettings(true)
    try {
      const response = await fetch('/api/admin/smart-cron')
      if (response.ok) {
        const data = await response.json()
        setPgCronConfigured(data.configured !== false)
        if (data.settings) {
          setSmartSettings(data.settings)
        }
        if (data.cronStatus) {
          setCronStatus(data.cronStatus)
        }
        if (data.logs) {
          setCronLogs(data.logs)
        }
        if (data.matchWindows) {
          setMatchWindows(data.matchWindows)
        }
        setApiCallsToday(data.apiCallsToday || 0)
        setLastRun(data.lastRun || null)
      }
    } catch (err: any) {
      console.error('Error fetching smart settings:', err)
    } finally {
      setLoadingSettings(false)
    }
  }

  // Sauvegarder les paramètres du système intelligent
  const saveSmartSettings = async () => {
    setSavingSettings(true)
    setError(null)
    setSuccess(null)
    try {
      const response = await fetch('/api/admin/smart-cron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: smartSettings }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.configured === false) {
          setPgCronConfigured(false)
        }
        throw new Error(data.error || 'Failed to save settings')
      }

      setSuccess(data.message || 'Paramètres sauvegardés avec succès')
      setPgCronConfigured(data.configured !== false)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSavingSettings(false)
    }
  }

  // Charger les stats API
  const fetchApiStats = async () => {
    setLoadingApiStats(true)
    try {
      const response = await fetch('/api/admin/api-stats')
      if (response.ok) {
        const data = await response.json()
        setApiStats(data.stats)
      }
    } catch (err: any) {
      console.error('Error fetching API stats:', err)
    } finally {
      setLoadingApiStats(false)
    }
  }

  // Générer les fenêtres de matchs
  const generateMatchWindows = async () => {
    setGeneratingWindows(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/smart-cron', {
        method: 'PUT',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate windows')
      }

      setSuccess(data.message || 'Fenêtres générées')
      await fetchSmartSettings()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setGeneratingWindows(false)
    }
  }

  // Exécuter une MAJ manuelle
  const runManualUpdate = async (type: 'realtime' | 'full' = 'realtime') => {
    setTestingCron(true)
    setError(null)
    setSuccess(null)
    setLastUpdateResults(null)
    try {
      const response = await fetch(`/api/admin/smart-cron?type=${type}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) throw new Error(data.error || 'Failed to run manual update')

      const result = data.result || {}

      // Stocker les résultats détaillés
      if (result.results) {
        setLastUpdateResults(result.results)
      }

      const totalUpdated = result.successCount || result.totalMatches || 0
      const failedCount = result.failureCount || 0
      const updateType = type === 'realtime' ? 'Temps réel' : 'Complète'

      if (failedCount > 0) {
        setSuccess(`${updateType} : ${totalUpdated} OK, ${failedCount} erreurs (voir détails ci-dessous)`)
      } else if (totalUpdated === 0) {
        setSuccess(`${updateType} : Aucune mise à jour nécessaire`)
      } else {
        setSuccess(`${updateType} : ${totalUpdated} ${type === 'realtime' ? 'matchs' : 'compétitions'} mis à jour`)
      }
      await fetchSmartSettings()
      await fetchApiStats() // Rafraîchir les stats API
      // Rafraîchir la liste des compétitions pour mettre à jour les dates
      if (type === 'full') {
        await fetchImportedCompetitions()
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setTestingCron(false)
    }
  }

  // Aperçu des nouvelles saisons dispo à la source (1 appel football-data)
  const fetchSeasonsOverview = async () => {
    try {
      const res = await fetch('/api/football/seasons-overview')
      if (!res.ok) return
      const data = await res.json()
      setRenewalMap(data.overview || {})
    } catch {
      // silencieux : l'absence d'aperçu ne bloque pas la page
    }
  }

  useEffect(() => {
    fetchImportedCompetitions()
    fetchSeasonsOverview()
  }, [])

  // Charger les paramètres de MAJ et stats API quand on passe à l'onglet
  useEffect(() => {
    if (activeTab === 'update-settings') {
      fetchSmartSettings()
      fetchApiStats()
      // Rafraîchir les stats toutes les 30 secondes
      const interval = setInterval(fetchApiStats, 30000)
      return () => clearInterval(interval)
    }
  }, [activeTab])

  // Charger les compétitions disponibles quand on passe à l'onglet
  useEffect(() => {
    if (activeTab === 'available' && availableCompetitions.length === 0) {
      fetchAvailableCompetitions()
    }
  }, [activeTab])

  // Séparer les compétitions actives des saisons terminées
  const today = new Date()
  const isSeasonFinished = (comp: Competition) =>
    comp.currentSeason?.endDate && new Date(comp.currentSeason.endDate) < today

  const activeCompetitions = competitions.filter(c => c.isActive && !isSeasonFinished(c))
  const finishedCompetitions = competitions.filter(c => c.isActive && isSeasonFinished(c))
  const inactiveCompetitions = competitions.filter(c => !c.isActive)

  return (
    <AdminLayout currentPage="data">
      <div className="min-h-screen bg-gray-50">
        <style jsx>{`
          .competitions-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 2rem;
          }
        `}</style>

        <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Gestion des Données</h1>
            <p className="text-gray-600">Gérez les compétitions Football-Data importées et disponibles</p>
          </div>

          {/* Sous-onglets */}
          <div className="flex gap-2 mb-6 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('active')}
              className={`px-6 py-3 font-medium text-sm transition-colors relative ${
                activeTab === 'active'
                  ? 'text-purple-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Compétitions activées
              {activeCompetitions.length > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">
                  {activeCompetitions.length}
                </span>
              )}
              {activeTab === 'active' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('finished')}
              className={`px-6 py-3 font-medium text-sm transition-colors relative ${
                activeTab === 'finished'
                  ? 'text-purple-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Saisons terminées
              {finishedCompetitions.length > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-orange-100 text-orange-700 rounded-full">
                  {finishedCompetitions.length}
                </span>
              )}
              {activeTab === 'finished' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('available')}
              className={`px-6 py-3 font-medium text-sm transition-colors relative ${
                activeTab === 'available'
                  ? 'text-purple-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Autres compétitions
              {activeTab === 'available' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('update-settings')}
              className={`px-6 py-3 font-medium text-sm transition-colors relative ${
                activeTab === 'update-settings'
                  ? 'text-purple-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Réglages des MAJ
              {(smartSettings.dailySyncEnabled || smartSettings.realtimeEnabled) && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">
                  Actif
                </span>
              )}
              {activeTab === 'update-settings' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600" />
              )}
            </button>
          </div>

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

          {/* Onglet Compétitions activées */}
          {activeTab === 'active' && (
            <div>
              {loading ? (
                <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500">
                  Chargement des compétitions...
                </div>
              ) : activeCompetitions.length === 0 && inactiveCompetitions.length === 0 ? (
                <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500">
                  <p className="mb-4">Aucune compétition importée</p>
                  <button
                    onClick={() => setActiveTab('available')}
                    className="btn-admin-primary"
                  >
                    Importer des compétitions
                  </button>
                </div>
              ) : (
                <>
                  {/* Compétitions actives */}
                  {activeCompetitions.length > 0 && (
                    <div className="mb-8">
                      <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                        Compétitions actives ({activeCompetitions.length})
                      </h2>
                      <div className="competitions-grid">
                        {activeCompetitions.map((comp) => (
                          <CompetitionCard
                            key={comp.id}
                            competition={comp}
                            importing={importing}
                            toggling={toggling}
                            togglingEvent={togglingEvent}
                            onImport={importCompetition}
                            onToggleActive={toggleActive}
                            onToggleEvent={toggleEvent}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Compétitions inactives (importées mais désactivées) */}
                  {inactiveCompetitions.length > 0 && (
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <span className="w-3 h-3 bg-gray-400 rounded-full"></span>
                        Compétitions désactivées ({inactiveCompetitions.length})
                      </h2>
                      <div className="competitions-grid">
                        {inactiveCompetitions.map((comp) => (
                          <CompetitionCard
                            key={comp.id}
                            competition={comp}
                            importing={importing}
                            toggling={toggling}
                            togglingEvent={togglingEvent}
                            onImport={importCompetition}
                            onToggleActive={toggleActive}
                            onToggleEvent={toggleEvent}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Onglet Saisons terminées */}
          {activeTab === 'finished' && (
            <div>
              {loading ? (
                <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500">
                  Chargement des compétitions...
                </div>
              ) : finishedCompetitions.length === 0 ? (
                <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500">
                  <p className="mb-2">Aucune saison terminée</p>
                  <p className="text-sm text-gray-400">
                    Les compétitions dont la date de fin de saison est passée apparaîtront ici.
                  </p>
                </div>
              ) : (
                <div>
                  <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                    <p className="text-sm text-orange-800">
                      <strong>Info :</strong> Ces compétitions ne sont plus mises à jour automatiquement car leur saison est terminée.
                      Elles restent visibles pour l'historique des tournois passés.
                    </p>
                  </div>
                  <div className="competitions-grid">
                    {finishedCompetitions.map((comp) => (
                      <CompetitionCard
                        key={comp.id}
                        competition={comp}
                        importing={importing}
                        toggling={toggling}
                        togglingEvent={togglingEvent}
                        onImport={importCompetition}
                        onToggleActive={toggleActive}
                        onToggleEvent={toggleEvent}
                        showRenewal
                        renewalStatus={renewalMap[comp.id]}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Onglet Autres compétitions */}
          {activeTab === 'available' && (
            <div>
              <div className="flex gap-3 mb-6">
                <button
                  onClick={fetchAvailableCompetitions}
                  disabled={loadingAvailable}
                  className="btn-admin-primary"
                >
                  {loadingAvailable ? 'Actualisation...' : 'Actualiser depuis Football-Data'}
                </button>
              </div>

              {loadingAvailable ? (
                <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500">
                  Chargement des compétitions disponibles...
                </div>
              ) : availableCompetitions.length === 0 ? (
                <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500">
                  <p>Toutes les compétitions disponibles ont déjà été importées.</p>
                  <p className="text-sm mt-2">Cliquez sur "Actualiser depuis Football-Data" pour mettre à jour la liste.</p>
                </div>
              ) : (
                <div className="competitions-grid">
                  {availableCompetitions.map((comp) => (
                    <div key={comp.id} className="admin-competition-card">
                      {/* Logo */}
                      <div className="w-[150px] h-[150px] flex items-center justify-center mb-4">
                        {comp.emblem ? (
                          <img
                            src={comp.emblem}
                            alt={comp.name}
                            className="max-w-full max-h-full object-contain"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                            }}
                          />
                        ) : (
                          <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center text-gray-400 text-sm">
                            N/A
                          </div>
                        )}
                      </div>

                      {/* Nom */}
                      <h3 className="text-lg font-bold text-gray-900 text-center mb-3 min-h-[3.5rem] flex items-center justify-center">
                        {comp.name}
                      </h3>

                      {/* ID, Code, Zone */}
                      <div className="text-xs text-gray-600 text-center mb-2 space-y-1">
                        <div>ID: {comp.id} | Code: {comp.code}</div>
                        <div>Zone: {comp.area}</div>
                      </div>

                      {/* Saison */}
                      {comp.currentSeason && (
                        <div className="text-xs text-gray-500 text-center mb-2">
                          Saison: {formatDate(comp.currentSeason.startDate)} → {formatDate(comp.currentSeason.endDate)}
                        </div>
                      )}

                      {/* Bouton d'import */}
                      <div className="w-full mt-auto">
                        <button
                          onClick={() => importCompetition(comp.id)}
                          disabled={importing === comp.id}
                          className="btn-admin-import w-full"
                        >
                          {importing === comp.id ? 'Import...' : 'Importer'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-900">
                  <strong>Note :</strong> L'import récupère toutes les informations de la compétition et
                  l'ensemble de ses matchs (passés, en cours et à venir). Les données sont mises en cache
                  localement pour éviter de consommer l'API inutilement.
                </p>
              </div>
            </div>
          )}

          {/* Onglet Réglages des MAJ */}
          {activeTab === 'update-settings' && (
            <div className="space-y-6">
              {loadingSettings ? (
                <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500">
                  Chargement des paramètres...
                </div>
              ) : (
                <>
                  {/* Avertissement si pg_cron non configuré */}
                  {!pgCronConfigured && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-900">
                        <strong>Configuration requise :</strong> pg_cron n'est pas encore configuré dans Supabase.
                        Exécutez les scripts SQL dans l'ordre :
                        <br />1. <code className="bg-red-100 px-1 rounded">20241209_pg_cron_setup.sql</code>
                        <br />2. <code className="bg-red-100 px-1 rounded">20241209_smart_cron_setup.sql</code>
                      </p>
                    </div>
                  )}

                  {/* Statut global et quotas */}
                  <div className="bg-white p-6 rounded-lg shadow">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900">Statut du système</h2>
                        <p className="text-sm text-gray-500">Aperçu des mises à jour automatiques</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-xs text-gray-500">Appels API aujourd'hui</p>
                          <p className="text-lg font-bold text-gray-900">{apiCallsToday} <span className="text-sm font-normal text-gray-500">/ ~1440</span></p>
                        </div>
                        <div className={`w-3 h-3 rounded-full ${(smartSettings.dailySyncEnabled || smartSettings.realtimeEnabled) ? 'bg-green-500' : 'bg-gray-400'}`} />
                      </div>
                    </div>
                    <div className="flex gap-6 text-sm">
                      <div>
                        <span className="text-gray-600 font-medium">Dernière MAJ :</span>
                        <span className="ml-2 font-semibold text-gray-900">{lastRun ? new Date(lastRun).toLocaleString('fr-FR') : 'Jamais'}</span>
                      </div>
                      <div>
                        <span className="text-gray-600 font-medium">Fenêtres actives :</span>
                        <span className="ml-2 font-semibold text-gray-900">{matchWindows.filter(w => new Date(w.window_start) <= new Date() && new Date(w.window_end) >= new Date()).length}</span>
                      </div>
                    </div>
                  </div>

                  {/* === SECTION 1: MAJ QUOTIDIENNE === */}
                  <div className="bg-white p-6 rounded-lg shadow">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-md font-semibold text-gray-900">MAJ Quotidienne (Calendrier)</h3>
                        <p className="text-sm text-gray-500">Synchronisation des horaires et nouveaux matchs</p>
                      </div>
                      <button
                        onClick={() => setSmartSettings(prev => ({ ...prev, dailySyncEnabled: !prev.dailySyncEnabled }))}
                        className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${
                          smartSettings.dailySyncEnabled ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                      >
                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                          smartSettings.dailySyncEnabled ? 'translate-x-8' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>

                    {smartSettings.dailySyncEnabled && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Heure d'exécution</label>
                          <input
                            type="time"
                            value={smartSettings.dailySyncHour}
                            onChange={(e) => setSmartSettings(prev => ({ ...prev, dailySyncHour: e.target.value }))}
                            className="admin-input"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Délai entre compétitions (sec)</label>
                          <input
                            type="number"
                            min="1"
                            max="30"
                            value={smartSettings.delayBetweenCompetitions}
                            onChange={(e) => setSmartSettings(prev => ({ ...prev, delayBetweenCompetitions: parseInt(e.target.value) || 5 }))}
                            className="admin-input"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* === SECTION 2: MAJ TEMPS RÉEL === */}
                  <div className="bg-white p-6 rounded-lg shadow">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-md font-semibold text-gray-900">MAJ en temps réel</h3>
                        <p className="text-sm text-gray-500">Mise à jour des scores pendant les matchs</p>
                      </div>
                      <button
                        onClick={() => setSmartSettings(prev => ({ ...prev, realtimeEnabled: !prev.realtimeEnabled }))}
                        className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${
                          smartSettings.realtimeEnabled ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                      >
                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                          smartSettings.realtimeEnabled ? 'translate-x-8' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>

                    {smartSettings.realtimeEnabled && (
                      <div className="space-y-4 pt-4 border-t border-gray-100">
                        {/* Mode intelligent */}
                        <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                          <div>
                            <span className="font-medium text-purple-900">Mode calendrier intelligent</span>
                            <p className="text-xs text-purple-700">N'actualise que pendant les fenêtres de matchs</p>
                          </div>
                          <button
                            onClick={() => setSmartSettings(prev => ({ ...prev, smartModeEnabled: !prev.smartModeEnabled }))}
                            className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors ${
                              smartSettings.smartModeEnabled ? 'bg-purple-600' : 'bg-gray-300'
                            }`}
                          >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                              smartSettings.smartModeEnabled ? 'translate-x-7' : 'translate-x-1'
                            }`} />
                          </button>
                        </div>

                        {smartSettings.smartModeEnabled ? (
                          /* Options mode intelligent */
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Fréquence pendant match (min)</label>
                              <input
                                type="number"
                                min="1"
                                max="15"
                                value={smartSettings.realtimeFrequency}
                                onChange={(e) => setSmartSettings(prev => ({ ...prev, realtimeFrequency: parseInt(e.target.value) || 2 }))}
                                className="admin-input"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Marge avant kickoff (min)</label>
                              <input
                                type="number"
                                min="0"
                                max="30"
                                value={smartSettings.marginBeforeKickoff}
                                onChange={(e) => setSmartSettings(prev => ({ ...prev, marginBeforeKickoff: parseInt(e.target.value) || 5 }))}
                                className="admin-input"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Marge après 90 min</label>
                              <input
                                type="number"
                                min="15"
                                max="60"
                                value={smartSettings.marginAfterMatch}
                                onChange={(e) => setSmartSettings(prev => ({ ...prev, marginAfterMatch: parseInt(e.target.value) || 30 }))}
                                className="admin-input"
                              />
                            </div>
                          </div>
                        ) : (
                          /* Options mode fallback */
                          <div className="space-y-4">
                            <div className="p-3 bg-amber-50 rounded-lg">
                              <p className="text-sm text-amber-800">
                                <strong>Mode fallback :</strong> MAJ à intervalle fixe, sans tenir compte du calendrier des matchs.
                              </p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Intervalle (minutes)</label>
                                <input
                                  type="number"
                                  min="5"
                                  max="60"
                                  value={smartSettings.fallbackInterval}
                                  onChange={(e) => setSmartSettings(prev => ({ ...prev, fallbackInterval: parseInt(e.target.value) || 15 }))}
                                  className="admin-input"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Plage horaire début</label>
                                <input
                                  type="time"
                                  value={smartSettings.fallbackTimeStart}
                                  onChange={(e) => setSmartSettings(prev => ({ ...prev, fallbackTimeStart: e.target.value }))}
                                  className="admin-input"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Plage horaire fin</label>
                                <input
                                  type="time"
                                  value={smartSettings.fallbackTimeEnd}
                                  onChange={(e) => setSmartSettings(prev => ({ ...prev, fallbackTimeEnd: e.target.value }))}
                                  className="admin-input"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* === SECTION 3: QUOTAS API === */}
                  <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-md font-semibold text-gray-900 mb-4">Protection des quotas API</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Délai minimum entre appels (sec)</label>
                        <input
                          type="number"
                          min="3"
                          max="30"
                          value={smartSettings.minDelayBetweenCalls}
                          onChange={(e) => setSmartSettings(prev => ({ ...prev, minDelayBetweenCalls: parseInt(e.target.value) || 6 }))}
                          className="admin-input"
                        />
                        <p className="text-xs text-gray-600 mt-1">Football-Data API: max 10 appels/minute</p>
                      </div>
                      <div className="flex items-end">
                        <button
                          onClick={generateMatchWindows}
                          disabled={generatingWindows}
                          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition disabled:opacity-50"
                        >
                          {generatingWindows ? 'Génération...' : 'Regénérer les fenêtres de matchs'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* === MONITORING API === */}
                  {apiStats && (
                    <div className="bg-white p-6 rounded-lg shadow">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-md font-semibold text-gray-900">Consommation API (aujourd'hui)</h3>
                        <button
                          onClick={fetchApiStats}
                          disabled={loadingApiStats}
                          className="text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
                        >
                          {loadingApiStats ? 'Actualisation...' : '🔄 Actualiser'}
                        </button>
                      </div>

                      {/* Quota Progress Bar */}
                      <div className="mb-6">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">Quota journalier</span>
                          <span className="text-sm text-gray-600">
                            {apiStats.totalCalls} / {apiStats.quota.daily} appels ({apiStats.quota.usagePercent}%)
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div
                            className={`h-3 rounded-full transition-all ${
                              apiStats.quota.usagePercent > 90
                                ? 'bg-red-500'
                                : apiStats.quota.usagePercent > 70
                                ? 'bg-orange-500'
                                : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(apiStats.quota.usagePercent, 100)}%` }}
                          />
                        </div>

                        {/* Estimation fin de journée */}
                        {apiStats.quota.estimatedTotal > apiStats.totalCalls && (
                          <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-blue-800">
                                Estimation fin de journée : <strong>{apiStats.quota.estimatedTotal} appels</strong>
                              </span>
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                apiStats.quota.status === 'critical'
                                  ? 'bg-red-100 text-red-700'
                                  : apiStats.quota.status === 'warning'
                                  ? 'bg-orange-100 text-orange-700'
                                  : 'bg-green-100 text-green-700'
                              }`}>
                                {apiStats.quota.estimatedQuotaPercent}%
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div className="p-4 bg-green-50 rounded-lg">
                          <div className="text-2xl font-bold text-green-700">{apiStats.successCount}</div>
                          <div className="text-xs text-green-600 mt-1">Succès</div>
                        </div>
                        <div className="p-4 bg-red-50 rounded-lg">
                          <div className="text-2xl font-bold text-red-700">{apiStats.failureCount}</div>
                          <div className="text-xs text-red-600 mt-1">Échecs</div>
                        </div>
                        <div className="p-4 bg-blue-50 rounded-lg">
                          <div className="text-2xl font-bold text-blue-700">{apiStats.successRate}%</div>
                          <div className="text-xs text-blue-600 mt-1">Taux succès</div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-lg">
                          <div className="text-2xl font-bold text-gray-700">{apiStats.quota.remaining}</div>
                          <div className="text-xs text-gray-600 mt-1">Restant</div>
                        </div>
                      </div>

                      {/* Répartition par type */}
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 mb-3">Répartition par type</h4>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-blue-500 rounded"></div>
                              <span className="text-sm text-gray-700">Quotidien</span>
                            </div>
                            <span className="text-sm font-medium text-gray-900">{apiStats.byType.quotidien} appels</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-green-500 rounded"></div>
                              <span className="text-sm text-gray-700">Temps réel</span>
                            </div>
                            <span className="text-sm font-medium text-gray-900">{apiStats.byType.realtime} appels</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-purple-500 rounded"></div>
                              <span className="text-sm text-gray-700">Manuel</span>
                            </div>
                            <span className="text-sm font-medium text-gray-900">{apiStats.byType.manual} appels</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* === BOUTONS D'ACTION === */}
                  <div className="flex flex-wrap gap-4">
                    <button
                      onClick={saveSmartSettings}
                      disabled={savingSettings}
                      className="px-6 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {savingSettings ? 'Enregistrement...' : 'Enregistrer les paramètres'}
                    </button>
                    <button
                      onClick={() => runManualUpdate('realtime')}
                      disabled={testingCron}
                      className="px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                      title="Mise à jour ciblée des matchs en cours uniquement (optimisée)"
                    >
                      {testingCron ? 'Exécution...' : '⚡ MAJ Temps réel'}
                    </button>
                    <button
                      onClick={() => runManualUpdate('full')}
                      disabled={testingCron}
                      className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                      title="Mise à jour complète de toutes les compétitions actives"
                    >
                      {testingCron ? 'Exécution...' : '🔄 MAJ Complète'}
                    </button>
                  </div>

                  {/* === RÉSULTATS DÉTAILLÉS DE LA DERNIÈRE MAJ === */}
                  {lastUpdateResults && lastUpdateResults.length > 0 && (
                    <div className="bg-white p-6 rounded-lg shadow">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-md font-semibold text-gray-900">Détails de la dernière exécution</h3>
                        <button
                          onClick={() => setLastUpdateResults(null)}
                          className="text-gray-400 hover:text-gray-600 text-sm"
                        >
                          Masquer
                        </button>
                      </div>
                      <div className="space-y-2">
                        {lastUpdateResults.map((r: any, idx: number) => (
                          <div
                            key={idx}
                            className={`p-3 rounded-lg border ${
                              r.success
                                ? 'bg-green-50 border-green-200'
                                : 'bg-red-50 border-red-200'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${r.success ? 'bg-green-500' : 'bg-red-500'}`} />
                                <span className="font-medium text-gray-900">{r.name}</span>
                                {r.code && <span className="text-xs text-gray-500">({r.code})</span>}
                              </div>
                              {r.success ? (
                                <span className="text-sm text-green-700">{r.matchesCount} matchs</span>
                              ) : (
                                <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded">Erreur</span>
                              )}
                            </div>
                            {!r.success && r.error && (
                              <p className="mt-2 text-sm text-red-700 pl-4">{r.error}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* === FENÊTRES DE MATCHS === */}
                  {matchWindows.length > 0 && (
                    <div className="bg-white p-6 rounded-lg shadow">
                      <h3 className="text-md font-semibold text-gray-900 mb-4">Prochaines fenêtres de matchs</h3>
                      <div className="mb-3 p-3 bg-blue-50 rounded-lg">
                        <p className="text-xs text-blue-900">
                          <strong>Info :</strong> Le nombre affiché représente les matchs réellement présents dans cette plage horaire (±10 min avant, +3h après le coup d'envoi).
                        </p>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-2 px-3 font-semibold text-gray-800">Compétition</th>
                              <th className="text-left py-2 px-3 font-semibold text-gray-800">Début</th>
                              <th className="text-left py-2 px-3 font-semibold text-gray-800">Fin</th>
                              <th className="text-left py-2 px-3 font-semibold text-gray-800">Matchs</th>
                              <th className="text-left py-2 px-3 font-semibold text-gray-800">Statut</th>
                            </tr>
                          </thead>
                          <tbody>
                            {matchWindows.slice(0, 5).map((window: any) => {
                              const now = new Date()
                              const start = new Date(window.window_start)
                              const end = new Date(window.window_end)
                              const isActive = now >= start && now <= end
                              const isPast = now > end
                              return (
                                <tr key={window.id} className="border-b border-gray-100">
                                  <td className="py-2 px-3 font-medium text-gray-900">{window.competitions?.name || `ID ${window.competition_id}`}</td>
                                  <td className="py-2 px-3 text-gray-800">
                                    {start.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                  </td>
                                  <td className="py-2 px-3 text-gray-800">
                                    {end.toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                  </td>
                                  <td className="py-2 px-3 text-gray-800">
                                    <span className="font-medium text-gray-900">
                                      {window.real_matches_count !== undefined ? window.real_matches_count : window.matches_count}
                                    </span>
                                    {window.real_matches_count !== undefined && window.real_matches_count !== window.matches_count && (
                                      <span className="ml-1 text-xs text-gray-500">
                                        (/{window.matches_count} dans la journée)
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2 px-3">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                      isActive ? 'bg-green-100 text-green-700' : isPast ? 'bg-gray-100 text-gray-500' : 'bg-blue-100 text-blue-700'
                                    }`}>
                                      {isActive ? 'En cours' : isPast ? 'Terminé' : 'À venir'}
                                    </span>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* === LOGS === */}
                  {cronLogs.filter((log: any) => log.status !== 'skipped').length > 0 && (
                    <div className="bg-white p-6 rounded-lg shadow">
                      <h3 className="text-md font-semibold text-gray-900 mb-4">Dernières exécutions</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-2 px-3 font-semibold text-gray-800">Date</th>
                              <th className="text-left py-2 px-3 font-semibold text-gray-800">Type</th>
                              <th className="text-left py-2 px-3 font-semibold text-gray-800">Statut</th>
                              <th className="text-left py-2 px-3 font-semibold text-gray-800">Message</th>
                              <th className="text-left py-2 px-3 font-semibold text-gray-800">MAJ</th>
                            </tr>
                          </thead>
                          <tbody>
                            {cronLogs
                              .filter((log: any) => log.status !== 'skipped')
                              .slice(0, 10)
                              .map((log: any) => (
                              <tr key={log.id} className="border-b border-gray-100">
                                <td className="py-2 px-3 text-gray-800">
                                  {new Date(log.created_at).toLocaleString('fr-FR', {
                                    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                                  })}
                                </td>
                                <td className="py-2 px-3">
                                  <span className={`px-2 py-0.5 rounded text-xs ${
                                    log.job_name === 'daily-sync' ? 'bg-blue-100 text-blue-700' :
                                    log.job_name === 'manual-update' ? 'bg-purple-100 text-purple-700' :
                                    'bg-gray-100 text-gray-700'
                                  }`}>
                                    {log.job_name === 'daily-sync' ? 'Quotidien' :
                                     log.job_name === 'manual-update' ? 'Manuel' : 'Temps réel'}
                                  </span>
                                </td>
                                <td className="py-2 px-3">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                    log.status === 'success' ? 'bg-green-100 text-green-700' :
                                    'bg-red-100 text-red-700'
                                  }`}>
                                    {log.status}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-gray-800 max-w-xs truncate">{log.message}</td>
                                <td className="py-2 px-3 font-medium text-gray-900">{log.competitions_updated || 0}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Note explicative */}
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-900">
                      <strong>Mode intelligent :</strong> Le système calcule des "fenêtres de matchs" basées sur le calendrier.
                      Les MAJ ne s'exécutent que pendant ces fenêtres, économisant les appels API.
                      La sync quotidienne met à jour le calendrier et regénère automatiquement les fenêtres.
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </main>
      </div>
    </AdminLayout>
  )
}

// Composant carte de compétition (pour les compétitions importées)
function CompetitionCard({
  competition: comp,
  importing,
  toggling,
  togglingEvent,
  onImport,
  onToggleActive,
  onToggleEvent,
  showRenewal = false,
  renewalStatus
}: {
  competition: Competition
  importing: number | null
  toggling: number | null
  togglingEvent: number | null
  onImport: (id: number) => void
  onToggleActive: (id: number, status: boolean) => void
  onToggleEvent: (id: number, status: boolean) => void
  showRenewal?: boolean
  renewalStatus?: { hasNewSeason: boolean; sourceStart: string | null; sourceEnd: string | null }
}) {
  // Sur l'onglet "Saisons terminées" : on connaît la dispo d'une nouvelle saison à la source.
  // renewalStatus indéfini = encore en chargement (on n'empêche rien).
  const renewalKnown = showRenewal && renewalStatus !== undefined
  const noNewSeason = renewalKnown && !renewalStatus!.hasNewSeason
  const hasNewSeason = renewalKnown && renewalStatus!.hasNewSeason
  return (
    <div className={`admin-competition-card ${comp.isActive ? 'active' : ''}`}>
      {/* Bouton d'activation (toggle switch) - Coin supérieur droit */}
      <div className="absolute top-3 right-3">
        <button
          onClick={() => onToggleActive(comp.id, comp.isActive)}
          disabled={toggling === comp.id}
          className={`admin-toggle-switch ${comp.isActive ? 'active' : 'inactive'}`}
          title={comp.isActive ? 'Activé - Cliquez pour désactiver' : 'Désactivé - Cliquez pour activer'}
        >
          <span className="admin-toggle-knob">
            {comp.isActive ? '✓' : '✗'}
          </span>
        </button>
      </div>

      {/* Logo */}
      <div className="w-[150px] h-[150px] flex items-center justify-center mb-4">
        {comp.emblem ? (
          <img
            src={comp.emblem}
            alt={comp.name}
            className="max-w-full max-h-full object-contain"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
        ) : (
          <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center text-gray-400 text-sm">
            N/A
          </div>
        )}
      </div>

      {/* Nom */}
      <h3 className="text-lg font-bold text-gray-900 text-center mb-3 min-h-[3.5rem] flex items-center justify-center">
        {comp.name}
      </h3>

      {/* ID, Code, Zone */}
      <div className="text-xs text-gray-600 text-center mb-2 space-y-1">
        <div>ID: {comp.id} | Code: {comp.code}</div>
        <div>Zone: {comp.area}</div>
      </div>

      {/* Saison */}
      {comp.currentSeason && (
        <div className="text-xs text-gray-500 text-center mb-2">
          Saison: {formatDate(comp.currentSeason.startDate)} → {formatDate(comp.currentSeason.endDate)}
        </div>
      )}

      {/* Badge Saison terminée */}
      {comp.currentSeason?.endDate && new Date(comp.currentSeason.endDate) < new Date() && (
        <div className="mb-2 text-center">
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200">
            Saison terminée
          </span>
        </div>
      )}

      {/* Journée actuelle */}
      {comp.currentSeason && (comp.currentSeason.currentMatchday || comp.currentSeason.totalMatchdays) && (
        <div className="text-sm font-medium text-gray-700 mb-3">
          Journée actuelle: {comp.currentSeason.currentMatchday || 0}
          {comp.currentSeason.totalMatchdays && (
            <span>/{comp.currentSeason.totalMatchdays}</span>
          )}
        </div>
      )}

      {/* Date dernière MAJ */}
      <div className="mb-3 text-center">
        {comp.lastUpdatedAt ? (
          (() => {
            const lastUpdate = new Date(comp.lastUpdatedAt)
            const now = new Date()
            const diffMs = now.getTime() - lastUpdate.getTime()
            const diffMins = Math.floor(diffMs / 60000)
            const diffHours = Math.floor(diffMins / 60)
            const diffDays = Math.floor(diffHours / 24)

            let timeAgo = ''
            let freshness: 'fresh' | 'recent' | 'old' = 'old'

            if (diffMins < 60) {
              timeAgo = `il y a ${diffMins} min`
              freshness = 'fresh'
            } else if (diffHours < 24) {
              timeAgo = `il y a ${diffHours}h`
              freshness = diffHours < 6 ? 'fresh' : 'recent'
            } else {
              timeAgo = `il y a ${diffDays}j`
              freshness = 'old'
            }

            return (
              <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${
                freshness === 'fresh' ? 'bg-green-100 text-green-700' :
                freshness === 'recent' ? 'bg-yellow-100 text-yellow-700' :
                'bg-gray-100 text-gray-600'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  freshness === 'fresh' ? 'bg-green-500' :
                  freshness === 'recent' ? 'bg-yellow-500' :
                  'bg-gray-400'
                }`} />
                <span>MAJ {timeAgo}</span>
                <span className="text-gray-400">
                  ({lastUpdate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} {lastUpdate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })})
                </span>
              </div>
            )
          })()
        ) : (
          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs bg-red-100 text-red-600">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            <span>Jamais mise à jour</span>
          </div>
        )}
      </div>

      {/* Toggle Événement */}
      <div className="mb-3 flex items-center justify-center gap-2">
        <button
          onClick={() => onToggleEvent(comp.id, comp.isEvent)}
          disabled={togglingEvent === comp.id}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            comp.isEvent
              ? 'bg-purple-600 text-white border border-purple-700 hover:bg-purple-700'
              : 'bg-amber-500 text-white border border-amber-600 hover:bg-amber-600'
          }`}
          title={comp.isEvent ? 'Compétition événementielle - Cliquez pour désactiver' : 'Cliquez pour marquer comme événement'}
        >
          {togglingEvent === comp.id ? '...' : comp.isEvent ? 'Événement' : 'Définir comme événement'}
        </button>
      </div>

      {/* Message dispo nouvelle saison (onglet "Saisons terminées") */}
      {showRenewal && (
        hasNewSeason ? (
          <div className="mb-2 w-full text-center text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-md px-2 py-1">
            ✅ Nouvelle saison disponible
            {renewalStatus?.sourceStart ? ` : ${formatDate(renewalStatus.sourceStart)} → ${formatDate(renewalStatus.sourceEnd || '')}` : ''}
          </div>
        ) : noNewSeason ? (
          <div className="mb-2 w-full text-center text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-md px-2 py-1">
            Aucune nouvelle saison disponible pour l'instant
          </div>
        ) : (
          <div className="mb-2 w-full text-center text-xs text-gray-400">Vérification de la saison…</div>
        )
      )}

      {/* Boutons d'action */}
      <div className="w-full mt-auto flex gap-3">
        <button
          onClick={() => window.open(`/${process.env.NEXT_PUBLIC_ADMIN_PANEL_PATH || 'sys-panel-svspgrn1kzw8'}/data/view/${comp.id}`, '_blank')}
          className="btn-admin-view"
        >
          Visualiser
        </button>
        <button
          onClick={() => onImport(comp.id)}
          disabled={importing === comp.id || noNewSeason}
          className={`btn-admin-refresh ${noNewSeason ? 'opacity-50 cursor-not-allowed' : ''}`}
          title={noNewSeason ? 'Aucune nouvelle saison disponible à la source' : hasNewSeason ? 'Importer la nouvelle saison' : 'Ré-importer / actualiser'}
        >
          {importing === comp.id ? 'Import...' : hasNewSeason ? 'Importer la saison' : 'Actualiser'}
        </button>
      </div>
    </div>
  )
}
