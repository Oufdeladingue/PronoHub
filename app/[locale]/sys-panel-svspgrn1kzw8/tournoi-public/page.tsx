'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import Navigation from '@/components/Navigation'
import { fetchWithAuth } from '@/lib/supabase/client'

interface Competition {
  id: string | number
  name: string
  is_custom?: boolean
  custom_competition_id?: string
}
interface PublicTournament {
  id: string
  name: string
  slug: string
  status: string
  competition_name: string | null
  players: number
  url: string
}

export default function AdminPublicTournamentPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [tournaments, setTournaments] = useState<PublicTournament[]>([])
  const [name, setName] = useState('')
  const [compKey, setCompKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const loadTournaments = useCallback(async () => {
    const r = await fetchWithAuth('/api/admin/tournaments/public')
    const d = await r.json()
    if (r.ok) setTournaments(d.tournaments || [])
  }, [])

  useEffect(() => {
    fetchWithAuth('/api/competitions/active')
      .then((r) => r.json())
      .then((d) => setCompetitions(d.competitions || []))
      .catch(() => {})
    loadTournaments()
  }, [loadTournaments])

  async function create() {
    setError(null); setOk(null)
    const comp = competitions.find((c) => String(c.id) === compKey)
    if (!name.trim() || !comp) { setError('Nom + compétition requis'); return }
    setBusy(true)
    try {
      const body: Record<string, any> = { name: name.trim() }
      if (comp.is_custom) body.customCompetitionId = comp.custom_competition_id
      else body.competitionId = comp.id
      const r = await fetchWithAuth('/api/admin/tournaments/public', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Erreur')
      setOk(`Tournoi public créé ✓ — visible sur ${d.publicUrl}`)
      setName(''); setCompKey('')
      loadTournaments()
    } catch (e: any) { setError(e.message) } finally { setBusy(false) }
  }

  async function remove(id: string, tname: string) {
    if (!confirm(`Supprimer le tournoi public « ${tname} » ? (irréversible)`)) return
    const r = await fetchWithAuth(`/api/admin/tournaments/public?id=${id}`, { method: 'DELETE' })
    if (r.ok) loadTournaments()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation username="Admin" userAvatar="avatar1" context="admin" adminContext={{ currentPage: 'tournoi-public' }} />

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">🌍 Tournois publics</h1>
          <p className="text-sm text-gray-500 mt-1">
            Un tournoi public est ouvert à tous, rejoignable seul et même en cours, capacité illimitée.
            Le flag est porté par le <strong>tournoi</strong> : une même compétition peut avoir un tournoi
            public ET des tournois privés, sans conflit.
          </p>
        </div>

        {/* Formulaire de création */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 mb-8">
          <h2 className="font-bold text-gray-900 mb-4">Créer un tournoi public</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nom du tournoi</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ex : Le Défi PronoHub de la semaine"
                className="w-full px-3 py-2.5 rounded-lg bg-white border border-gray-300 text-gray-900 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 scheme-light"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Compétition (custom 🛠️ ou normale ⚽)</label>
              <select
                value={compKey}
                onChange={(e) => setCompKey(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-white border border-gray-300 text-gray-900 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 scheme-light"
              >
                <option value="">— Choisir une compétition —</option>
                {competitions.map((c) => (
                  <option key={String(c.id)} value={String(c.id)}>
                    {c.is_custom ? '🛠️ ' : '⚽ '}{c.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={create}
              disabled={busy || !name.trim() || !compKey}
              className="w-full px-4 py-2.5 rounded-lg bg-purple-600 text-white font-bold text-sm hover:bg-purple-700 disabled:opacity-50 transition"
            >
              {busy ? 'Création…' : 'Créer le tournoi public'}
            </button>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {ok && <p className="text-sm text-green-600">✅ {ok}</p>}
          </div>
        </div>

        {/* Liste des tournois publics */}
        <h2 className="font-bold text-gray-900 mb-3">Tournois publics existants ({tournaments.length})</h2>
        <div className="space-y-2">
          {tournaments.length === 0 && <p className="text-sm text-gray-500">Aucun tournoi public pour l'instant.</p>}
          {tournaments.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3 bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3">
              <div className="min-w-0">
                <div className="font-semibold text-sm text-gray-900 truncate">{t.name}</div>
                <div className="text-xs text-gray-500 truncate">
                  {t.competition_name} · {t.players} joueurs · {t.status}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Link href={t.url} target="_blank" className="text-xs font-semibold text-purple-600 hover:underline">Voir</Link>
                <button onClick={() => remove(t.id, t.name)} className="text-xs font-semibold text-red-600 hover:text-red-700">Supprimer</button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
