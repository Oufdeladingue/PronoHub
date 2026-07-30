'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
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
      setOk(`Tournoi public créé : ${d.publicUrl}`)
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
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">🌍 Tournois publics</h1>
          <Link href="/sys-panel-svspgrn1kzw8" className="text-sm text-slate-400 hover:text-white">← Admin</Link>
        </div>

        <p className="text-sm text-slate-400 mb-6">
          Un tournoi public est ouvert à tous, rejoignable seul et en cours, capacité illimitée. Le flag est
          porté par le tournoi : la même compétition (normale ou custom) peut avoir un tournoi public ET des
          tournois privés sans conflit.
        </p>

        {/* Formulaire de création */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 mb-8">
          <h2 className="font-bold mb-4">Créer un tournoi public</h2>
          <div className="space-y-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nom du tournoi (ex : Le Défi PronoHub de la CDM)"
              className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm outline-none focus:border-[#ff9900]"
            />
            <select
              value={compKey}
              onChange={(e) => setCompKey(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm outline-none focus:border-[#ff9900] scheme-dark"
            >
              <option value="">— Choisir une compétition —</option>
              {competitions.map((c) => (
                <option key={String(c.id)} value={String(c.id)}>
                  {c.is_custom ? '🛠️ ' : '⚽ '}{c.name}
                </option>
              ))}
            </select>
            <button
              onClick={create}
              disabled={busy || !name.trim() || !compKey}
              className="w-full px-4 py-2.5 rounded-lg bg-[#ff9900] text-slate-900 font-bold text-sm disabled:opacity-50"
            >
              {busy ? 'Création…' : 'Créer le tournoi public'}
            </button>
            {error && <p className="text-sm text-red-400">{error}</p>}
            {ok && <p className="text-sm text-green-400">✅ {ok}</p>}
          </div>
        </div>

        {/* Liste des tournois publics */}
        <h2 className="font-bold mb-3">Tournois publics existants ({tournaments.length})</h2>
        <div className="space-y-2">
          {tournaments.length === 0 && <p className="text-sm text-slate-500">Aucun tournoi public pour l'instant.</p>}
          {tournaments.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <div className="min-w-0">
                <div className="font-semibold text-sm truncate">{t.name}</div>
                <div className="text-xs text-slate-400 truncate">
                  {t.competition_name} · {t.players} joueurs · {t.status}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Link href={t.url} target="_blank" className="text-xs text-[#ff9900] hover:underline">Voir</Link>
                <button onClick={() => remove(t.id, t.name)} className="text-xs text-red-400 hover:text-red-300">Supprimer</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
