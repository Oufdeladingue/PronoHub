'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function AgeGate() {
  const [showGate, setShowGate] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Verifier si l'utilisateur a deja accepte
    const hasAccepted = localStorage.getItem('pronohub_age_verified')
    if (!hasAccepted) {
      setShowGate(true)
    }
    setIsLoading(false)
  }, [])

  const handleAccept = () => {
    localStorage.setItem('pronohub_age_verified', 'true')
    localStorage.setItem('pronohub_cookies_accepted', 'true')
    setShowGate(false)
  }

  const handleDecline = () => {
    // Rediriger vers Google
    window.location.href = 'https://www.google.com'
  }

  // Ne rien afficher pendant le chargement pour eviter le flash
  if (isLoading) return null

  if (!showGate) return null

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center p-4">
      {/* Overlay sombre */}
      <div className="absolute inset-0 bg-black" />

      {/* Contenu */}
      <div className="relative z-10 max-w-lg w-full text-center">
        {/* Logo */}
        <div className="mb-8">
          <img
            src="/images/logo.svg"
            alt="PronoHub"
            className="w-32 h-32 mx-auto"
          />
        </div>

        {/* Titre */}
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
          Etes-vous majeur(e) ?
        </h1>

        {/* Avertissement humoristique */}
        <div className="bg-gray-900/80 border-2 border-[#ff9900] rounded-xl p-6 mb-8">
          <p className="text-[#ff9900] font-semibold text-lg mb-3">
            ATTENTION
          </p>
          <p className="text-gray-300 mb-2">
            Ce site contient des pronostics sportifs qui peuvent créer une <span className="text-[#ff9900] font-semibold">forte dépendance</span>.
          </p>
          <p className="text-gray-400 text-sm">
            Des scènes de classements serrés et de remontadas spectaculaires peuvent heurter la sensibilité des mauvais perdants.
          </p>
        </div>

        {/* Boutons */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <button
            onClick={handleAccept}
            className="flex-1 py-4 bg-[#ff9900] hover:bg-[#e68a00] text-black font-bold rounded-lg transition-all transform hover:scale-105 text-lg flex flex-col items-center"
          >
            <span>J'ai 18 ans ou +</span>
            <span>Entrer</span>
          </button>
          <button
            onClick={handleDecline}
            className="flex-1 py-4 bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium rounded-lg transition-all text-lg flex flex-col items-center"
          >
            <span>Je suis mineur</span>
            <span>Quitter</span>
          </button>
        </div>

        {/* Mention legale */}
        <p className="text-gray-500 text-xs">
          En entrant sur ce site, vous confirmez avoir 18 ans ou plus et acceptez nos{' '}
          <Link href="/cgv" className="text-[#ff9900] hover:underline">
            Conditions Générales
          </Link>{' '}
          et notre{' '}
          <Link href="/privacy" className="text-[#ff9900] hover:underline">
            Politique de cookies
          </Link>
          .
        </p>
      </div>
    </div>
  )
}
