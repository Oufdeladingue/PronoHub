'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { fetchWithAuth } from '@/lib/supabase/client'

/**
 * Connexion d'un salon Discord à un tournoi (créateur uniquement).
 * L'utilisateur colle une URL de webhook → le tournoi auto-poste ses temps forts.
 */
export default function DiscordConnect({ tournamentId }: { tournamentId: string }) {
  const t = useTranslations('Discord')
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
      if (!res.ok) throw new Error(d.error || t('errorGeneric'))
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
        <h4 className="font-semibold theme-text text-sm">{t('title')}</h4>
        {connected && (
          <span className="ml-auto text-xs font-semibold text-green-500">{t('connected')}</span>
        )}
      </div>

      {connected ? (
        <>
          <p className="text-xs theme-text-secondary mb-3">
            {t('connectedDesc')}
          </p>
          <button
            onClick={disconnect}
            disabled={busy}
            className="text-xs font-medium text-red-400 hover:text-red-300 disabled:opacity-50"
          >
            {t('disconnect')}
          </button>
        </>
      ) : (
        <>
          <p className="text-xs theme-text-secondary mb-2">
            {t('intro')}
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
              {busy ? '...' : t('connect')}
            </button>
          </div>
          {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
          <button onClick={() => setShowHelp(v => !v)} className="text-xs text-[#8b93f7] hover:underline">
            {showHelp ? t('hide') : t('howToGet')}
          </button>
          {showHelp && (
            <ol className="mt-2 text-xs theme-text-secondary list-decimal pl-4 space-y-1">
              <li>{t('step1Pre')}<strong>{t('step1Bold')}</strong></li>
              <li>{t('step2Pre')}<strong>{t('step2Bold1')}</strong>{t('step2Mid')}<strong>{t('step2Bold2')}</strong></li>
              <li>{t('step3Pre')}<strong>{t('step3Bold')}</strong></li>
            </ol>
          )}
        </>
      )}
    </div>
  )
}
