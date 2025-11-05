'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/contexts/ThemeContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import Link from 'next/link'

function ProfileContent() {
  const [username, setUsername] = useState('')
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

      const { data: profile } = await supabase
        .from('profiles')
        .select('username, theme_preference')
        .eq('id', user.id)
        .single()

      if (profile) {
        setUsername(profile.username || '')
      }

      setLoading(false)
    }

    loadProfile()
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
        theme_preference: theme
      })
      .eq('id', user.id)

    if (error) {
      setMessage('Erreur lors de la sauvegarde')
    } else {
      setMessage('Profil mis à jour avec succès')
    }

    setSaving(false)
  }

  const handleThemeChange = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme)
  }

  if (loading) {
    return (
      <div className="min-h-screen theme-bg flex items-center justify-center">
        <p className="theme-text">Chargement...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen theme-bg">
      <nav className="theme-nav">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/dashboard" className="text-2xl font-bold theme-text hover:opacity-80">
            PronoHub
          </Link>
        </div>
      </nav>

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
                className="theme-input"
                placeholder="Votre nom d'utilisateur"
              />
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
