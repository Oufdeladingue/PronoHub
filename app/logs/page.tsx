'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { globalLogs, clearLogs } from '@/lib/logger'

export default function LogsPage() {
  const [logs, setLogs] = useState(globalLogs)

  useEffect(() => {
    // Mettre à jour les logs toutes les 500ms
    const interval = setInterval(() => {
      setLogs([...globalLogs])
    }, 500)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-black text-white p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-[#ff9900]">Console Logs</h1>
        <div className="flex gap-2">
          <button
            onClick={() => {
              clearLogs()
              setLogs([])
            }}
            className="px-3 py-1 bg-red-600 text-white rounded text-sm"
          >
            Clear
          </button>
          <Link href="/dashboard" className="px-3 py-1 bg-gray-700 text-white rounded text-sm">
            Dashboard
          </Link>
        </div>
      </div>

      <div className="bg-gray-900 p-3 rounded font-mono text-xs max-h-[80vh] overflow-y-auto">
        <p className="text-gray-400 mb-2">Total: {logs.length} logs</p>
        {logs.length === 0 && <p className="text-gray-500">Aucun log (le logger s'initialise au chargement de l'app)</p>}
        {logs.map((log, i) => (
          <div
            key={i}
            className={`py-0.5 ${
              log.level === 'ERROR'
                ? 'text-red-400'
                : log.level === 'WARN'
                ? 'text-yellow-400'
                : log.message.includes('[Capacitor]') || log.message.includes('[CapacitorSessionProvider]')
                ? 'text-green-400'
                : log.message.includes('[StatusBar]')
                ? 'text-blue-400'
                : 'text-gray-300'
            }`}
          >
            <span className="text-gray-500">{log.time}</span> [{log.level}] {log.message}
          </div>
        ))}
      </div>
    </div>
  )
}
