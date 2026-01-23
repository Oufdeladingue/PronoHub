'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

// Intercepter console.log pour capturer les logs
const logs: string[] = []
const originalLog = console.log
const originalWarn = console.warn
const originalError = console.error

if (typeof window !== 'undefined') {
  console.log = (...args: any[]) => {
    logs.push(`[LOG] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}`)
    originalLog.apply(console, args)
  }
  console.warn = (...args: any[]) => {
    logs.push(`[WARN] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}`)
    originalWarn.apply(console, args)
  }
  console.error = (...args: any[]) => {
    logs.push(`[ERROR] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}`)
    originalError.apply(console, args)
  }
}

export default function LogsPage() {
  const [displayLogs, setDisplayLogs] = useState<string[]>([])

  useEffect(() => {
    // Mettre à jour les logs toutes les 500ms
    const interval = setInterval(() => {
      setDisplayLogs([...logs])
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
              logs.length = 0
              setDisplayLogs([])
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

      <div className="bg-gray-900 p-3 rounded font-mono text-xs">
        <p className="text-gray-400 mb-2">Total: {displayLogs.length} logs</p>
        {displayLogs.length === 0 && <p className="text-gray-500">Aucun log</p>}
        {displayLogs.map((log, i) => (
          <div
            key={i}
            className={`py-0.5 ${
              log.includes('[ERROR]')
                ? 'text-red-400'
                : log.includes('[WARN]')
                ? 'text-yellow-400'
                : log.includes('[Capacitor]') || log.includes('[CapacitorSessionProvider]')
                ? 'text-green-400'
                : log.includes('[StatusBar]')
                ? 'text-blue-400'
                : 'text-gray-300'
            }`}
          >
            {log}
          </div>
        ))}
      </div>
    </div>
  )
}
