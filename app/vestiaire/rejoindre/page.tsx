'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import { useUser } from '@/contexts/UserContext'
import { createClient } from '@/lib/supabase/client'

interface TournamentPreview {
  tournament: {
    name: string
    status: string
    maxPlayers: number
    currentPlayers: number
    tournamentType: string
  }
  creator: {
    username: string
    avatar: string
  }
  competition: {
    name: string
    emblem: string | null
    custom_emblem_white?: string | null
    custom_emblem_color?: string | null
    is_custom: boolean
  } | null
}

function RejoindreContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const codeFromUrl = searchParams.get('code')?.toUpperCase() || ''
  const { username, userAvatar } = useUser()
  const supabase = createClient()

  const [code, setCode] = useState(codeFromUrl)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [autoJoin, setAutoJoin] = useState(!!codeFromUrl)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [tournamentPreview, setTournamentPreview] = useState<TournamentPreview | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)

  // Charger les infos du tournoi si on a un code valide
  const loadTournamentPreview = async (tournamentCode: string) => {
    if (tournamentCode.length !== 8) {
      setTournamentPreview(null)
      return
    }

    setLoadingPreview(true)
    try {
      const response = await fetch(`/api/tournaments/preview?code=${tournamentCode}`)
      const data = await response.json()

      if (response.ok && data.success) {
        setTournamentPreview(data)
      } else {
        setTournamentPreview(null)
      }
    } catch (err) {
      console.error('Error loading tournament preview:', err)
      setTournamentPreview(null)
    } finally {
      setLoadingPreview(false)
    }
  }

  // Vérifier si l'utilisateur est connecté
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setIsAuthenticated(!!user)
      setCheckingAuth(false)

      // Charger les infos du tournoi si code présent
      if (codeFromUrl && codeFromUrl.length === 8) {
        loadTournamentPreview(codeFromUrl)
      }

      // Si connecté et code valide, auto-join
      if (user && codeFromUrl && codeFromUrl.length === 8) {
        handleJoin()
      }
    }
    checkAuth()
  }, [])

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase()
    if (value.length <= 8 && /^[A-Z0-9]*$/.test(value)) {
      setCode(value)
      setError('')
      // Charger les infos du tournoi quand le code est complet
      if (value.length === 8) {
        loadTournamentPreview(value)
      } else {
        setTournamentPreview(null)
      }
    }
  }

  const handleJoin = async () => {
    const joinCode = code || codeFromUrl

    if (joinCode.length !== 8) {
      setError('Le code doit contenir 8 caractères')
      setAutoJoin(false)
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('/api/tournaments/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inviteCode: joinCode }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.quotaExceeded) {
          setError(`Quota atteint (${data.currentCount}/${data.maxCount}). ${data.message || 'Passez à une offre supérieure.'}`)
        } else if (data.requiresPayment && data.isEventTournament) {
          setError(`${data.error} ${data.message || ''}`)
        } else {
          setError(data.error || 'Erreur lors de la tentative de rejoindre le tournoi')
        }
        setIsLoading(false)
        setAutoJoin(false)
        return
      }

      // Rediriger vers la page d'échauffement du tournoi
      if (data.tournament) {
        // Construire le slug complet (nom_CODE)
        const fullSlug = `${data.tournament.name.toLowerCase().replace(/\s+/g, '_')}_${data.tournament.slug}`
        router.push(`/vestiaire/${fullSlug}/echauffement`)
      }
    } catch (err) {
      setError('Erreur de connexion au serveur')
      setIsLoading(false)
      setAutoJoin(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleJoin()
  }

  // Construire l'URL de retour pour après connexion
  const getRedirectUrl = () => {
    const currentUrl = `/vestiaire/rejoindre?code=${code || codeFromUrl}`
    return encodeURIComponent(currentUrl)
  }

  // Affichage pendant la vérification d'authentification
  if (checkingAuth) {
    return (
      <div className="min-h-screen theme-bg flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#ff9900] border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  // Fonction pour obtenir le logo de la compétition
  const getCompetitionLogo = () => {
    if (!tournamentPreview?.competition) return null

    const comp = tournamentPreview.competition
    if (comp.is_custom) {
      // Compétition custom - utiliser custom_emblem_white pour le mode sombre
      return comp.custom_emblem_white || comp.custom_emblem_color || null
    }
    return comp.emblem
  }

  // Si non connecté, afficher l'écran de connexion/inscription
  if (!isAuthenticated) {
    const competitionLogo = getCompetitionLogo()

    return (
      <div className="min-h-screen theme-bg flex flex-col">
        <Navigation
          context="app"
          username="Invité"
          userAvatar="avatar1"
        />

        <main className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            <div className="theme-card rounded-xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-[#ff9900] to-[#e68a00] p-6 text-center">
                {/* Logo compétition ou icône par défaut */}
                <div className="w-20 h-20 mx-auto mb-4 bg-white/20 rounded-full flex items-center justify-center p-2">
                  {loadingPreview ? (
                    <div className="w-8 h-8 border-3 border-[#111] border-t-transparent rounded-full animate-spin"></div>
                  ) : competitionLogo ? (
                    <Image
                      src={competitionLogo}
                      alt="Logo compétition"
                      width={64}
                      height={64}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 419.5 375.3" className="w-10 h-10 text-[#111]" fill="currentColor">
                      <path d="M417.1,64.6c-1.7-10.4-8.3-15.8-18.9-15.9c-22.2,0-44.4,0-66.6,0c-1.5,0-3,0-5.1,0c0-2,0-3.9,0-5.7c0-6,0.1-12-0.1-18c-0.3-12.9-10.1-22.7-23-22.8c-15.1-0.1-30.2,0-45.3,0c-46,0-92,0-138,0c-15.8,0-24.9,8.5-25.6,24.3C94,33.8,94.3,41,94.3,48.8c-1.7,0-3.1,0-4.6,0c-22.2,0-44.4,0-66.6,0c-11.2,0-17.8,5.1-19.5,16.2c-8.4,56.5,7.9,104.9,49.1,144.5c23.4,22.4,51.7,36.9,82,47.5c9.7,3.4,19.7,6.2,29.6,9.1c15.5,4.6,24.4,18.4,22.3,34.8c-1.9,14.7-15.1,26.6-30.6,26.5c-12.9,0-23.8,3.7-31.8,14.3c-4.3,5.7-6.5,12.2-6.9,19.3c-0.4,7.7,4.5,13,12.3,13c53.2,0,106.5,0,159.7,0c7.2,0,11.6-4.5,11.7-11.8c0.3-18.8-15.1-34.1-34.5-34.8c-5.7-0.2-11.8-1-17-3.2c-12.1-5-19.1-17.8-18.1-30.7c1.1-13.1,9.8-24,22.6-27.4c24.4-6.6,48-14.8,70.2-27c39.8-21.8,69.2-52.7,85.3-95.6c5.1-13.7,8-27.9,8.9-42.6c0.1-1.3,0.4-2.6,0.7-4c0-4.9,0-9.8,0-14.7C418.7,76.4,418.1,70.5,417.1,64.6z"/>
                    </svg>
                  )}
                </div>

                {/* Titre */}
                <p className="text-sm text-[#111]/70 uppercase tracking-wider">Invitation à rejoindre le tournoi</p>
                {tournamentPreview ? (
                  <h1 className="text-2xl font-bold text-[#111] mt-1">{tournamentPreview.tournament.name}</h1>
                ) : (
                  <h1 className="text-2xl font-bold text-[#111] mt-1">Tournoi</h1>
                )}
              </div>

              {/* Content */}
              <div className="p-6 space-y-5">
                {/* Infos du tournoi si disponibles */}
                {tournamentPreview && (
                  <div className="text-center p-4 rounded-xl theme-secondary-bg space-y-3">
                    {/* Créateur */}
                    <div className="flex items-center justify-center gap-2">
                      <Image
                        src={`/avatars/${tournamentPreview.creator.avatar || 'avatar1'}.png`}
                        alt=""
                        width={24}
                        height={24}
                        className="w-6 h-6 rounded-full"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/avatars/avatar1.png'
                        }}
                      />
                      <span className="text-sm theme-text">
                        Créé par <span className="font-semibold theme-accent-text-always">{tournamentPreview.creator.username}</span>
                      </span>
                    </div>

                    {/* Compétition et participants */}
                    <div className="flex items-center justify-center gap-4 pt-2 border-t theme-border text-sm theme-text-secondary">
                      {/* Compétition */}
                      {tournamentPreview.competition && (
                        <div className="flex items-center gap-2">
                          {competitionLogo && (
                            <Image
                              src={competitionLogo}
                              alt=""
                              width={16}
                              height={16}
                              className="w-4 h-4 object-contain"
                            />
                          )}
                          <span>{tournamentPreview.competition.name}</span>
                        </div>
                      )}
                      {/* Séparateur */}
                      {tournamentPreview.competition && (
                        <span className="text-gray-400">•</span>
                      )}
                      {/* Participants */}
                      <div className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <span>{tournamentPreview.tournament.currentPlayers}/{tournamentPreview.tournament.maxPlayers} joueurs</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Code affiché (si pas d'infos tournoi) */}
                {!tournamentPreview && (code || codeFromUrl) && (
                  <div className="text-center p-4 rounded-xl theme-secondary-bg">
                    <p className="text-sm theme-text-secondary mb-1">Code d'invitation</p>
                    <p className="text-2xl font-bold font-mono tracking-widest theme-accent-text-always">
                      {code || codeFromUrl}
                    </p>
                  </div>
                )}

                {/* Boutons */}
                <div className="space-y-3">
                  <Link
                    href={`/auth/login?redirectTo=${getRedirectUrl()}`}
                    className="w-full py-4 px-6 bg-[#ff9900] text-[#111] rounded-xl font-bold text-lg hover:bg-[#e68a00] transition flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                    </svg>
                    Se connecter
                  </Link>

                  <Link
                    href={`/auth/signup?redirectTo=${getRedirectUrl()}`}
                    className="w-full py-4 px-6 rounded-xl font-bold text-lg transition flex items-center justify-center gap-2 border-2 border-[#ff9900] text-[#ff9900] hover:bg-[#ff9900]/10"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                    Créer un compte
                  </Link>
                </div>

                {/* Séparateur */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t theme-border"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 theme-card theme-text-secondary">ou</span>
                  </div>
                </div>

                {/* Input code manuel */}
                <div>
                  <label className="block text-sm font-medium theme-text mb-2">
                    Entrer un autre code
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={handleCodeChange}
                    placeholder="ABCD1234"
                    className="w-full py-3 px-4 border-2 theme-border rounded-xl text-center font-mono text-xl tracking-[0.3em] uppercase theme-input focus:border-[#ff9900] focus:ring-2 focus:ring-[#ff9900]/20 transition"
                  />
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="mt-6 text-center">
              <p className="text-sm theme-text-secondary">
                Après connexion, tu rejoindras automatiquement le tournoi.
              </p>
            </div>
          </div>
        </main>

        <Footer variant="minimal" />
      </div>
    )
  }

  // Si connecté, afficher le formulaire de join normal
  const competitionLogoAuth = getCompetitionLogo()

  return (
    <div className="min-h-screen theme-bg flex flex-col">
      <Navigation
        context="app"
        username={username || 'Utilisateur'}
        userAvatar={userAvatar || 'avatar1'}
      />

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="theme-card rounded-xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#ff9900] to-[#e68a00] p-6 text-center">
              {/* Logo compétition ou icône par défaut */}
              <div className="w-20 h-20 mx-auto mb-4 bg-white/20 rounded-full flex items-center justify-center p-2">
                {loadingPreview ? (
                  <div className="w-8 h-8 border-3 border-[#111] border-t-transparent rounded-full animate-spin"></div>
                ) : competitionLogoAuth ? (
                  <Image
                    src={competitionLogoAuth}
                    alt="Logo compétition"
                    width={64}
                    height={64}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 419.5 375.3" className="w-10 h-10 text-[#111]" fill="currentColor">
                    <path d="M417.1,64.6c-1.7-10.4-8.3-15.8-18.9-15.9c-22.2,0-44.4,0-66.6,0c-1.5,0-3,0-5.1,0c0-2,0-3.9,0-5.7c0-6,0.1-12-0.1-18c-0.3-12.9-10.1-22.7-23-22.8c-15.1-0.1-30.2,0-45.3,0c-46,0-92,0-138,0c-15.8,0-24.9,8.5-25.6,24.3C94,33.8,94.3,41,94.3,48.8c-1.7,0-3.1,0-4.6,0c-22.2,0-44.4,0-66.6,0c-11.2,0-17.8,5.1-19.5,16.2c-8.4,56.5,7.9,104.9,49.1,144.5c23.4,22.4,51.7,36.9,82,47.5c9.7,3.4,19.7,6.2,29.6,9.1c15.5,4.6,24.4,18.4,22.3,34.8c-1.9,14.7-15.1,26.6-30.6,26.5c-12.9,0-23.8,3.7-31.8,14.3c-4.3,5.7-6.5,12.2-6.9,19.3c-0.4,7.7,4.5,13,12.3,13c53.2,0,106.5,0,159.7,0c7.2,0,11.6-4.5,11.7-11.8c0.3-18.8-15.1-34.1-34.5-34.8c-5.7-0.2-11.8-1-17-3.2c-12.1-5-19.1-17.8-18.1-30.7c1.1-13.1,9.8-24,22.6-27.4c24.4-6.6,48-14.8,70.2-27c39.8-21.8,69.2-52.7,85.3-95.6c5.1-13.7,8-27.9,8.9-42.6c0.1-1.3,0.4-2.6,0.7-4c0-4.9,0-9.8,0-14.7C418.7,76.4,418.1,70.5,417.1,64.6z"/>
                  </svg>
                )}
              </div>

              {/* Titre */}
              {tournamentPreview ? (
                <>
                  <p className="text-sm text-[#111]/70 uppercase tracking-wider">Invitation à rejoindre le tournoi</p>
                  <h1 className="text-2xl font-bold text-[#111] mt-1">{tournamentPreview.tournament.name}</h1>
                </>
              ) : (
                <>
                  <p className="text-sm text-[#111]/70 uppercase tracking-wider">Rejoindre un tournoi</p>
                  <h1 className="text-2xl font-bold text-[#111] mt-1">Entrez le code d'invitation</h1>
                </>
              )}
            </div>

            {/* Content */}
            <div className="p-6">
              {/* Loading state pour auto-join */}
              {isLoading && autoJoin ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 mx-auto mb-4 border-4 border-[#ff9900] border-t-transparent rounded-full animate-spin"></div>
                  <p className="theme-text font-medium">Connexion au tournoi en cours...</p>
                  <p className="theme-text-secondary text-sm mt-2">Code : {code}</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Infos du tournoi si disponibles */}
                  {tournamentPreview && (
                    <div className="text-center p-4 rounded-xl theme-secondary-bg space-y-3">
                      {/* Créateur */}
                      <div className="flex items-center justify-center gap-2">
                        <Image
                          src={`/avatars/${tournamentPreview.creator.avatar || 'avatar1'}.png`}
                          alt=""
                          width={24}
                          height={24}
                          className="w-6 h-6 rounded-full"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/avatars/avatar1.png'
                          }}
                        />
                        <span className="text-sm theme-text">
                          Créé par <span className="font-semibold theme-accent-text-always">{tournamentPreview.creator.username}</span>
                        </span>
                      </div>

                      {/* Compétition et participants */}
                      <div className="flex items-center justify-center gap-4 pt-2 border-t theme-border text-sm theme-text-secondary">
                        {/* Compétition */}
                        {tournamentPreview.competition && (
                          <div className="flex items-center gap-2">
                            {competitionLogoAuth && (
                              <Image
                                src={competitionLogoAuth}
                                alt=""
                                width={16}
                                height={16}
                                className="w-4 h-4 object-contain"
                              />
                            )}
                            <span>{tournamentPreview.competition.name}</span>
                          </div>
                        )}
                        {/* Séparateur */}
                        {tournamentPreview.competition && (
                          <span className="text-gray-400">•</span>
                        )}
                        {/* Participants */}
                        <div className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          <span>{tournamentPreview.tournament.currentPlayers}/{tournamentPreview.tournament.maxPlayers} joueurs</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Input code */}
                  <div>
                    {!tournamentPreview && (
                      <label className="block text-sm font-medium theme-text mb-2">
                        Code d'invitation
                      </label>
                    )}
                    <input
                      type="text"
                      value={code}
                      onChange={handleCodeChange}
                      placeholder="ABCD1234"
                      autoFocus={!tournamentPreview}
                      className="w-full py-4 px-4 border-2 theme-border rounded-xl text-center font-mono text-2xl tracking-[0.3em] uppercase theme-input focus:border-[#ff9900] focus:ring-2 focus:ring-[#ff9900]/20 transition"
                      disabled={isLoading}
                    />
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-xs theme-text-secondary">
                        {code.length}/8 caractères
                      </span>
                      {code.length === 8 && (
                        <span className="text-xs text-green-500 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                          </svg>
                          Code valide
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Error */}
                  {error && (
                    <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                      <p className="text-sm text-red-500 flex items-center gap-2">
                        <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                        </svg>
                        {error}
                      </p>
                    </div>
                  )}

                  {/* Buttons */}
                  <div className="space-y-3">
                    <button
                      type="submit"
                      disabled={isLoading || code.length !== 8}
                      className="w-full py-4 px-6 bg-[#ff9900] text-[#111] rounded-xl font-bold text-lg hover:bg-[#e68a00] transition disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isLoading ? (
                        <>
                          <div className="w-5 h-5 border-2 border-[#111] border-t-transparent rounded-full animate-spin"></div>
                          Vérification...
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                          Rejoindre le tournoi
                        </>
                      )}
                    </button>

                    <Link
                      href="/dashboard"
                      className="block w-full py-3 px-6 text-center theme-text-secondary hover:theme-text rounded-xl border-2 theme-border hover:border-[#ff9900]/50 transition font-medium"
                    >
                      Retour au dashboard
                    </Link>
                  </div>
                </form>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="mt-6 text-center">
            <p className="text-sm theme-text-secondary">
              Vous n'avez pas de code ? Demandez-le au créateur du tournoi.
            </p>
          </div>
        </div>
      </main>

      <Footer variant="minimal" />
    </div>
  )
}

export default function RejoindrePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen theme-bg flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#ff9900] border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <RejoindreContent />
    </Suspense>
  )
}
