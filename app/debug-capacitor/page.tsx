'use client'

import { useEffect, useState } from 'react'

export default function DebugCapacitorPage() {
  const [debugInfo, setDebugInfo] = useState<Record<string, unknown>>({})
  const [statusBarResult, setStatusBarResult] = useState<string>('non testé')

  useEffect(() => {
    const info: Record<string, unknown> = {}

    // User Agent
    info.userAgent = navigator.userAgent

    // Détection WebView via User-Agent
    const ua = navigator.userAgent || ''
    info.isAndroidWebView_method1 = /Android.*wv/.test(ua)
    info.isAndroidWebView_method2 = /; wv\)/.test(ua)

    // Objet Capacitor
    const win = window as unknown as { Capacitor?: unknown }
    info.hasCapacitorObject = !!win.Capacitor
    info.capacitorType = typeof win.Capacitor

    if (win.Capacitor) {
      const cap = win.Capacitor as Record<string, unknown>
      info.capacitorKeys = Object.keys(cap)

      // isNativePlatform
      if (typeof cap.isNativePlatform === 'function') {
        try {
          info.isNativePlatform = (cap.isNativePlatform as () => boolean)()
        } catch (e) {
          info.isNativePlatformError = String(e)
        }
      }

      // getPlatform
      if (typeof cap.getPlatform === 'function') {
        try {
          info.platform = (cap.getPlatform as () => string)()
        } catch (e) {
          info.platformError = String(e)
        }
      }

      // Plugins
      if (cap.Plugins) {
        const plugins = cap.Plugins as Record<string, unknown>
        info.pluginKeys = Object.keys(plugins)
        info.hasStatusBar = !!plugins.StatusBar
        info.hasPreferences = !!plugins.Preferences
        info.hasApp = !!plugins.App
        info.hasBrowser = !!plugins.Browser
        info.hasGoogleAuth = !!plugins.GoogleAuth
      } else {
        info.plugins = 'undefined'
      }
    }

    // localStorage
    info.localStorageLength = localStorage.length
    const sbKeys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith('sb-')) {
        sbKeys.push(key)
      }
    }
    info.supabaseKeys = sbKeys

    setDebugInfo(info)
  }, [])

  // Fonction pour tester le changement de couleur status bar
  const testStatusBar = async (color: string) => {
    const win = window as unknown as { Capacitor?: { Plugins?: { StatusBar?: { setBackgroundColor: (opts: { color: string }) => Promise<void> } } } }
    const statusBar = win.Capacitor?.Plugins?.StatusBar
    if (statusBar) {
      try {
        await statusBar.setBackgroundColor({ color })
        setStatusBarResult(`OK: couleur ${color} appliquée`)
      } catch (e) {
        setStatusBarResult(`Erreur: ${String(e)}`)
      }
    } else {
      setStatusBarResult('StatusBar plugin non disponible')
    }
  }

  return (
    <div className="min-h-screen bg-black text-white p-4">
      <h1 className="text-xl font-bold mb-4 text-[#ff9900]">Debug Capacitor</h1>

      {/* Test Status Bar */}
      <div className="mb-4 p-3 bg-gray-800 rounded">
        <p className="text-sm mb-2">Test Status Bar: <span className="text-yellow-400">{statusBarResult}</span></p>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => testStatusBar('#ff0000')} className="px-3 py-1 bg-red-600 text-white rounded text-sm">Rouge</button>
          <button onClick={() => testStatusBar('#00ff00')} className="px-3 py-1 bg-green-600 text-white rounded text-sm">Vert</button>
          <button onClick={() => testStatusBar('#0000ff')} className="px-3 py-1 bg-blue-600 text-white rounded text-sm">Bleu</button>
          <button onClick={() => testStatusBar('#000000')} className="px-3 py-1 bg-gray-600 text-white rounded text-sm">Noir</button>
          <button onClick={() => testStatusBar('#1e293b')} className="px-3 py-1 bg-slate-700 text-white rounded text-sm">Nav</button>
        </div>
      </div>

      <pre className="text-xs whitespace-pre-wrap break-all bg-gray-900 p-4 rounded">
        {JSON.stringify(debugInfo, null, 2)}
      </pre>
      <button
        onClick={() => window.location.reload()}
        className="mt-4 px-4 py-2 bg-[#ff9900] text-black rounded"
      >
        Rafraîchir
      </button>
    </div>
  )
}
