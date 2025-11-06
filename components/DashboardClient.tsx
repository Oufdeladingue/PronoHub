'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ThemeToggle from './ThemeToggle'
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext'

interface DashboardClientProps {
  username: string
  isSuper: boolean
  hasReachedLimit: boolean
  currentTournamentCount: number
  maxTournaments: number
  tournaments: any[]
  children?: React.ReactNode
}

function DashboardContent({
  username,
  isSuper,
  hasReachedLimit,
  currentTournamentCount,
  maxTournaments,
  tournaments,
  children
}: DashboardClientProps) {
  const { theme } = useTheme()
  const router = useRouter()
  const [showJoinInput, setShowJoinInput] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joinError, setJoinError] = useState('')
  const [isJoining, setIsJoining] = useState(false)

  const handleJoinTournament = async () => {
    if (joinCode.length !== 8) {
      setJoinError('Le code doit contenir exactement 8 caractères')
      return
    }

    setIsJoining(true)
    setJoinError('')

    try {
      const response = await fetch('/api/tournaments/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: joinCode.toUpperCase() })
      })

      const data = await response.json()

      if (response.ok && data.tournament) {
        // Rediriger vers la page d'échauffement du tournoi
        router.push(`/vestiaire/${data.tournament.slug}/echauffement`)
      } else {
        setJoinError(data.error || 'Code invalide ou tournoi introuvable')
      }
    } catch (error) {
      setJoinError('Erreur lors de la connexion au tournoi')
    } finally {
      setIsJoining(false)
    }
  }

  const handleJoinCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase().slice(0, 8)
    setJoinCode(value)
    setJoinError('')
  }

  return (
    <div className="min-h-screen theme-bg">
      {children}

      {/* Navigation principale */}
      <nav className="theme-nav">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src="/images/logo.svg" alt="PronoHub" className="w-14 h-14" />
            <ThemeToggle />
          </div>

          <div className="flex items-center gap-3">
            <span className="theme-text text-sm">Bonjour, {username} !</span>

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
                className="w-5 h-5"
                style={{
                  filter: theme === 'dark'
                    ? 'invert(62%) sepia(46%) saturate(1614%) hue-rotate(1deg) brightness(103%) contrast(101%)'
                    : 'invert(17%) sepia(93%) saturate(4520%) hue-rotate(355deg) brightness(88%) contrast(104%)'
                }}
              />
              Carrière
            </Link>

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
                  className="w-5 h-5"
                  style={{
                    filter: theme === 'dark'
                      ? 'invert(62%) sepia(46%) saturate(1614%) hue-rotate(1deg) brightness(103%) contrast(101%)'
                      : 'invert(17%) sepia(93%) saturate(4520%) hue-rotate(355deg) brightness(88%) contrast(104%)'
                  }}
                />
                Quitter le terrain
              </button>
            </form>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Message d'alerte si limite atteinte */}
        {hasReachedLimit && (
          <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 text-orange-600 text-2xl">⚠️</div>
              <div>
                <h3 className="font-semibold text-orange-900 mb-1">
                  Limite de tournois atteinte
                </h3>
                <p className="text-sm text-orange-800">
                  Vous participez actuellement à {currentTournamentCount} tournoi{currentTournamentCount > 1 ? 's' : ''}
                  (limite : {maxTournaments} en version gratuite).
                  Pour créer ou rejoindre un nouveau tournoi, vous devez d'abord quitter l'un de vos tournois existants ou passer à la version payante.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Section Mes tournois en premier */}
        <div className="theme-card mb-8">
          <div className="flex items-baseline gap-2 mb-4">
            <h2 className="text-xl font-bold theme-text">Mes tournois</h2>
            <span className="text-sm theme-text-secondary">
              (Participez jusqu'à {maxTournaments} tournois simultanés en version gratuite)
            </span>
          </div>
          {tournaments.length === 0 ? (
            <p className="theme-text-secondary text-center py-8">
              Vous n'avez actuellement aucun tournoi en cours
            </p>
          ) : (
            <div className="space-y-3">
              {tournaments.map((tournament) => {
                // Redirection basée sur le statut du tournoi
                let tournamentUrl = `/terrain/${tournament.slug}` // Par défaut

                if (tournament.status === 'pending' || tournament.status === 'warmup') {
                  tournamentUrl = `/vestiaire/${tournament.slug}/echauffement`
                } else if (tournament.status === 'active') {
                  tournamentUrl = `/vestiaire/${tournament.slug}/opposition`
                }

                return (
                  <a
                    key={tournament.id}
                    href={tournamentUrl}
                    className="glossy-card group relative flex items-center gap-4 p-4 border theme-border rounded-lg overflow-hidden"
                  >
                    {/* Logo de la compétition */}
                    <div className="relative z-10">
                    {tournament.emblem ? (
                      <img
                        src={tournament.emblem}
                        alt={tournament.competition_name}
                        className="w-12 h-12 object-contain"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center">
                        <span className="text-gray-400 text-xs">N/A</span>
                      </div>
                    )}
                    </div>

                    {/* Informations du tournoi */}
                    <div className="flex-1 relative z-10">
                      <h3 className="font-semibold theme-text">
                        {tournament.name}
                        {tournament.isCaptain && (
                          <span className="text-yellow-600 font-normal"> (capitaine)</span>
                        )}
                      </h3>
                      <p className="text-sm theme-text-secondary">{tournament.competition_name}</p>
                    </div>

                    {/* Statut et informations */}
                    <div className="text-right relative z-10">
                      <span className={`px-3 py-1 rounded-full text-sm ${
                        tournament.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : tournament.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {tournament.status === 'pending' && 'En attente'}
                        {tournament.status === 'active' && 'En cours'}
                        {tournament.status === 'finished' && 'Terminé'}
                      </span>
                      <p className="text-xs theme-text-secondary mt-1">
                        {tournament.status === 'pending' || tournament.status === 'warmup'
                          ? `${tournament.current_participants}/${tournament.max_players} joueurs`
                          : `${tournament.current_participants} joueurs`
                        }
                      </p>
                    </div>
                  </a>
                )
              })}
            </div>
          )}
        </div>

        {/* Actions : Créer et Rejoindre */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className={`theme-card ${hasReachedLimit ? 'opacity-60' : ''}`}>
            <h2 className="text-xl font-bold mb-4 theme-text">Créer un tournoi</h2>
            <p className="theme-text-secondary mb-4">
              Lancez votre propre tournoi de pronostics et invitez vos amis à participer.
            </p>
            {hasReachedLimit ? (
              <div className="w-full py-2 px-4 bg-gray-400 text-white rounded-md text-center cursor-not-allowed">
                Limite atteinte
              </div>
            ) : (
              <a href="/vestiaire" className="flex items-center justify-center gap-2 w-full py-2 px-4 bg-[#ff9900] text-[#111] rounded-md hover:bg-[#e68a00] transition font-semibold">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 419.5 375.3" className="w-5 h-5" fill="currentColor">
                  <path d="M417.1,64.6c-1.7-10.4-8.3-15.8-18.9-15.9c-22.2,0-44.4,0-66.6,0c-1.5,0-3,0-5.1,0c0-2,0-3.9,0-5.7c0-6,0.1-12-0.1-18c-0.3-12.9-10.1-22.7-23-22.8c-15.1-0.1-30.2,0-45.3,0c-46,0-92,0-138,0c-15.8,0-24.9,8.5-25.6,24.3C94,33.8,94.3,41,94.3,48.8c-1.7,0-3.1,0-4.6,0c-22.2,0-44.4,0-66.6,0c-11.2,0-17.8,5.1-19.5,16.2c-8.4,56.5,7.9,104.9,49.1,144.5c23.4,22.4,51.7,36.9,82,47.5c9.7,3.4,19.7,6.2,29.6,9.1c15.5,4.6,24.4,18.4,22.3,34.8c-1.9,14.7-15.1,26.6-30.6,26.5c-12.9,0-23.8,3.7-31.8,14.3c-4.3,5.7-6.5,12.2-6.9,19.3c-0.4,7.7,4.5,13,12.3,13c53.2,0,106.5,0,159.7,0c7.2,0,11.6-4.5,11.7-11.8c0.3-18.8-15.1-34.1-34.5-34.8c-5.7-0.2-11.8-1-17-3.2c-12.1-5-19.1-17.8-18.1-30.7c1.1-13.1,9.8-24,22.6-27.4c24.4-6.6,48-14.8,70.2-27c39.8-21.8,69.2-52.7,85.3-95.6c5.1-13.7,8-27.9,8.9-42.6c0.1-1.3,0.4-2.6,0.7-4c0-4.9,0-9.8,0-14.7C418.7,76.4,418.1,70.5,417.1,64.6z M40.2,122.8c-3.3-12.7-4.5-25.6-3.6-39c1.6-0.1,2.9-0.2,4.2-0.2c16.5,0,32.9,0.1,49.4-0.1c3.5,0,4.8,0.8,5.2,4.6c4,39.9,12.7,78.6,31,114.6c3,5.8,6.3,11.4,10,18.1C89.9,201.2,53.5,173.3,40.2,122.8z M275.3,154.8h-41.8v41.8h-45.3v-41.8h-41.8v-45.3h41.8V67.6h45.3v41.8h41.8V154.8z M380.7,121.6c-7.2,30.8-24.7,54.7-49.6,73.5c-13.3,10-28,17.8-43.3,24.2c-0.8,0.4-1.7,0.6-2.6,0.9c4.7-9.1,9.6-17.9,13.8-26.9c13.5-29.1,20.8-60,25-91.7c0.7-5,1-10,1.8-15c0.2-1.1,1.8-2.8,2.7-2.8c18.1-0.2,36.2-0.1,54.3-0.1c0.4,0,0.8,0.2,1.5,0.4C384.7,96.7,383.6,109.3,380.7,121.6z"/>
                </svg>
                Nouveau tournoi
              </a>
            )}
          </div>

          <div className={`theme-card ${hasReachedLimit ? 'opacity-60' : ''}`}>
            <h2 className="text-xl font-bold mb-4 theme-text">Rejoindre un tournoi</h2>
            <p className="theme-text-secondary mb-4">
              Vous avez reçu un code d'invitation ? Rejoignez un tournoi existant.
            </p>
            {hasReachedLimit ? (
              <div className="w-full py-2 px-4 bg-gray-400 text-white rounded-md text-center cursor-not-allowed">
                Limite atteinte
              </div>
            ) : !showJoinInput ? (
              <button
                onClick={() => setShowJoinInput(true)}
                className="flex items-center justify-center gap-2 w-full py-2 px-4 bg-[#ff9900] text-[#111] rounded-md hover:bg-[#e68a00] transition font-semibold"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 419.5 375.3" className="w-5 h-5" fill="currentColor">
                  <path d="M417.1,64.6c-1.7-10.4-8.3-15.8-18.9-15.9c-22.2,0-44.4,0-66.6,0c-1.5,0-3,0-5.1,0c0-2,0-3.9,0-5.7c0-6,0.1-12-0.1-18c-0.3-12.9-10.1-22.7-23-22.8c-15.1-0.1-30.2,0-45.3,0c-46,0-92,0-138,0c-15.8,0-24.9,8.5-25.6,24.3C94,33.8,94.3,41,94.3,48.8c-1.7,0-3.1,0-4.6,0c-22.2,0-44.4,0-66.6,0c-11.2,0-17.8,5.1-19.5,16.2c-8.4,56.5,7.9,104.9,49.1,144.5c23.4,22.4,51.7,36.9,82,47.5c9.7,3.4,19.7,6.2,29.6,9.1c15.5,4.6,24.4,18.4,22.3,34.8c-1.9,14.7-15.1,26.6-30.6,26.5c-12.9,0-23.8,3.7-31.8,14.3c-4.3,5.7-6.5,12.2-6.9,19.3c-0.4,7.7,4.5,13,12.3,13c53.2,0,106.5,0,159.7,0c7.2,0,11.6-4.5,11.7-11.8c0.3-18.8-15.1-34.1-34.5-34.8c-5.7-0.2-11.8-1-17-3.2c-12.1-5-19.1-17.8-18.1-30.7c1.1-13.1,9.8-24,22.6-27.4c24.4-6.6,48-14.8,70.2-27c39.8-21.8,69.2-52.7,85.3-95.6c5.1-13.7,8-27.9,8.9-42.6c0.1-1.3,0.4-2.6,0.7-4c0-4.9,0-9.8,0-14.7C418.7,76.4,418.1,70.5,417.1,64.6z M40.2,122.8c-3.3-12.7-4.5-25.6-3.6-39c1.6-0.1,2.9-0.2,4.2-0.2c16.5,0,32.9,0.1,49.4-0.1c3.5,0,4.8,0.8,5.2,4.6c4,39.9,12.7,78.6,31,114.6c3,5.8,6.3,11.4,10,18.1C89.9,201.2,53.5,173.3,40.2,122.8z M218.6,175.6c-4.7,4.7-9.1,9.7-14.3,13.8c-21.1,16.4-52.6,3.3-56.1-23.2c-1.5-11.3,1.7-21.2,9.6-29.3c7-7.2,14.1-14.3,21.3-21.3c6.7-6.5,14.9-9.6,24.1-9.7c9.6,0.1,17.8,3.4,24.6,9.9c2.9,2.8,3.2,6.9,0.6,9.6c-2.6,2.7-6.6,2.7-9.6-0.1c-9.3-8.6-22.4-8.4-31.4,0.5c-6.6,6.6-13.3,13.2-19.8,19.8c-6.2,6.3-8.2,13.9-5.6,22.4c2.6,8.4,8.6,13.5,17.2,15.1c7.4,1.4,13.9-0.8,19.3-6c3.5-3.3,6.8-6.8,10.3-10.2c3.6-3.5,9.5-2.1,10.9,2.6C220.5,171.7,220.2,173.9,218.6,175.6z M269.4,124.8c-6.9,7.2-14.1,14.2-21.2,21.2c-6.8,6.6-15,9.8-24.6,10c-9.2-0.1-17.4-3.4-24.3-9.9c-2.9-2.8-3.2-6.9-0.6-9.6c2.6-2.7,6.6-2.7,9.6,0c8.1,7.4,19.2,8.4,28,2.4c1.2-0.8,2.3-1.8,3.3-2.8c6.7-6.6,13.3-13.2,19.9-19.9c6.2-6.3,8.2-13.9,5.6-22.4c-2.6-8.4-8.5-13.5-17.2-15.2c-7.3-1.4-13.7,0.6-19.1,5.7c-3.6,3.4-7,7-10.5,10.4c-3.7,3.5-9.4,2.2-10.9-2.6c-0.7-2.1-0.5-4.4,1.1-5.9c5.1-5.1,9.8-10.6,15.6-14.8c21.3-15.3,51.4-1.9,54.9,24.1C280.3,106.9,277.2,116.7,269.4,124.8z M380.7,121.6c-7.2,30.8-24.7,54.7-49.6,73.5c-13.3,10-28,17.8-43.3,24.2c-0.8,0.4-1.7,0.6-2.6,0.9c4.7-9.1,9.6-17.9,13.8-26.9c13.5-29.1,20.8-60,25-91.7c0.7-5,1-10,1.8-15c0.2-1.1,1.8-2.8,2.7-2.8c18.1-0.2,36.2-0.1,54.3-0.1c0.4,0,0.8,0.2,1.5,0.4C384.7,96.7,383.6,109.3,380.7,121.6z"/>
                </svg>
                Rejoindre
              </button>
            ) : (
              <div className="space-y-3">
                <div>
                  <input
                    type="text"
                    value={joinCode}
                    onChange={handleJoinCodeChange}
                    placeholder="CODE 8 CARACTÈRES"
                    maxLength={8}
                    className="w-full px-4 py-2 border-2 border-[#ff9900] rounded-md text-center font-mono text-lg uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-[#ff9900] theme-text theme-bg"
                    autoFocus
                  />
                  {joinError && (
                    <p className="text-red-600 text-sm mt-1 text-center">{joinError}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleJoinTournament}
                    disabled={joinCode.length !== 8 || isJoining}
                    className="flex-1 py-2 px-4 bg-[#ff9900] text-[#111] rounded-md hover:bg-[#e68a00] transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isJoining ? 'Connexion...' : 'Valider'}
                  </button>
                  <button
                    onClick={() => {
                      setShowJoinInput(false)
                      setJoinCode('')
                      setJoinError('')
                    }}
                    className="px-4 py-2 border-2 border-gray-300 rounded-md hover:bg-gray-100 transition theme-text"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default function DashboardClient(props: DashboardClientProps) {
  return (
    <ThemeProvider>
      <DashboardContent {...props} />
    </ThemeProvider>
  )
}
