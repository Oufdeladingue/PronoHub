'use client'

import { useState } from 'react'

interface Props {
  /** Titre proposé par défaut pour la surimpression (ex: titre de la notif FR) */
  defaultTitle?: string
  /** Appelé avec l'URL publique de l'image générée (1024x512) */
  onGenerated: (url: string) => void
}

/**
 * Générateur de visuel 1024x512 « prompt → image » via Cloudflare Workers AI
 * (fond illustré) + titre net superposé (satori, côté serveur).
 */
export default function PushImageGenerator({ defaultTitle = '', onGenerated }: Props) {
  const [open, setOpen] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [overlay, setOverlay] = useState(true)
  const [title, setTitle] = useState(defaultTitle)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)

  const generate = async () => {
    setError(null)
    setLoading(true)
    setResultUrl(null)
    try {
      const res = await fetch('/api/admin/communications/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, title: overlay ? title : '', overlay }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.url) {
        throw new Error(data?.error || `Erreur serveur (HTTP ${res.status})`)
      }
      setResultUrl(data.url)
      onGenerated(data.url)
    } catch (e: any) {
      setError(e.message || 'Erreur lors de la génération')
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => { setOpen(true); setTitle(defaultTitle) }}
        className="text-sm text-purple-600 hover:text-purple-700 font-medium inline-flex items-center gap-1.5"
      >
        🎨 Générer un visuel par IA (1024×512)
      </button>
    )
  }

  return (
    <div className="border border-purple-200 bg-purple-50/50 rounded-lg p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-purple-800">🎨 Générateur de visuel IA</span>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-gray-500 hover:text-gray-700">
          Fermer
        </button>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Décris l'ambiance du visuel
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 bg-white"
          placeholder="Ex: stade de foot la nuit sous les projecteurs, ballon doré, ambiance Coupe du monde, couleurs chaudes"
        />
        <p className="text-[11px] text-gray-500 mt-1">
          L'IA génère le <strong>fond</strong> (pas le texte). Sois descriptif : lieu, ambiance, couleurs, objets.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={overlay} onChange={(e) => setOverlay(e.target.checked)} className="w-4 h-4 text-purple-600 rounded" />
        Ajouter un titre net en surimpression
      </label>

      {overlay && (
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={80}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 bg-white"
          placeholder="Titre affiché sur l'image (ex: La Coupe du monde arrive !)"
        />
      )}

      <button
        type="button"
        onClick={generate}
        disabled={loading || !prompt.trim()}
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
            Génération en cours… (~10 s)
          </>
        ) : (
          <>✨ Générer le visuel</>
        )}
      </button>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-700">{error}</div>
      )}

      {resultUrl && (
        <div className="space-y-1">
          <img src={resultUrl} alt="Visuel généré" className="w-full rounded-lg border border-gray-200" />
          <p className="text-[11px] text-green-700">✅ Visuel appliqué à la notification. Régénère si besoin.</p>
        </div>
      )}
    </div>
  )
}
