'use client'

import { useEffect, useState } from 'react'

interface NotificationLog {
  id: string
  user_id: string
  user_email: string
  username: string
  notification_type: string
  tournament_id: string | null
  matchday: number | null
  status: 'pending' | 'sent' | 'failed'
  scheduled_at: string
  sent_at: string | null
  error_message: string | null
  created_at: string
}

interface LogsResponse {
  success: boolean
  stats: {
    total: number
    sent: number
    failed: number
    pending: number
  }
  logs: NotificationLog[]
  filters: {
    date: string
    type: string
    limit: number
  }
}

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<LogsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  )

  const fetchLogs = async (date: string) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/admin/notification-logs?date=${date}&type=reminder`
      )
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors du chargement des logs')
      }

      setLogs(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs(selectedDate)
  }, [selectedDate])

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">📋 Logs de notifications</h1>

        {/* Date picker */}
        <div className="mb-6 flex items-center gap-4">
          <label className="text-gray-400">Date:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-[#1a1a1a] border border-gray-700 rounded px-3 py-2 text-white"
          />
          <button
            onClick={() => fetchLogs(selectedDate)}
            className="bg-[#ff9900] text-black px-4 py-2 rounded font-semibold hover:bg-[#ff9900]/90"
          >
            Actualiser
          </button>
        </div>

        {loading && (
          <div className="text-center py-12">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[#ff9900] border-r-transparent"></div>
            <p className="mt-4 text-gray-400">Chargement des logs...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-900/20 border border-red-500 rounded p-4 mb-6">
            <p className="text-red-500">❌ {error}</p>
          </div>
        )}

        {logs && !loading && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-4 gap-4 mb-8">
              <div className="bg-[#1a1a1a] rounded-lg p-4">
                <div className="text-gray-400 text-sm mb-1">Total</div>
                <div className="text-2xl font-bold">{logs.stats.total}</div>
              </div>
              <div className="bg-[#1a1a1a] rounded-lg p-4">
                <div className="text-gray-400 text-sm mb-1">Envoyés</div>
                <div className="text-2xl font-bold text-green-500">
                  {logs.stats.sent}
                </div>
              </div>
              <div className="bg-[#1a1a1a] rounded-lg p-4">
                <div className="text-gray-400 text-sm mb-1">Échoués</div>
                <div className="text-2xl font-bold text-red-500">
                  {logs.stats.failed}
                </div>
              </div>
              <div className="bg-[#1a1a1a] rounded-lg p-4">
                <div className="text-gray-400 text-sm mb-1">En attente</div>
                <div className="text-2xl font-bold text-yellow-500">
                  {logs.stats.pending}
                </div>
              </div>
            </div>

            {/* Logs table */}
            {logs.logs.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                Aucun log trouvé pour cette date
              </div>
            ) : (
              <div className="bg-[#1a1a1a] rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-[#0f0f0f] border-b border-gray-800">
                    <tr>
                      <th className="text-left p-4 text-gray-400 font-semibold">
                        Utilisateur
                      </th>
                      <th className="text-left p-4 text-gray-400 font-semibold">
                        Statut
                      </th>
                      <th className="text-left p-4 text-gray-400 font-semibold">
                        Programmé à
                      </th>
                      <th className="text-left p-4 text-gray-400 font-semibold">
                        Envoyé à
                      </th>
                      <th className="text-left p-4 text-gray-400 font-semibold">
                        Erreur
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {logs.logs.map((log) => (
                      <tr key={log.id} className="hover:bg-[#0f0f0f]">
                        <td className="p-4">
                          <div className="font-semibold">{log.username}</div>
                          <div className="text-sm text-gray-400">
                            {log.user_email}
                          </div>
                        </td>
                        <td className="p-4">
                          <span
                            className={`px-2 py-1 rounded text-xs font-semibold ${
                              log.status === 'sent'
                                ? 'bg-green-900/30 text-green-500'
                                : log.status === 'failed'
                                ? 'bg-red-900/30 text-red-500'
                                : 'bg-yellow-900/30 text-yellow-500'
                            }`}
                          >
                            {log.status}
                          </span>
                        </td>
                        <td className="p-4 text-sm">
                          {new Date(log.scheduled_at).toLocaleString('fr-FR', {
                            timeZone: 'Europe/Paris'
                          })}
                        </td>
                        <td className="p-4 text-sm">
                          {log.sent_at
                            ? new Date(log.sent_at).toLocaleString('fr-FR', {
                                timeZone: 'Europe/Paris'
                              })
                            : '-'}
                        </td>
                        <td className="p-4 text-sm text-red-400">
                          {log.error_message || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
