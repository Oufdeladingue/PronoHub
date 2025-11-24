'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/contexts/ThemeContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { getAvatarUrl } from '@/lib/avatars'
import Image from 'next/image'
import Link from 'next/link'
import ThemeToggle from '@/components/ThemeToggle'
import UserQuotasCard from '@/components/UserQuotasCard'

function ProfileContent() {
  const [activeTab, setActiveTab] = useState('profil')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [username, setUsername] = useState('')
  const [initialUsername, setInitialUsername] = useState('')
  const [selectedAvatar, setSelectedAvatar] = useState<string>('avatar1')
  const [availableAvatars, setAvailableAvatars] = useState<string[]>([])
  const [showAllAvatars, setShowAllAvatars] = useState(false)
  const [visibleAvatarsCount, setVisibleAvatarsCount] = useState(4) // Nombre d'avatars visibles sur mobile (4), 7 sur desktop
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [securityMessage, setSecurityMessage] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  const [stats, setStats] = useState<any>(null)
  const [loadingStats, setLoadingStats] = useState(false)
  const [statsLoaded, setStatsLoaded] = useState(false) // Tracker si les stats ont été chargées au moins une fois
  const [trophies, setTrophies] = useState<any[]>([])
  const [loadingTrophies, setLoadingTrophies] = useState(false)
  const [hasNewTrophies, setHasNewTrophies] = useState(false)
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

    // Adapter le nombre d'avatars visibles selon la taille de l'écran
    function updateVisibleAvatarsCount() {
      if (window.innerWidth < 768) {
        setVisibleAvatarsCount(4) // Mobile: 4 avatars
      } else {
        setVisibleAvatarsCount(7) // Desktop: 7 avatars
      }
    }

    loadProfile()
    loadAvatars()
    updateVisibleAvatarsCount()

    window.addEventListener('resize', updateVisibleAvatarsCount)
    return () => window.removeEventListener('resize', updateVisibleAvatarsCount)
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

  const handlePasswordChange = async () => {
    setChangingPassword(true)
    setSecurityMessage('')

    // Validations
    if (!currentPassword || !newPassword || !confirmPassword) {
      setSecurityMessage('Tous les champs sont requis')
      setChangingPassword(false)
      return
    }

    if (newPassword.length < 6) {
      setSecurityMessage('Le nouveau mot de passe doit contenir au moins 6 caractères')
      setChangingPassword(false)
      return
    }

    if (newPassword !== confirmPassword) {
      setSecurityMessage('Les mots de passe ne correspondent pas')
      setChangingPassword(false)
      return
    }

    try {
      // Vérifier le mot de passe actuel en tentant de se connecter
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) {
        setSecurityMessage('Erreur : utilisateur non trouvé')
        setChangingPassword(false)
        return
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword
      })

      if (signInError) {
        setSecurityMessage('Mot de passe actuel incorrect')
        setChangingPassword(false)
        return
      }

      // Mettre à jour le mot de passe
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (updateError) {
        setSecurityMessage('Erreur lors de la mise à jour du mot de passe')
      } else {
        setSecurityMessage('Mot de passe modifié avec succès')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      }
    } catch (error) {
      setSecurityMessage('Erreur lors de la modification du mot de passe')
    }

    setChangingPassword(false)
  }

  const loadStats = async () => {
    setLoadingStats(true)
    try {
      const response = await fetch('/api/user/stats')
      const data = await response.json()

      if (data.success) {
        setStats(data.stats)
        setStatsLoaded(true)
      }
    } catch (error) {
      console.error('Error loading stats:', error)
    } finally {
      setLoadingStats(false)
    }
  }

  // Charger automatiquement les stats lorsque l'utilisateur ouvre l'onglet Stats
  useEffect(() => {
    if (activeTab === 'stats' && !statsLoaded && !loadingStats) {
      loadStats()
    }
  }, [activeTab])

  // Charger automatiquement les trophées lorsque l'utilisateur ouvre l'onglet Trophées
  useEffect(() => {
    if (activeTab === 'trophees') {
      loadTrophies()
    }
  }, [activeTab])

  const loadTrophies = async () => {
    setLoadingTrophies(true)
    try {
      const response = await fetch('/api/user/trophies')
      const data = await response.json()

      if (data.success) {
        setTrophies(data.trophies)
        setHasNewTrophies(data.hasNewTrophies)
      }
    } catch (error) {
      console.error('Error loading trophies:', error)
    } finally {
      setLoadingTrophies(false)
    }
  }

  const markTrophiesAsSeen = async () => {
    try {
      await fetch('/api/user/trophies', {
        method: 'POST'
      })
      setHasNewTrophies(false)
      // Recharger les trophées pour mettre à jour l'état is_new
      loadTrophies()
    } catch (error) {
      console.error('Error marking trophies as seen:', error)
    }
  }

  const getTrophyInfo = (trophyType: string) => {
    switch (trophyType) {
      case 'king_of_day':
        return {
          name: 'The King of Day',
          description: 'Premier au classement d\'une journée de tournoi',
          image: '/trophy/king-of-day.png'
        }
      case 'correct_result':
        return {
          name: 'Le Veinard',
          description: 'Au moins un bon résultat pronostiqué',
          image: '/trophy/bon-resultat.png'
        }
      case 'exact_score':
        return {
          name: 'L\'Analyste',
          description: 'Au moins un score exact pronostiqué',
          image: '/trophy/score-exact.png'
        }
      case 'tournament_winner':
        return {
          name: 'Le Ballon d\'or',
          description: 'Premier au classement final d\'un tournoi',
          image: '/trophy/tournoi.png'
        }
      case 'double_king':
        return {
          name: 'Le Roi du Doublé',
          description: 'Premier au classement de deux journées consécutives',
          image: '/trophy/double.png'
        }
      case 'opportunist':
        return {
          name: 'L\'Opportuniste',
          description: 'Deux bons résultats sur une même journée',
          image: '/trophy/opportuniste.png'
        }
      case 'nostradamus':
        return {
          name: 'Le Nostradamus',
          description: 'Deux scores exacts sur une même journée',
          image: '/trophy/nostra.png'
        }
      case 'bonus_profiteer':
        return {
          name: 'Le Profiteur',
          description: 'Un bon résultat sur un match Bonus',
          image: '/trophy/profiteur.png'
        }
      case 'bonus_optimizer':
        return {
          name: 'L\'Optimisateur',
          description: 'Un score exact sur un match Bonus',
          image: '/trophy/optimisateur.png'
        }
      default:
        return {
          name: 'Trophée',
          description: '',
          image: ''
        }
    }
  }

  const isUsernameSet = Boolean(initialUsername && initialUsername.trim().length > 0)

  if (loading) {
    return (
      <div className="min-h-screen theme-bg flex items-center justify-center">
        <p className="theme-text">Chargement...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen theme-bg">
      {/* Navigation principale */}
      <nav className="theme-nav">
        <div className="max-w-7xl mx-auto px-2 md:px-4 py-3 md:py-6">
          <div className="grid grid-cols-[auto_1fr_auto] gap-2 md:gap-4 items-center">

            {/* COLONNE GAUCHE - Theme Toggle */}
            <div className="flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-4">
              <Link href="/dashboard" className="hidden md:block">
                <img src="/images/logo.svg" alt="PronoHub" className="w-14 h-14" />
              </Link>
              <ThemeToggle />
            </div>

            {/* COLONNE CENTRALE - "Fiche technique" centré sur mobile, également visible sur desktop */}
            <div className="flex justify-center">
              <h1 className="text-lg md:text-xl font-bold theme-accent-text-always">Fiche technique</h1>
            </div>

            {/* COLONNE DROITE - Avatar + Menu */}
            <div className="flex flex-row md:flex-row items-center gap-1 md:gap-3">
              {/* Avatar */}
              <div className="relative w-8 h-8 md:w-10 md:h-10 rounded-full overflow-hidden border-2 border-[#ff9900] flex-shrink-0">
                <Image
                  src={getAvatarUrl(selectedAvatar || 'avatar1')}
                  alt={username}
                  fill
                  className="object-cover"
                  sizes="40px"
                />
                {/* Pastille de notification pour nouveaux trophées */}
                {hasNewTrophies && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 md:w-4 md:h-4 bg-red-500 rounded-full border-2 border-white"></div>
                )}
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

                {/* Lien Accueil */}
                <Link
                  href="/dashboard"
                  className="flex items-center gap-2 px-3 py-2 text-sm rounded transition-all duration-200 hover:scale-105 cursor-pointer theme-accent-text"
                >
                  Accueil
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
                href="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center gap-2 px-3 py-2 text-sm rounded transition-all theme-accent-text hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Accueil
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
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Onglets de navigation */}
        <div className="flex justify-between md:justify-start md:gap-1 border-b theme-border mb-6">
            <button
              onClick={() => setActiveTab('profil')}
              className={`flex-1 md:flex-none px-3 py-2 md:px-4 md:py-2 font-semibold transition-all relative flex items-center justify-center gap-2 ${
                activeTab === 'profil'
                  ? 'theme-accent-text-always border-b-2 border-[#ff9900]'
                  : 'theme-slate-text hover:theme-text'
              }`}
            >
              <img
                src="/images/icons/user.svg"
                alt="Profil"
                className={`w-7 h-7 md:w-5 md:h-5 ${
                  activeTab === 'profil'
                    ? 'icon-filter-orange'
                    : 'icon-filter-slate'
                }`}
              />
              <span className="hidden md:inline">Profil</span>
            </button>

            <button
              onClick={() => setActiveTab('stats')}
              className={`flex-1 md:flex-none px-3 py-2 md:px-4 md:py-2 font-semibold transition-all relative flex items-center justify-center gap-2 ${
                activeTab === 'stats'
                  ? 'theme-accent-text-always border-b-2 border-[#ff9900]'
                  : 'theme-slate-text hover:theme-text'
              }`}
            >
              <img
                src="/images/icons/stats.svg"
                alt="Stats"
                className={`w-7 h-7 md:w-5 md:h-5 ${
                  activeTab === 'stats'
                    ? 'icon-filter-orange'
                    : 'icon-filter-slate'
                }`}
              />
              <span className="hidden md:inline">Stats</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('trophees')
                if (hasNewTrophies) {
                  markTrophiesAsSeen()
                }
              }}
              className={`flex-1 md:flex-none px-3 py-2 md:px-4 md:py-2 font-semibold transition-all relative flex items-center justify-center gap-2 ${
                activeTab === 'trophees'
                  ? 'theme-accent-text-always border-b-2 border-[#ff9900]'
                  : 'theme-slate-text hover:theme-text'
              }`}
            >
              <div className="relative">
                <img
                  src="/images/icons/gain.svg"
                  alt="Trophées"
                  className={`w-7 h-7 md:w-5 md:h-5 ${
                    activeTab === 'trophees'
                      ? 'icon-filter-orange'
                      : 'icon-filter-slate'
                  }`}
                />
                {/* Pastille de notification pour nouveaux trophées */}
                {hasNewTrophies && (
                  <div className="absolute -top-1 -right-1 w-2 h-2 md:w-2.5 md:h-2.5 bg-red-500 rounded-full border border-white"></div>
                )}
              </div>
              <span className="hidden md:inline">Trophées</span>
            </button>

            <button
              onClick={() => setActiveTab('securite')}
              className={`flex-1 md:flex-none px-3 py-2 md:px-4 md:py-2 font-semibold transition-all relative flex items-center justify-center gap-2 ${
                activeTab === 'securite'
                  ? 'theme-accent-text-always border-b-2 border-[#ff9900]'
                  : 'theme-slate-text hover:theme-text'
              }`}
            >
              <img
                src="/images/icons/secure.svg"
                alt="Sécurité"
                className={`w-7 h-7 md:w-5 md:h-5 ${
                  activeTab === 'securite'
                    ? 'icon-filter-orange'
                    : 'icon-filter-slate'
                }`}
              />
              <span className="hidden md:inline">Sécurité</span>
            </button>

            <button
              onClick={() => setActiveTab('abonnement')}
              className={`flex-1 md:flex-none px-3 py-2 md:px-4 md:py-2 font-semibold transition-all relative flex items-center justify-center gap-2 ${
                activeTab === 'abonnement'
                  ? 'theme-accent-text-always border-b-2 border-[#ff9900]'
                  : 'theme-slate-text hover:theme-text'
              }`}
            >
              <img
                src="/images/icons/premium.svg"
                alt="Abonnement"
                className={`w-7 h-7 md:w-5 md:h-5 ${
                  activeTab === 'abonnement'
                    ? 'icon-filter-orange'
                    : 'icon-filter-slate'
                }`}
              />
              <span className="hidden md:inline">Abonnement</span>
            </button>
          </div>

        <div className="theme-card">
          {message && (
            <div className={`mb-4 p-3 rounded-lg ${message.includes('succès') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {message}
            </div>
          )}

          {/* Contenu de l'onglet Profil */}
          {activeTab === 'profil' && (
            <div className="space-y-6">
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
                className={`theme-input ${isUsernameSet ? 'opacity-60 cursor-not-allowed' : ''}`}
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
              <div className="flex justify-center gap-2 mb-3 flex-wrap">
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
          )}

          {/* Contenu de l'onglet Stats */}
          {activeTab === 'stats' && (
            <div className="space-y-6">
              {loadingStats && (
                <div className="text-center py-12">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[#ff9900] border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite] mb-4"></div>
                  <p className="theme-text-secondary">Chargement des statistiques...</p>
                </div>
              )}

              {stats && !loadingStats && (
                <div className="space-y-6">
                  {/* Statistiques de tournois */}
                  <div>
                    <h3 className="text-lg font-semibold theme-text mb-4">Mes tournois</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 border border-blue-200 dark:border-blue-700">
                        <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                          {stats.totalTournaments}
                        </div>
                        <div className="text-sm theme-text-secondary mt-1">
                          Tournois total
                        </div>
                      </div>
                      <div className="p-4 rounded-lg bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 border border-green-200 dark:border-green-700">
                        <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                          {stats.activeTournaments}
                        </div>
                        <div className="text-sm theme-text-secondary mt-1">
                          En cours
                        </div>
                      </div>
                      <div className="p-4 rounded-lg bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900/30 dark:to-gray-800/30 border border-gray-200 dark:border-gray-700">
                        <div className="text-3xl font-bold text-gray-600 dark:text-gray-400">
                          {stats.finishedTournaments}
                        </div>
                        <div className="text-sm theme-text-secondary mt-1">
                          Terminés
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Séparateur */}
                  <div className="border-t theme-border"></div>

                  {/* Statistiques de pronostics */}
                  <div>
                    <h3 className="text-lg font-semibold theme-text mb-4">Mes pronostics</h3>
                    {stats.totalFinishedMatches > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-lg bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/30 dark:to-orange-800/30 border border-orange-200 dark:border-orange-700">
                          <div className="text-3xl font-bold theme-accent-text-always">
                            {stats.correctResultsPercentage}%
                          </div>
                          <div className="text-sm theme-text-secondary mt-1">
                            Bons résultats
                          </div>
                          <div className="text-xs theme-text-secondary mt-2">
                            Sur {stats.totalFinishedMatches} matchs terminés
                          </div>
                        </div>
                        <div className="p-4 rounded-lg bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/30 dark:to-yellow-800/30 border border-yellow-200 dark:border-yellow-700">
                          <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                            {stats.exactScoresPercentage}%
                          </div>
                          <div className="text-sm theme-text-secondary mt-1">
                            Scores exacts
                          </div>
                          <div className="text-xs theme-text-secondary mt-2">
                            Sur {stats.totalFinishedMatches} matchs terminés
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 theme-text-secondary">
                        Aucun match pronostiqué terminé pour le moment
                      </div>
                    )}
                  </div>

                  {/* Séparateur */}
                  <div className="border-t theme-border"></div>

                  {/* Statistiques de classements */}
                  <div>
                    <h3 className="text-lg font-semibold theme-text mb-4">Mes performances</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {stats.finishedTournaments > 0 ? (
                        <div className="p-4 rounded-lg bg-gradient-to-br from-yellow-50 to-amber-100 dark:from-yellow-900/30 dark:to-amber-800/30 border-2 border-yellow-400 dark:border-yellow-600">
                          <div className="flex items-center gap-3">
                            <div className="text-4xl">🏆</div>
                            <div>
                              <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                                {stats.firstPlacesFinal}
                              </div>
                              <div className="text-sm theme-text-secondary mt-1">
                                Victoire{stats.firstPlacesFinal > 1 ? 's' : ''} finale{stats.firstPlacesFinal > 1 ? 's' : ''}
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 rounded-lg bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900/30 dark:to-gray-800/30 border border-gray-200 dark:border-gray-700">
                          <div className="text-center py-4 theme-text-secondary text-sm">
                            Aucun tournoi terminé
                          </div>
                        </div>
                      )}

                      {stats.firstPlacesProvisional > 0 ? (
                        <div className="p-4 rounded-lg bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 border border-purple-200 dark:border-purple-700">
                          <div className="flex items-center gap-3">
                            <div className="text-4xl">⭐</div>
                            <div>
                              <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                                {stats.firstPlacesProvisional}
                              </div>
                              <div className="text-sm theme-text-secondary mt-1">
                                Première{stats.firstPlacesProvisional > 1 ? 's' : ''} place{stats.firstPlacesProvisional > 1 ? 's' : ''} provisoire{stats.firstPlacesProvisional > 1 ? 's' : ''}
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 rounded-lg bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900/30 dark:to-gray-800/30 border border-gray-200 dark:border-gray-700">
                          <div className="text-center py-4 theme-text-secondary text-sm">
                            Aucune première place provisoire
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              )}
            </div>
          )}

          {/* Contenu de l'onglet Trophées */}
          {activeTab === 'trophees' && (
            <div className="space-y-6">
              {loadingTrophies ? (
                <div className="text-center py-12">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[#ff9900] border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite] mb-4"></div>
                  <p className="theme-text-secondary">Chargement des trophées...</p>
                </div>
              ) : trophies.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🏆</div>
                  <p className="theme-text-secondary text-lg mb-2">Aucun trophée déverrouillé pour le moment</p>
                  <p className="theme-text-secondary text-sm">
                    Continuez à pronostiquer pour débloquer vos premiers trophées !
                  </p>
                </div>
              ) : (
                <div>
                  <h3 className="text-lg font-semibold theme-text mb-4">Mes trophées déverrouillés</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {trophies.map((trophy) => {
                      const trophyInfo = getTrophyInfo(trophy.trophy_type)
                      return (
                        <div
                          key={trophy.id}
                          style={{
                            background: theme === 'dark' ? '#0f172a' : trophy.is_new
                              ? 'linear-gradient(to bottom right, rgb(254, 252, 232), rgb(254, 243, 199))'
                              : 'linear-gradient(to bottom right, rgb(249, 250, 251), rgb(243, 244, 246))'
                          }}
                          className={`relative p-6 rounded-lg border-2 transition-all ${
                            trophy.is_new
                              ? 'border-yellow-400 dark:border-yellow-600 shadow-lg'
                              : 'border-gray-200 dark:border-gray-700'
                          }`}
                        >
                          {/* Badge "NOUVEAU" */}
                          {trophy.is_new && (
                            <div className="absolute top-2 right-2 px-2 py-1 bg-red-500 text-white text-xs font-bold rounded-full">
                              NOUVEAU
                            </div>
                          )}

                          <div className="flex items-center gap-4">
                            {/* Image du trophée */}
                            <div className="flex-shrink-0">
                              <img
                                src={trophyInfo.image}
                                alt={trophyInfo.name}
                                className="w-20 h-20 object-contain"
                              />
                            </div>

                            {/* Informations du trophée */}
                            <div className="flex-1">
                              <h4 className="text-lg font-bold theme-text mb-1">
                                {trophyInfo.name}
                              </h4>
                              <p className="text-sm theme-text-secondary mb-2">
                                {trophyInfo.description}
                              </p>
                              <p className="text-xs theme-text-secondary">
                                Déverrouillé le {new Date(trophy.unlocked_at).toLocaleDateString('fr-FR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric'
                                })}
                              </p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Liste des trophées à débloquer */}
                  <div className="mt-8">
                    <h3 className="text-lg font-semibold theme-text mb-4">Trophées à débloquer</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {['king_of_day', 'correct_result', 'exact_score', 'tournament_winner', 'double_king', 'opportunist', 'nostradamus', 'bonus_profiteer', 'bonus_optimizer']
                        .filter(type => !trophies.some(t => t.trophy_type === type))
                        .map((trophyType) => {
                          const trophyInfo = getTrophyInfo(trophyType)
                          return (
                            <div
                              key={trophyType}
                              style={{
                                background: theme === 'dark' ? '#0f172a' : undefined
                              }}
                              className="relative p-6 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 opacity-50"
                            >
                              <div className="flex items-center gap-4">
                                {/* Image du trophée en noir et blanc */}
                                <div className="flex-shrink-0 grayscale">
                                  <img
                                    src={trophyInfo.image}
                                    alt={trophyInfo.name}
                                    className="w-20 h-20 object-contain"
                                  />
                                </div>

                                {/* Informations du trophée */}
                                <div className="flex-1">
                                  <h4 className="text-lg font-bold theme-text mb-1">
                                    {trophyInfo.name}
                                  </h4>
                                  <p className="text-sm theme-text-secondary">
                                    {trophyInfo.description}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Contenu de l'onglet Sécurité */}
          {activeTab === 'securite' && (
            <div className="space-y-6">
              {securityMessage && (
                <div className={`p-3 rounded-lg ${securityMessage.includes('succès') ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
                  {securityMessage}
                </div>
              )}

              {/* Section Email */}
              <div>
                <h3 className="text-lg font-semibold theme-text mb-4">Adresse email</h3>
                <div>
                  <label htmlFor="email-security" className="block text-sm font-medium theme-text mb-2">
                    Email
                  </label>
                  <input
                    id="email-security"
                    type="email"
                    value={email}
                    disabled
                    className="theme-input opacity-60 cursor-not-allowed"
                  />
                  <p className="text-sm theme-text-secondary mt-1">
                    L'email ne peut pas être modifié
                  </p>
                </div>
              </div>

              {/* Séparateur */}
              <div className="border-t theme-border"></div>

              {/* Section Changement de mot de passe */}
              <div>
                <h3 className="text-lg font-semibold theme-text mb-4">Modifier le mot de passe</h3>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="current-password" className="block text-sm font-medium theme-text mb-2">
                      Mot de passe actuel
                    </label>
                    <input
                      id="current-password"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="theme-input"
                      placeholder="Entrez votre mot de passe actuel"
                    />
                  </div>

                  <div>
                    <label htmlFor="new-password" className="block text-sm font-medium theme-text mb-2">
                      Nouveau mot de passe
                    </label>
                    <input
                      id="new-password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="theme-input"
                      placeholder="Minimum 6 caractères"
                    />
                  </div>

                  <div>
                    <label htmlFor="confirm-password" className="block text-sm font-medium theme-text mb-2">
                      Confirmer le nouveau mot de passe
                    </label>
                    <input
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="theme-input"
                      placeholder="Confirmez le nouveau mot de passe"
                    />
                  </div>

                  <button
                    onClick={handlePasswordChange}
                    disabled={changingPassword}
                    className="theme-btn-primary w-full"
                  >
                    {changingPassword ? 'Modification en cours...' : 'Modifier le mot de passe'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Contenu de l'onglet Abonnement */}
          {activeTab === 'abonnement' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold theme-text mb-4">Mon abonnement</h3>
              <UserQuotasCard />
              <div className="mt-6 p-4 theme-card-secondary rounded-lg">
                <p className="text-sm theme-text-secondary">
                  Gerez votre abonnement, consultez vos quotas et passez a Premium pour debloquer plus de fonctionnalites.
                </p>
              </div>
            </div>
          )}
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
