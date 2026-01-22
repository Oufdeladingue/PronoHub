'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import ThemeToggle from '@/components/ThemeToggle'
import { useTheme } from '@/contexts/ThemeContext'
import { getAvatarUrl } from '@/lib/avatars'
import { NavBarProps } from '@/types/navigation'
import LogoutButton from '@/components/LogoutButton'

export default function NavBarMobile({
  username,
  userAvatar,
  context = 'app',
  tournamentContext,
  creationContext,
}: NavBarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { theme } = useTheme()

  // Rendu pour le contexte Creation (page de création de tournoi)
  if (context === 'creation' && creationContext) {
    return (
      <div className="theme-nav md:hidden">
        <div className="max-w-7xl mx-auto px-2 py-3">
          {/* Navigation layout - 3 colonnes sur mobile */}
          <div className="grid grid-cols-[auto_1fr_auto] gap-2 items-center">
            {/* COLONNE GAUCHE - Logo + Theme Toggle */}
            <div className="flex flex-col items-start gap-2">
              <Link href="/dashboard">
                <img
                  src="/images/logo.svg"
                  alt="PronoHub"
                  className="w-10 h-10 cursor-pointer hover:opacity-80 transition"
                />
              </Link>
              <ThemeToggle />
            </div>

            {/* COLONNE CENTRALE - Infos compétition */}
            <div className="flex flex-col items-center justify-center gap-2">
              {(creationContext.competitionLogo || creationContext.competitionLogoWhite) && (
                <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
                  {/* Logo blanc en mode sombre, logo couleur en mode clair */}
                  {theme === 'dark' ? (
                    creationContext.competitionLogoWhite ? (
                      <img
                        src={creationContext.competitionLogoWhite}
                        alt={creationContext.competitionName}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <img
                        src={creationContext.competitionLogo || ''}
                        alt={creationContext.competitionName}
                        className="w-full h-full object-contain brightness-0 invert"
                      />
                    )
                  ) : (
                    <img
                      src={creationContext.competitionLogo || creationContext.competitionLogoWhite || ''}
                      alt={creationContext.competitionName}
                      className="w-full h-full object-contain"
                    />
                  )}
                </div>
              )}
              <div className="text-center">
                <h2 className="text-sm font-bold theme-text truncate max-w-[200px]">
                  {creationContext.competitionName}
                </h2>
                <p className="theme-text-secondary text-xs mt-0.5">
                  {creationContext.remainingMatchdays} journée{creationContext.remainingMatchdays > 1 ? 's' : ''} restante{creationContext.remainingMatchdays > 1 ? 's' : ''}
                </p>
              </div>
            </div>

            {/* COLONNE DROITE - Avatar et menu sandwich en colonne */}
            <div className="flex flex-col items-center gap-2">
              {/* Avatar */}
              <div className="relative w-8 h-8 rounded-full overflow-hidden border-2 mobile-avatar-border flex-shrink-0">
                <Image
                  src={getAvatarUrl(userAvatar)}
                  alt={username}
                  fill
                  className="object-cover"
                  sizes="32px"
                />
              </div>

              {/* Hamburger menu */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="flex flex-col gap-1 p-1 cursor-pointer"
                aria-label="Menu"
              >
                <span className="w-5 h-0.5 hamburger-bar rounded"></span>
                <span className="w-5 h-0.5 hamburger-bar rounded"></span>
                <span className="w-5 h-0.5 hamburger-bar rounded"></span>
              </button>
            </div>
          </div>

          {/* Menu mobile dropdown */}
          {mobileMenuOpen && (
            <div className="mt-3 pt-3 border-t border-white/30 flex flex-col gap-3">
              <div className="mobile-menu-text text-sm text-center font-bold">
                Bonjour {username} !
              </div>

              {/* 3 icônes côte à côte */}
              <div className="flex items-start justify-center gap-6">
                {/* Accueil */}
                <Link
                  href="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex flex-col items-center gap-1 p-2 rounded transition-all hover:bg-white/10"
                >
                  <img
                    src="/images/icons/home.svg"
                    alt="Accueil"
                    className="w-6 h-6 mobile-menu-icon"
                  />
                  <span className="text-xs mobile-menu-text">Accueil</span>
                </Link>

                {/* Carrière */}
                <Link
                  href="/profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex flex-col items-center gap-1 p-2 rounded transition-all hover:bg-white/10"
                >
                  <img
                    src="/images/icons/profil.svg"
                    alt="Carrière"
                    className="w-6 h-6 mobile-menu-icon"
                  />
                  <span className="text-xs mobile-menu-text">Carrière</span>
                </Link>

                {/* Quitter le terrain */}
                <LogoutButton className="flex flex-col items-center gap-1 p-2 rounded transition-all hover:bg-white/10">
                  <img
                    src="/images/icons/logout.svg"
                    alt="Quitter"
                    className="w-6 h-6 mobile-menu-icon"
                  />
                  <span className="text-xs mobile-menu-text">Quitter</span>
                </LogoutButton>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Rendu pour le contexte Tournament
  if (context === 'tournament' && tournamentContext) {
    const getStatusBadge = () => {
      switch (tournamentContext.status) {
        case 'pending':
          return (
            <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-800">
              En attente
            </span>
          )
        case 'active':
          return (
            <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-800">
              En cours
            </span>
          )
        case 'finished':
          return (
            <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-800">
              Terminé
            </span>
          )
        default:
          return null
      }
    }

    return (
      <div className="theme-nav md:hidden">
        <div className="max-w-7xl mx-auto px-2 py-3">
          {/* Navigation layout - 3 colonnes sur mobile */}
          <div className="grid grid-cols-[auto_1fr_auto] gap-2 items-center">
            {/* COLONNE GAUCHE - Logo + Theme Toggle */}
            <div className="flex flex-col items-start gap-2">
              <Link href="/dashboard">
                <img
                  src="/images/logo.svg"
                  alt="PronoHub"
                  className="w-10 h-10 cursor-pointer hover:opacity-80 transition"
                />
              </Link>
              <ThemeToggle />
            </div>

            {/* COLONNE CENTRALE - Infos compétition et tournoi */}
            <div className="flex flex-col items-center justify-center gap-2">
              {(tournamentContext.competitionLogo || tournamentContext.competitionLogoWhite) && (
                <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
                  {/* Logo blanc toujours car nav bleue en light et sombre en dark */}
                  {tournamentContext.competitionLogoWhite ? (
                    <img
                      src={tournamentContext.competitionLogoWhite}
                      alt={tournamentContext.competitionName}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <img
                      src={tournamentContext.competitionLogo || ''}
                      alt={tournamentContext.competitionName}
                      className="w-full h-full object-contain brightness-0 invert"
                    />
                  )}
                </div>
              )}
              <div className="text-center">
                <h1 className="text-sm font-bold theme-text truncate max-w-[200px]">
                  {tournamentContext.tournamentName}
                </h1>
                <p className="theme-text-secondary text-xs mt-0.5 truncate max-w-[200px]">
                  {tournamentContext.competitionName}
                </p>
              </div>
            </div>

            {/* COLONNE DROITE - Avatar et menu sandwich en colonne */}
            <div className="flex flex-col items-center gap-2">
              {/* Avatar */}
              <div className="relative w-8 h-8 rounded-full overflow-hidden border-2 mobile-avatar-border flex-shrink-0">
                <Image
                  src={getAvatarUrl(userAvatar)}
                  alt={username}
                  fill
                  className="object-cover"
                  sizes="32px"
                />
              </div>

              {/* Hamburger menu */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="flex flex-col gap-1 p-1 cursor-pointer"
                aria-label="Menu"
              >
                <span className="w-5 h-0.5 hamburger-bar rounded"></span>
                <span className="w-5 h-0.5 hamburger-bar rounded"></span>
                <span className="w-5 h-0.5 hamburger-bar rounded"></span>
              </button>
            </div>
          </div>

          {/* Menu mobile dropdown */}
          {mobileMenuOpen && (
            <div className="mt-3 pt-3 border-t border-white/30 flex flex-col gap-3">
              <div className="mobile-menu-text text-sm text-center font-bold">
                Bonjour {username} !
              </div>

              {/* 3 icônes côte à côte */}
              <div className="flex items-start justify-center gap-6">
                {/* Accueil */}
                <Link
                  href="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex flex-col items-center gap-1 p-2 rounded transition-all hover:bg-white/10"
                >
                  <img
                    src="/images/icons/home.svg"
                    alt="Accueil"
                    className="w-6 h-6 mobile-menu-icon"
                  />
                  <span className="text-xs mobile-menu-text">Accueil</span>
                </Link>

                {/* Carrière */}
                <Link
                  href="/profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex flex-col items-center gap-1 p-2 rounded transition-all hover:bg-white/10"
                >
                  <img
                    src="/images/icons/profil.svg"
                    alt="Carrière"
                    className="w-6 h-6 mobile-menu-icon"
                  />
                  <span className="text-xs mobile-menu-text">Carrière</span>
                </Link>

                {/* Quitter le terrain */}
                <LogoutButton className="flex flex-col items-center gap-1 p-2 rounded transition-all hover:bg-white/10">
                  <img
                    src="/images/icons/logout.svg"
                    alt="Quitter"
                    className="w-6 h-6 mobile-menu-icon"
                  />
                  <span className="text-xs mobile-menu-text">Quitter</span>
                </LogoutButton>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Rendu pour le contexte App ou Admin (version mobile simplifiée)
  return (
    <nav className="theme-nav md:hidden">
      <div className="max-w-7xl mx-auto px-2">
        {/* Navigation layout avec logo centré absolument */}
        <div className="relative flex items-center justify-between min-h-[80px]">
          {/* GAUCHE - Theme Toggle */}
          <div className="flex items-center z-10">
            <ThemeToggle />
          </div>

          {/* CENTRE - Logo centré absolument sur l'écran */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <Link href="/dashboard">
              <img
                src="/images/logo.svg"
                alt="PronoHub"
                className="w-20 h-20 cursor-pointer hover:opacity-80 transition"
              />
            </Link>
          </div>

          {/* DROITE - Avatar et menu sandwich en colonne */}
          <div className="flex flex-col items-center gap-2 z-10">
            <div className="relative w-8 h-8 rounded-full overflow-hidden border-2 mobile-avatar-border">
              <Image
                src={getAvatarUrl(userAvatar || 'avatar1')}
                alt={username || 'Avatar utilisateur'}
                fill
                className="object-cover"
                sizes="32px"
              />
            </div>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex flex-col gap-1 p-1 cursor-pointer"
              aria-label="Menu"
            >
              <span className="w-5 h-0.5 hamburger-bar rounded"></span>
              <span className="w-5 h-0.5 hamburger-bar rounded"></span>
              <span className="w-5 h-0.5 hamburger-bar rounded"></span>
            </button>
          </div>
        </div>

        {/* Menu mobile dropdown */}
        {mobileMenuOpen && (
          <div className="mt-3 pt-3 border-t border-white/30 flex flex-col gap-3">
            <div className="mobile-menu-text text-sm text-center font-bold">
              Bonjour {username} !
            </div>

            {/* 3 icônes côte à côte */}
            <div className="flex items-start justify-center gap-6">
              {/* Accueil */}
              <Link
                href="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="flex flex-col items-center gap-1 p-2 rounded transition-all hover:bg-white/10"
              >
                <img
                  src="/images/icons/home.svg"
                  alt="Accueil"
                  className="w-6 h-6 mobile-menu-icon"
                />
                <span className="text-xs mobile-menu-text">Accueil</span>
              </Link>

              {/* Carrière */}
              <Link
                href="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="flex flex-col items-center gap-1 p-2 rounded transition-all hover:bg-white/10"
              >
                <img
                  src="/images/icons/profil.svg"
                  alt="Carrière"
                  className="w-6 h-6 mobile-menu-icon"
                />
                <span className="text-xs mobile-menu-text">Carrière</span>
              </Link>

              {/* Quitter le terrain */}
              <LogoutButton className="flex flex-col items-center gap-1 p-2 rounded transition-all hover:bg-white/10">
                <img
                  src="/images/icons/logout.svg"
                  alt="Quitter"
                  className="w-6 h-6 mobile-menu-icon"
                />
                <span className="text-xs mobile-menu-text">Quitter</span>
              </LogoutButton>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
