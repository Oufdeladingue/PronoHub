'use client'

import Link from 'next/link'
import ThemeToggle from './ThemeToggle'
import JoinTournamentButton from './JoinTournamentButton'
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

  return (
    <div className="min-h-screen theme-bg">
      {children}

    {/* Navigation principale */}
    <nav className="theme-nav">
      <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <img src="/images/logo.svg" alt="PronoHub" className="w-17 h-17" />
          <ThemeToggle />
        </div>
        <div className="flex items-center gap-4">
          <span className="theme-text">Bonjour, {username} !</span>
          <div className="h-6 w-0.5 bg-[#e68a00]"></div>
          <Link
            href="/profile"
            className={`flex items-center gap-2 px-4 py-2 text-sm transition-all duration-200 cursor-pointer ${
              theme === 'dark'
                ? 'text-[#e68a00] hover:text-[#ff9900] hover:scale-105'
                : 'text-red-600 hover:text-red-800 hover:scale-105'
            }`}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M15.1636 3C13.7409 3 12.5495 3.99037 12.2412 5.31931L3.81819 5.31931C3.36632 5.31931 3.00001 5.68562 3.00001 6.13749C3.00001 6.58936 3.36632 6.95567 3.81819 6.95567L12.3191 6.95567C12.7181 8.14396 13.8409 9 15.1636 9C16.4864 9 17.6091 8.14396 18.0082 6.95567H20.1818C20.6337 6.95567 21 6.58936 21 6.13749C21 5.68562 20.6337 5.31931 20.1818 5.31931H18.0861C17.7778 3.99037 16.5864 3 15.1636 3Z" fill="currentColor"/>
              <path d="M7.52727 9C6.14741 9 4.98512 9.9316 4.63508 11.2002L3.79675 11.2221C3.34503 11.234 2.98845 11.6098 3.00029 12.0615C3.01213 12.5132 3.38791 12.8698 3.83963 12.8579L4.64554 12.8368C5.00778 14.0865 6.16084 15 7.52727 15C8.88587 15 10.0335 14.0969 10.4027 12.8583H20.1818C20.6337 12.8583 21 12.492 21 12.0401C21 11.5882 20.6337 11.2219 20.1818 11.2219H10.4254C10.0827 9.94227 8.91502 9 7.52727 9Z" fill="currentColor"/>
              <path d="M15.1636 15C13.8114 15 12.6681 15.8947 12.2934 17.1244H3.81819C3.36632 17.1244 3.00001 17.4907 3.00001 17.9426C3.00001 18.3944 3.36632 18.7608 3.81819 18.7608H12.2609C12.5977 20.0492 13.7696 21 15.1636 21C16.5576 21 17.7296 20.0492 18.0663 18.7608H20.1818C20.6337 18.7608 21 18.3944 21 17.9426C21 17.4907 20.6337 17.1244 20.1818 17.1244H18.0338C17.6592 15.8947 16.5159 15 15.1636 15Z" fill="currentColor"/>
            </svg>
            Carrière
          </Link>
          <div className="h-6 w-0.5 bg-[#e68a00]"></div>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className={`flex items-center gap-2 px-4 py-2 text-sm transition-all duration-200 cursor-pointer ${
                theme === 'dark'
                  ? 'text-[#e68a00] hover:text-[#ff9900] hover:scale-105'
                  : 'text-red-600 hover:text-red-800 hover:scale-105'
              }`}
            >
              <svg
                width="16"
                height="16"
                viewBox="-96 0 512 512"
                xmlns="http://www.w3.org/2000/svg"
                fill="currentColor"
              >
                <path d="M96 512L320 460.8V51.2L96 0V48H0V464H96V512ZM32 80H96V432H32V80ZM144 288C152.837 288 160 277.255 160 264C160 250.745 152.837 240 144 240C135.163 240 128 250.745 128 264C128 277.255 135.163 288 144 288Z"></path>
              </svg>
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
                const tournamentUrl = tournament.status === 'pending' || tournament.status === 'warmup'
                  ? `/vestiaire/${tournament.slug}/echauffement`
                  : `/terrain/${tournament.slug}`

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
                        {tournament.current_participants}/{tournament.max_players} joueurs
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
            ) : (
              <JoinTournamentButton />
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
