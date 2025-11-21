'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import ThemeToggle from './ThemeToggle'
import { useTheme } from '@/contexts/ThemeContext'
import { getAvatarUrl } from '@/lib/avatars'
import { NavBarProps } from '@/types/navigation'

export default function NavBar({
  username,
  userAvatar,
  context = 'app',
  appContext,
  tournamentContext,
  adminContext
}: NavBarProps) {
  const { theme } = useTheme()
  const pathname = usePathname()
  const [hasNewTrophies, setHasNewTrophies] = useState(false)

  useEffect(() => {
    // Charger l'état des trophées (uniquement pour contexte app)
    if (context === 'app') {
      const loadTrophiesStatus = async () => {
        try {
          const response = await fetch('/api/user/trophies')
          const data = await response.json()
          if (data.success) {
            setHasNewTrophies(data.hasNewTrophies)
          }
        } catch (error) {
          console.error('Error loading trophies status:', error)
        }
      }
      loadTrophiesStatus()
    }
  }, [context])

  // Rendu pour le contexte Admin
  if (context === 'admin') {
    const navItems = [
      { name: 'Général', href: '/admin', icon: 'home' },
      { name: 'Import', href: '/admin/import', icon: 'import' },
      { name: 'Réglages', href: '/admin/settings', icon: 'settings' },
    ]

    return (
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4">
          {/* Badge Super Admin */}
          <div className="py-3 border-b border-purple-500">
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-yellow-300" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-semibold bg-purple-800 bg-opacity-50 px-3 py-1 rounded-full">
                Connecté en tant que SuperAdmin
              </span>
            </div>
          </div>

          {/* Menu de navigation */}
          <nav className="flex space-x-2 py-3">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/admin' && pathname?.startsWith(item.href))
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'bg-white text-purple-700 font-semibold shadow-md'
                      : 'hover:bg-purple-500 hover:bg-opacity-50'
                  }`}
                >
                  {item.icon === 'home' && (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                    </svg>
                  )}
                  {item.icon === 'import' && (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  )}
                  {item.icon === 'settings' && (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                    </svg>
                  )}
                  <span>{item.name}</span>
                </Link>
              )
            })}
          </nav>
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
      <div className="theme-nav hidden md:block">
        <div className="max-w-7xl mx-auto px-4 py-6">
          {/* Navigation layout - 3 colonnes sur desktop */}
          <div className="grid grid-cols-[auto_1fr_auto] gap-4 items-center">
            {/* COLONNE GAUCHE - Logo + Theme Toggle */}
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <img
                  src="/images/logo.svg"
                  alt="PronoHub"
                  className="w-14 h-14 cursor-pointer hover:opacity-80 transition"
                />
              </Link>
              <ThemeToggle />
            </div>

            {/* COLONNE CENTRALE - Infos compétition et tournoi */}
            <div className="flex items-center justify-center gap-4">
              {tournamentContext.competitionLogo && (
                <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center p-2 shadow-sm flex-shrink-0">
                  <img
                    src={tournamentContext.competitionLogo}
                    alt={tournamentContext.competitionName}
                    className="w-full h-full object-contain"
                  />
                </div>
              )}
              <div className="text-left">
                <h1 className="text-3xl font-bold theme-text">
                  {tournamentContext.tournamentName}
                </h1>
                <p className="theme-text-secondary text-base mt-1">
                  {tournamentContext.competitionName}
                </p>
                <div className="mt-1 flex justify-start">
                  {getStatusBadge()}
                </div>
              </div>
            </div>

            {/* COLONNE DROITE - Avatar + Menu */}
            <div className="flex items-center gap-3">
              {/* Avatar */}
              <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-[#ff9900] flex-shrink-0">
                <Image
                  src={getAvatarUrl(userAvatar)}
                  alt={username}
                  fill
                  className="object-cover"
                  sizes="40px"
                />
              </div>

              {/* Menu desktop */}
              <div className="flex items-center gap-3">
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
        </div>
      </div>
    )
  }

  // Rendu pour le contexte App (par défaut)
  return (
    <nav className="theme-nav hidden md:block">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Navigation layout - 3 colonnes sur desktop */}
        <div className="grid grid-cols-[auto_1fr_auto] gap-4 items-center">
          {/* COLONNE GAUCHE - Logo + Theme Toggle */}
          <div className="flex items-center gap-4">
            {appContext?.showBackToDashboard ? (
              <Link href="/dashboard">
                <img
                  src="/images/logo.svg"
                  alt="PronoHub"
                  className="w-14 h-14 cursor-pointer hover:opacity-80 transition"
                />
              </Link>
            ) : (
              <img src="/images/logo.svg" alt="PronoHub" className="w-14 h-14" />
            )}
            <ThemeToggle />
          </div>

          {/* COLONNE CENTRALE - Vide pour dashboard */}
          <div></div>

          {/* COLONNE DROITE - Avatar + Menu */}
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <Link href="/profile" className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-[#ff9900] flex-shrink-0">
              <Image
                src={getAvatarUrl(userAvatar)}
                alt={username}
                fill
                className="object-cover"
                sizes="40px"
              />
              {/* Pastille de notification pour nouveaux trophées */}
              {hasNewTrophies && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></div>
              )}
            </Link>

            {/* Menu desktop */}
            <div className="flex items-center gap-3">
              <span className="theme-text text-sm">Bonjour, {username} !</span>

              {!appContext?.hideProfileLink && (
                <>
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
                </>
              )}

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
      </div>
    </nav>
  )
}
