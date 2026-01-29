'use client'

import { useEffect, useState, useRef } from 'react'
import Image from 'next/image'

interface TrophyCelebrationModalProps {
  trophy: {
    name: string
    description: string
    imagePath: string
    unlocked_at: string
    triggerMatch?: {
      homeTeamName: string
      awayTeamName: string
      homeTeamLogo: string | null
      awayTeamLogo: string | null
      competitionId: number
    }
  }
  onClose: () => void
}

export default function TrophyCelebrationModal({ trophy, onClose }: TrophyCelebrationModalProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  // Animation d'entrée après 1 seconde
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true)
    }, 1000)

    return () => clearTimeout(timer)
  }, [])

  // Formater la date de déblocage
  const unlockedDate = new Date(trophy.unlocked_at).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  })

  // Fonction pour télécharger l'image
  const downloadImage = async () => {
    if (!cardRef.current) return

    try {
      // Utiliser html2canvas pour capturer la carte
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#ffffff',
        scale: 2 // Haute résolution
      })

      // Convertir en blob et télécharger
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = `pronohub-trophy-${trophy.name.replace(/\s+/g, '-').toLowerCase()}.png`
          link.click()
          URL.revokeObjectURL(url)
        }
      })
    } catch (error) {
      console.error('Error downloading image:', error)
    }
  }

  // Fonction pour partager sur Facebook
  const shareOnFacebook = () => {
    const url = `https://www.pronohub.club/trophies/${encodeURIComponent(trophy.name)}`
    const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`
    window.open(shareUrl, '_blank', 'width=600,height=400')
  }

  // Fonction pour partager sur WhatsApp
  const shareOnWhatsApp = () => {
    const text = `🎉 J'ai débloqué le trophée "${trophy.name}" sur PronoHub ! ${trophy.description}\nRejoins-moi sur pronohub.club`
    const shareUrl = `https://wa.me/?text=${encodeURIComponent(text)}`
    window.open(shareUrl, '_blank')
  }

  // Fonction pour partager sur Messenger
  const shareOnMessenger = () => {
    const url = `https://www.pronohub.club/trophies/${encodeURIComponent(trophy.name)}`
    const shareUrl = `fb-messenger://share/?link=${encodeURIComponent(url)}`
    window.location.href = shareUrl
  }

  // Fonction pour partager avec le Web Share API (autres options)
  const shareOther = async () => {
    const text = `🎉 J'ai débloqué le trophée "${trophy.name}" sur PronoHub !\n${trophy.description}\n\nRejoins-moi sur pronohub.club`

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Trophée PronoHub - ${trophy.name}`,
          text: text,
          url: 'https://www.pronohub.club'
        })
      } catch (error) {
        // L'utilisateur a annulé le partage
        console.log('Partage annulé')
      }
    } else {
      // Fallback : copier dans le presse-papier
      navigator.clipboard.writeText(text)
      alert('Texte copié dans le presse-papier !')
    }
  }

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black transition-opacity duration-500 ${
        isVisible ? 'bg-opacity-75' : 'bg-opacity-0 pointer-events-none'
      }`}
      onClick={onClose}
    >
      {/* Carte de célébration */}
      <div
        ref={cardRef}
        className={`relative max-w-md w-full bg-gradient-to-br from-amber-50 to-orange-50 dark:from-slate-800 dark:to-slate-900 rounded-2xl shadow-2xl overflow-hidden transform transition-all duration-500 ${
          isVisible ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Logo PronoHub en haut à droite */}
        <div className="absolute top-4 right-4 z-10">
          <Image
            src="/logo.png"
            alt="PronoHub"
            width={60}
            height={60}
            className="drop-shadow-lg"
          />
        </div>

        {/* Bouton fermer */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 z-10 w-8 h-8 rounded-full bg-white dark:bg-slate-700 shadow-lg flex items-center justify-center hover:bg-gray-100 dark:hover:bg-slate-600 transition"
        >
          <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Confetti animation en arrière-plan */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[...Array(30)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-confetti"
              style={{
                left: `${Math.random() * 100}%`,
                top: `-${Math.random() * 20}%`,
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${3 + Math.random() * 2}s`
              }}
            >
              🎉
            </div>
          ))}
        </div>

        {/* Contenu */}
        <div className="relative p-8 pt-16 text-center">
          {/* Titre */}
          <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-600 to-orange-600 dark:from-amber-400 dark:to-orange-400 mb-2">
            Bravo, un trophée de plus sur l'étagère !
          </h2>

          {/* Image du trophée */}
          <div className="my-8 flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-orange-400 rounded-full blur-2xl opacity-50 animate-pulse"></div>
              <Image
                src={trophy.imagePath}
                alt={trophy.name}
                width={180}
                height={180}
                className="relative z-10 drop-shadow-2xl"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/trophy/default.png'
                }}
              />
            </div>
          </div>

          {/* Nom du trophée */}
          <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {trophy.name}
          </h3>

          {/* Description du trophée */}
          <p className="text-lg text-gray-600 dark:text-gray-300 mb-4 italic">
            {trophy.description}
          </p>

          {/* Date de déblocage */}
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Débloqué le {unlockedDate}
          </p>

          {/* Match déclencheur */}
          {trophy.triggerMatch && (
            <div className="bg-white dark:bg-slate-700 rounded-xl p-4 mb-6 shadow-inner">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Match déclencheur
              </p>
              <div className="flex items-center justify-center gap-4">
                {/* Équipe domicile */}
                <div className="flex flex-col items-center">
                  {trophy.triggerMatch.homeTeamLogo ? (
                    <Image
                      src={trophy.triggerMatch.homeTeamLogo}
                      alt={trophy.triggerMatch.homeTeamName}
                      width={48}
                      height={48}
                      className="mb-2"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  ) : (
                    <div className="w-12 h-12 mb-2 rounded-full bg-gray-200 dark:bg-slate-600 flex items-center justify-center">
                      <span className="text-xl">⚽</span>
                    </div>
                  )}
                  <p className="text-sm font-medium text-gray-900 dark:text-white text-center">
                    {trophy.triggerMatch.homeTeamName}
                  </p>
                </div>

                {/* VS */}
                <span className="text-2xl font-bold text-gray-400 dark:text-gray-500">vs</span>

                {/* Équipe extérieur */}
                <div className="flex flex-col items-center">
                  {trophy.triggerMatch.awayTeamLogo ? (
                    <Image
                      src={trophy.triggerMatch.awayTeamLogo}
                      alt={trophy.triggerMatch.awayTeamName}
                      width={48}
                      height={48}
                      className="mb-2"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  ) : (
                    <div className="w-12 h-12 mb-2 rounded-full bg-gray-200 dark:bg-slate-600 flex items-center justify-center">
                      <span className="text-xl">⚽</span>
                    </div>
                  )}
                  <p className="text-sm font-medium text-gray-900 dark:text-white text-center">
                    {trophy.triggerMatch.awayTeamName}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Boutons de partage */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Partager sur les réseaux :
            </p>

            <div className="flex gap-2 justify-center flex-wrap">
              {/* Facebook */}
              <button
                onClick={shareOnFacebook}
                className="flex items-center gap-2 px-4 py-2 bg-[#1877F2] text-white rounded-lg hover:bg-[#166FE5] transition shadow-md"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                Facebook
              </button>

              {/* WhatsApp */}
              <button
                onClick={shareOnWhatsApp}
                className="flex items-center gap-2 px-4 py-2 bg-[#25D366] text-white rounded-lg hover:bg-[#22C55E] transition shadow-md"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.304-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
                WhatsApp
              </button>

              {/* Télécharger */}
              <button
                onClick={downloadImage}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition shadow-md"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Télécharger
              </button>

              {/* Autres */}
              <button
                onClick={shareOther}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition shadow-md"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Autres
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-slate-700">
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
              pronohub.club
            </p>
          </div>
        </div>
      </div>

      {/* Styles pour l'animation des confetti */}
      <style jsx>{`
        @keyframes confetti {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }

        .animate-confetti {
          animation: confetti linear infinite;
        }
      `}</style>
    </div>
  )
}
