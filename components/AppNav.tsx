'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import ThemeToggle from './ThemeToggle'
import { useTheme } from '@/contexts/ThemeContext'
import { getAvatarUrl } from '@/lib/avatars'

interface AppNavProps {
  username: string
  avatar?: string
  showBackToDashboard?: boolean
  hideProfileLink?: boolean
}

export default function AppNav({ username, avatar, showBackToDashboard = false, hideProfileLink = false }: AppNavProps) {
  const { theme } = useTheme()
  const [hasNewTrophies, setHasNewTrophies] = useState(false)

  useEffect(() => {
    // Charger l'état des trophées
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
  }, [])

  return (
    <nav className="theme-nav">
      <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          {showBackToDashboard ? (
            <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-80 transition">
              <img src="/images/logo.svg" alt="PronoHub" className="w-14 h-14" />
            </Link>
          ) : (
            <img src="/images/logo.svg" alt="PronoHub" className="w-14 h-14" />
          )}
          <ThemeToggle />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Link href="/profile" className="relative w-8 h-8 rounded-full overflow-hidden border-2 theme-accent-border cursor-pointer hover:opacity-80 transition">
              <Image
                src={getAvatarUrl(avatar || 'avatar1')}
                alt={username}
                fill
                className="object-cover"
                sizes="32px"
              />
              {/* Pastille de notification pour nouveaux trophées */}
              {hasNewTrophies && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></div>
              )}
            </Link>
            <span className="theme-text text-sm">Bonjour, {username} !</span>
          </div>

          {!hideProfileLink && (
            <>
              {/* Séparateur */}
              <div className="h-6 w-[2px] bg-[#e68a00]"></div>

              {/* Lien Carrière avec icône */}
              <Link
                href="/profile"
                className={`flex items-center gap-2 px-3 py-2 text-sm rounded transition-all duration-200 hover:scale-105 cursor-pointer ${
                  theme === 'dark'
                    ? 'text-[#e68a00] hover:text-[#ff9900]'
                    : 'text-red-600 hover:text-red-800'
                }`}
              >
                <img
                  src="/images/icons/profil.svg"
                  alt="Carrière"
                  className="w-5 h-5 icon-filter-theme"
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
              className={`flex items-center gap-2 px-3 py-2 text-sm rounded transition-all duration-200 hover:scale-105 cursor-pointer ${
                theme === 'dark'
                  ? 'text-[#e68a00] hover:text-[#ff9900]'
                  : 'text-red-600 hover:text-red-800'
              }`}
            >
              <img
                src="/images/icons/logout.svg"
                alt="Quitter"
                className="w-5 h-5 icon-filter-theme"
              />
              Quitter le terrain
            </button>
          </form>
        </div>
      </div>
    </nav>
  )
}
