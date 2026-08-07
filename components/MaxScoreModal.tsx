'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { useTheme } from '@/contexts/ThemeContext'
import { isCapacitor } from '@/lib/capacitor'

interface MaxScoreModalProps {
  isOpen: boolean
  onClose: () => void
}

const FUNNY_KEYS = ['funny1', 'funny2', 'funny3', 'funny4', 'funny5'] as const

export default function MaxScoreModal({ isOpen, onClose }: MaxScoreModalProps) {
  const t = useTranslations('MaxScore')
  const { theme } = useTheme()
  const [randomMessage, setRandomMessage] = useState('')
  const [isMobile, setIsMobile] = useState(false)
  const isApp = isCapacitor()

  // Détecter mobile au montage
  useEffect(() => {
    setIsMobile(window.innerWidth < 768)
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Choisir un message aléatoire à chaque ouverture
  useEffect(() => {
    if (isOpen) {
      const key = FUNNY_KEYS[Math.floor(Math.random() * FUNNY_KEYS.length)]
      setRandomMessage(t(key))
    }
  }, [isOpen])

  // Fermer avec Escape
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  if (!isOpen) return null

  // Couleurs adaptatives selon le thème
  const isDark = theme === 'dark'
  const modalBg = isDark
    ? 'linear-gradient(to bottom, #0f0f0f 0%, #1a1a1a 100%)'
    : 'linear-gradient(to bottom, #ffffff 0%, #f8f9fa 100%)'
  const modalBorder = isDark ? '#ff9900' : '#0055FF'
  const modalShadow = isDark
    ? '0 0 40px rgba(255, 153, 0, 0.4)'
    : '0 0 40px rgba(0, 85, 255, 0.3)'
  const headerGradient = isDark
    ? 'linear-gradient(135deg, #ff9900 0%, #ff7700 100%)'
    : 'linear-gradient(135deg, #0055FF 0%, #0044cc 100%)'
  const textColor = isDark ? 'text-gray-200' : 'text-gray-800'
  const gifBorder = isDark ? '#ff9900' : '#0055FF'
  const gifShadow = isDark
    ? '0 0 20px rgba(255, 153, 0, 0.3)'
    : '0 0 20px rgba(0, 85, 255, 0.2)'

  // Taille adaptative selon le contexte
  const modalWidth = isMobile || isApp ? 'max-w-sm' : 'max-w-md'
  const padding = isMobile || isApp ? 'p-4' : 'p-6'
  const headerPadding = isMobile || isApp ? 'p-4' : 'p-6'
  const fontSize = isMobile || isApp ? 'text-xl' : 'text-2xl'
  const messageFontSize = isMobile || isApp ? 'text-sm' : 'text-base'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      style={{
        background: isDark ? 'rgba(0, 0, 0, 0.85)' : 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(8px)'
      }}
      onClick={onClose}
    >
      <div
        className={`rounded-2xl shadow-2xl ${modalWidth} w-full overflow-hidden animate-scale-in`}
        style={{
          background: modalBg,
          border: `2px solid ${modalBorder}`,
          boxShadow: modalShadow
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={`${headerPadding} text-center relative`}
          style={{ background: headerGradient }}
        >
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-white/80 hover:text-white transition-colors"
            aria-label={t('close')}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="flex items-center justify-center gap-3">
            <Image
              src="/images/logo.svg"
              alt="PronoHub"
              width={32}
              height={32}
              className={isMobile || isApp ? 'w-7 h-7' : 'w-8 h-8'}
            />
            <h2 className={`${fontSize} font-bold drop-shadow-lg`} style={{ color: isDark ? '#000000' : '#ffffff' }}>
              {t('title')}
            </h2>
          </div>
        </div>

        {/* Body */}
        <div className={`${padding} space-y-5`}>
          {/* GIF animé */}
          <div className="flex justify-center">
            <div
              className="rounded-xl overflow-hidden"
              style={{
                border: `2px solid ${gifBorder}`,
                boxShadow: gifShadow
              }}
            >
              <Image
                src="https://c.tenor.com/qxVAbTWrqMEAAAAd/tenor.gif"
                alt={t('imageAlt')}
                width={300}
                height={200}
                className="w-full h-auto"
                unoptimized
              />
            </div>
          </div>

          {/* Message drôle */}
          <p className={`${textColor} text-center ${messageFontSize} leading-relaxed font-medium px-2`}>
            {randomMessage}
          </p>

          {/* Bouton de fermeture */}
          <button
            onClick={onClose}
            className="w-full text-white font-bold py-3.5 px-6 rounded-lg transition-all transform hover:scale-[1.02] hover:opacity-90"
            style={{
              background: headerGradient,
              boxShadow: isDark
                ? '0 0 20px rgba(255, 153, 0, 0.3)'
                : '0 0 20px rgba(0, 85, 255, 0.2)'
            }}
          >
            {t('button')}
          </button>
        </div>
      </div>
    </div>
  )
}
