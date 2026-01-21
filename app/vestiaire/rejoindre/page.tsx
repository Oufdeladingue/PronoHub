'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import Footer from '@/components/Footer'
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
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            <div className="theme-card rounded-xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-[#ff9900] to-[#e68a00] p-6 text-center">
                {/* Logo app */}
                <div className="w-20 h-20 mx-auto mb-4 bg-[#111] rounded-full flex items-center justify-center p-3 shadow-lg">
                  <Image
                    src="/images/logo.svg"
                    alt="PronoHub"
                    width={64}
                    height={64}
                    className="w-full h-full object-contain"
                  />
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
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="theme-card rounded-xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#ff9900] to-[#e68a00] p-6 text-center">
              {/* Logo app */}
              <div className="w-20 h-20 mx-auto mb-4 bg-[#111] rounded-full flex items-center justify-center p-3 shadow-lg">
                <Image
                  src="/images/logo.svg"
                  alt="PronoHub"
                  width={64}
                  height={64}
                  className="w-full h-full object-contain"
                />
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
