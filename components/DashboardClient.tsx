'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { UpgradeBanner } from '@/components/UpgradeBanner'
import Footer from '@/components/Footer'
import TournamentTypeBadge from '@/components/TournamentTypeBadge'

// Fonction pour formater la date au format "dd/mm à hhhmm"
function formatMatchDate(dateString: string) {
  const date = new Date(dateString)

  const day = date.getDate().toString().padStart(2, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')

  return `${day}/${month} à ${hours}h${minutes}`
}

interface QuotasInfo {
  freeTournaments: number
  freeTournamentsMax: number
  premiumTournaments: number
  premiumTournamentsMax: number
  oneshotSlotsAvailable: number
  canCreateFree: boolean
  canCreatePremium: boolean
  canCreateOneshot: boolean
}

interface LeftTournament {
  id: string
  name: string
  competition_id: number
  competition_name: string
  emblem: string | null
  custom_emblem_white: string | null
  custom_emblem_color: string | null
  tournament_type: 'free' | 'oneshot' | 'premium' | 'enterprise'
  status: string
  hasLeft: boolean
}

interface DashboardClientProps {
  username: string
  avatar?: string
  isSuper: boolean
  canCreateTournament: boolean
  hasSubscription: boolean
  quotas: QuotasInfo
  tournaments: any[]
  leftTournaments?: LeftTournament[]
  adminPath?: string
}

function DashboardContent({
  username,
  avatar,
  isSuper,
  canCreateTournament,
  hasSubscription,
  quotas,
  tournaments,
  leftTournaments = [],
  adminPath = 'admin'
}: DashboardClientProps) {
  const router = useRouter()
  const [showJoinInput, setShowJoinInput] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joinError, setJoinError] = useState('')
  const [isJoining, setIsJoining] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  // Séparer les tournois actifs/en attente des tournois terminés
  const activeTournaments = tournaments.filter(t => t.status !== 'finished')
  const finishedTournaments = tournaments.filter(t => t.status === 'finished')
  const hasArchivedTournaments = finishedTournaments.length > 0 || leftTournaments.length > 0

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
    <div className="theme-bg flex flex-col flex-1">
      <main className="max-w-7xl mx-auto px-4 py-8 w-full flex-1">
        {/* Bouton Panel Admin pour les super admins */}
        {isSuper && (
          <div className="mb-6">
            <Link
              href={`/${adminPath}`}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg shadow-lg hover:shadow-xl hover:from-purple-700 hover:to-purple-800 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="font-semibold">Panel d'administration</span>
            </Link>
          </div>
        )}

        {/* Banniere Upgrade */}
        <UpgradeBanner />

        {/* Section Mes tournois en premier */}
        <div className="theme-card mb-8">
          <div className="mb-4">
            <h2 className="text-xl font-bold theme-accent-text whitespace-nowrap text-center md:text-left">Mes tournois</h2>
            <p className="text-sm theme-text-secondary mt-1">
              {hasSubscription
                ? `Premium : ${quotas.premiumTournaments}/${quotas.premiumTournamentsMax} · Gratuit : ${quotas.freeTournaments}/${quotas.freeTournamentsMax}`
                : `Gratuit : ${quotas.freeTournaments}/${quotas.freeTournamentsMax} tournois actifs`
              }
            </p>
          </div>
          {activeTournaments.length === 0 ? (
            <p className="theme-text-secondary text-center py-8">
              Vous n'avez actuellement aucun tournoi en cours
            </p>
          ) : (
            <div className="space-y-3">
              {activeTournaments.map((tournament) => {
                // Redirection basée sur le statut du tournoi
                let tournamentUrl = `/terrain/${tournament.slug}` // Par défaut

                if (tournament.status === 'pending' || tournament.status === 'warmup') {
                  // Tournoi en préparation = vestiaire (avant le match)
                  tournamentUrl = `/vestiaire/${tournament.slug}/echauffement`
                } else if (tournament.status === 'active') {
                  // Tournoi actif = sur le terrain (plus de vestiaire dans l'URL)
                  tournamentUrl = `/${tournament.slug}/opposition`
                }

                return (
                  <a
                    key={tournament.id}
                    href={tournamentUrl}
                    className="glossy-card group relative flex flex-col md:flex-row items-center md:gap-4 p-2 md:p-4 border theme-border rounded-lg overflow-hidden"
                  >
                    {/* Badge type de tournoi - coin inférieur droit sur mobile, supérieur gauche sur desktop */}
                    <div className="absolute bottom-1 right-1 md:top-1 md:left-1 md:bottom-auto md:right-auto z-20 tournament-badge-hover">
                      <TournamentTypeBadge type={tournament.tournament_type || 'free'} size="sm" />
                    </div>

                    {/* Fond orange qui arrive de la gauche au survol - uniquement sur desktop */}
                    <div className="absolute left-0 top-0 bottom-0 w-0 hidden md:block md:group-hover:w-28 bg-[#ff9900] transition-all duration-500 ease-out pointer-events-none"></div>

                    {/* Version mobile - Layout compact */}
                    <div className="md:hidden w-full flex flex-col gap-2 relative z-10">
                      {/* Première ligne: Nom du tournoi (gauche) + Nb joueurs (droite) */}
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold theme-text text-base flex-1 transition-colors group-hover:!text-[#ff9900]">
                          {tournament.name}
                          {tournament.isCaptain && (
                            <span className="captain-label font-normal text-sm"> (capitaine)</span>
                          )}
                        </h3>
                        <p className="text-xs theme-text-secondary whitespace-nowrap">
                          {tournament.status === 'pending' || tournament.status === 'warmup'
                            ? `${tournament.current_participants}/${tournament.max_players} joueurs`
                            : `${tournament.current_participants} joueurs`
                          }
                        </p>
                      </div>

                      {/* Deuxième ligne: Logo + Nom compétition + Badge statut */}
                      <div className="flex items-center justify-between gap-3">
                        {/* Partie gauche: Logo + Nom compétition */}
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {/* Logo de la compétition */}
                          <div className="flex-shrink-0">
                            {tournament.custom_emblem_white || tournament.custom_emblem_color || tournament.emblem ? (
                              <div className="w-12 h-12 flex items-center justify-center relative">
                                {/* Logo blanc par défaut - pas de hover sur mobile */}
                                <img
                                  src={tournament.custom_emblem_white || tournament.emblem || ''}
                                  alt={tournament.competition_name}
                                  className="logo-competition-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 object-contain transition-opacity duration-300 md:group-hover:opacity-0"
                                />
                                {/* Logo couleur au survol - uniquement sur desktop */}
                                {tournament.custom_emblem_color && (
                                  <img
                                    src={tournament.custom_emblem_color}
                                    alt={tournament.competition_name}
                                    className="logo-competition-color absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 object-contain transition-opacity duration-300 opacity-0 md:group-hover:opacity-100"
                                  />
                                )}
                              </div>
                            ) : (
                              <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
                                <span className="text-gray-400 text-xs">N/A</span>
                              </div>
                            )}
                          </div>

                          {/* Nom de la compétition */}
                          <div className="flex items-center min-w-0">
                            <p className="text-sm theme-text-secondary font-medium">{tournament.competition_name}</p>
                          </div>
                        </div>

                        {/* Badge statut à droite */}
                        <span className="status-badge px-2 py-1 rounded-lg text-[10px] font-bold uppercase whitespace-nowrap flex-shrink-0 border-2 border-[#ff9900] flex items-center gap-1 bg-slate-900 text-[#ff9900]">
                          {tournament.status === 'pending' && (
                            <span className="badge-pending-animated">
                              <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" strokeWidth="3">
                                <circle cx="12" cy="12" r="10"/>
                                <polyline points="12 6 12 12 16 14"/>
                              </svg>
                              En attente
                            </span>
                          )}
                          {tournament.status === 'active' && (
                            <>
                              <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                <polyline points="9 18 15 12 9 6"/>
                              </svg>
                              En cours
                            </>
                          )}
                          {tournament.status === 'finished' && 'Terminé'}
                        </span>
                      </div>

                      {/* Troisième ligne: Info journée ou date en bas à gauche */}
                      <div>
                        {/* Informations de journée pour tournois actifs */}
                        {tournament.status === 'active' && tournament.journeyInfo && tournament.journeyInfo.total > 0 && (
                          <p className="text-xs theme-accent-text font-semibold">
                            {tournament.journeyInfo.currentNumber}{tournament.journeyInfo.currentNumber === 1 ? 'ère' : 'ème'} journée / {tournament.journeyInfo.total} au total
                          </p>
                        )}
                        {/* Date de la prochaine journée pour tournois en attente */}
                        {(tournament.status === 'pending' || tournament.status === 'warmup') && tournament.nextMatchDate && (
                          <p className="text-xs theme-accent-text font-semibold">
                            Prochaine journée le {formatMatchDate(tournament.nextMatchDate)}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Version desktop - Layout horizontal */}
                    <div className="hidden md:flex md:items-center md:gap-6 md:w-full relative z-10">
                      {/* Logo de la compétition */}
                      <div>
                        {tournament.custom_emblem_white || tournament.custom_emblem_color || tournament.emblem ? (
                          <div className="w-20 h-20 flex items-center justify-center relative">
                            {/* Logo blanc par défaut */}
                            <img
                              src={tournament.custom_emblem_white || tournament.emblem || ''}
                              alt={tournament.competition_name}
                              className="logo-competition-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 object-contain transition-opacity duration-300 group-hover:opacity-0"
                            />
                            {/* Logo couleur au survol */}
                            {tournament.custom_emblem_color && (
                              <img
                                src={tournament.custom_emblem_color}
                                alt={tournament.competition_name}
                                className="logo-competition-color absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 object-contain transition-opacity duration-300 opacity-0 group-hover:opacity-100"
                              />
                            )}
                          </div>
                        ) : (
                          <div className="w-20 h-20 bg-gray-200 rounded-xl flex items-center justify-center">
                            <span className="text-gray-400 text-sm">N/A</span>
                          </div>
                        )}
                      </div>

                      {/* Informations du tournoi */}
                      <div className="flex-1">
                        <h3 className="font-semibold theme-text text-xl transition-colors group-hover:!text-[#ff9900]">
                          {tournament.name}
                          {tournament.isCaptain && (
                            <span className="captain-label font-normal text-base"> (capitaine)</span>
                          )}
                        </h3>
                        <p className="text-base theme-text-secondary">{tournament.competition_name}</p>
                      </div>

                      {/* Statut et informations */}
                      <div className="text-right">
                        <span className="status-badge px-3 py-1.5 rounded-lg text-xs font-bold uppercase border-2 border-[#ff9900] inline-flex items-center gap-1.5 bg-slate-900 text-[#ff9900]">
                          {tournament.status === 'pending' && (
                            <span className="badge-pending-animated">
                              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" strokeWidth="3">
                                <circle cx="12" cy="12" r="10"/>
                                <polyline points="12 6 12 12 16 14"/>
                              </svg>
                              En attente
                            </span>
                          )}
                          {tournament.status === 'active' && (
                            <>
                              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                <polyline points="9 18 15 12 9 6"/>
                              </svg>
                              En cours
                            </>
                          )}
                          {tournament.status === 'finished' && 'Terminé'}
                        </span>
                        <p className="text-xs theme-text-secondary mt-1">
                          {tournament.status === 'pending' || tournament.status === 'warmup'
                            ? `${tournament.current_participants}/${tournament.max_players} joueurs`
                            : `${tournament.current_participants} joueurs`
                          }
                        </p>
                        {/* Informations de journée pour tournois actifs */}
                        {tournament.status === 'active' && tournament.journeyInfo && tournament.journeyInfo.total > 0 && (
                          <p className="text-xs theme-accent-text mt-1 font-semibold">
                            {tournament.journeyInfo.currentNumber}{tournament.journeyInfo.currentNumber === 1 ? 'ère' : 'ème'} journée / {tournament.journeyInfo.total} au total
                          </p>
                        )}
                        {/* Date de la prochaine journée pour tournois en attente */}
                        {(tournament.status === 'pending' || tournament.status === 'warmup') && tournament.nextMatchDate && (
                          <p className="text-xs theme-accent-text mt-1 font-semibold">
                            Prochaine journée le {formatMatchDate(tournament.nextMatchDate)}
                          </p>
                        )}
                      </div>
                    </div>
                  </a>
                )
              })}
            </div>
          )}

          {/* Accordéon pour tournois terminés et quittés */}
          {hasArchivedTournaments && (
            <div className="mt-6 pt-6 border-t theme-border">
              <button
                onClick={() => setShowArchived(!showArchived)}
                className="w-full flex items-center justify-between text-sm font-semibold theme-accent-text hover:opacity-80 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <img
                    src="/images/icons/plus.svg"
                    alt=""
                    className={`w-4 h-4 icon-filter-orange transition-transform duration-200 ${showArchived ? 'rotate-45' : ''}`}
                  />
                  Tournois terminés et quittés
                </span>
                <span className="text-xs bg-[#ff9900] text-[#0f172a] px-2 py-0.5 rounded font-bold">
                  {finishedTournaments.length + leftTournaments.length}
                </span>
              </button>

              {showArchived && (
                <div className="mt-4 space-y-4 animate-fadeIn">
                  {/* Tournois terminés */}
                  {finishedTournaments.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold theme-text-secondary mb-2 uppercase tracking-wide">Terminés</h4>
                      <div className="space-y-2">
                        {finishedTournaments.map((tournament) => (
                          <a
                            key={tournament.id}
                            href={`/${tournament.slug}/opposition`}
                            className="archived-card relative flex items-center gap-4 p-3 border theme-border rounded-lg transition-colors"
                          >
                            {/* Badge type de tournoi */}
                            <div className="absolute top-1 left-1 z-20">
                              <TournamentTypeBadge type={tournament.tournament_type || 'free'} size="sm" />
                            </div>

                            {/* Logo de la compétition */}
                            <div className="flex-shrink-0">
                              {tournament.custom_emblem_white || tournament.emblem ? (
                                <div className="w-10 h-10 flex items-center justify-center">
                                  <img
                                    src={tournament.custom_emblem_white || tournament.emblem || ''}
                                    alt={tournament.competition_name}
                                    className="logo-competition-white w-8 h-8 object-contain opacity-70"
                                  />
                                </div>
                              ) : (
                                <div className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center">
                                  <span className="text-gray-500 text-xs">N/A</span>
                                </div>
                              )}
                            </div>

                            {/* Informations du tournoi */}
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium theme-text text-sm truncate">{tournament.name}</h4>
                              <p className="text-xs theme-text-secondary">{tournament.competition_name}</p>
                            </div>

                            {/* Badge "Terminé" */}
                            <div className="flex-shrink-0">
                              <span className="badge-finished px-2 py-1 rounded text-[10px] font-bold uppercase">
                                Terminé
                              </span>
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tournois quittés */}
                  {leftTournaments.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold theme-text-secondary mb-2 uppercase tracking-wide">Quittés</h4>
                      <div className="space-y-2">
                        {leftTournaments.map((tournament) => (
                          <div
                            key={tournament.id}
                            className="archived-card-left relative flex items-center gap-4 p-3 border theme-border rounded-lg opacity-60 cursor-not-allowed"
                          >
                            {/* Badge type de tournoi */}
                            <div className="absolute top-1 left-1 z-20">
                              <TournamentTypeBadge type={tournament.tournament_type || 'free'} size="sm" />
                            </div>

                            {/* Logo de la compétition */}
                            <div className="flex-shrink-0 grayscale">
                              {tournament.custom_emblem_white || tournament.emblem ? (
                                <div className="w-10 h-10 flex items-center justify-center">
                                  <img
                                    src={tournament.custom_emblem_white || tournament.emblem || ''}
                                    alt={tournament.competition_name}
                                    className="logo-competition-white w-8 h-8 object-contain opacity-50"
                                  />
                                </div>
                              ) : (
                                <div className="w-10 h-10 placeholder-logo rounded-lg flex items-center justify-center">
                                  <span className="theme-text-secondary text-xs">N/A</span>
                                </div>
                              )}
                            </div>

                            {/* Informations du tournoi */}
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium theme-text-secondary text-sm truncate">{tournament.name}</h4>
                              <p className="text-xs theme-text-secondary">{tournament.competition_name}</p>
                            </div>

                            {/* Badge "Quitté" */}
                            <div className="flex-shrink-0">
                              <span className="badge-left px-2 py-1 rounded text-[10px] font-bold uppercase">
                                Quitté
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs theme-text-secondary mt-2 italic">
                        Ces tournois occupent un slot car vous les avez créés, même si vous n'y participez plus.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions : Créer et Rejoindre */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="theme-card">
            <h2 className="text-xl font-bold mb-4 theme-accent-text text-center md:text-left">Créer un tournoi</h2>
            <p className="theme-text-secondary mb-4">
              Lancez votre propre tournoi de pronostics et invitez vos amis à participer.
            </p>
            {!canCreateTournament ? (
              <div className="space-y-2">
                <div className="w-full py-2 px-4 border-2 border-[#ff9900] bg-transparent text-[#ff9900] rounded-md text-center cursor-not-allowed opacity-50 font-semibold">
                  Quota atteint en mode gratuit : {quotas.freeTournaments}/{quotas.freeTournamentsMax}
                </div>
                <p className="text-xs text-[#ff9900] text-center">
                  Passer à une offre supérieure pour pouvoir créer un nouveau tournoi
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <a href="/vestiaire" className="flex items-center justify-center gap-2 w-full py-2 px-4 bg-[#ff9900] text-[#111] rounded-md hover:bg-[#e68a00] transition font-semibold">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 419.5 375.3" className="w-5 h-5" fill="currentColor">
                    <path d="M417.1,64.6c-1.7-10.4-8.3-15.8-18.9-15.9c-22.2,0-44.4,0-66.6,0c-1.5,0-3,0-5.1,0c0-2,0-3.9,0-5.7c0-6,0.1-12-0.1-18c-0.3-12.9-10.1-22.7-23-22.8c-15.1-0.1-30.2,0-45.3,0c-46,0-92,0-138,0c-15.8,0-24.9,8.5-25.6,24.3C94,33.8,94.3,41,94.3,48.8c-1.7,0-3.1,0-4.6,0c-22.2,0-44.4,0-66.6,0c-11.2,0-17.8,5.1-19.5,16.2c-8.4,56.5,7.9,104.9,49.1,144.5c23.4,22.4,51.7,36.9,82,47.5c9.7,3.4,19.7,6.2,29.6,9.1c15.5,4.6,24.4,18.4,22.3,34.8c-1.9,14.7-15.1,26.6-30.6,26.5c-12.9,0-23.8,3.7-31.8,14.3c-4.3,5.7-6.5,12.2-6.9,19.3c-0.4,7.7,4.5,13,12.3,13c53.2,0,106.5,0,159.7,0c7.2,0,11.6-4.5,11.7-11.8c0.3-18.8-15.1-34.1-34.5-34.8c-5.7-0.2-11.8-1-17-3.2c-12.1-5-19.1-17.8-18.1-30.7c1.1-13.1,9.8-24,22.6-27.4c24.4-6.6,48-14.8,70.2-27c39.8-21.8,69.2-52.7,85.3-95.6c5.1-13.7,8-27.9,8.9-42.6c0.1-1.3,0.4-2.6,0.7-4c0-4.9,0-9.8,0-14.7C418.7,76.4,418.1,70.5,417.1,64.6z M40.2,122.8c-3.3-12.7-4.5-25.6-3.6-39c1.6-0.1,2.9-0.2,4.2-0.2c16.5,0,32.9,0.1,49.4-0.1c3.5,0,4.8,0.8,5.2,4.6c4,39.9,12.7,78.6,31,114.6c3,5.8,6.3,11.4,10,18.1C89.9,201.2,53.5,173.3,40.2,122.8z M275.3,154.8h-41.8v41.8h-45.3v-41.8h-41.8v-45.3h41.8V67.6h45.3v41.8h41.8V154.8z M380.7,121.6c-7.2,30.8-24.7,54.7-49.6,73.5c-13.3,10-28,17.8-43.3,24.2c-0.8,0.4-1.7,0.6-2.6,0.9c4.7-9.1,9.6-17.9,13.8-26.9c13.5-29.1,20.8-60,25-91.7c0.7-5,1-10,1.8-15c0.2-1.1,1.8-2.8,2.7-2.8c18.1-0.2,36.2-0.1,54.3-0.1c0.4,0,0.8,0.2,1.5,0.4C384.7,96.7,383.6,109.3,380.7,121.6z"/>
                  </svg>
                  Nouveau tournoi
                </a>
                <p className="text-xs theme-text-secondary text-center">
                  {quotas.canCreatePremium && `Premium : ${quotas.premiumTournaments}/${quotas.premiumTournamentsMax}`}
                  {quotas.canCreatePremium && quotas.canCreateFree && ' · '}
                  {quotas.canCreateFree && `Gratuit : ${quotas.freeTournaments}/${quotas.freeTournamentsMax}`}
                  {quotas.canCreateOneshot && ` · One-shot : ${quotas.oneshotSlotsAvailable} dispo`}
                </p>
              </div>
            )}
          </div>

          <div className="theme-card">
            <h2 className="text-xl font-bold mb-4 theme-accent-text text-center md:text-left">Rejoindre un tournoi</h2>
            <p className="theme-text-secondary mb-4">
              Vous avez reçu un code d'invitation ? Rejoignez un tournoi existant.
            </p>
            {!showJoinInput ? (
              <div className="space-y-2">
                <button
                  onClick={() => setShowJoinInput(true)}
                  className="flex items-center justify-center gap-2 w-full py-2 px-4 bg-[#ff9900] text-[#111] rounded-md hover:bg-[#e68a00] transition font-semibold"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 419.5 375.3" className="w-5 h-5" fill="currentColor">
                    <path d="M417.1,64.6c-1.7-10.4-8.3-15.8-18.9-15.9c-22.2,0-44.4,0-66.6,0c-1.5,0-3,0-5.1,0c0-2,0-3.9,0-5.7c0-6,0.1-12-0.1-18c-0.3-12.9-10.1-22.7-23-22.8c-15.1-0.1-30.2,0-45.3,0c-46,0-92,0-138,0c-15.8,0-24.9,8.5-25.6,24.3C94,33.8,94.3,41,94.3,48.8c-1.7,0-3.1,0-4.6,0c-22.2,0-44.4,0-66.6,0c-11.2,0-17.8,5.1-19.5,16.2c-8.4,56.5,7.9,104.9,49.1,144.5c23.4,22.4,51.7,36.9,82,47.5c9.7,3.4,19.7,6.2,29.6,9.1c15.5,4.6,24.4,18.4,22.3,34.8c-1.9,14.7-15.1,26.6-30.6,26.5c-12.9,0-23.8,3.7-31.8,14.3c-4.3,5.7-6.5,12.2-6.9,19.3c-0.4,7.7,4.5,13,12.3,13c53.2,0,106.5,0,159.7,0c7.2,0,11.6-4.5,11.7-11.8c0.3-18.8-15.1-34.1-34.5-34.8c-5.7-0.2-11.8-1-17-3.2c-12.1-5-19.1-17.8-18.1-30.7c1.1-13.1,9.8-24,22.6-27.4c24.4-6.6,48-14.8,70.2-27c39.8-21.8,69.2-52.7,85.3-95.6c5.1-13.7,8-27.9,8.9-42.6c0.1-1.3,0.4-2.6,0.7-4c0-4.9,0-9.8,0-14.7C418.7,76.4,418.1,70.5,417.1,64.6z M40.2,122.8c-3.3-12.7-4.5-25.6-3.6-39c1.6-0.1,2.9-0.2,4.2-0.2c16.5,0,32.9,0.1,49.4-0.1c3.5,0,4.8,0.8,5.2,4.6c4,39.9,12.7,78.6,31,114.6c3,5.8,6.3,11.4,10,18.1C89.9,201.2,53.5,173.3,40.2,122.8z M218.6,175.6c-4.7,4.7-9.1,9.7-14.3,13.8c-21.1,16.4-52.6,3.3-56.1-23.2c-1.5-11.3,1.7-21.2,9.6-29.3c7-7.2,14.1-14.3,21.3-21.3c6.7-6.5,14.9-9.6,24.1-9.7c9.6,0.1,17.8,3.4,24.6,9.9c2.9,2.8,3.2,6.9,0.6,9.6c-2.6,2.7-6.6,2.7-9.6-0.1c-9.3-8.6-22.4-8.4-31.4,0.5c-6.6,6.6-13.3,13.2-19.8,19.8c-6.2,6.3-8.2,13.9-5.6,22.4c2.6,8.4,8.6,13.5,17.2,15.1c7.4,1.4,13.9-0.8,19.3-6c3.5-3.3,6.8-6.8,10.3-10.2c3.6-3.5,9.5-2.1,10.9,2.6C220.5,171.7,220.2,173.9,218.6,175.6z M269.4,124.8c-6.9,7.2-14.1,14.2-21.2,21.2c-6.8,6.6-15,9.8-24.6,10c-9.2-0.1-17.4-3.4-24.3-9.9c-2.9-2.8-3.2-6.9-0.6-9.6c2.6-2.7,6.6-2.7,9.6,0c8.1,7.4,19.2,8.4,28,2.4c1.2-0.8,2.3-1.8,3.3-2.8c6.7-6.6,13.3-13.2,19.9-19.9c6.2-6.3,8.2-13.9,5.6-22.4c-2.6-8.4-8.5-13.5-17.2-15.2c-7.3-1.4-13.7,0.6-19.1,5.7c-3.6,3.4-7,7-10.5,10.4c-3.7,3.5-9.4,2.2-10.9-2.6c-0.7-2.1-0.5-4.4,1.1-5.9c5.1-5.1,9.8-10.6,15.6-14.8c21.3-15.3,51.4-1.9,54.9,24.1C280.3,106.9,277.2,116.7,269.4,124.8z M380.7,121.6c-7.2,30.8-24.7,54.7-49.6,73.5c-13.3,10-28,17.8-43.3,24.2c-0.8,0.4-1.7,0.6-2.6,0.9c4.7-9.1,9.6-17.9,13.8-26.9c13.5-29.1,20.8-60,25-91.7c0.7-5,1-10,1.8-15c0.2-1.1,1.8-2.8,2.7-2.8c18.1-0.2,36.2-0.1,54.3-0.1c0.4,0,0.8,0.2,1.5,0.4C384.7,96.7,383.6,109.3,380.7,121.6z"/>
                  </svg>
                  Rejoindre
                </button>
                {/* Message informatif si quota gratuit atteint */}
                {!quotas.canCreateFree && (
                  <p className="text-xs text-[#ff9900] text-center">
                    Quota gratuit atteint - vous ne pouvez rejoindre qu'un tournoi premium ou one-shot
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {/* Message si quota gratuit atteint */}
                {!quotas.canCreateFree && (
                  <div className="p-2 bg-[#ff9900]/10 border border-[#ff9900]/30 rounded-md">
                    <p className="text-xs text-[#ff9900] text-center">
                      Quota gratuit atteint - vous ne pouvez rejoindre qu'un tournoi premium ou one-shot
                    </p>
                  </div>
                )}
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
      <Footer />
    </div>
  )
}

export default function DashboardClient(props: DashboardClientProps) {
  return <DashboardContent {...props} />
}
