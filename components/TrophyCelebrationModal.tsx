'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'

// Couleurs du thème (gold premium en dark)
const THEME_COLORS = {
  dark: '#F5B800', // Gold premium
  light: '#3B82F6' // Bleu (si tu veux garder un mode clair)
}

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
  // Tous les hooks DOIVENT être appelés avant tout return conditionnel
  const [isVisible, setIsVisible] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [mounted, setMounted] = useState(false)
  const [isAndroidWebView, setIsAndroidWebView] = useState(false)
  const continueButtonRef = useRef<HTMLButtonElement>(null)

  // Marquer comme monté côté client (pour createPortal)
  useEffect(() => {
    setMounted(true)
    // Détecter Android WebView (le téléchargement ne fonctionne pas dans ce contexte)
    const userAgent = navigator.userAgent || ''
    const isWebView = /Android.*wv/.test(userAgent) || /; wv\)/.test(userAgent)
    setIsAndroidWebView(isWebView)
  }, [])

  // Détecter le thème actif
  useEffect(() => {
    const currentTheme = (localStorage.getItem('theme') as 'dark' | 'light') || 'dark'
    setTheme(currentTheme)
  }, [])

  const themeColor = THEME_COLORS[theme]

  // Animation d'entrée
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 30)
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

  // Date FR
  const unlockedDate = new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(trophy.unlocked_at))

  // Génère l'image du trophée pour partage/download
  const generateTrophyImage = useCallback(async (): Promise<Blob | null> => {
    try {
      const captureDiv = document.createElement('div')
      captureDiv.style.cssText = `
        width: 420px;
        border-radius: 28px;
        border: 1px solid ${themeColor}40;
        padding: 22px 22px 20px;
        position: fixed;
        left: -9999px;
        top: 0;
        font-family: system-ui, -apple-system, sans-serif;
        color: white;
        overflow: hidden;
        background:
          radial-gradient(120% 80% at 50% 0%, ${themeColor}2E 0%, rgba(0,0,0,0) 45%),
          radial-gradient(120% 120% at 50% 100%, ${themeColor}18 0%, rgba(0,0,0,0) 60%),
          linear-gradient(180deg, #0B0B0C 0%, #050506 100%);
        box-shadow: 0 24px 80px rgba(0,0,0,0.65);
      `

      // Header premium (logo + titre centré)
      const header = document.createElement('div')
      header.style.cssText = 'text-align:center; margin-bottom: 12px;'
      header.innerHTML = `
        <img src="/images/logo.png" style="height: 28px; width: auto; margin: 0 auto 8px; display: block;" />
        <div style="font-size: 16px; font-weight: 900; color: ${themeColor}; letter-spacing: 0.14em; text-transform: uppercase;">TROPHÉE DÉBLOQUÉ</div>
      `
      captureDiv.appendChild(header)

      // Separator
      const sep = document.createElement('div')
      sep.style.cssText = `height: 1px; width: 100%; background: linear-gradient(90deg, transparent, ${themeColor}60, transparent); margin: 10px 0 14px;`
      captureDiv.appendChild(sep)

      // Trophy image
      const trophyContainer = document.createElement('div')
      trophyContainer.style.cssText = 'display:flex; justify-content:center; margin-bottom: 10px; position:relative;'
      trophyContainer.innerHTML = `
        <div style="position:absolute; inset:0; display:flex; justify-content:center; align-items:center;">
          <div style="width: 180px; height: 180px; border-radius: 999px; background: radial-gradient(circle, ${themeColor}40 0%, rgba(0,0,0,0) 65%); filter: blur(16px); opacity: 0.55;"></div>
        </div>
        <img src="${trophy.imagePath}" style="width: 164px; height: 164px; object-fit: contain; position:relative; z-index:1;" />
      `
      captureDiv.appendChild(trophyContainer)

      // Trophy name & description
      const info = document.createElement('div')
      info.style.cssText = 'text-align:center; margin-bottom: 14px;'
      info.innerHTML = `
        <div style="font-size: 30px; font-weight: 900; color: #fff; margin: 0;">${trophy.name}</div>
        <div style="font-size: 14px; color: rgba(255,255,255,0.70); margin-top: 4px;">${trophy.description}</div>
      `
      captureDiv.appendChild(info)

      // Match card
      if (trophy.triggerMatch) {
        const hasScore = trophy.triggerMatch.homeScore !== undefined && trophy.triggerMatch.awayScore !== undefined
        const scoreDisplay = hasScore ? `${trophy.triggerMatch.homeScore} - ${trophy.triggerMatch.awayScore}` : 'VS'

        const matchCard = document.createElement('div')
        matchCard.style.cssText = `
          border-radius: 18px;
          border: 1px solid rgba(245,184,0,0.22);
          padding: 14px 14px 12px;
          margin-bottom: 14px;
          background:
            radial-gradient(120% 120% at 50% 0%, ${themeColor}1F 0%, rgba(0,0,0,0) 55%),
            linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%);
        `
        matchCard.innerHTML = `
          <div style="color:${themeColor}; font-size: 13px; font-weight: 700; text-align:center; margin-bottom: 10px;">Match décisif</div>

          <div style="display:flex; align-items:center; justify-content:space-between;">
            <div style="flex:1; text-align:center;">
              ${
                trophy.triggerMatch.homeTeamCrest
                  ? `<img src="${getProxiedUrl(trophy.triggerMatch.homeTeamCrest)}" crossorigin="anonymous" style="width: 36px; height: 36px; margin: 0 auto 4px; display:block;" />`
                  : `<div style="width:36px;height:36px;margin:0 auto 4px;border-radius:999px;background:rgba(255,255,255,0.08)"></div>`
              }
              <div style="font-size: 10px; color: rgba(255,255,255,0.82); line-height: 1.25;">${trophy.triggerMatch.homeTeamName}</div>
            </div>

            <div style="
              padding: 6px 10px;
              border-radius: 12px;
              border: 1px solid ${themeColor}35;
              background: rgba(0,0,0,0.35);
              font-size: 28px;
              font-weight: 900;
              color: ${themeColor};
              letter-spacing: 0.04em;
              margin: 0 8px;
            ">
              ${scoreDisplay}
            </div>

            <div style="flex:1; text-align:center;">
              ${
                trophy.triggerMatch.awayTeamCrest
                  ? `<img src="${getProxiedUrl(trophy.triggerMatch.awayTeamCrest)}" crossorigin="anonymous" style="width: 36px; height: 36px; margin: 0 auto 4px; display:block;" />`
                  : `<div style="width:36px;height:36px;margin:0 auto 4px;border-radius:999px;background:rgba(255,255,255,0.08)"></div>`
              }
              <div style="font-size: 10px; color: rgba(255,255,255,0.82); line-height: 1.25;">${trophy.triggerMatch.awayTeamName}</div>
            </div>
          </div>

          <div style="font-size: 11px; color: rgba(255,255,255,0.52); text-align:center; margin-top: 10px;">
            Débloqué le ${unlockedDate}
          </div>
        `
        captureDiv.appendChild(matchCard)
      }

      // Footer
      const footer = document.createElement('div')
      footer.style.cssText = 'text-align:center; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.08);'
      footer.innerHTML = `<div style="font-size: 12px; color: rgba(255,255,255,0.40);">pronohub.club</div>`
      captureDiv.appendChild(footer)

      document.body.appendChild(captureDiv)
      await new Promise(resolve => setTimeout(resolve, 280))

      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(captureDiv, {
        backgroundColor: '#050506',
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
  }, [trophy, unlockedDate, themeColor])

  // Download
  const handleDownload = async () => {
    if (isDownloading) return
    setIsDownloading(true)

    try {
      const blob = await generateTrophyImage()

      if (blob) {
        const filename = `pronohub-trophy-${trophy.name.replace(/\s+/g, '-').toLowerCase()}.png`

        // Essayer d'abord Web Share API (fonctionne sur mobile Android/iOS natif)
        if (navigator.share && navigator.canShare) {
          try {
            const file = new File([blob], filename, { type: 'image/png' })
            if (navigator.canShare({ files: [file] })) {
              await navigator.share({
                title: `Trophée PronoHub - ${trophy.name}`,
                files: [file]
              })
              setIsDownloading(false)
              return
            }
          } catch (e: any) {
            // Utilisateur a annulé = pas d'erreur
            if (e.name === 'AbortError') {
              setIsDownloading(false)
              return
            }
          }
        }

        // Fallback: téléchargement classique (desktop/web mobile)
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)

        // Nettoyer après un délai
        setTimeout(() => URL.revokeObjectURL(url), 5000)
      }
    } catch (error) {
      console.error('[Download] Error:', error)
    }
    setIsDownloading(false)
  }

  // Share
  const handleShare = async (platform: 'whatsapp' | 'facebook' | 'messenger') => {
    const text = `🏆 J'ai débloqué le trophée "${trophy.name}" sur PronoHub !\n\n${trophy.description}\n\nMerci le talent ou la chatte à Dédé ? 😏\n\n👉 Rejoins-moi sur pronohub.club`

    // Try Web Share API with file first
    if (navigator.share && navigator.canShare) {
      try {
        const blob = await generateTrophyImage()
        if (blob) {
          const file = new File([blob], `pronohub-trophy.png`, { type: 'image/png' })
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: `Trophée PronoHub - ${trophy.name}`,
              text,
              files: [file]
            })
            return
          }
        }
      } catch (error: any) {
        if (error.name === 'AbortError') return
      }
    }

    // Fallback URLs par plateforme
    if (platform === 'facebook') {
      const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://www.pronohub.club')}&quote=${encodeURIComponent(text)}`
      window.open(shareUrl, '_blank', 'width=600,height=400')
    } else if (platform === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
    } else if (platform === 'messenger') {
      // Messenger share link (ouvre l'app Messenger sur mobile ou le site web)
      const messengerUrl = `fb-messenger://share/?link=${encodeURIComponent('https://www.pronohub.club')}&app_id=0`
      // Fallback vers la version web si l'app n'est pas installée
      const webFallback = `https://www.facebook.com/dialog/send?link=${encodeURIComponent('https://www.pronohub.club')}&app_id=0&redirect_uri=${encodeURIComponent('https://www.pronohub.club')}`

      // Essayer d'ouvrir l'app, sinon fallback web
      const iframe = document.createElement('iframe')
      iframe.style.display = 'none'
      iframe.src = messengerUrl
      document.body.appendChild(iframe)

      setTimeout(() => {
        document.body.removeChild(iframe)
        // Si on est toujours sur la page, ouvrir la version web
        window.open(webFallback, '_blank', 'width=600,height=400')
      }, 500)
    }
  }

  const hasScore = trophy.triggerMatch?.homeScore !== undefined && trophy.triggerMatch?.awayScore !== undefined
  const scoreDisplay = hasScore ? `${trophy.triggerMatch!.homeScore} - ${trophy.triggerMatch!.awayScore}` : 'VS'

  const borderColorClass = theme === 'dark' ? 'border-[#F5B800]/25' : 'border-[#3B82F6]/25'

  const gradientBg =
    theme === 'dark'
      ? 'radial-gradient(120% 80% at 50% 0%, rgba(245,184,0,0.20) 0%, rgba(0,0,0,0) 45%), radial-gradient(120% 120% at 50% 100%, rgba(245,184,0,0.10) 0%, rgba(0,0,0,0) 60%), linear-gradient(180deg, #0B0B0C 0%, #050506 100%)'
      : 'radial-gradient(120% 80% at 50% 0%, rgba(59,130,246,0.18) 0%, rgba(0,0,0,0) 45%), radial-gradient(120% 120% at 50% 100%, rgba(59,130,246,0.08) 0%, rgba(0,0,0,0) 60%), linear-gradient(180deg, #0B0B0C 0%, #050506 100%)'

  // CTA gradient premium
  const buttonGradient =
    theme === 'dark'
      ? 'linear-gradient(180deg, #FFD36A 0%, #F5B800 55%, #D99A00 100%)'
      : 'linear-gradient(180deg, #60A5FA 0%, #3B82F6 55%, #2563EB 100%)'

  // Le contenu de la modale (styles inline pour garantir l'affichage sur mobile)
  const modalContent = (
    <div
      id="trophy-modal-backdrop"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        opacity: isVisible ? 1 : 0,
        transition: 'opacity 200ms ease'
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="trophy-title"
    >
      {/* Modal Container */}
      <div
        id="trophy-modal-container"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '420px',
          margin: '0 16px',
          borderRadius: '24px',
          border: theme === 'dark' ? '1px solid rgba(245, 184, 0, 0.25)' : '1px solid rgba(59, 130, 246, 0.25)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.65)',
          background: gradientBg,
          transform: isVisible ? 'scale(1) translateY(0)' : 'scale(0.98) translateY(8px)',
          opacity: isVisible ? 1 : 0,
          transition: 'all 200ms ease-out'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 h-11 w-11 flex items-center justify-center rounded-full transition-colors hover:bg-white/5"
          aria-label="Fermer"
        >
          <svg className="w-5 h-5 text-white/55" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Content */}
        <div className="px-6 pt-5 pb-6">
          {/* Header premium (logo centré) */}
          <div className="text-center">
            <img
              src="/images/logo.png"
              alt="PronoHub"
              className="h-7 w-auto mx-auto object-contain"
            />
            <h1
              id="trophy-title"
              className="mt-2 text-[15px] font-extrabold uppercase tracking-[0.16em]"
              style={{ color: themeColor }}
            >
              Trophée débloqué
            </h1>
          </div>

          {/* Separator gradient */}
          <div
            className="mt-3 h-px w-full"
            style={{ background: `linear-gradient(90deg, transparent, ${themeColor}60, transparent)` }}
          />

          {/* Trophy Image + glow */}
          <div className="relative mt-4 flex justify-center">
            <div
              className="absolute inset-0 flex items-center justify-center"
              aria-hidden="true"
            >
              <div
                className="w-44 h-44 rounded-full opacity-50 blur-2xl"
                style={{ background: `radial-gradient(circle, ${themeColor}55 0%, transparent 65%)` }}
              />
            </div>

            <img
              src={trophy.imagePath}
              alt={trophy.name}
              className="relative z-10 w-[164px] h-[164px] object-contain"
              onError={(e) => {
                ;(e.target as HTMLImageElement).src = '/trophy/default.png'
              }}
            />
          </div>

          {/* Trophy Name & Description */}
          <div className="mt-3 text-center">
            <h2 className="text-[30px] leading-tight font-extrabold text-white">
              {trophy.name}
            </h2>
            <p className="mt-1 text-sm text-white/70">
              {trophy.description}
            </p>
          </div>

          {/* Match Card */}
          {trophy.triggerMatch && (
            <div
              className="mt-5 rounded-2xl border px-4 py-4"
              style={{
                borderColor: `${themeColor}35`,
                background:
                  `radial-gradient(120% 120% at 50% 0%, ${themeColor}22 0%, rgba(0,0,0,0) 55%), ` +
                  'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)'
              }}
            >
              <p className="text-[13px] font-semibold text-center mb-3" style={{ color: themeColor }}>
                Match décisif
              </p>

              <div className="flex items-center justify-between">
                {/* Home */}
                <div className="flex-1 flex flex-col items-center">
                  {trophy.triggerMatch.homeTeamCrest ? (
                    <img
                      src={getProxiedUrl(trophy.triggerMatch.homeTeamCrest) ?? undefined}
                      alt={trophy.triggerMatch.homeTeamName}
                      className="w-9 h-9 sm:w-10 sm:h-10 object-contain"
                      crossOrigin="anonymous"
                      onError={(e) => {
                        ;(e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  ) : (
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/10" />
                  )}
                  <p className="mt-1 text-[10px] text-white/80 text-center leading-tight line-clamp-2 max-w-[90px]">
                    {trophy.triggerMatch.homeTeamName}
                  </p>
                </div>

                {/* Score pill */}
                <div
                  className="mx-2 px-2.5 py-1.5 rounded-xl border bg-black/30"
                  style={{ borderColor: `${themeColor}35` }}
                >
                  <span className="text-[28px] font-extrabold tracking-wide" style={{ color: themeColor }}>
                    {scoreDisplay}
                  </span>
                </div>

                {/* Away */}
                <div className="flex-1 flex flex-col items-center">
                  {trophy.triggerMatch.awayTeamCrest ? (
                    <img
                      src={getProxiedUrl(trophy.triggerMatch.awayTeamCrest) ?? undefined}
                      alt={trophy.triggerMatch.awayTeamName}
                      className="w-9 h-9 sm:w-10 sm:h-10 object-contain"
                      crossOrigin="anonymous"
                      onError={(e) => {
                        ;(e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  ) : (
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/10" />
                  )}
                  <p className="mt-1 text-[10px] text-white/80 text-center leading-tight line-clamp-2 max-w-[90px]">
                    {trophy.triggerMatch.awayTeamName}
                  </p>
                </div>
              </div>

              <p className="mt-3 text-xs text-white/55 text-center">
                Débloqué le {unlockedDate}
              </p>
            </div>
          )}

          {/* Share Zone */}
          <div className="mt-5">
            <p className="text-sm text-white/85 font-medium text-center mb-3">
              🔥 Partage ton exploit
            </p>
            <div className="flex justify-center gap-4">
              {/* WhatsApp */}
              <button
                onClick={() => handleShare('whatsapp')}
                className="h-12 w-12 rounded-full flex items-center justify-center transition hover:bg-white/5 active:scale-[0.98] bg-black/20"
                style={{ border: `1px solid ${themeColor}50` }}
                aria-label="Partager sur WhatsApp"
                title="WhatsApp"
              >
                <svg className="w-6 h-6" fill={themeColor} viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.304-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                </svg>
              </button>

              {/* Facebook */}
              <button
                onClick={() => handleShare('facebook')}
                className="h-12 w-12 rounded-full flex items-center justify-center transition hover:bg-white/5 active:scale-[0.98] bg-black/20"
                style={{ border: `1px solid ${themeColor}50` }}
                aria-label="Partager sur Facebook"
                title="Facebook"
              >
                <svg className="w-6 h-6" fill={themeColor} viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </button>

              {/* Messenger */}
              <button
                onClick={() => handleShare('messenger')}
                className="h-12 w-12 rounded-full flex items-center justify-center transition hover:bg-white/5 active:scale-[0.98] bg-black/20"
                style={{ border: `1px solid ${themeColor}50` }}
                aria-label="Partager sur Messenger"
                title="Messenger"
              >
                <svg className="w-6 h-6" fill={themeColor} viewBox="0 0 24 24">
                  <path d="M12 0C5.373 0 0 4.974 0 11.111c0 3.498 1.744 6.614 4.469 8.654V24l4.088-2.242c1.092.3 2.246.464 3.443.464 6.627 0 12-4.975 12-11.111S18.627 0 12 0zm1.191 14.963l-3.055-3.26-5.963 3.26L10.732 8l3.131 3.259L19.752 8l-6.561 6.963z" />
                </svg>
              </button>

              {/* Download - Masqué sur Android WebView (le téléchargement ne fonctionne pas) */}
              {!isAndroidWebView && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleDownload()
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleDownload()
                  }}
                  disabled={isDownloading}
                  className="h-12 w-12 rounded-full flex items-center justify-center transition hover:bg-white/5 active:scale-[0.98] disabled:opacity-50 bg-black/20"
                  style={{ border: `1px solid ${themeColor}50` }}
                  aria-label="Télécharger l'image"
                  title="Télécharger"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke={themeColor} strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* CTA Button */}
          <button
            ref={continueButtonRef}
            onClick={onClose}
            className="mt-5 w-full rounded-full py-3 text-sm font-bold text-black tracking-wide transition hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black shadow-[0_10px_24px_rgba(0,0,0,0.40)]"
            style={{
              background: buttonGradient,
              '--tw-ring-color': `${themeColor}85`
            } as React.CSSProperties}
          >
            CONTINUER →
          </button>
        </div>
      </div>
    </div>
  )

  // Ne pas rendre côté serveur
  if (!mounted) {
    return null
  }

  // Utiliser createPortal pour échapper au stacking context de overflow-y-auto
  return createPortal(modalContent, document.body)
}
