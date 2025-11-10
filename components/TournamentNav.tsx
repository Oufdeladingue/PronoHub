'use client'

import { useState } from 'react'
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const getStatusBadge = () => {
    switch (status) {
      case 'pending':
        return (
          <span className="px-2 py-0.5 md:px-3 md:py-1 rounded-full text-xs md:text-sm bg-yellow-100 text-yellow-800">
            En attente
          </span>
        )
      case 'active':
        return (
          <span className="px-2 py-0.5 md:px-3 md:py-1 rounded-full text-xs md:text-sm bg-green-100 text-green-800">
            En cours
          </span>
        )
      case 'finished':
        return (
          <span className="px-2 py-0.5 md:px-3 md:py-1 rounded-full text-xs md:text-sm bg-gray-100 text-gray-800">
            Terminé
          </span>
        )
      default:
        return null
    }
  }

  return (
    <div className="theme-nav">
      <div className="max-w-7xl mx-auto px-2 md:px-4 py-3 md:py-6">
        {/* Navigation layout - 3 colonnes sur mobile et desktop */}
        <div className="grid grid-cols-[auto_1fr_auto] gap-2 md:gap-4 items-center">

          {/* COLONNE GAUCHE - Logo + Theme Toggle */}
          <div className="flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-4">
            <Link href="/dashboard">
              <img
                src="/images/logo.svg"
                alt="PronoHub"
                className="w-10 h-10 md:w-14 md:h-14 cursor-pointer hover:opacity-80 transition"
              />
            </Link>
            <ThemeToggle />
          </div>

          {/* COLONNE CENTRALE - Infos compétition et tournoi */}
          <div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-4">
            {competitionLogo && (
              <div className="w-10 h-10 md:w-16 md:h-16 rounded-full bg-white flex items-center justify-center p-1 md:p-2 shadow-sm flex-shrink-0">
                <img
                  src={competitionLogo}
                  alt={competitionName}
                  className="w-full h-full object-contain"
                />
              </div>
            )}
            <div className="text-center md:text-left">
              <h1 className="text-sm md:text-3xl font-bold theme-text truncate max-w-[200px] md:max-w-none">
                {tournamentName}
              </h1>
              <p className="theme-text-secondary text-xs md:text-base mt-0.5 md:mt-1 truncate max-w-[200px] md:max-w-none">
                {competitionName}
              </p>
              <div className="mt-1 flex justify-center md:justify-start">
                {getStatusBadge()}
              </div>
            </div>
          </div>

          {/* COLONNE DROITE - Avatar + Menu */}
          <div className="flex flex-col md:flex-row items-center gap-1 md:gap-3">
            {/* Avatar */}
            <div className="relative w-8 h-8 md:w-10 md:h-10 rounded-full overflow-hidden border-2 border-[#ff9900] flex-shrink-0">
              <Image
                src={getAvatarUrl(userAvatar)}
                alt={username}
                fill
                className="object-cover"
                sizes="40px"
              />
            </div>

            {/* Hamburger menu sur mobile, menu complet sur desktop */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden flex flex-col gap-1 p-1 cursor-pointer"
              aria-label="Menu"
            >
              <span className="w-5 h-0.5 bg-[#ff9900] rounded"></span>
              <span className="w-5 h-0.5 bg-[#ff9900] rounded"></span>
              <span className="w-5 h-0.5 bg-[#ff9900] rounded"></span>
            </button>

            {/* Menu desktop (caché sur mobile) */}
            <div className="hidden md:flex items-center gap-3">
              <span className="theme-text text-sm">Bonjour, {username} !</span>

              {/* Séparateur */}
              <div className="h-6 w-[2px] bg-[#e68a00]"></div>

              {/* Lien Carrière avec icône */}
              <Link
                href="/profile"
                className="flex items-center gap-2 px-3 py-2 text-sm rounded transition-all duration-200 hover:scale-105 cursor-pointer theme-accent-text"
              >
                <img
                  src="/images/icons/profil.svg"
                  alt="Carrière"
                  className="w-5 h-5 icon-filter-orange"
                />
                Carrière
              </Link>

              {/* Séparateur */}
              <div className="h-6 w-[2px] bg-[#e68a00]"></div>

              {/* Bouton Déconnexion avec icône */}
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="flex items-center gap-2 px-3 py-2 text-sm rounded transition-all duration-200 hover:scale-105 cursor-pointer theme-accent-text"
                >
                  <img
                    src="/images/icons/logout.svg"
                    alt="Quitter"
                    className="w-5 h-5 icon-filter-orange"
                  />
                  Quitter le terrain
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Menu mobile dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-3 pt-3 border-t border-[#e68a00] flex flex-col gap-2">
            <div className="theme-text text-sm text-center mb-2">
              Bonjour, {username} !
            </div>

            <Link
              href="/profile"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-center gap-2 px-3 py-2 text-sm rounded transition-all theme-accent-text hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <img
                src="/images/icons/profil.svg"
                alt="Carrière"
                className="w-5 h-5 icon-filter-orange"
              />
              Carrière
            </Link>

            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm rounded transition-all theme-accent-text hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <img
                  src="/images/icons/logout.svg"
                  alt="Quitter"
                  className="w-5 h-5 icon-filter-orange"
                />
                Quitter le terrain
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
