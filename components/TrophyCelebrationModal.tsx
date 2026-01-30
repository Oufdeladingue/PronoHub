'use client'

import { useEffect, useState, useRef, useCallback } from 'react'

// Couleurs
const GOLD = '#F5B800'
const GOLD_BORDER = 'rgba(245, 184, 0, 0.35)'

// Helper pour convertir une URL externe en URL proxy
const getProxiedUrl = (url: string | null): string | null => {
  if (!url) return null
  if (url.startsWith('/') || url.startsWith('data:') || url.startsWith('blob:')) {
    return url
  }
  return `/api/proxy-image?url=${encodeURIComponent(url)}`
}

interface TrophyCelebrationModalProps {
  trophy: {
    name: string
    description: string
    imagePath: string
    unlocked_at: string
    triggerMatch?: {
      homeTeamName: string
      awayTeamName: string
      homeTeamCrest: string | null
      awayTeamCrest: string | null
      competitionId: number
      homeScore?: number
      awayScore?: number
    }
  }
  onClose: () => void
}

export default function TrophyCelebrationModal({ trophy, onClose }: TrophyCelebrationModalProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const continueButtonRef = useRef<HTMLButtonElement>(null)

  // Animation d'entrée
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50)
    return () => clearTimeout(timer)
  }, [])

  // Focus sur le bouton Continuer à l'ouverture
  useEffect(() => {
    if (isVisible && continueButtonRef.current) {
      continueButtonRef.current.focus()
    }
  }, [isVisible])

  // Bloquer le scroll du body
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  // Fermer avec ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  // Formater la date
  const unlockedDate = new Date(trophy.unlocked_at).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })

  // Génère l'image du trophée pour partage/download
  const generateTrophyImage = useCallback(async (): Promise<Blob | null> => {
    try {
      const captureDiv = document.createElement('div')
      captureDiv.style.cssText = `
        width: 420px;
        background: linear-gradient(180deg, #1a1408 0%, #0d0d0d 30%, #000000 100%);
        border-radius: 24px;
        border: 1px solid ${GOLD_BORDER};
        padding: 24px;
        position: fixed;
        left: -9999px;
        top: 0;
        font-family: system-ui, -apple-system, sans-serif;
      `

      // Header avec lignes décoratives
      const header = document.createElement('div')
      header.style.cssText = 'text-align: center; margin-bottom: 16px;'
      header.innerHTML = `
        <div style="font-size: 40px; margin-bottom: 8px;">🏆</div>
        <div style="display: flex; align-items: center; justify-content: center; gap: 12px;">
          <div style="flex: 1; height: 1px; background: linear-gradient(90deg, transparent, ${GOLD});"></div>
          <div style="font-size: 16px; font-weight: bold; color: ${GOLD}; letter-spacing: 0.1em; white-space: nowrap;">TROPHÉE DÉBLOQUÉ</div>
          <div style="flex: 1; height: 1px; background: linear-gradient(90deg, ${GOLD}, transparent);"></div>
        </div>
      `
      captureDiv.appendChild(header)

      // Trophy image (l'image contient déjà le cercle bleu et le ruban)
      const trophyContainer = document.createElement('div')
      trophyContainer.style.cssText = 'display: flex; justify-content: center; margin-bottom: 12px;'
      trophyContainer.innerHTML = `<img src="${trophy.imagePath}" style="width: 160px; height: 160px; object-fit: contain;" />`
      captureDiv.appendChild(trophyContainer)

      // Trophy name & description
      const info = document.createElement('div')
      info.style.cssText = 'text-align: center; margin-bottom: 16px;'
      info.innerHTML = `
        <h2 style="font-size: 26px; font-weight: bold; color: white; margin: 0 0 6px 0;">${trophy.name}</h2>
        <p style="font-size: 14px; color: rgba(255,255,255,0.6); margin: 0;">${trophy.description}</p>
      `
      captureDiv.appendChild(info)

      // Match card
      if (trophy.triggerMatch) {
        const hasScore = trophy.triggerMatch.homeScore !== undefined && trophy.triggerMatch.awayScore !== undefined
        const matchCard = document.createElement('div')
        matchCard.style.cssText = `
          background: rgba(30, 30, 30, 0.8);
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.1);
          padding: 14px;
          margin-bottom: 16px;
        `
        matchCard.innerHTML = `
          <div style="color: ${GOLD}; font-size: 13px; font-weight: 600; text-align: center; margin-bottom: 10px;">Match décisif</div>
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div style="flex: 1; text-align: center;">
              ${trophy.triggerMatch.homeTeamCrest ? `<img src="${getProxiedUrl(trophy.triggerMatch.homeTeamCrest)}" crossorigin="anonymous" style="width: 44px; height: 44px; margin: 0 auto 4px; display: block;" />` : '<div style="width: 44px; height: 44px; margin: 0 auto 4px; background: #333; border-radius: 50%;"></div>'}
              <div style="font-size: 11px; color: rgba(255,255,255,0.8); line-height: 1.2;">${trophy.triggerMatch.homeTeamName}</div>
            </div>
            <div style="font-size: ${hasScore ? '32px' : '28px'}; font-weight: bold; color: ${GOLD}; padding: 0 8px;">${hasScore ? `${trophy.triggerMatch.homeScore} - ${trophy.triggerMatch.awayScore}` : 'vs'}</div>
            <div style="flex: 1; text-align: center;">
              ${trophy.triggerMatch.awayTeamCrest ? `<img src="${getProxiedUrl(trophy.triggerMatch.awayTeamCrest)}" crossorigin="anonymous" style="width: 44px; height: 44px; margin: 0 auto 4px; display: block;" />` : '<div style="width: 44px; height: 44px; margin: 0 auto 4px; background: #333; border-radius: 50%;"></div>'}
              <div style="font-size: 11px; color: rgba(255,255,255,0.8); line-height: 1.2;">${trophy.triggerMatch.awayTeamName}</div>
            </div>
          </div>
          <div style="font-size: 11px; color: #888; text-align: center; margin-top: 10px;">Débloqué le ${unlockedDate}</div>
        `
        captureDiv.appendChild(matchCard)
      }

      // Footer
      const footer = document.createElement('div')
      footer.style.cssText = 'text-align: center; padding-top: 12px; border-top: 1px solid #222;'
      footer.innerHTML = `<div style="font-size: 12px; color: #555;">pronohub.club</div>`
      captureDiv.appendChild(footer)

      document.body.appendChild(captureDiv)
      await new Promise(resolve => setTimeout(resolve, 300))

      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(captureDiv, {
        backgroundColor: '#000000',
        scale: 2,
        useCORS: true,
        allowTaint: true
      })

      document.body.removeChild(captureDiv)

      return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), 'image/png')
      })
    } catch (error) {
      console.error('[generateTrophyImage] Error:', error)
      return null
    }
  }, [trophy, unlockedDate])

  // Download
  const handleDownload = async () => {
    if (isDownloading) return
    setIsDownloading(true)
    try {
      const blob = await generateTrophyImage()
      if (blob) {
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `pronohub-trophy-${trophy.name.replace(/\s+/g, '-').toLowerCase()}.png`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error('[Download] Error:', error)
      alert('Erreur lors du téléchargement')
    }
    setIsDownloading(false)
  }

  // Share
  const handleShare = async (platform: 'whatsapp' | 'facebook' | 'download') => {
    if (platform === 'download') {
      handleDownload()
      return
    }

    const text = `🏆 J'ai débloqué le trophée "${trophy.name}" sur PronoHub !\n${trophy.description}\n\nRejoins-moi sur pronohub.club`

    // Try Web Share API with file first
    if (navigator.share && navigator.canShare) {
      try {
        const blob = await generateTrophyImage()
        if (blob) {
          const file = new File([blob], `pronohub-trophy.png`, { type: 'image/png' })
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: `Trophée PronoHub - ${trophy.name}`,
              text: text,
              files: [file]
            })
            return
          }
        }
      } catch (error: any) {
        if (error.name === 'AbortError') return
        console.log('[Share] Fallback to URL share')
      }
    }

    // Fallback
    if (platform === 'facebook') {
      const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://www.pronohub.club')}&quote=${encodeURIComponent(text)}`
      window.open(shareUrl, '_blank', 'width=600,height=400')
    } else if (platform === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
    }
  }

  const hasScore = trophy.triggerMatch?.homeScore !== undefined && trophy.triggerMatch?.awayScore !== undefined

  return (
    <div
      className={`fixed inset-0 z-100 flex items-center justify-center p-4 transition-all duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.9)' }}
      onClick={onClose}
    >
      {/* Modal */}
      <div
        className={`relative w-[92vw] max-w-[400px] rounded-3xl overflow-hidden transform transition-all duration-300 ${
          isVisible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'
        }`}
        style={{
          background: 'linear-gradient(180deg, #1a1408 0%, #0d0d0d 25%, #000000 100%)',
          border: `1px solid ${GOLD_BORDER}`,
          boxShadow: '0 25px 80px rgba(0, 0, 0, 0.8)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-10 h-10 flex items-center justify-center rounded-full transition-colors hover:bg-white/10"
          style={{ color: 'rgba(255,255,255,0.5)' }}
          aria-label="Fermer"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Content */}
        <div className="p-5 pt-6">
          {/* Header avec lignes décoratives */}
          <div className="text-center mb-3">
            <div className="text-4xl mb-2">🏆</div>
            <div className="flex items-center justify-center gap-3">
              <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, transparent, ${GOLD})` }}></div>
              <h1
                className="text-sm font-bold uppercase tracking-[0.15em] whitespace-nowrap"
                style={{ color: GOLD }}
              >
                Trophée débloqué
              </h1>
              <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${GOLD}, transparent)` }}></div>
            </div>
          </div>

          {/* Trophy Image (contient déjà le cercle bleu et le ruban) */}
          <div className="flex justify-center mb-3">
            <img
              src={trophy.imagePath}
              alt={trophy.name}
              className="w-40 h-40 object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/trophy/default.png'
              }}
            />
          </div>

          {/* Trophy Name & Description */}
          <div className="text-center mb-4">
            <h2 className="text-2xl font-bold text-white mb-1">
              {trophy.name}
            </h2>
            <p className="text-sm text-white/60">
              {trophy.description}
            </p>
          </div>

          {/* Match Card */}
          {trophy.triggerMatch && (
            <div
              className="rounded-2xl p-3.5 mb-4"
              style={{
                backgroundColor: 'rgba(30, 30, 30, 0.8)',
                border: '1px solid rgba(255,255,255,0.08)'
              }}
            >
              <p className="text-xs font-semibold text-center mb-2.5" style={{ color: GOLD }}>
                Match décisif
              </p>
              <div className="flex items-center justify-between">
                {/* Home */}
                <div className="flex-1 flex flex-col items-center">
                  {trophy.triggerMatch.homeTeamCrest ? (
                    <img
                      src={trophy.triggerMatch.homeTeamCrest}
                      alt={trophy.triggerMatch.homeTeamName}
                      className="w-11 h-11 mb-1"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  ) : (
                    <div className="w-11 h-11 mb-1 rounded-full bg-gray-700 flex items-center justify-center">
                      <span className="text-xl">⚽</span>
                    </div>
                  )}
                  <p className="text-[11px] text-white/80 text-center leading-tight line-clamp-2 px-1">
                    {trophy.triggerMatch.homeTeamName}
                  </p>
                </div>

                {/* Score */}
                <div className="px-2">
                  {hasScore ? (
                    <span className="text-[32px] font-bold" style={{ color: GOLD }}>
                      {trophy.triggerMatch.homeScore} - {trophy.triggerMatch.awayScore}
                    </span>
                  ) : (
                    <span className="text-2xl font-bold" style={{ color: GOLD }}>vs</span>
                  )}
                </div>

                {/* Away */}
                <div className="flex-1 flex flex-col items-center">
                  {trophy.triggerMatch.awayTeamCrest ? (
                    <img
                      src={trophy.triggerMatch.awayTeamCrest}
                      alt={trophy.triggerMatch.awayTeamName}
                      className="w-11 h-11 mb-1"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  ) : (
                    <div className="w-11 h-11 mb-1 rounded-full bg-gray-700 flex items-center justify-center">
                      <span className="text-xl">⚽</span>
                    </div>
                  )}
                  <p className="text-[11px] text-white/80 text-center leading-tight line-clamp-2 px-1">
                    {trophy.triggerMatch.awayTeamName}
                  </p>
                </div>
              </div>
              <p className="text-[11px] text-gray-500 text-center mt-2.5">
                Débloqué le {unlockedDate}
              </p>
            </div>
          )}

          {/* Share Zone */}
          <div className="mb-4">
            <p className="text-white text-sm text-center mb-3">
              🔥 Partage ton exploit
            </p>
            <div className="flex justify-center gap-4">
              {/* WhatsApp */}
              <button
                onClick={() => handleShare('whatsapp')}
                className="w-12 h-12 rounded-full flex items-center justify-center transition-all hover:bg-[rgba(245,184,0,0.15)] active:scale-95"
                style={{ border: `2px solid ${GOLD}` }}
                title="WhatsApp"
              >
                <svg className="w-6 h-6" fill={GOLD} viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.304-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
              </button>

              {/* Facebook */}
              <button
                onClick={() => handleShare('facebook')}
                className="w-12 h-12 rounded-full flex items-center justify-center transition-all hover:bg-[rgba(245,184,0,0.15)] active:scale-95"
                style={{ border: `2px solid ${GOLD}` }}
                title="Facebook"
              >
                <svg className="w-6 h-6" fill={GOLD} viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </button>

              {/* Download */}
              <button
                onClick={() => handleShare('download')}
                disabled={isDownloading}
                className="w-12 h-12 rounded-full flex items-center justify-center transition-all hover:bg-[rgba(245,184,0,0.15)] active:scale-95 disabled:opacity-50"
                style={{ border: `2px solid ${GOLD}` }}
                title="Télécharger"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke={GOLD} strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>
            </div>
          </div>

          {/* CTA Button */}
          <button
            ref={continueButtonRef}
            onClick={onClose}
            className="w-full py-3.5 rounded-full text-black font-bold text-sm tracking-wide transition-all active:scale-[0.98] hover:brightness-110"
            style={{ backgroundColor: GOLD }}
          >
            CONTINUER →
          </button>
        </div>
      </div>
    </div>
  )
}
