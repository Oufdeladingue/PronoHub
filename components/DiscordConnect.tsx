'use client'

import { useEffect, useState } from 'react'
import { fetchWithAuth } from '@/lib/supabase/client'

/**
 * Connexion d'un salon Discord à un tournoi (créateur uniquement).
 * L'utilisateur colle une URL de webhook → le tournoi auto-poste ses temps forts.
 */
export default function DiscordConnect({ tournamentId }: { tournamentId: string }) {
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(false)
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showHelp, setShowHelp] = useState(false)

  useEffect(() => {
    let alive = true
    fetchWithAuth(`/api/tournaments/${tournamentId}/discord`)
      .then(r => r.json())
      .then(d => { if (alive) setConnected(!!d.connected) })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [tournamentId])

  async function connect() {
    setError(null)
    setBusy(true)
    try {
      const res = await fetchWithAuth(`/api/tournaments/${tournamentId}/discord`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl: url.trim() }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Erreur')
      setConnected(true)
      setUrl('')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function disconnect() {
    setBusy(true)
    try {
      await fetchWithAuth(`/api/tournaments/${tournamentId}/discord`, { method: 'DELETE' })
      setConnected(false)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return null

  return (
    <div className="rounded-lg border border-[#5865F2]/40 bg-[#5865F2]/10 p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">🎮</span>
        <h4 className="font-semibold theme-text text-sm">Salon Discord</h4>
        {connected && (
          <span className="ml-auto text-xs font-semibold text-green-500">● Connecté</span>
        )}
      </div>

      {connected ? (
        <>
          <p className="text-xs theme-text-secondary mb-3">
            Ce tournoi publie automatiquement ses temps forts dans ton salon Discord (arrivées de joueurs, rappels, classements).
          </p>
          <button
            onClick={disconnect}
            disabled={busy}
            className="text-xs font-medium text-red-400 hover:text-red-300 disabled:opacity-50"
          >
            Déconnecter le salon
          </button>
        </>
      ) : (
        <>
          <p className="text-xs theme-text-secondary mb-2">
            Colle l'URL d'un webhook Discord : le salon suivra le tournoi tout seul.
          </p>
          <div className="flex gap-2 mb-2">
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://discord.com/api/webhooks/..."
              className="flex-1 min-w-0 px-3 py-2 text-xs rounded-lg bg-black/20 border border-white/10 theme-text outline-none focus:border-[#5865F2]"
            />
            <button
              onClick={connect}
              disabled={busy || !url.trim()}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#5865F2] rounded-lg hover:brightness-110 disabled:opacity-50 whitespace-nowrap"
            >
              {busy ? '...' : 'Connecter'}
            </button>
          </div>
          {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
          <button onClick={() => setShowHelp(v => !v)} className="text-xs text-[#8b93f7] hover:underline">
            {showHelp ? 'Masquer' : 'Comment obtenir l\'URL ?'}
          </button>
          {showHelp && (
            <ol className="mt-2 text-xs theme-text-secondary list-decimal pl-4 space-y-1">
              <li>Sur ton serveur Discord : <strong>Paramètres du serveur → Intégrations → Webhooks</strong></li>
              <li>Clique <strong>Nouveau webhook</strong>, choisis le salon, puis <strong>Copier l'URL du webhook</strong></li>
              <li>Colle-la ci-dessus et clique <strong>Connecter</strong></li>
            </ol>
          )}
        </>
      )}
    </div>
  )
}
