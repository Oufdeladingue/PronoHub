'use client'

import { useEffect, useState } from 'react'

// Types pour Capacitor
interface PreferencesPlugin {
  get: (opts: { key: string }) => Promise<{ value: string | null }>
  set: (opts: { key: string; value: string }) => Promise<void>
  keys: () => Promise<{ keys: string[] }>
  remove: (opts: { key: string }) => Promise<void>
}

interface StatusBarPlugin {
  setStyle: (opts: { style: string }) => Promise<void>
  setBackgroundColor: (opts: { color: string }) => Promise<void>
  setOverlaysWebView: (opts: { overlay: boolean }) => Promise<void>
}

interface CapacitorWindow {
  Capacitor?: {
    isNativePlatform?: () => boolean
    getPlatform?: () => string
    Plugins?: {
      StatusBar?: StatusBarPlugin
      Preferences?: PreferencesPlugin
      App?: unknown
      Browser?: unknown
      GoogleAuth?: unknown
    }
  }
}

export default function DebugCapacitorPage() {
  const [debugInfo, setDebugInfo] = useState<Record<string, unknown>>({})
  const [statusBarResult, setStatusBarResult] = useState<string>('non testé')
  const [prefsResult, setPrefsResult] = useState<string>('non testé')
  const [prefsKeys, setPrefsKeys] = useState<string[]>([])
  const [localStorageKeys, setLocalStorageKeys] = useState<string[]>([])

  const getCapacitor = () => (window as unknown as CapacitorWindow).Capacitor

  // Charger les infos au montage
  useEffect(() => {
    const info: Record<string, unknown> = {}
    const cap = getCapacitor()

    // User Agent
    info.userAgent = navigator.userAgent

    // Détection WebView via User-Agent
    const ua = navigator.userAgent || ''
    info.isAndroidWebView_method1 = /Android.*wv/.test(ua)
    info.isAndroidWebView_method2 = /; wv\)/.test(ua)

    // Objet Capacitor
    info.hasCapacitorObject = !!cap
    info.capacitorType = typeof cap

    if (cap) {
      info.capacitorKeys = Object.keys(cap)
      info.isNativePlatform = cap.isNativePlatform?.()
      info.platform = cap.getPlatform?.()

      if (cap.Plugins) {
        info.pluginKeys = Object.keys(cap.Plugins)
        info.hasStatusBar = !!cap.Plugins.StatusBar
        info.hasPreferences = !!cap.Plugins.Preferences
        info.hasApp = !!cap.Plugins.App
        info.hasBrowser = !!cap.Plugins.Browser
        info.hasGoogleAuth = !!cap.Plugins.GoogleAuth
      }
    }

    setDebugInfo(info)
    refreshKeys()
  }, [])

  // Rafraîchir les clés localStorage et Preferences
  const refreshKeys = async () => {
    // localStorage
    const lsKeys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) lsKeys.push(key)
    }
    setLocalStorageKeys(lsKeys)

    // Preferences
    const prefs = getCapacitor()?.Plugins?.Preferences
    if (prefs) {
      try {
        const { keys } = await prefs.keys()
        setPrefsKeys(keys)
      } catch (e) {
        setPrefsKeys([`Erreur: ${String(e)}`])
      }
    }
  }

  // Test Status Bar
  const testStatusBar = async (color: string) => {
    const statusBar = getCapacitor()?.Plugins?.StatusBar
    if (statusBar) {
      try {
        // Configurer le style (icônes blanches pour fond sombre, noires pour fond clair)
        const isDark = ['#000000', '#1e293b', '#0000ff'].includes(color)
        const style = isDark ? 'DARK' : 'LIGHT'

        await statusBar.setStyle({ style })
        await statusBar.setOverlaysWebView({ overlay: false })
        await statusBar.setBackgroundColor({ color })
        setStatusBarResult(`OK: ${color} (style: ${style})`)
      } catch (e) {
        setStatusBarResult(`Erreur: ${String(e)}`)
      }
    } else {
      setStatusBarResult('Plugin non disponible')
    }
  }

  // Test Preferences - Écrire
  const testPrefsWrite = async () => {
    const prefs = getCapacitor()?.Plugins?.Preferences
    if (!prefs) {
      setPrefsResult('Plugin non disponible')
      return
    }
    try {
      const testKey = 'debug-test-key'
      const testValue = `test-${Date.now()}`
      await prefs.set({ key: testKey, value: testValue })
      setPrefsResult(`Écrit: ${testKey}=${testValue}`)
      refreshKeys()
    } catch (e) {
      setPrefsResult(`Erreur écriture: ${String(e)}`)
    }
  }

  // Test Preferences - Lire
  const testPrefsRead = async () => {
    const prefs = getCapacitor()?.Plugins?.Preferences
    if (!prefs) {
      setPrefsResult('Plugin non disponible')
      return
    }
    try {
      const { value } = await prefs.get({ key: 'debug-test-key' })
      setPrefsResult(`Lu: debug-test-key=${value || 'null'}`)
    } catch (e) {
      setPrefsResult(`Erreur lecture: ${String(e)}`)
    }
  }

  // Sauvegarder toutes les clés sb-* de localStorage vers Preferences
  const saveSessionToPrefs = async () => {
    const prefs = getCapacitor()?.Plugins?.Preferences
    if (!prefs) {
      setPrefsResult('Plugin non disponible')
      return
    }
    try {
      let count = 0
      const keys: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith('sb-')) {
          const value = localStorage.getItem(key)
          if (value) {
            await prefs.set({ key, value })
            count++
            keys.push(key)
          }
        }
      }
      setPrefsResult(`Sauvegardé ${count} clés: ${keys.join(', ')}`)
      refreshKeys()
    } catch (e) {
      setPrefsResult(`Erreur sauvegarde: ${String(e)}`)
    }
  }

  // Restaurer les clés sb-* de Preferences vers localStorage
  const restoreSessionFromPrefs = async () => {
    const prefs = getCapacitor()?.Plugins?.Preferences
    if (!prefs) {
      setPrefsResult('Plugin non disponible')
      return
    }
    try {
      const { keys } = await prefs.keys()
      let count = 0
      const restored: string[] = []
      for (const key of keys) {
        if (key.startsWith('sb-')) {
          const { value } = await prefs.get({ key })
          if (value) {
            localStorage.setItem(key, value)
            count++
            restored.push(key)
          }
        }
      }
      setPrefsResult(`Restauré ${count} clés: ${restored.join(', ')}`)
      refreshKeys()
    } catch (e) {
      setPrefsResult(`Erreur restauration: ${String(e)}`)
    }
  }

  // Afficher le contenu d'une clé Preferences
  const showPrefsValue = async (key: string) => {
    const prefs = getCapacitor()?.Plugins?.Preferences
    if (!prefs) return
    try {
      const { value } = await prefs.get({ key })
      const preview = value ? (value.length > 100 ? value.substring(0, 100) + '...' : value) : 'null'
      setPrefsResult(`${key}: ${preview}`)
    } catch (e) {
      setPrefsResult(`Erreur: ${String(e)}`)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 pb-20">
      <h1 className="text-xl font-bold mb-4 text-[#ff9900]">Debug Capacitor</h1>

      {/* Test Status Bar */}
      <div className="mb-4 p-3 bg-gray-800 rounded">
        <p className="text-sm font-bold mb-2 text-[#ff9900]">Status Bar</p>
        <p className="text-xs mb-2 text-yellow-400">{statusBarResult}</p>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => testStatusBar('#ff0000')} className="px-3 py-1 bg-red-600 text-white rounded text-xs">Rouge</button>
          <button onClick={() => testStatusBar('#00ff00')} className="px-3 py-1 bg-green-600 text-white rounded text-xs">Vert</button>
          <button onClick={() => testStatusBar('#0000ff')} className="px-3 py-1 bg-blue-600 text-white rounded text-xs">Bleu</button>
          <button onClick={() => testStatusBar('#000000')} className="px-3 py-1 bg-gray-600 text-white rounded text-xs">Noir</button>
          <button onClick={() => testStatusBar('#1e293b')} className="px-3 py-1 bg-slate-700 text-white rounded text-xs">Nav</button>
        </div>
      </div>

      {/* Test Preferences */}
      <div className="mb-4 p-3 bg-gray-800 rounded">
        <p className="text-sm font-bold mb-2 text-[#ff9900]">Preferences (Persistance)</p>
        <p className="text-xs mb-2 text-yellow-400 break-all">{prefsResult}</p>
        <div className="flex gap-2 flex-wrap mb-3">
          <button onClick={testPrefsWrite} className="px-3 py-1 bg-purple-600 text-white rounded text-xs">Écrire test</button>
          <button onClick={testPrefsRead} className="px-3 py-1 bg-purple-600 text-white rounded text-xs">Lire test</button>
          <button onClick={saveSessionToPrefs} className="px-3 py-1 bg-green-600 text-white rounded text-xs">Sauv session</button>
          <button onClick={restoreSessionFromPrefs} className="px-3 py-1 bg-blue-600 text-white rounded text-xs">Restaurer session</button>
        </div>
        <p className="text-xs text-gray-400">Clés dans Preferences ({prefsKeys.length}):</p>
        <div className="flex gap-1 flex-wrap mt-1">
          {prefsKeys.map(k => (
            <button key={k} onClick={() => showPrefsValue(k)} className="px-2 py-0.5 bg-gray-700 text-xs rounded hover:bg-gray-600">
              {k}
            </button>
          ))}
          {prefsKeys.length === 0 && <span className="text-xs text-gray-500">aucune</span>}
        </div>
      </div>

      {/* localStorage */}
      <div className="mb-4 p-3 bg-gray-800 rounded">
        <p className="text-sm font-bold mb-2 text-[#ff9900]">localStorage</p>
        <p className="text-xs text-gray-400">
          Total: {localStorageKeys.length} clés |
          sb-*: {localStorageKeys.filter(k => k.startsWith('sb-')).length} clés
        </p>
        <div className="flex gap-1 flex-wrap mt-1">
          {localStorageKeys.map(k => (
            <span key={k} className={`px-2 py-0.5 text-xs rounded ${k.startsWith('sb-') ? 'bg-green-800' : 'bg-gray-700'}`}>
              {k}
            </span>
          ))}
          {localStorageKeys.length === 0 && <span className="text-xs text-gray-500">aucune</span>}
        </div>
      </div>

      {/* Info Capacitor */}
      <div className="mb-4 p-3 bg-gray-800 rounded">
        <p className="text-sm font-bold mb-2 text-[#ff9900]">Info Capacitor</p>
        <pre className="text-xs whitespace-pre-wrap break-all">
          {JSON.stringify(debugInfo, null, 2)}
        </pre>
      </div>

      <button
        onClick={() => { refreshKeys(); window.location.reload() }}
        className="w-full px-4 py-2 bg-[#ff9900] text-black rounded font-bold"
      >
        Rafraîchir
      </button>
    </div>
  )
}
