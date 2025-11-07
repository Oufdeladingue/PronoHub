'use client'

import Link from 'next/link'
import Image from 'next/image'
import ThemeToggle from '@/components/ThemeToggle'
import { getAvatarUrl } from '@/lib/avatars'

interface TournamentNavProps {
  tournamentName: string
  competitionName: string
  competitionLogo?: string | null
  status: 'pending' | 'active' | 'finished'
  username: string
  userAvatar: string
}

export default function TournamentNav({
  tournamentName,
  competitionName,
  competitionLogo,
  status,
  username,
  userAvatar
}: TournamentNavProps) {
  const getStatusBadge = () => {
    switch (status) {
      case 'pending':
        return (
          <span className="px-3 py-1 rounded-full text-sm bg-yellow-100 text-yellow-800">
            En attente
          </span>
        )
      case 'active':
        return (
          <span className="px-3 py-1 rounded-full text-sm bg-green-100 text-green-800">
            En cours
          </span>
        )
      case 'finished':
        return (
          <span className="px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-800">
            Terminé
          </span>
        )
      default:
        return null
    }
  }

  return (
    <div className="theme-nav">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <img src="/images/logo.svg" alt="PronoHub" className="w-14 h-14 cursor-pointer hover:opacity-80 transition" />
            </Link>
            <ThemeToggle />
          </div>
          <div className="flex items-center gap-4">
            {competitionLogo && (
              <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center p-2 shadow-sm">
                <img
                  src={competitionLogo}
                  alt={competitionName}
                  className="w-full h-full object-contain"
                />
              </div>
            )}
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold theme-text">{tournamentName}</h1>
                {getStatusBadge()}
              </div>
              <p className="theme-text-secondary mt-1">{competitionName}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="relative w-8 h-8 rounded-full overflow-hidden border-2 border-[#ff9900]">
                <Image
                  src={getAvatarUrl(userAvatar)}
                  alt={username}
                  fill
                  className="object-cover"
                  sizes="32px"
                />
              </div>
              <span className="theme-text text-sm">Bonjour, {username} !</span>
            </div>

            {/* Séparateur */}
            <div className="h-6 w-[2px] bg-[#e68a00]"></div>

            {/* Lien Carrière avec icône */}
            <Link
              href="/profile"
              className="flex items-center gap-2 px-3 py-2 text-sm rounded transition-all duration-200 hover:scale-105 cursor-pointer"
              style={{ color: 'var(--theme-accent, #ff9900)' }}
            >
              <img
                src="/images/icons/profil.svg"
                alt="Carrière"
                className="w-5 h-5"
                style={{ filter: 'invert(62%) sepia(46%) saturate(1614%) hue-rotate(1deg) brightness(103%) contrast(101%)' }}
              />
              Carrière
            </Link>

            {/* Séparateur */}
            <div className="h-6 w-[2px] bg-[#e68a00]"></div>

            {/* Bouton Déconnexion avec icône */}
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="flex items-center gap-2 px-3 py-2 text-sm rounded transition-all duration-200 hover:scale-105 cursor-pointer"
                style={{ color: 'var(--theme-accent, #ff9900)' }}
              >
                <img
                  src="/images/icons/logout.svg"
                  alt="Quitter"
                  className="w-5 h-5"
                  style={{ filter: 'invert(62%) sepia(46%) saturate(1614%) hue-rotate(1deg) brightness(103%) contrast(101%)' }}
                />
                Quitter le terrain
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
