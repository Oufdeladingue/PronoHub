'use client'

import { useState, useCallback } from 'react'

const SHARE_URL = 'https://www.pronohub.club'
const SHARE_TEXT = 'Crée ton tournoi de pronostics foot gratuit et défie tes potes sur PronoHub !'

const socials = [
  {
    name: 'WhatsApp',
    tooltip: 'Partager sur WhatsApp',
    href: `https://wa.me/?text=${encodeURIComponent(`${SHARE_TEXT} ${SHARE_URL}`)}`,
    icon: (
      <svg viewBox="0 0 24 24" className="share-icon w-5 h-5" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    ),
    brandColor: '#25D366',
  },
  {
    name: 'X',
    tooltip: 'Partager sur X',
    href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(SHARE_TEXT)}&url=${encodeURIComponent(SHARE_URL)}`,
    icon: (
      <svg viewBox="0 0 24 24" className="share-icon w-4.5 h-4.5" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
    brandColor: '#ffffff',
  },
  {
    name: 'Facebook',
    tooltip: 'Partager sur Facebook',
    href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(SHARE_URL)}`,
    icon: (
      <svg viewBox="0 0 24 24" className="share-icon w-5 h-5" fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
    brandColor: '#1877F2',
  },
  {
    name: 'Telegram',
    tooltip: 'Partager sur Telegram',
    href: `https://t.me/share/url?url=${encodeURIComponent(SHARE_URL)}&text=${encodeURIComponent(SHARE_TEXT)}`,
    icon: (
      <svg viewBox="0 0 24 24" className="share-icon w-5 h-5" fill="currentColor">
        <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
      </svg>
    ),
    brandColor: '#0088cc',
  },
  {
    name: 'Copier le lien',
    tooltip: 'Copier le lien de partage',
    href: null as string | null,
    icon: (
      <svg viewBox="0 0 24 24" className="share-icon w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
      </svg>
    ),
    brandColor: '#ffffff',
  },
]

/** Spawn 6 tiny orange dots that burst outward from center */
function createBurst(el: HTMLElement) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  const count = 6
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count
    const dot = document.createElement('span')
    dot.setAttribute('aria-hidden', 'true')
    dot.style.cssText = `
      position:absolute; width:4px; height:4px; border-radius:50%;
      background:#ff9900; left:50%; top:50%; pointer-events:none; z-index:10;
    `
    el.appendChild(dot)

    const tx = Math.cos(angle) * 22
    const ty = Math.sin(angle) * 22
    const anim = dot.animate(
      [
        { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
        { transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(0)`, opacity: 0 },
      ],
      { duration: 380, easing: 'cubic-bezier(0.16,1,0.3,1)', fill: 'forwards' },
    )
    anim.onfinish = () => dot.remove()
  }
}

export function ShareButtons() {
  const [copied, setCopied] = useState(false)
  const [glowIdx, setGlowIdx] = useState<number | null>(null)

  const handleClick = useCallback((idx: number, el: HTMLElement) => {
    createBurst(el)
    setGlowIdx(idx)
    setTimeout(() => setGlowIdx(null), 400)
  }, [])

  const handleCopyLink = async (e: React.MouseEvent<HTMLButtonElement>) => {
    const el = e.currentTarget
    try {
      await navigator.clipboard.writeText(`${SHARE_TEXT} ${SHARE_URL}`)
      createBurst(el)
      setGlowIdx(socials.length - 1)
      setCopied(true)
      setTimeout(() => {
        setCopied(false)
        setGlowIdx(null)
      }, 700)
    } catch {
      // Fallback
    }
  }

  return (
    <div className="flex items-center gap-4">
      {socials.map((s, i) => {
        const isGlowing = glowIdx === i
        const isCopy = s.href === null

        const btnClass = [
          'share-btn group relative flex items-center justify-center w-12 h-12 rounded-full',
          'bg-[#1e293b] border border-white/10 text-[#94a3b8]',
          'outline-none focus-visible:ring-2 focus-visible:ring-[#ff9900]/50',
          isGlowing ? 'share-btn-glow' : '',
        ].join(' ')

        const tooltipText = isCopy && copied ? 'Copié !' : s.tooltip
        const showTooltipAlways = isCopy && copied

        const tooltip = (
          <span
            className={`share-tooltip ${showTooltipAlways ? 'share-tooltip-visible' : ''}`}
            aria-hidden="true"
          >
            {tooltipText}
          </span>
        )

        if (s.href) {
          return (
            <a
              key={s.name}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              className={btnClass}
              style={{ '--brand': s.brandColor } as React.CSSProperties}
              aria-label={s.tooltip}
              onClick={(e) => handleClick(i, e.currentTarget)}
            >
              {tooltip}
              {s.icon}
            </a>
          )
        }

        return (
          <button
            key={s.name}
            onClick={handleCopyLink}
            className={btnClass}
            style={{ '--brand': s.brandColor } as React.CSSProperties}
            aria-label={s.tooltip}
          >
            {trajectory}
            {tooltip}
            {copied ? (
              <svg className="share-icon w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              s.icon
            )}
          </button>
        )
      })}
    </div>
  )
}
