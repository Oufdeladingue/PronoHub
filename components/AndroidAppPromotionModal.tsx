'use client'

import { useState, useEffect } from 'react'

interface AndroidAppPromotionModalProps {
  onClose: () => void
}

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=club.pronohub.app'

export default function AndroidAppPromotionModal({ onClose }: AndroidAppPromotionModalProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50)
    return () => clearTimeout(timer)
  }, [])

  const handleDownload = () => {
    // Stocker la date de dismiss
    localStorage.setItem('android_app_modal_dismissed', new Date().toDateString())
    setIsVisible(false)
    setTimeout(() => {
      window.open(PLAY_STORE_URL, '_blank')
      onClose()
    }, 200)
  }

  const handleDismiss = () => {
    localStorage.setItem('android_app_modal_dismissed', new Date().toDateString())
    setIsVisible(false)
    setTimeout(onClose, 200)
  }

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 transition-opacity duration-200 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
    >
      <div
        className={`w-full max-w-sm rounded-2xl bg-[#1a1a2e] p-6 shadow-2xl transform transition-transform duration-200 ${
          isVisible ? 'scale-100' : 'scale-95'
        }`}
      >
        {/* Icône */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-[#ff9900]/20 flex items-center justify-center">
            <svg
              className="w-9 h-9 text-[#ff9900]"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M17.523 2.223a.5.5 0 0 0-.736.076l-1.82 2.349A8.252 8.252 0 0 0 12 4C9.65 4 7.547 5.015 6.036 6.648L4.213 4.299a.5.5 0 0 0-.812.584l1.77 2.282A9.627 9.627 0 0 0 3 13h18a9.627 9.627 0 0 0-2.171-5.835l1.77-2.282a.5.5 0 0 0-.076-.66ZM8.5 10.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm7 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2ZM3 14v5a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3v-5H3Z" />
            </svg>
          </div>
        </div>

        {/* Titre */}
        <h2 className="text-xl font-bold text-white text-center mb-2">
          PronoHub est dispo sur Android !
        </h2>

        {/* Description */}
        <p className="text-gray-400 text-center text-sm mb-4">
          Profite d'une expérience optimale avec l'app :
        </p>

        {/* Liste des avantages */}
        <ul className="space-y-2 mb-6">
          <li className="flex items-center gap-3 text-sm text-gray-300">
            <span className="text-[#ff9900]">🔔</span>
            <span>Notifications push en temps réel</span>
          </li>
          <li className="flex items-center gap-3 text-sm text-gray-300">
            <span className="text-[#ff9900]">⚡</span>
            <span>Chargement ultra-rapide</span>
          </li>
          <li className="flex items-center gap-3 text-sm text-gray-300">
            <span className="text-[#ff9900]">📱</span>
            <span>Expérience native et fluide</span>
          </li>
          <li className="flex items-center gap-3 text-sm text-gray-300">
            <span className="text-[#ff9900]">🏆</span>
            <span>Accès rapide depuis ton écran d'accueil</span>
          </li>
        </ul>

        {/* Boutons */}
        <div className="space-y-3">
          <button
            onClick={handleDownload}
            className="w-full py-3 px-4 bg-[#ff9900] hover:bg-[#e68a00] text-black font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 20.5v-1h18v1H3Zm9-4.5L7 11l1.4-1.4 2.6 2.575V4h2v8.175L15.6 9.6 17 11l-5 5Z" />
            </svg>
            Télécharger sur le Play Store
          </button>
          <button
            onClick={handleDismiss}
            className="w-full py-3 px-4 bg-transparent hover:bg-white/5 text-gray-400 font-medium rounded-xl transition-colors"
          >
            Plus tard
          </button>
        </div>
      </div>
    </div>
  )
}
