'use client'

import { useState, useEffect, ReactNode } from 'react'
import Link from 'next/link'

interface AgeGateProps {
  children: ReactNode
}

export default function AgeGate({ children }: AgeGateProps) {
  const [verified, setVerified] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const hasAccepted = localStorage.getItem('pronohub_age_verified')
    if (hasAccepted) {
      setVerified(true)
    }
    setIsLoading(false)
  }, [])

  const handleAccept = () => {
    localStorage.setItem('pronohub_age_verified', 'true')
    setVerified(true)
  }

  const handleDecline = () => {
    window.location.href = 'https://www.google.com'
  }

  // Pendant le chargement, ne rien afficher pour éviter le flash
  if (isLoading) return null

  // Déjà vérifié → afficher le contenu
  if (verified) return <>{children}</>

  // Pas vérifié → afficher le gate
  return (
    <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black" />

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

        {/* Mention légale */}
        <p className="text-gray-500 text-xs">
          En continuant, vous confirmez avoir 18 ans ou plus et acceptez nos{' '}
          <Link href="/cgv" className="text-[#ff9900] hover:underline">
            Conditions Générales
          </Link>{' '}
          et notre{' '}
          <Link href="/privacy" className="text-[#ff9900] hover:underline">
            Politique de confidentialité
          </Link>
          .
        </p>
      </div>
    </div>
  )
}
