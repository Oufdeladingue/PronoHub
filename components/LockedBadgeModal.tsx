'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface LockedBadgeModalProps {
  isOpen: boolean
  onClose: () => void
  theme: 'gold' | 'red' | 'green'
}

const GIFS = Array.from({ length: 16 }, (_, i) => `/images/gif-ester-egg/${String(i + 1).padStart(2, '0')}.gif`)

const MESSAGES = [
  "Ce badge est encore en phase de poules… et toi aussi.",
  "On sent l'envie, mais pour l'instant c'est surtout de l'espoir.",
  "Ce trophée ne se débloque pas sur un coup de chatte.",
  "On admire l'audace. Le niveau, un peu moins.",
  "Ce badge demande plus que « j'avais presque bon ».",
  "Tu cliques comme si c'était FIFA en facile.",
  "Ce trophée n'est pas tombé par miracle à la 90+4.",
  "Encore quelques pronos ratés et tu y seras… ou pas.",
  "Même le gardien l'a vu venir, ce clic.",
  "Pour l'instant, ton palmarès est en reconstruction.",
  "Ce badge se mérite. Comme un triplé à l'extérieur.",
  "Retour à l'entraînement. Le badge, lui, est en Ligue des Champions.",
  "Toujours pas… mais belle tentative.",
  "Le badge est débloqué. Pas pour toi.",
  "À ce niveau-là, même la VAR n'aide plus.",
  "Ce clic méritait un carton jaune.",
  "C'est ambitieux. Presque touchant.",
  "Même en pronostiquant au hasard, ça passerait mieux.",
  "Ce badge n'aime pas les touristes.",
  "Encore trop tendre pour ce niveau.",
  "Ce badge joue en première division.",
  "On ne débloque pas ça avec des pronos du dimanche.",
  "Le badge t'a scouté. Il n'a pas donné suite.",
  "Ce badge ne se gagne pas à la PlayStation."
]

export default function LockedBadgeModal({ isOpen, onClose, theme }: LockedBadgeModalProps) {
  const [mounted, setMounted] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [randomGif, setRandomGif] = useState('')
  const [randomMessage, setRandomMessage] = useState('')

  // Couleurs selon le thème
  const themeColors = {
    gold: '#f5b800',
    red: '#ef4444',
    green: '#22c55e'
  }
  const themeColor = themeColors[theme] || themeColors.gold

  const gradientBg = `linear-gradient(180deg, #0B0B0C 0%, #050506 100%)`

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isOpen) {
      // Randomiser le GIF et le message à chaque ouverture
      setRandomGif(GIFS[Math.floor(Math.random() * GIFS.length)])
      setRandomMessage(MESSAGES[Math.floor(Math.random() * MESSAGES.length)])

      // Activer l'animation d'entrée
      requestAnimationFrame(() => {
        setIsVisible(true)
      })
    } else {
      setIsVisible(false)
    }
  }, [isOpen])

  if (!mounted || !isOpen) return null

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)'
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      {/* Animations CSS */}
      <style>{`
        @keyframes modal-slide-fall {
          0% {
            transform: translateY(-100px) scale(0.9);
            opacity: 0;
          }
          100% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }
      `}</style>

      {/* Modale */}
      <div
        className="relative w-full max-w-md rounded-3xl p-8"
        style={{
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 24px 80px rgba(0,0,0,0.65)',
          background: gradientBg,
          animation: isVisible ? 'modal-slide-fall 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' : 'none',
          opacity: isVisible ? 1 : 0,
          border: `1px solid ${themeColor}40`
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 h-11 w-11 flex items-center justify-center rounded-full transition-colors hover:bg-white/5"
          aria-label="Fermer"
        >
          <X className="w-6 h-6 text-white/70" />
        </button>

        {/* Contenu */}
        <div className="relative z-10 flex flex-col items-center text-center pt-4">
          {/* Titre avec emoji */}
          <h2
            className="text-2xl font-bold mb-6"
            style={{
              color: themeColor,
              textShadow: `0 0 20px ${themeColor}60`
            }}
          >
            👆 Ton doigt a glissé ?
          </h2>

          {/* GIF */}
          <div
            className="relative w-full max-w-xs mb-6 rounded-2xl overflow-hidden"
            style={{
              border: `2px solid ${themeColor}60`,
              boxShadow: `0 0 30px ${themeColor}30`
            }}
          >
            <img
              src={randomGif}
              alt="Easter egg"
              className="w-full h-auto"
              style={{ display: 'block' }}
            />
          </div>

          {/* Message sarcastique */}
          <p className="text-white/80 text-base mb-8 leading-relaxed px-4">
            « {randomMessage} »
          </p>

          {/* Bouton de retour */}
          <button
            onClick={onClose}
            className="w-full py-4 rounded-2xl font-bold text-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: `linear-gradient(135deg, ${themeColor} 0%, ${themeColor}CC 100%)`,
              color: '#000',
              boxShadow: `0 8px 24px ${themeColor}40, inset 0 1px 0 rgba(255,255,255,0.2)`
            }}
          >
            Retour à la réalité du terrain →
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
