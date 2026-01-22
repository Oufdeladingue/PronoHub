'use client'

import { useState, useEffect } from 'react'
import { isCapacitor } from '@/lib/capacitor'

interface NotificationPermissionModalProps {
  onAccept: () => void
  onDecline: () => void
}

export default function NotificationPermissionModal({
  onAccept,
  onDecline,
}: NotificationPermissionModalProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Petit délai pour l'animation d'entrée
    const timer = setTimeout(() => setIsVisible(true), 50)
    return () => clearTimeout(timer)
  }, [])

  const handleAccept = () => {
    setIsVisible(false)
    setTimeout(onAccept, 200)
  }

  const handleDecline = () => {
    setIsVisible(false)
    setTimeout(onDecline, 200)
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
              className="w-8 h-8 text-[#ff9900]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
          </div>
        </div>

        {/* Titre */}
        <h2 className="text-xl font-bold text-white text-center mb-2">
          Reste dans le match !
        </h2>

        {/* Description */}
        <p className="text-gray-400 text-center text-sm mb-4">
          Active les notifications pour ne rien manquer :
        </p>

        {/* Liste des avantages */}
        <ul className="space-y-2 mb-6">
          <li className="flex items-center gap-3 text-sm text-gray-300">
            <span className="text-[#ff9900]">⚽</span>
            <span>Rappels avant les matchs</span>
          </li>
          <li className="flex items-center gap-3 text-sm text-gray-300">
            <span className="text-[#ff9900]">🏆</span>
            <span>Résultats et classements en direct</span>
          </li>
          <li className="flex items-center gap-3 text-sm text-gray-300">
            <span className="text-[#ff9900]">👥</span>
            <span>Invitations de tes amis</span>
          </li>
          <li className="flex items-center gap-3 text-sm text-gray-300">
            <span className="text-[#ff9900]">🎯</span>
            <span>Nouveaux tournois disponibles</span>
          </li>
        </ul>

        {/* Boutons */}
        <div className="space-y-3">
          <button
            onClick={handleAccept}
            className="w-full py-3 px-4 bg-[#ff9900] hover:bg-[#e68a00] text-black font-semibold rounded-xl transition-colors"
          >
            Activer les notifications
          </button>
          <button
            onClick={handleDecline}
            className="w-full py-3 px-4 bg-transparent hover:bg-white/5 text-gray-400 font-medium rounded-xl transition-colors"
          >
            Plus tard
          </button>
        </div>
      </div>
    </div>
  )
}
