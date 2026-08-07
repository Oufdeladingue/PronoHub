'use client'

import { useEffect, useState } from 'react'
import { createClient, fetchWithAuth } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTheme } from '@/contexts/ThemeContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { getAvatarUrl } from '@/lib/avatars'
import Image from 'next/image'
import Link from 'next/link'
import ThemeToggle from '@/components/ThemeToggle'
import LanguageSelector from '@/components/LanguageSelector'
import UserQuotasCard from '@/components/UserQuotasCard'
import Footer from '@/components/Footer'
import { useUser } from '@/contexts/UserContext'
import { isCapacitor } from '@/lib/capacitor'
import { useTranslations, useLocale } from 'next-intl'
import LogoutButton from '@/components/LogoutButton'
import TrophyCelebrationModal from '@/components/TrophyCelebrationModal'
import LockedBadgeModal from '@/components/LockedBadgeModal'

// Composant jauge en demi-cercle avec couleur dynamique
function SemiCircleGauge({
  percentage,
  label,
  subLabel,
  invertColors = false
}: {
  percentage: number
  label: string
  subLabel?: string
  invertColors?: boolean
}) {
  // Calcul de la couleur en fonction du pourcentage
  // Normal: rouge (0%) -> orange (50%) -> vert (100%)
  // Inversé: vert (0%) -> orange (50%) -> rouge (100%)
  const getColor = (pct: number, invert: boolean) => {
    const p = invert ? 100 - pct : pct
    if (p <= 33) {
      // Rouge vers orange
      const ratio = p / 33
      const r = 239
      const g = Math.round(68 + (146 - 68) * ratio)
      const b = Math.round(68 + (0 - 68) * ratio)
      return `rgb(${r}, ${g}, ${b})`
    } else if (p <= 66) {
      // Orange vers jaune-vert
      const ratio = (p - 33) / 33
      const r = Math.round(239 - (239 - 132) * ratio)
      const g = Math.round(146 + (204 - 146) * ratio)
      const b = Math.round(0 + (22 - 0) * ratio)
      return `rgb(${r}, ${g}, ${b})`
    } else {
      // Jaune-vert vers vert
      const ratio = (p - 66) / 34
      const r = Math.round(132 - (132 - 34) * ratio)
      const g = Math.round(204 - (204 - 197) * ratio)
      const b = Math.round(22 + (94 - 22) * ratio)
      return `rgb(${r}, ${g}, ${b})`
    }
  }

  const color = getColor(percentage, invertColors)

  // L'arc fait 180 degrés (demi-cercle)
  // strokeDasharray = circonférence du demi-cercle
  // strokeDashoffset = partie non remplie
  const radius = 45
  const circumference = Math.PI * radius // Demi-cercle
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-28 h-16">
        <svg
          viewBox="0 0 100 55"
          className="w-full h-full"
        >
          {/* Arc de fond (gris) */}
          <path
            d="M 5 50 A 45 45 0 0 1 95 50"
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            className="stroke-gray-200 dark-stroke-secondary"
          />
          {/* Arc de progression (coloré) */}
          <path
            d="M 5 50 A 45 45 0 0 1 95 50"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{
              transition: 'stroke-dashoffset 0.5s ease-out, stroke 0.3s ease'
            }}
          />
        </svg>
        {/* Pourcentage au centre */}
        <div className="absolute inset-0 flex items-end justify-center pb-0">
          <span
            className="text-2xl font-bold"
            style={{ color }}
          >
            {percentage}%
          </span>
        </div>
      </div>
      <div className="text-sm font-medium theme-text mt-2 text-center">
        {label}
      </div>
      {subLabel && (
        <div className="text-xs theme-text-secondary text-center">
          {subLabel}
        </div>
      )}
    </div>
  )
}

function ProfileContent() {
  const t = useTranslations('Profile')
  const tc = useTranslations('Common')
  const locale = useLocale()
  const { refreshUserData } = useUser()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')
  const initialTab = tabParam && ['profil', 'stats', 'trophees', 'securite', 'abonnement'].includes(tabParam)
    ? tabParam
    : 'profil'
  const [activeTab, setActiveTab] = useState(initialTab)
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
  const [messageType, setMessageType] = useState<'success' | 'error'>('error')
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
  const [recalculatingTrophies, setRecalculatingTrophies] = useState(false)
  const [hasNewTrophies, setHasNewTrophies] = useState(false)
  const [lastRefreshMessage, setLastRefreshMessage] = useState('')
  // Préférences de notifications (tout à true par défaut)
  const [notificationPrefs, setNotificationPrefs] = useState({
    email_reminder: true,            // Rappel si prono non renseigné (4h avant)
    email_tournament_started: true,  // Confirmation lancement tournoi par capitaine
    email_day_recap: true,           // Récap à l'issue d'une journée
    email_tournament_end: true,      // Récap fin de tournoi
    email_invite: true,              // Invitation à un tournoi
    email_player_joined: true,       // Quand un joueur rejoint (si capitaine)
    email_mention: true,             // Mention dans une discussion (@user)
    email_badge_unlocked: true,      // Nouveau badge/trophée débloqué
    email_new_matches: true,         // Nouvelles rencontres ajoutées
  })
  const [savingNotifications, setSavingNotifications] = useState(false)
  const [notificationSaved, setNotificationSaved] = useState(false)
  const [showPasswordSuccessModal, setShowPasswordSuccessModal] = useState(false)
  const [hasChosenUsername, setHasChosenUsername] = useState(true)
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null)
  const [checkingUsername, setCheckingUsername] = useState(false)
  const [showDeleteZone, setShowDeleteZone] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [selectedTrophyForModal, setSelectedTrophyForModal] = useState<any>(null)
  const [loadingTrophyModal, setLoadingTrophyModal] = useState(false)
  const [showLockedBadgeModal, setShowLockedBadgeModal] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    async function loadProfile() {
      // Utiliser getSession d'abord pour s'assurer que le storage async est prêt
      const { data: { session } } = await supabase.auth.getSession()

      const user = session?.user

      if (!user) {
        router.push('/auth/login')
        return
      }

      setEmail(user.email || '')

      // Requête de base pour le profil
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('username, theme_preference, avatar, has_chosen_username')
        .eq('id', user.id)
        .single()

      if (profileError) {
        console.error('Error loading profile:', profileError)
      }

      if (profile) {
        setUsername(profile.username || '')
        setInitialUsername(profile.username || '')
        setSelectedAvatar(profile.avatar || 'avatar1')
        setHasChosenUsername(profile.has_chosen_username !== false)
      }

      // Charger les préférences de notifications séparément (colonne optionnelle)
      try {
        const { data: prefsData } = await supabase
          .from('profiles')
          .select('notification_preferences')
          .eq('id', user.id)
          .single()

        if (prefsData?.notification_preferences) {
          setNotificationPrefs(prev => ({
            ...prev,
            ...prefsData.notification_preferences
          }))
        }
      } catch (e) {
        // La colonne notification_preferences n'existe peut-être pas encore
      }

      setLoading(false)
    }

    async function loadAvatars() {
      try {
        const response = await fetchWithAuth('/api/avatars')
        const data = await response.json()
        // Mélanger aléatoirement les avatars
        const shuffledAvatars = [...(data.avatars || [])].sort(() => Math.random() - 0.5)
        setAvailableAvatars(shuffledAvatars)
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
    loadTrophiesForAvatars() // Charger les trophées pour les avatars débloqués
    updateVisibleAvatarsCount()

    window.addEventListener('resize', updateVisibleAvatarsCount)
    return () => window.removeEventListener('resize', updateVisibleAvatarsCount)
  }, [router, supabase])

  // Fonction pour charger les trophées (uniquement pour affichage des avatars, pas de recalcul)
  async function loadTrophiesForAvatars() {
    try {
      const response = await fetchWithAuth('/api/user/trophies')
      const data = await response.json()
      if (data.success) {
        setTrophies(data.trophies)
        setHasNewTrophies(data.hasNewTrophies)
      }
    } catch (error) {
      console.error('Error loading trophies for avatars:', error)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Si le pseudo a changé et qu'on n'avait pas encore choisi, vérifier l'unicité
    const usernameChanged = username !== initialUsername
    if (usernameChanged && !hasChosenUsername) {
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .ilike('username', username)
        .neq('id', user.id)
        .limit(1)

      if (existing && existing.length > 0) {
        setMessage(t('messages.usernameTaken'))
        setMessageType('error')
        setSaving(false)
        return
      }
    }

    const updateData: any = {
      username,
      theme_preference: theme,
      avatar: selectedAvatar
    }

    // Marquer le pseudo comme choisi si c'est un changement
    if (usernameChanged && !hasChosenUsername) {
      updateData.has_chosen_username = true
    }

    const { error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', user.id)

    if (error) {
      if (error.code === '23505') {
        setMessage(t('messages.usernameTaken'))
      } else {
        setMessage(t('messages.saveError'))
      }
      setMessageType('error')
    } else {
      setMessage(t('messages.saveSuccess'))
      setMessageType('success')
      setInitialUsername(username)
      if (usernameChanged && !hasChosenUsername) {
        setHasChosenUsername(true)
      }
      // Rafraîchir les données utilisateur dans le context global
      await refreshUserData()
    }

    setSaving(false)
  }

  const handleThemeChange = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme)
  }

  const handleNotificationToggle = async (key: keyof typeof notificationPrefs) => {
    const newPrefs = {
      ...notificationPrefs,
      [key]: !notificationPrefs[key]
    }
    setNotificationPrefs(newPrefs)

    // Sauvegarder automatiquement
    setSavingNotifications(true)
    setNotificationSaved(false)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from('profiles')
        .update({ notification_preferences: newPrefs })
        .eq('id', user.id)

      if (error) {
        console.error('Error saving notification preferences:', error)
        // Reverter en cas d'erreur
        setNotificationPrefs(notificationPrefs)
      } else {
        // Afficher la confirmation de sauvegarde
        setNotificationSaved(true)
        setTimeout(() => setNotificationSaved(false), 2000)
      }
    } catch (error) {
      console.error('Error saving notification preferences:', error)
      setNotificationPrefs(notificationPrefs)
    } finally {
      setSavingNotifications(false)
    }
  }

  const handlePasswordChange = async () => {
    setChangingPassword(true)
    setSecurityMessage('')

    // Validations
    if (!currentPassword || !newPassword || !confirmPassword) {
      setSecurityMessage(t('security.errors.allFieldsRequired'))
      setChangingPassword(false)
      return
    }

    const hasMinLength = newPassword.length >= 8
    const hasUpperCase = /[A-Z]/.test(newPassword)
    const hasLowerCase = /[a-z]/.test(newPassword)
    const hasNumber = /\d/.test(newPassword)
    if (!hasMinLength || !hasUpperCase || !hasLowerCase || !hasNumber) {
      setSecurityMessage(t('security.errors.passwordRules'))
      setChangingPassword(false)
      return
    }

    if (newPassword !== confirmPassword) {
      setSecurityMessage(t('security.errors.passwordsMismatch'))
      setChangingPassword(false)
      return
    }

    try {
      // Vérifier le mot de passe actuel en tentant de se connecter
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) {
        setSecurityMessage(t('security.errors.userNotFound'))
        setChangingPassword(false)
        return
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword
      })

      if (signInError) {
        setSecurityMessage(t('security.errors.currentPasswordWrong'))
        setChangingPassword(false)
        return
      }

      // Mettre à jour le mot de passe
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (updateError) {
        setSecurityMessage(t('security.errors.updateError'))
      } else {
        setSecurityMessage('')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
        setShowPasswordSuccessModal(true)
      }
    } catch (error) {
      setSecurityMessage(t('security.errors.changeError'))
    }

    setChangingPassword(false)
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== t('security.deleteConfirmPhrase')) return

    setDeleting(true)
    setDeleteError('')

    try {
      const response = await fetchWithAuth('/api/user/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmText: deleteConfirmText })
      })

      const data = await response.json()

      if (data.success) {
        // Déconnecter côté client et rediriger
        await supabase.auth.signOut()
        router.push('/')
      } else {
        setDeleteError(data.error || t('security.deleteErrors.generic'))
        setDeleting(false)
      }
    } catch (error) {
      setDeleteError(t('security.deleteErrors.connection'))
      setDeleting(false)
    }
  }

  const loadStats = async () => {
    setLoadingStats(true)
    try {
      const response = await fetchWithAuth('/api/user/stats')
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
  // Option 3 : Affichage instantané + recalcul en arrière-plan
  useEffect(() => {
    if (activeTab === 'trophees') {
      loadTrophiesWithBackgroundRefresh()
    }
  }, [activeTab])

  const loadTrophiesWithBackgroundRefresh = async () => {
    setLoadingTrophies(true)
    setLastRefreshMessage('')

    try {
      // 1. Charger d'abord les trophées stockés (rapide)
      const response = await fetchWithAuth('/api/user/trophies')
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

    // 2. Lancer le recalcul en arrière-plan (sans bloquer l'affichage)
    setRecalculatingTrophies(true)
    try {
      const refreshResponse = await fetchWithAuth('/api/user/trophies', { method: 'PUT' })
      const refreshData = await refreshResponse.json()

      if (refreshData.success) {
        // Mettre à jour seulement si de nouveaux trophées ont été trouvés
        if (refreshData.newTrophiesUnlocked > 0) {
          setTrophies(refreshData.trophies)
          setHasNewTrophies(refreshData.hasNewTrophies)
          setLastRefreshMessage(t('trophies.refreshMessage', { count: refreshData.newTrophiesUnlocked }))
        }
      }
    } catch (error) {
      console.error('Error refreshing trophies:', error)
    } finally {
      setRecalculatingTrophies(false)
    }
  }

  const markTrophiesAsSeen = async () => {
    try {
      await fetchWithAuth('/api/user/trophies', {
        method: 'POST'
      })
      setHasNewTrophies(false)
      // Mettre à jour localement l'état is_new des trophées
      setTrophies(prev => prev.map(t => ({ ...t, is_new: false })))
    } catch (error) {
      console.error('Error marking trophies as seen:', error)
    }
  }

  // Ouvrir la modale d'un trophée avec les infos du match déclencheur
  const openTrophyModal = async (trophy: any) => {
    const trophyInfo = getTrophyInfo(trophy.trophy_type)

    // Afficher la modale immédiatement avec les infos de base
    setSelectedTrophyForModal({
      name: trophyInfo.name,
      description: trophyInfo.description,
      imagePath: trophyInfo.image,
      unlocked_at: trophy.unlocked_at
    })

    // Charger les infos du match déclencheur en arrière-plan
    try {
      const matchResponse = await fetchWithAuth(
        `/api/user/trophy-unlock-info?trophyType=${encodeURIComponent(trophy.trophy_type)}&unlockedAt=${encodeURIComponent(trophy.unlocked_at)}`
      )
      const matchData = await matchResponse.json()

      if (matchData.success && matchData.match) {
        // Mettre à jour la modale avec les infos du match
        setSelectedTrophyForModal((prev: any) => ({
          ...prev,
          triggerMatch: matchData.match
        }))
      }
    } catch (error) {
      console.error('Error loading trigger match:', error)
    }
  }

  const trophyImages: Record<string, string> = {
    king_of_day: '/trophy/king-of-day.png',
    correct_result: '/trophy/bon-resultat.png',
    exact_score: '/trophy/score-exact.png',
    tournament_winner: '/trophy/tournoi.png',
    double_king: '/trophy/double.png',
    opportunist: '/trophy/opportuniste.png',
    nostradamus: '/trophy/nostra.png',
    bonus_profiteer: '/trophy/profiteur.png',
    bonus_optimizer: '/trophy/optimisateur.png',
    ultra_dominator: '/trophy/dominateur.png',
    lantern: '/trophy/lanterne.png',
    downward_spiral: '/trophy/spirale.png',
    abyssal: '/trophy/abyssal.png',
    poulidor: '/trophy/poulidor.png',
    cursed: '/trophy/maudit.png',
    legend: '/trophy/LEGENDE.png',
  }

  const getTrophyInfo = (trophyType: string) => {
    if (!(trophyType in trophyImages)) {
      return { name: t('trophies.default'), description: '', image: '' }
    }
    return {
      name: t(`trophies.types.${trophyType}.name`),
      description: t(`trophies.types.${trophyType}.desc`),
      image: trophyImages[trophyType]
    }
  }

  const isUsernameLocked = hasChosenUsername && Boolean(initialUsername && initialUsername.trim().length > 0)

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <p className="text-gray-400">{t('loading')}</p>
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
              <h1 className="text-lg md:text-xl font-bold theme-accent-text-always">{t('header.title')}</h1>
            </div>

            {/* COLONNE DROITE - Avatar + Menu */}
            <div className="flex flex-row md:flex-row items-center gap-1 md:gap-3">
              {/* Avatar */}
              <div className="relative w-8 h-8 md:w-10 md:h-10 rounded-full overflow-hidden border-2 mobile-avatar-border md:border-[#ff9900] flex-shrink-0">
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
                aria-label={t('header.menu')}
              >
                <span className="w-5 h-0.5 hamburger-bar rounded"></span>
                <span className="w-5 h-0.5 hamburger-bar rounded"></span>
                <span className="w-5 h-0.5 hamburger-bar rounded"></span>
              </button>

              {/* Menu desktop (caché sur mobile) */}
              <div className="hidden md:flex items-center gap-3">
                <span className="nav-greeting">{t('header.greeting', { username })}</span>

                {/* Lien Accueil avec icône */}
                <Link
                  href="/dashboard"
                  className="nav-icon-btn"
                  title={t('header.home')}
                >
                  <img
                    src="/images/icons/home.svg"
                    alt={t('header.home')}
                    className="w-6 h-6"
                  />
                </Link>

                {/* Bouton Déconnexion avec icône */}
                <LogoutButton
                  className="nav-icon-btn"
                  title={t('header.leaveTitle')}
                >
                  <img
                    src="/images/icons/logout.svg"
                    alt={t('header.leave')}
                    className="w-6 h-6"
                  />
                </LogoutButton>
              </div>
            </div>
          </div>

          {/* Menu mobile dropdown */}
          {mobileMenuOpen && (
            <div className="md:hidden mt-3 pt-3 border-t border-white/30 flex flex-col gap-3">
              <div className="mobile-menu-text text-sm text-center font-bold">
                {t('header.greeting', { username })}
              </div>

              {/* 2 icônes côte à côte */}
              <div className="flex items-start justify-center gap-6">
                {/* Accueil */}
                <Link
                  href="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex flex-col items-center gap-1 p-2 rounded transition-all hover:bg-white/10"
                >
                  <img
                    src="/images/icons/home.svg"
                    alt={t('header.home')}
                    className="w-6 h-6 mobile-menu-icon"
                  />
                  <span className="text-xs mobile-menu-text">{t('header.home')}</span>
                </Link>

                {/* Quitter le terrain */}
                <LogoutButton className="flex flex-col items-center gap-1 p-2 rounded transition-all hover:bg-white/10">
                  <img
                    src="/images/icons/logout.svg"
                    alt={t('header.leave')}
                    className="w-6 h-6 mobile-menu-icon"
                  />
                  <span className="text-xs mobile-menu-text">{t('header.leave')}</span>
                </LogoutButton>
              </div>
            </div>
          )}
        </div>
      </nav>

      <main id="main-content" className="max-w-2xl mx-auto px-4 py-8 md:pb-24">
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
                alt={t('tabs.profil')}
                className={`w-7 h-7 md:w-5 md:h-5 ${
                  activeTab === 'profil'
                    ? 'icon-filter-orange'
                    : 'icon-filter-slate'
                }`}
              />
              <span className="hidden md:inline">{t('tabs.profil')}</span>
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
                alt={t('tabs.stats')}
                className={`w-7 h-7 md:w-5 md:h-5 ${
                  activeTab === 'stats'
                    ? 'icon-filter-orange'
                    : 'icon-filter-slate'
                }`}
              />
              <span className="hidden md:inline">{t('tabs.stats')}</span>
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
                  alt={t('tabs.trophees')}
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
              <span className="hidden md:inline">{t('tabs.trophees')}</span>
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
                alt={t('tabs.securite')}
                className={`w-7 h-7 md:w-5 md:h-5 ${
                  activeTab === 'securite'
                    ? 'icon-filter-orange'
                    : 'icon-filter-slate'
                }`}
              />
              <span className="hidden md:inline">{t('tabs.securite')}</span>
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
                alt={t('tabs.abonnement')}
                className={`w-7 h-7 md:w-5 md:h-5 ${
                  activeTab === 'abonnement'
                    ? 'icon-filter-orange'
                    : 'icon-filter-slate'
                }`}
              />
              <span className="hidden md:inline">{t('tabs.abonnement')}</span>
            </button>
          </div>

        <div className="theme-card">
          {message && (
            <div className={`mb-4 p-3 rounded-lg ${messageType === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {message}
            </div>
          )}

          {/* Contenu de l'onglet Profil */}
          {activeTab === 'profil' && (
            <div className="space-y-6">
            <div>
              {/* Prévisualisation de l'avatar sélectionné */}
              <div className="flex justify-center mb-4">
                <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-[#ff9900] shadow-lg">
                  <Image
                    src={getAvatarUrl(selectedAvatar)}
                    alt={t('profil.avatarSelectedAlt')}
                    fill
                    priority
                    className="object-cover"
                    sizes="128px"
                  />
                </div>
              </div>

              {/* Nom d'utilisateur sous l'avatar */}
              <div className="text-center mb-6">
                <div className="flex items-center justify-center gap-2">
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => {
                      const val = e.target.value
                      setUsername(val)
                      if (!hasChosenUsername && val.length >= 3 && val !== initialUsername) {
                        setCheckingUsername(true)
                        setUsernameAvailable(null)
                      }
                    }}
                    disabled={isUsernameLocked}
                    maxLength={12}
                    className={`theme-input max-w-[200px] text-center ${isUsernameLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                    placeholder={t('profil.usernamePlaceholder')}
                  />
                  <LanguageSelector />
                </div>
                {isUsernameLocked && (
                  <p className="text-sm theme-text-secondary mt-1">
                    {t('profil.usernameLocked')}
                  </p>
                )}
                {!hasChosenUsername && !isUsernameLocked && (
                  <p className="text-sm text-[#ff9900] mt-1 font-medium">
                    {t('profil.usernameChangeOnce')}
                  </p>
                )}
              </div>

              {/* Séparateur */}
              <div className="border-t-2 border-[#ff9900] mb-6"></div>

              <p className="text-sm theme-text-secondary text-center mb-4">
                {t('profil.chooseAvatar')}
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
                        alt={t('profil.avatarAlt', { id: avatarId })}
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
                    <span>{t('profil.moreChoices')}</span>
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
                          alt={t('profil.avatarAlt', { id: avatarId })}
                          fill
                          className="object-cover"
                          sizes="64px"
                        />
                      </button>
                    ))}
                </div>
              )}

              {/* Section Avatars Trophées - affichée seulement si l'utilisateur a des trophées */}
              {trophies.length > 0 && (
                <div className="mt-6 pt-4 border-t theme-border">
                  <p className="text-sm theme-text-secondary text-center mb-4">
                    {t('profil.trophyAvatars')}
                  </p>
                  <div className="flex justify-center gap-2 flex-wrap">
                    {trophies.map((trophy) => {
                      const trophyAvatarId = `trophy_${trophy.trophy_type}`
                      const trophyInfo = getTrophyInfo(trophy.trophy_type)
                      const isSelected = selectedAvatar === trophyAvatarId
                      return (
                        <button
                          key={trophy.id}
                          type="button"
                          onClick={() => setSelectedAvatar(trophyAvatarId)}
                          className={`relative w-16 h-16 rounded-full overflow-hidden border-2 transition-all hover:scale-105 flex-shrink-0 ${
                            isSelected
                              ? 'border-[#ff9900] ring-2 ring-[#ff9900]/50'
                              : 'border-gray-300 dark:border-gray-600 hover:border-[#ff9900]/50'
                          }`}
                          title={trophyInfo.name}
                        >
                          <Image
                            src={trophyInfo.image}
                            alt={trophyInfo.name}
                            fill
                            className="object-cover"
                            sizes="64px"
                          />
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium theme-text mb-2 text-center">
                {t('profil.defaultTheme')}
              </label>
              <div className="flex items-center justify-center gap-4">
                {/* Icône soleil */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className={`w-5 h-5 transition-colors ${theme === 'light' ? 'text-[#ff9900]' : 'theme-text-secondary'}`}
                >
                  <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
                </svg>

                {/* Toggle Switch */}
                <button
                  onClick={() => handleThemeChange(theme === 'light' ? 'dark' : 'light')}
                  className={`relative w-14 h-7 rounded-full transition-colors duration-300 ${
                    theme === 'dark' ? 'bg-[#ff9900]' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-300 ${
                      theme === 'dark' ? 'translate-x-7' : 'translate-x-0'
                    }`}
                  />
                </button>

                {/* Icône lune */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className={`w-5 h-5 transition-colors ${theme === 'dark' ? 'text-[#ff9900]' : 'theme-text-secondary'}`}
                >
                  <path fillRule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z" clipRule="evenodd" />
                </svg>
              </div>
            </div>

              <div className="flex gap-4">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="theme-btn-primary flex-1"
                >
                  {saving ? t('profil.saving') : t('profil.save')}
                </button>

                <Link
                  href="/dashboard"
                  className="theme-btn-secondary flex-1 text-center"
                >
                  {t('profil.back')}
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
                  <p className="theme-text-secondary">{t('stats.loading')}</p>
                </div>
              )}

              {stats && !loadingStats && (
                <div className="space-y-6">
                  {/* Statistiques de tournois */}
                  <div>
                    <h3 className="text-lg font-semibold theme-text mb-4">{t('stats.myTournaments')}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="stat-card border-blue-200">
                        <div className="stat-number text-blue-600">
                          {stats.totalTournaments}
                        </div>
                        <div className="text-sm theme-text-secondary mt-1">
                          {t('stats.totalTournaments')}
                        </div>
                      </div>
                      <div className="stat-card border-green-200">
                        <div className="stat-number text-green-600">
                          {stats.activeTournaments}
                        </div>
                        <div className="text-sm theme-text-secondary mt-1">
                          {t('stats.inProgress')}
                        </div>
                      </div>
                      <div className="stat-card border-gray-200">
                        <div className="stat-number text-gray-600">
                          {stats.finishedTournaments}
                        </div>
                        <div className="text-sm theme-text-secondary mt-1">
                          {t('stats.finished')}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Séparateur */}
                  <div className="border-t theme-border"></div>

                  {/* Statistiques de pronostics */}
                  <div>
                    <h3 className="text-lg font-semibold theme-text mb-4">{t('stats.myPredictions')}</h3>
                    {stats.totalFinishedMatches > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="stat-card border-transparent">
                          <SemiCircleGauge
                            percentage={stats.correctResultsPercentage}
                            label={t('stats.correctResults')}
                            subLabel={t('stats.onMatches', { count: stats.totalFinishedMatches })}
                          />
                        </div>
                        <div className="stat-card border-transparent">
                          <SemiCircleGauge
                            percentage={stats.exactScoresPercentage}
                            label={t('stats.exactScores')}
                            subLabel={t('stats.onMatches', { count: stats.totalFinishedMatches })}
                          />
                        </div>
                        <div className="stat-card border-transparent">
                          <SemiCircleGauge
                            percentage={stats.defaultPredictionsPercentage}
                            label={t('stats.notFilled')}
                            subLabel={t('stats.defaultPredictions')}
                            invertColors={true}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 theme-text-secondary">
                        {t('stats.noFinishedMatch')}
                      </div>
                    )}
                  </div>

                  {/* Séparateur */}
                  <div className="border-t theme-border"></div>

                  {/* Statistiques de classements */}
                  <div>
                    <h3 className="text-lg font-semibold theme-text mb-4">{t('stats.myPerformances')}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {stats.finishedTournaments > 0 ? (
                        <div className="stat-card border-2 border-yellow-400 bg-yellow-50">
                          <div className="flex flex-col items-center gap-2">
                            <div className="text-4xl">🏆</div>
                            <div>
                              <div className="stat-number text-yellow-600">
                                {stats.firstPlacesFinal}
                              </div>
                              <div className="text-sm theme-text-secondary mt-1">
                                {t('stats.finalWins', { count: stats.firstPlacesFinal })}
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="stat-card border-gray-200 bg-gray-50">
                          <div className="text-center py-4 theme-text-secondary text-sm">
                            {t('stats.noFinishedTournament')}
                          </div>
                        </div>
                      )}

                      {stats.firstPlacesProvisional > 0 ? (
                        <div className="stat-card border-purple-200 bg-purple-50">
                          <div className="flex flex-col items-center gap-2">
                            <div className="text-4xl">⭐</div>
                            <div>
                              <div className="stat-number text-purple-600">
                                {stats.firstPlacesProvisional}
                              </div>
                              <div className="text-sm theme-text-secondary mt-1">
                                {t('stats.provisionalFirsts', { count: stats.firstPlacesProvisional })}
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="stat-card border-gray-200 bg-gray-50">
                          <div className="text-center py-4 theme-text-secondary text-sm">
                            {t('stats.noProvisionalFirst')}
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
              {/* Indicateur de synchronisation en arrière-plan */}
              {recalculatingTrophies && (
                <div className="flex items-center justify-center gap-2 text-sm theme-text-secondary">
                  <div className="w-3 h-3 border-2 border-[#ff9900] border-t-transparent rounded-full animate-spin"></div>
                  <span>{t('trophies.checking')}</span>
                </div>
              )}

              {/* Message si nouveaux trophées trouvés */}
              {lastRefreshMessage && (
                <div className="p-3 rounded-lg text-sm text-center bg-[#ff9900] text-white font-medium">
                  🎉 {lastRefreshMessage}
                </div>
              )}

              {loadingTrophies ? (
                <div className="text-center py-12">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[#ff9900] border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite] mb-4"></div>
                  <p className="theme-text-secondary">{t('trophies.loading')}</p>
                </div>
              ) : trophies.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🏆</div>
                  <p className="theme-text-secondary text-lg mb-2">{t('trophies.emptyTitle')}</p>
                  <p className="theme-text-secondary text-sm">
                    {t('trophies.emptySubtitle')}
                  </p>
                </div>
              ) : (
                <div>
                  <h3 className="text-lg font-semibold theme-text mb-4">{t('trophies.unlockedTitle')}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {trophies.map((trophy) => {
                      const trophyInfo = getTrophyInfo(trophy.trophy_type)
                      return (
                        <div
                          key={trophy.id}
                          onClick={() => openTrophyModal(trophy)}
                          className={`trophy-card relative cursor-pointer hover:scale-[1.02] transition-transform ${trophy.is_new ? 'shadow-lg trophy-card-new' : 'trophy-card-unlocked'}`}
                        >
                          {/* Badge "NOUVEAU" */}
                          {trophy.is_new && (
                            <div className="absolute top-2 right-2 px-2 py-1 bg-red-500 text-white text-xs font-bold rounded-full">
                              {t('trophies.newBadge')}
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
                              <h4 className="trophy-title">
                                {trophyInfo.name}
                              </h4>
                              <p className="text-sm theme-text-secondary mb-2">
                                {trophyInfo.description}
                              </p>
                              <p className="text-xs theme-text-secondary">
                                {t('trophies.unlockedOn', { date: new Date(trophy.unlocked_at).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric'
                                }) })}
                              </p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Liste des trophées à débloquer */}
                  <div className="mt-8">
                    <h3 className="text-lg font-semibold theme-text mb-4">{t('trophies.toUnlockTitle')}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {['king_of_day', 'correct_result', 'exact_score', 'tournament_winner', 'double_king', 'opportunist', 'nostradamus', 'bonus_profiteer', 'bonus_optimizer', 'ultra_dominator', 'lantern', 'downward_spiral', 'abyssal', 'poulidor', 'cursed', 'legend']
                        .filter(type => !trophies.some(t => t.trophy_type === type))
                        .map((trophyType) => {
                          const trophyInfo = getTrophyInfo(trophyType)
                          return (
                            <div
                              key={trophyType}
                              onClick={() => setShowLockedBadgeModal(true)}
                              className="trophy-card-locked bg-gray-50 cursor-default"
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
                <div className="p-3 rounded-lg bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                  {securityMessage}
                </div>
              )}

              {/* Section Email */}
              <div>
                <h3 className="text-lg font-semibold theme-text mb-4">{t('security.emailSection')}</h3>
                <div>
                  <label htmlFor="email-security" className="block text-sm font-medium theme-text mb-2">
                    {t('security.emailLabel')}
                  </label>
                  <input
                    id="email-security"
                    type="email"
                    value={email}
                    disabled
                    className="theme-input opacity-60 cursor-not-allowed"
                  />
                  <p className="text-sm theme-text-secondary mt-1">
                    {t('security.emailLocked')}
                  </p>
                </div>
              </div>

              {/* Séparateur */}
              <div className="border-t theme-border"></div>

              {/* Section Notifications */}
              <div>
                <h3 className="text-lg font-semibold theme-text mb-4">{t('security.notifSection')}</h3>
                <p className="text-sm theme-text-secondary mb-4">
                  {isCapacitor()
                    ? t('security.notifIntroPush')
                    : t('security.notifIntroEmail')}
                </p>

                <div className="space-y-4">
                  {/* Rappel pronostics */}
                  <div className="pref-item">
                    <div className="flex-1 pr-4">
                      <p className="text-sm font-medium theme-text">{t('security.notifs.reminderTitle')}</p>
                      <p className="text-xs theme-text-secondary">
                        {t('security.notifs.reminderDesc')}
                      </p>
                    </div>
                    <button
                      onClick={() => handleNotificationToggle('email_reminder')}
                      disabled={savingNotifications}
                      className={`toggle-switch ${notificationPrefs.email_reminder ? 'active' : ''}`}
                    >
                      <span className="toggle-switch-knob"></span>
                    </button>
                  </div>

                  {/* Lancement tournoi */}
                  <div className="pref-item">
                    <div className="flex-1 pr-4">
                      <p className="text-sm font-medium theme-text">{t('security.notifs.startedTitle')}</p>
                      <p className="text-xs theme-text-secondary">
                        {t('security.notifs.startedDesc')}
                      </p>
                    </div>
                    <button
                      onClick={() => handleNotificationToggle('email_tournament_started')}
                      disabled={savingNotifications}
                      className={`toggle-switch ${notificationPrefs.email_tournament_started ? 'active' : ''}`}
                    >
                      <span className="toggle-switch-knob"></span>
                    </button>
                  </div>

                  {/* Récap journée */}
                  <div className="pref-item">
                    <div className="flex-1 pr-4">
                      <p className="text-sm font-medium theme-text">{t('security.notifs.dayRecapTitle')}</p>
                      <p className="text-xs theme-text-secondary">
                        {t('security.notifs.dayRecapDesc')}
                      </p>
                    </div>
                    <button
                      onClick={() => handleNotificationToggle('email_day_recap')}
                      disabled={savingNotifications}
                      className={`toggle-switch ${notificationPrefs.email_day_recap ? 'active' : ''}`}
                    >
                      <span className="toggle-switch-knob"></span>
                    </button>
                  </div>

                  {/* Récap fin tournoi */}
                  <div className="pref-item">
                    <div className="flex-1 pr-4">
                      <p className="text-sm font-medium theme-text">{t('security.notifs.endTitle')}</p>
                      <p className="text-xs theme-text-secondary">
                        {t('security.notifs.endDesc')}
                      </p>
                    </div>
                    <button
                      onClick={() => handleNotificationToggle('email_tournament_end')}
                      disabled={savingNotifications}
                      className={`toggle-switch ${notificationPrefs.email_tournament_end ? 'active' : ''}`}
                    >
                      <span className="toggle-switch-knob"></span>
                    </button>
                  </div>

                  {/* Invitation tournoi */}
                  <div className="pref-item">
                    <div className="flex-1 pr-4">
                      <p className="text-sm font-medium theme-text">{t('security.notifs.inviteTitle')}</p>
                      <p className="text-xs theme-text-secondary">
                        {t('security.notifs.inviteDesc')}
                      </p>
                    </div>
                    <button
                      onClick={() => handleNotificationToggle('email_invite')}
                      disabled={savingNotifications}
                      className={`toggle-switch ${notificationPrefs.email_invite ? 'active' : ''}`}
                    >
                      <span className="toggle-switch-knob"></span>
                    </button>
                  </div>

                  {/* Joueur rejoint (capitaine) */}
                  <div className="pref-item">
                    <div className="flex-1 pr-4">
                      <p className="text-sm font-medium theme-text">{t('security.notifs.playerJoinedTitle')}</p>
                      <p className="text-xs theme-text-secondary">
                        {t('security.notifs.playerJoinedDesc')}
                      </p>
                    </div>
                    <button
                      onClick={() => handleNotificationToggle('email_player_joined')}
                      disabled={savingNotifications}
                      className={`toggle-switch ${notificationPrefs.email_player_joined ? 'active' : ''}`}
                    >
                      <span className="toggle-switch-knob"></span>
                    </button>
                  </div>

                  {/* Mention dans discussion */}
                  <div className="pref-item">
                    <div className="flex-1 pr-4">
                      <p className="text-sm font-medium theme-text">{t('security.notifs.mentionTitle')}</p>
                      <p className="text-xs theme-text-secondary">
                        {t('security.notifs.mentionDesc')}
                      </p>
                    </div>
                    <button
                      onClick={() => handleNotificationToggle('email_mention')}
                      disabled={savingNotifications}
                      className={`toggle-switch ${notificationPrefs.email_mention ? 'active' : ''}`}
                    >
                      <span className="toggle-switch-knob"></span>
                    </button>
                  </div>

                  {/* Badge débloqué */}
                  <div className="pref-item">
                    <div className="flex-1 pr-4">
                      <p className="text-sm font-medium theme-text">{t('security.notifs.badgeTitle')}</p>
                      <p className="text-xs theme-text-secondary">
                        {t('security.notifs.badgeDesc')}
                      </p>
                    </div>
                    <button
                      onClick={() => handleNotificationToggle('email_badge_unlocked')}
                      disabled={savingNotifications}
                      className={`toggle-switch ${notificationPrefs.email_badge_unlocked ? 'active' : ''}`}
                    >
                      <span className="toggle-switch-knob"></span>
                    </button>
                  </div>

                  {/* Nouvelles rencontres */}
                  <div className="pref-item">
                    <div className="flex-1 pr-4">
                      <p className="text-sm font-medium theme-text">{t('security.notifs.newMatchesTitle')}</p>
                      <p className="text-xs theme-text-secondary">
                        {t('security.notifs.newMatchesDesc')}
                      </p>
                    </div>
                    <button
                      onClick={() => handleNotificationToggle('email_new_matches')}
                      disabled={savingNotifications}
                      className={`toggle-switch ${notificationPrefs.email_new_matches ? 'active' : ''}`}
                    >
                      <span className="toggle-switch-knob"></span>
                    </button>
                  </div>
                </div>

                {(savingNotifications || notificationSaved) && (
                  <div className={`mt-3 py-2 px-3 rounded-lg text-xs text-center flex items-center justify-center gap-2 transition-all ${
                    notificationSaved
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                  }`}>
                    {savingNotifications ? (
                      <>
                        <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                        <span>{t('security.savingNotif')}</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>{t('security.notifSaved')}</span>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Séparateur */}
              <div className="border-t theme-border"></div>

              {/* Section Changement de mot de passe */}
              <div>
                <h3 className="text-lg font-semibold theme-text mb-4">{t('security.changePasswordSection')}</h3>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="current-password" className="block text-sm font-medium theme-text mb-2">
                      {t('security.currentPassword')}
                    </label>
                    <input
                      id="current-password"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="theme-input"
                      placeholder={t('security.currentPasswordPlaceholder')}
                    />
                  </div>

                  <div>
                    <label htmlFor="new-password" className="block text-sm font-medium theme-text mb-2">
                      {t('security.newPassword')}
                    </label>
                    <input
                      id="new-password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="theme-input"
                      placeholder={t('security.newPasswordPlaceholder')}
                    />
                  </div>

                  <div>
                    <label htmlFor="confirm-password" className="block text-sm font-medium theme-text mb-2">
                      {t('security.confirmPassword')}
                    </label>
                    <input
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="theme-input"
                      placeholder={t('security.confirmPasswordPlaceholder')}
                    />
                  </div>

                  <button
                    onClick={handlePasswordChange}
                    disabled={changingPassword}
                    className="theme-btn-primary w-full"
                  >
                    {changingPassword ? t('security.changingPassword') : t('security.changePassword')}
                  </button>
                </div>
              </div>

              {/* Séparateur */}
              <div className="border-t theme-border"></div>

              {/* Zone danger - Suppression de compte (cachée par défaut) */}
              <div>
                <button
                  onClick={() => setShowDeleteZone(!showDeleteZone)}
                  className="text-xs theme-text-secondary hover:text-red-500 transition-colors underline underline-offset-2"
                >
                  {t('security.advancedAccount')}
                </button>

                {showDeleteZone && (
                  <div className="mt-4 p-4 rounded-lg border border-red-500/30 bg-red-500/5">
                    <h4 className="text-sm font-semibold text-red-500 mb-2">{t('security.deleteTitle')}</h4>
                    <p className="text-xs theme-text-secondary mb-3">
                      {t('security.deleteDesc')}
                    </p>

                    {!showDeleteConfirm ? (
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="text-xs px-3 py-1.5 rounded border border-red-500/50 text-red-500 hover:bg-red-500/10 transition-colors"
                      >
                        {t('security.deletePermanent')}
                      </button>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-xs text-red-400 font-medium">
                          {t.rich('security.deleteConfirmPrompt', { mono: (c) => <span className="font-mono font-bold">{c}</span>, phrase: t('security.deleteConfirmPhrase') })}
                        </p>
                        <input
                          type="text"
                          value={deleteConfirmText}
                          onChange={(e) => {
                            setDeleteConfirmText(e.target.value.toUpperCase())
                            setDeleteError('')
                          }}
                          placeholder={t('security.deleteConfirmPhrase')}
                          className="w-full px-3 py-2 text-sm rounded border border-red-500/50 bg-transparent theme-text font-mono focus:outline-none focus:ring-1 focus:ring-red-500"
                          autoComplete="off"
                        />
                        {deleteError && (
                          <p className="text-xs text-red-500">{deleteError}</p>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={handleDeleteAccount}
                            disabled={deleteConfirmText !== t('security.deleteConfirmPhrase') || deleting}
                            className="flex-1 py-2 px-3 text-sm rounded bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {deleting ? t('security.deleting') : t('security.deleteConfirm')}
                          </button>
                          <button
                            onClick={() => {
                              setShowDeleteConfirm(false)
                              setDeleteConfirmText('')
                              setDeleteError('')
                            }}
                            className="px-3 py-2 text-sm rounded border theme-border theme-text hover:opacity-80 transition-colors"
                          >
                            {tc('cancel')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Contenu de l'onglet Abonnement */}
          {activeTab === 'abonnement' && (
            <div className="space-y-6">
              <UserQuotasCard />
            </div>
          )}
        </div>
      </main>

      {/* Modale de célébration trophée (quand on clique sur un trophée débloqué) */}
      {selectedTrophyForModal && (
        <TrophyCelebrationModal
          trophy={selectedTrophyForModal}
          onClose={() => setSelectedTrophyForModal(null)}
        />
      )}

      {/* Modale easter egg (quand on clique sur un badge verrouillé) */}
      <LockedBadgeModal
        isOpen={showLockedBadgeModal}
        onClose={() => setShowLockedBadgeModal(false)}
        theme="gold"
      />

      {/* Modale de succès changement de mot de passe */}
      {showPasswordSuccessModal && (
        <div className="modal-backdrop">
          <div className="theme-card max-w-sm w-full p-6 rounded-2xl shadow-2xl text-center animate-fadeIn">
            {/* Icône de succès */}
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>

            {/* Titre */}
            <h3 className="text-xl font-bold theme-text mb-2">
              {t('passwordSuccess.title')}
            </h3>

            {/* Message */}
            <p className="theme-text-secondary mb-6">
              {t('passwordSuccess.message')}
            </p>

            {/* Bouton fermer */}
            <button
              onClick={() => setShowPasswordSuccessModal(false)}
              className="theme-btn-primary w-full"
            >
              {t('passwordSuccess.button')}
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <Footer />
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
