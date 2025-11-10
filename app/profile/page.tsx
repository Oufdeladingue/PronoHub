'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/contexts/ThemeContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { getAvatarUrl } from '@/lib/avatars'
import Image from 'next/image'
import Link from 'next/link'
import AppNav from '@/components/AppNav'

function ProfileContent() {
  const [username, setUsername] = useState('')
  const [initialUsername, setInitialUsername] = useState('')
  const [selectedAvatar, setSelectedAvatar] = useState<string>('avatar1')
  const [availableAvatars, setAvailableAvatars] = useState<string[]>([])
  const [showAllAvatars, setShowAllAvatars] = useState(false)
  const [visibleAvatarsCount, setVisibleAvatarsCount] = useState(7) // Nombre d'avatars visibles sur la première ligne
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()
  const supabase = createClient()
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/auth/login')
        return
      }

      setEmail(user.email || '')

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('username, theme_preference, avatar')
        .eq('id', user.id)
        .single()

      console.log('Profile data:', profile)
      console.log('Profile error:', profileError)
      if (profileError) {
        console.log('Error details:', JSON.stringify(profileError, null, 2))
      }

      if (profile) {
        setUsername(profile.username || '')
        setInitialUsername(profile.username || '')
        setSelectedAvatar(profile.avatar || 'avatar1')
      }

      setLoading(false)
    }

    async function loadAvatars() {
      try {
        const response = await fetch('/api/avatars')
        const data = await response.json()
        // Mélanger aléatoirement les avatars
        const shuffledAvatars = [...(data.avatars || [])].sort(() => Math.random() - 0.5)
        setAvailableAvatars(shuffledAvatars)
        console.log(`Avatars disponibles: ${shuffledAvatars.length}`, shuffledAvatars)
      } catch (error) {
        console.error('Error loading avatars:', error)
        // Fallback vers une liste par défaut
        setAvailableAvatars(['avatar1', 'avatar2', 'avatar3', 'avatar4', 'avatar5', 'avatar6'])
      }
    }

    loadProfile()
    loadAvatars()
  }, [router, supabase])

  const handleSave = async () => {
    setSaving(true)
    setMessage('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('profiles')
      .update({
        username,
        theme_preference: theme,
        avatar: selectedAvatar
      })
      .eq('id', user.id)

    if (error) {
      setMessage('Erreur lors de la sauvegarde')
    } else {
      setMessage('Profil mis à jour avec succès')
      setInitialUsername(username)
    }

    setSaving(false)
  }

  const handleThemeChange = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme)
  }

  const isUsernameSet = initialUsername && initialUsername.trim().length > 0

  if (loading) {
    return (
      <div className="min-h-screen theme-bg flex items-center justify-center">
        <p className="theme-text">Chargement...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen theme-bg">
      <AppNav username={username} avatar={selectedAvatar} showBackToDashboard={true} hideProfileLink={true} />

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="theme-card">
          <h1 className="text-3xl font-bold theme-text mb-6">Mon Profil</h1>

          {message && (
            <div className={`mb-4 p-3 rounded-lg ${message.includes('succès') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {message}
            </div>
          )}

          <div className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium theme-text mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                disabled
                className="theme-input opacity-60 cursor-not-allowed"
              />
              <p className="text-sm theme-text-secondary mt-1">
                L'email ne peut pas être modifié
              </p>
            </div>

            <div>
              <label htmlFor="username" className="block text-sm font-medium theme-text mb-2">
                Nom d'utilisateur
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isUsernameSet}
                className={`theme-input ${isUsernameSet ? 'cursor-not-allowed' : ''}`}
                placeholder="Votre nom d'utilisateur"
              />
              {isUsernameSet && (
                <p className="text-sm theme-text-secondary mt-1">
                  Le nom d'utilisateur ne peut pas être modifié une fois défini
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium theme-text mb-3">
                Avatar
              </label>

              {/* Prévisualisation de l'avatar sélectionné */}
              <div className="flex justify-center mb-6">
                <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-[#ff9900] shadow-lg">
                  <Image
                    src={getAvatarUrl(selectedAvatar)}
                    alt="Avatar sélectionné"
                    fill
                    className="object-cover"
                    sizes="128px"
                  />
                </div>
              </div>

              <p className="text-sm theme-text-secondary text-center mb-4">
                Choisissez votre avatar :
              </p>

              {/* Afficher seulement les avatars qui rentrent sur une ligne */}
              <div className="flex justify-center gap-2 mb-3">
                {availableAvatars
                  .filter(avatarId => avatarId !== selectedAvatar)
                  .slice(0, visibleAvatarsCount)
                  .map((avatarId) => (
                    <button
                      key={avatarId}
                      type="button"
                      onClick={() => setSelectedAvatar(avatarId)}
                      className="relative w-16 h-16 rounded-full overflow-hidden border-2 transition-all hover:scale-105 border-gray-300 dark:border-gray-600 hover:border-[#ff9900]/50 flex-shrink-0"
                    >
                      <Image
                        src={getAvatarUrl(avatarId)}
                        alt={`Avatar ${avatarId}`}
                        fill
                        className="object-cover"
                        sizes="64px"
                      />
                    </button>
                  ))}
              </div>

              {/* Lien "Plus de choix" pour afficher tous les avatars en accordéon */}
              {availableAvatars.filter(avatarId => avatarId !== selectedAvatar).length > visibleAvatarsCount && (
                <div className="text-center mb-3">
                  <button
                    type="button"
                    onClick={() => setShowAllAvatars(!showAllAvatars)}
                    className="text-xs theme-text hover:text-[#ff9900] transition flex items-center justify-center gap-2 mx-auto"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-3 w-3"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      {showAllAvatars ? (
                        <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                      ) : (
                        <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                      )}
                    </svg>
                    <span>Plus de choix</span>
                  </button>
                </div>
              )}

              {/* Accordéon avec les avatars restants (ceux non affichés sur la première ligne) */}
              {showAllAvatars && (
                <div className="flex flex-wrap justify-center gap-2 mt-3 animate-fadeIn">
                  {availableAvatars
                    .filter(avatarId => avatarId !== selectedAvatar)
                    .slice(visibleAvatarsCount)
                    .map((avatarId) => (
                      <button
                        key={avatarId}
                        type="button"
                        onClick={() => setSelectedAvatar(avatarId)}
                        className="relative w-16 h-16 rounded-full overflow-hidden border-2 transition-all hover:scale-105 border-gray-300 dark:border-gray-600 hover:border-[#ff9900]/50 flex-shrink-0"
                      >
                        <Image
                          src={getAvatarUrl(avatarId)}
                          alt={`Avatar ${avatarId}`}
                          fill
                          className="object-cover"
                          sizes="64px"
                        />
                      </button>
                    ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium theme-text mb-2">
                Thème par défaut
              </label>
              <div className="flex gap-4">
                <button
                  onClick={() => handleThemeChange('light')}
                  className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
                    theme === 'light'
                      ? 'border-[#ff9900] bg-[#ff9900]/10'
                      : 'theme-border'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="w-5 h-5"
                    >
                      <path
                        d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z"
                      />
                    </svg>
                    <span className="theme-text font-medium">Clair</span>
                  </div>
                </button>

                <button
                  onClick={() => handleThemeChange('dark')}
                  className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
                    theme === 'dark'
                      ? 'border-[#ff9900] bg-[#ff9900]/10'
                      : 'theme-border'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="w-5 h-5"
                    >
                      <path
                        fillRule="evenodd"
                        d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="theme-text font-medium">Sombre</span>
                  </div>
                </button>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={handleSave}
                disabled={saving}
                className="theme-btn-primary flex-1"
              >
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>

              <Link
                href="/dashboard"
                className="theme-btn-secondary flex-1 text-center"
              >
                Retour
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default function ProfilePage() {
  return (
    <ThemeProvider>
      <ProfileContent />
    </ThemeProvider>
  )
}
