'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'

interface SharePronosModalProps {
  tournamentId: string
  matchId: string
  homeTeamName: string
  awayTeamName: string
  onClose: () => void
}

const BASE = 'https://www.pronohub.club'

export default function SharePronosModal({ tournamentId, matchId, homeTeamName, awayTeamName, onClose }: SharePronosModalProps) {
  const [mounted, setMounted] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [canNativeShare, setCanNativeShare] = useState(false)

  const shareUrl = `${BASE}/share/match/${tournamentId}/${matchId}`
  const shareText = `Les pronos de ${homeTeamName} - ${awayTeamName} sur PronoHub 👀`

  useEffect(() => setMounted(true), [])

  // Bloquer le scroll du body (y compris WebView Android)
  useEffect(() => {
    const scrollY = window.scrollY
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.width = '100%'
    document.body.style.top = `-${scrollY}px`
    return () => {
      document.documentElement.style.overflow = ''
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.width = ''
      document.body.style.top = ''
      window.scrollTo(0, scrollY)
    }
  }, [])

  // Charger l'image générée
  useEffect(() => {
    let revoked: string | null = null
    const load = async () => {
      try {
        setLoading(true)
        setError(false)
        const res = await fetch(`/api/og/match-pronos?tournamentId=${tournamentId}&matchId=${matchId}`)
        if (!res.ok) throw new Error('image')
        const b = await res.blob()
        const url = URL.createObjectURL(b)
        revoked = url
        setBlob(b)
        setImageUrl(url)
        // Web Share API avec fichier (mobile/Capacitor)
        const file = new File([b], 'pronos-pronohub.png', { type: 'image/png' })
        const nav = navigator as any
        setCanNativeShare(!!(nav.canShare && nav.canShare({ files: [file] })))
      } catch {
        setError(true)
      } finally {
        setLoading(false)
      }
    }
    load()
    return () => { if (revoked) URL.revokeObjectURL(revoked) }
  }, [tournamentId, matchId])

  const handleDownload = useCallback(() => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pronos-${homeTeamName}-${awayTeamName}.png`.replace(/\s+/g, '-').toLowerCase()
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
  }, [blob, homeTeamName, awayTeamName])

  const handleWhatsApp = useCallback(() => {
    window.open(`https://wa.me/?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`, '_blank')
  }, [shareText, shareUrl])

  const handleMessenger = useCallback(() => {
    // App mobile via schéma, sinon fallback web (Send Dialog)
    const appUrl = `fb-messenger://share/?link=${encodeURIComponent(shareUrl)}`
    const webUrl = `https://www.facebook.com/dialog/send?app_id=0&link=${encodeURIComponent(shareUrl)}&redirect_uri=${encodeURIComponent(shareUrl)}`
    const iframe = document.createElement('iframe')
    iframe.style.display = 'none'
    iframe.src = appUrl
    document.body.appendChild(iframe)
    setTimeout(() => {
      iframe.remove()
      window.open(webUrl, '_blank', 'width=600,height=500')
    }, 500)
  }, [shareUrl])

  const handleNativeShare = useCallback(async () => {
    if (!blob) return
    try {
      const file = new File([blob], 'pronos-pronohub.png', { type: 'image/png' })
      await (navigator as any).share({ files: [file], title: 'PronoHub', text: shareText })
    } catch (e: any) {
      if (e?.name !== 'AbortError') console.error('Partage natif échoué:', e)
    }
  }, [blob, shareText])

  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[10000] p-4" onClick={onClose}>
      <div
        className="theme-card max-w-md w-full max-h-[90vh] flex flex-col !p-0 overflow-hidden bg-white dark:bg-slate-900 rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b theme-border flex items-center justify-between shrink-0">
          <h3 className="text-base font-bold text-blue-600 dark:text-[#ff9900]">Partager les pronos</h3>
          <button onClick={onClose} className="p-2 rounded-lg theme-text-secondary hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors" aria-label="Fermer">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Aperçu image */}
        <div className="p-4 overflow-y-auto flex-1">
          <div className="rounded-xl overflow-hidden border theme-border bg-slate-100 dark:bg-slate-800 min-h-[120px] flex items-center justify-center">
            {loading ? (
              <div className="py-12 flex flex-col items-center gap-3">
                <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-blue-500 dark:border-[#ff9900]" />
                <span className="text-xs theme-text-secondary">Génération de l’image…</span>
              </div>
            ) : error ? (
              <p className="py-10 text-sm text-red-500 px-4 text-center">Impossible de générer l’image. Réessaie plus tard.</p>
            ) : imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="Aperçu des pronostics" className="w-full h-auto" />
            ) : null}
          </div>
        </div>

        {/* Boutons de partage */}
        <div className="p-4 pt-0 shrink-0 flex flex-col gap-2.5">
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={handleWhatsApp}
              disabled={loading}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-white transition hover:opacity-90 disabled:opacity-50"
              style={{ background: '#25D366' }}
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
              WhatsApp
            </button>
            <button
              onClick={handleMessenger}
              disabled={loading}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-white transition hover:opacity-90 disabled:opacity-50"
              style={{ background: '#0084FF' }}
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor"><path d="M12 0C5.24 0 0 4.95 0 11.64c0 3.5 1.44 6.53 3.78 8.62.2.18.32.43.32.7l.07 2.13c.02.68.72 1.12 1.34.85l2.38-1.05c.2-.09.43-.11.65-.05 1.06.29 2.18.45 3.36.45 6.76 0 12-4.95 12-11.64C24 4.95 18.76 0 12 0zm7.2 8.94l-3.53 5.6c-.56.89-1.76 1.11-2.61.48l-2.81-2.1a.72.72 0 00-.86 0l-3.79 2.88c-.51.39-1.17-.22-.83-.76l3.53-5.6c.56-.89 1.76-1.11 2.61-.48l2.81 2.1c.26.19.6.19.86 0l3.79-2.88c.51-.39 1.17.22.83.76z" /></svg>
              Messenger
            </button>
          </div>

          {canNativeShare && (
            <button
              onClick={handleNativeShare}
              disabled={loading}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold transition hover:opacity-90 disabled:opacity-50 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
              Plus d’options…
            </button>
          )}

          <button
            onClick={handleDownload}
            disabled={loading || !blob}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold transition hover:opacity-90 disabled:opacity-50 border-2 border-[#ff9900] text-[#ff9900]"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Télécharger l’image
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
