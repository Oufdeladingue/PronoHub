'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { UpgradeBanner } from '@/components/UpgradeBanner'
import Footer from '@/components/Footer'
import TournamentTypeBadge from '@/components/TournamentTypeBadge'
import { fetchWithAuth } from '@/lib/supabase/client'
import { openExternalUrl } from '@/lib/capacitor'
import { useTrophyNotifications } from '@/hooks/useTrophyNotifications'
import TrophyCelebrationModal from '@/components/TrophyCelebrationModal'
// Les icônes des formules sont maintenant des SVG custom dans /images/icons/

// Fonction pour formater la date au format "dd/mm à hhhmm"
function formatMatchDate(dateString: string) {
  const date = new Date(dateString)

  const day = date.getDate().toString().padStart(2, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')

  return `${day}/${month} à ${hours}h${minutes}`
}

// Fonction pour formater la date de fin au format "dd/mm/yyyy"
function formatEndDate(dateString: string) {
  const date = new Date(dateString)

  const day = date.getDate().toString().padStart(2, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const year = date.getFullYear()

  return `${day}/${month}/${year}`
}

interface QuotasInfo {
  // Tournois Free-Kick (gratuits)
  freeTournaments: number
  freeTournamentsMax: number
  canCreateFree: boolean
  canJoinFree: boolean
  // Compteurs par type de tournoi cree
  oneshotCreated: number
  eliteCreated: number
  platiniumCreated: number
  // Tournois événement (compétitions occasionnelles)
  eventTournaments: number
  // Legacy
  premiumTournaments: number
  premiumTournamentsMax: number
  oneshotSlotsAvailable: number
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

interface UserCredits {
  oneshot: number
  elite: number
  platinium_solo: number
  platinium_group_slots: number
  slot_invite: number
  duration_extension: number
  player_extension: number
}

interface DashboardClientProps {
  username: string
  avatar?: string
  isSuper: boolean
  canCreateTournament: boolean
  hasSubscription: boolean
  quotas: QuotasInfo
  credits?: UserCredits
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
  credits,
  tournaments,
  leftTournaments = [],
  adminPath = 'admin'
}: DashboardClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showJoinInput, setShowJoinInput] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joinError, setJoinError] = useState('')
  const [isJoining, setIsJoining] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [showParticipations, setShowParticipations] = useState(false)
  const [showQuotaModal, setShowQuotaModal] = useState<'create' | 'join' | null>(null)
  const [showPlatiniumChoice, setShowPlatiniumChoice] = useState(false)
  const [showPlatiniumSlotSelector, setShowPlatiniumSlotSelector] = useState(false)
  const [selectedPlatiniumSlots, setSelectedPlatiniumSlots] = useState(1)
  const [isCheckoutLoading, setIsCheckoutLoading] = useState<string | null>(null)
  // Nouveau: modale de paiement pour rejoindre un tournoi specifique
  const [joinPaymentModal, setJoinPaymentModal] = useState<{
    show: boolean
    tournamentId: string
    tournamentName: string
    tournamentType: string
    paymentAmount: number
    paymentType: string
    message: string
    hasPrepaidSlots?: boolean
    hasAvailableSlot?: boolean
    availableSlotId?: string | null
    availableSlotsCount?: number
    inviteCode?: string
  } | null>(null)
  const [isUsingSlot, setIsUsingSlot] = useState(false)
  const [tournamentsWithLiveMatches, setTournamentsWithLiveMatches] = useState<Set<string>>(new Set())

  // Hook pour détecter les nouveaux trophées
  const { currentTrophy, hasNewTrophies, closeCurrentTrophy } = useTrophyNotifications()

  // Reset loading quand l'app revient au premier plan (retour depuis Stripe sur Android)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setIsCheckoutLoading(null)
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  // Vérifier périodiquement si des tournois ont des matchs LIVE (batch: 1 requête)
  useEffect(() => {
    const checkLiveMatches = async () => {
      const activeTournaments = tournaments.filter(t => t.status === 'active')
      if (activeTournaments.length === 0) return

      try {
        const ids = activeTournaments.map(t => t.id).join(',')
        const response = await fetchWithAuth(`/api/tournaments/batch-live-status?ids=${ids}`)
        const data = await response.json()

        const liveSet = new Set<string>()
        if (data.liveMap) {
          for (const [id, isLive] of Object.entries(data.liveMap)) {
            if (isLive) liveSet.add(id)
          }
        }
        setTournamentsWithLiveMatches(liveSet)
      } catch (err) {
        console.error('Erreur vérification matchs LIVE:', err)
      }
    }

    // Vérifier immédiatement au chargement
    checkLiveMatches()

    // Puis vérifier toutes les 3 minutes
    const interval = setInterval(checkLiveMatches, 3 * 60 * 1000)

    return () => clearInterval(interval)
  }, [tournaments])

  // Ouvrir le champ de jointure si ?action=join dans l'URL
  useEffect(() => {
    const action = searchParams.get('action')
    if (action === 'join') {
      setShowJoinInput(true)
      // Nettoyer l'URL sans recharger la page
      router.replace('/dashboard', { scroll: false })
    }
  }, [searchParams, router])

  // Fonction pour rediriger vers Stripe checkout
  const handleCheckout = async (purchaseType: string) => {
    setIsCheckoutLoading(purchaseType)
    try {
      const response = await fetchWithAuth('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchaseType, returnUrl: '/dashboard' }),
      })
      const data = await response.json()
      if (data.url) {
        await openExternalUrl(data.url)
      } else {
        console.error('Erreur checkout:', data.error)
        setIsCheckoutLoading(null)
      }
    } catch (error) {
      console.error('Erreur checkout:', error)
      setIsCheckoutLoading(null)
    }
  }

  // Séparer les tournois actifs/en attente des tournois terminés
  const activeTournaments = tournaments.filter(t => t.status !== 'finished' && t.status !== 'completed')
  // Trier les tournois terminés par date du dernier match (plus récent en premier)
  const finishedTournaments = tournaments
    .filter(t => t.status === 'finished' || t.status === 'completed')
    .sort((a, b) => {
      const dateA = a.lastMatchDate ? new Date(a.lastMatchDate).getTime() : 0
      const dateB = b.lastMatchDate ? new Date(b.lastMatchDate).getTime() : 0
      return dateB - dateA // Décroissant (plus récent en premier)
    })
  const hasArchivedTournaments = finishedTournaments.length > 0 || leftTournaments.length > 0

  const handleJoinTournament = async () => {
    if (joinCode.length !== 8) {
      setJoinError('Le code doit contenir exactement 8 caractères')
      return
    }

    setIsJoining(true)
    setJoinError('')

    try {
      const response = await fetchWithAuth('/api/tournaments/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: joinCode.toUpperCase() })
      })

      const data = await response.json()

      if (response.ok && data.tournament) {
        // Rediriger vers la page d'échauffement du tournoi
        router.push(`/vestiaire/${data.tournament.slug}/echauffement`)
      } else if (response.status === 402 && data.requiresPayment) {
        // Paiement requis - afficher la modale de paiement contextuelle
        setJoinPaymentModal({
          show: true,
          tournamentId: data.tournamentId,
          tournamentName: data.tournamentName,
          tournamentType: data.paymentType === 'platinium_participation' ? 'platinium' : 'free',
          paymentAmount: data.paymentAmount,
          paymentType: data.paymentType,
          message: data.message,
          hasAvailableSlot: data.hasAvailableSlot || false,
          availableSlotId: data.availableSlotId || null,
          availableSlotsCount: data.availableSlotsCount || 0,
          inviteCode: joinCode.toUpperCase()
        })
        // Cacher l'input de code
        setShowJoinInput(false)
        setJoinCode('')
      } else {
        // Erreur classique (tournoi complet, commencé, introuvable, etc.)
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

  // Fonction pour utiliser un slot existant et rejoindre le tournoi
  const handleUseSlot = async () => {
    if (!joinPaymentModal?.availableSlotId || !joinPaymentModal?.inviteCode) return

    setIsUsingSlot(true)
    try {
      const response = await fetchWithAuth('/api/tournaments/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inviteCode: joinPaymentModal.inviteCode,
          useSlotId: joinPaymentModal.availableSlotId
        })
      })

      const data = await response.json()

      if (response.ok && data.tournament) {
        setJoinPaymentModal(null)
        router.push(`/vestiaire/${data.tournament.slug}/echauffement`)
      } else {
        alert(data.error || 'Erreur lors de l\'utilisation du slot')
      }
    } catch (error) {
      console.error('Error using slot:', error)
      alert('Erreur lors de l\'utilisation du slot')
    } finally {
      setIsUsingSlot(false)
    }
  }

  return (
    <div className="theme-bg flex flex-col flex-1 overflow-y-auto">
      <main id="main-content" className="max-w-7xl mx-auto px-4 pt-8 pb-4 w-full" style={{ paddingBottom: 'calc(70px + env(safe-area-inset-bottom, 0px))' }}>
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

        {/* Banniere Upgrade - données pré-fetchées côté serveur pour éviter 3 appels API */}
        <UpgradeBanner
          serverQuotas={{
            free_tournaments_active: quotas.freeTournaments,
            free_tournaments_max: quotas.freeTournamentsMax,
            can_create_tournament: canCreateTournament
          }}
          serverCredits={credits ? {
            oneshot_credits: credits.oneshot,
            elite_credits: credits.elite,
            platinium_solo_credits: credits.platinium_solo,
            platinium_group_slots: credits.platinium_group_slots,
            slot_invite_credits: credits.slot_invite,
            duration_extension_credits: credits.duration_extension,
            player_extension_credits: credits.player_extension
          } : undefined}
        />

        {/* Section Mes tournois en premier */}
        <div className="theme-card mb-8">
          <div className="mb-4">
            <h2 className="text-xl font-bold theme-accent-text whitespace-nowrap text-center md:text-left">
              Mes tournois
            </h2>

            {/* Version Desktop - affichage direct */}
            <p className="hidden md:flex text-sm theme-text-secondary mt-1 flex-wrap items-center gap-x-5 gap-y-1">
              <span className="inline-flex items-center gap-1">
                <img src="/images/icons/free-tour.svg" alt="" className="w-4 h-4 icon-filter-blue" />
                Tournois Free-Kick : {quotas.freeTournaments}/{quotas.freeTournamentsMax}
              </span>
              {quotas.oneshotCreated > 0 && (
                <span className="inline-flex items-center gap-1">
                  <img src="/images/icons/on-shot-tour.svg" alt="" className="w-4 h-4 icon-filter-green" />
                  Tournois One-Shot : {quotas.oneshotCreated}
                </span>
              )}
              {quotas.eliteCreated > 0 && (
                <span className="inline-flex items-center gap-1">
                  <img src="/images/icons/team-elite-tour.svg" alt="" className="w-4 h-4 icon-filter-orange" />
                  Tournois Elite : {quotas.eliteCreated}
                </span>
              )}
              {quotas.platiniumCreated > 0 && (
                <span className="inline-flex items-center gap-1">
                  <img src="/images/icons/premium-tour.svg" alt="" className="w-4 h-4 icon-filter-yellow" />
                  Tournois Platinium : {quotas.platiniumCreated}
                </span>
              )}
              {quotas.eventTournaments > 0 && (
                <span className="inline-flex items-center gap-1">
                  <img src="/images/icons/event.svg" alt="" className="w-4 h-4 icon-filter-rose" />
                  Tournois Événement : {quotas.eventTournaments}
                </span>
              )}
            </p>

            {/* Version Mobile - accordéon */}
            <div className="md:hidden mt-2">
              <button
                onClick={() => setShowParticipations(!showParticipations)}
                className="w-full flex items-center justify-between py-2 px-3 rounded-lg theme-secondary-bg border theme-border hover-theme-accent-border transition-colors"
              >
                <span className="text-sm font-medium theme-text">Participations</span>
                <svg
                  className={`w-4 h-4 theme-text-secondary transition-transform duration-200 ${showParticipations ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showParticipations && (
                <div className="mt-2 p-3 rounded-lg theme-secondary-bg border theme-border space-y-2 animate-fadeIn">
                  <div className="flex items-center gap-2 text-sm theme-text-secondary">
                    <img src="/images/icons/free-tour.svg" alt="" className="w-4 h-4 icon-filter-blue" />
                    <span>Tournois Free-Kick : {quotas.freeTournaments}/{quotas.freeTournamentsMax}</span>
                  </div>
                  {quotas.oneshotCreated > 0 && (
                    <div className="flex items-center gap-2 text-sm theme-text-secondary">
                      <img src="/images/icons/on-shot-tour.svg" alt="" className="w-4 h-4 icon-filter-green" />
                      <span>Tournois One-Shot : {quotas.oneshotCreated}</span>
                    </div>
                  )}
                  {quotas.eliteCreated > 0 && (
                    <div className="flex items-center gap-2 text-sm theme-text-secondary">
                      <img src="/images/icons/team-elite-tour.svg" alt="" className="w-4 h-4 icon-filter-orange" />
                      <span>Tournois Elite : {quotas.eliteCreated}</span>
                    </div>
                  )}
                  {quotas.platiniumCreated > 0 && (
                    <div className="flex items-center gap-2 text-sm theme-text-secondary">
                      <img src="/images/icons/premium-tour.svg" alt="" className="w-4 h-4 icon-filter-yellow" />
                      <span>Tournois Platinium : {quotas.platiniumCreated}</span>
                    </div>
                  )}
                  {quotas.eventTournaments > 0 && (
                    <div className="flex items-center gap-2 text-sm theme-text-secondary">
                      <img src="/images/icons/event.svg" alt="" className="w-4 h-4 icon-filter-rose" />
                      <span>Tournois Événement : {quotas.eventTournaments}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          {activeTournaments.length === 0 ? (
            <div className="flex flex-col items-center text-center py-10 px-4">
              <img src="/images/no-tournoi.png" alt="" width={252} height={246} className="mb-4" />
              <h3 className="text-lg font-bold theme-text mb-2">Pas encore de tournoi ?</h3>
              <p className="theme-text-secondary text-sm mb-6 max-w-xs">
                Crée ton premier tournoi et défie tes amis sur tes compétitions préférées !
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href="/vestiaire"
                  className="px-6 py-2.5 rounded-lg bg-[#ff9900] text-black font-semibold text-sm hover:bg-[#e68a00] transition-colors"
                >
                  Créer un tournoi
                </a>
                <button
                  onClick={() => setShowJoinInput(true)}
                  className="px-6 py-2.5 rounded-lg border theme-border theme-text font-medium text-sm hover-theme-accent-border transition-colors"
                >
                  Rejoindre avec un code
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {activeTournaments.map((tournament, index) => {
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
                      <TournamentTypeBadge type={tournament.is_event ? 'event' : (tournament.tournament_type || 'free')} size="sm" />
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
                          {tournament.pendingTeamRequests > 0 && (
                            <span className="ml-2 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold bg-[#ff9900] text-[#111] rounded-full" title="Demandes d'équipe en attente">
                              {tournament.pendingTeamRequests}
                            </span>
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
                              <div className="logo-container w-12 h-12 flex items-center justify-center relative transition-colors duration-300">
                                {/* Logo blanc - visible par défaut en dark, au survol en light */}
                                <img
                                  src={tournament.custom_emblem_white || tournament.emblem || ''}
                                  alt={tournament.competition_name}
                                  loading={index < 5 ? "eager" : "lazy"}
                                  className="logo-competition-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 object-contain transition-opacity duration-300"
                                />
                                {/* Logo couleur - au survol en dark, par défaut en light */}
                                {tournament.custom_emblem_color && (
                                  <img
                                    src={tournament.custom_emblem_color}
                                    alt={tournament.competition_name}
                                    loading={index < 5 ? "eager" : "lazy"}
                                    className="logo-competition-color absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 object-contain transition-opacity duration-300"
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

                        {/* Badge LIVE - affiché quand un match est en cours */}
                        {tournamentsWithLiveMatches.has(tournament.id) && (
                          <span className="px-2 py-1 rounded-lg text-[10px] font-bold uppercase whitespace-nowrap flex-shrink-0 border-2 border-red-600 flex items-center gap-1 bg-red-600 text-white animate-pulse">
                            <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor">
                              <circle cx="12" cy="12" r="10"/>
                            </svg>
                            LIVE
                          </span>
                        )}

                        {/* Badge statut à droite */}
                        <span className={`status-badge px-2 py-1 rounded-lg text-[10px] font-bold uppercase whitespace-nowrap flex-shrink-0 border-2 border-[#ff9900] flex items-center gap-1 bg-slate-900 text-[#ff9900] ${tournament.status === 'pending' ? 'status-badge-pending' : ''}`}>
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
                          {(tournament.status === 'finished' || tournament.status === 'completed') && 'Terminé'}
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
                          <div className="logo-container w-20 h-20 flex items-center justify-center relative transition-colors duration-300">
                            {/* Logo blanc - visible par défaut en dark, au survol en light */}
                            <img
                              src={tournament.custom_emblem_white || tournament.emblem || ''}
                              alt={tournament.competition_name}
                              loading={index < 5 ? "eager" : "lazy"}
                              className="logo-competition-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 object-contain transition-opacity duration-300"
                            />
                            {/* Logo couleur - au survol en dark, par défaut en light */}
                            {tournament.custom_emblem_color && (
                              <img
                                src={tournament.custom_emblem_color}
                                alt={tournament.competition_name}
                                loading={index < 5 ? "eager" : "lazy"}
                                className="logo-competition-color absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 object-contain transition-opacity duration-300"
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
                          {tournament.pendingTeamRequests > 0 && (
                            <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold bg-[#ff9900] text-[#111] rounded-full" title="Demandes d'équipe en attente">
                              {tournament.pendingTeamRequests}
                            </span>
                          )}
                        </h3>
                        <p className="text-base theme-text-secondary">{tournament.competition_name}</p>
                      </div>

                      {/* Statut et informations */}
                      <div className="text-right flex flex-col gap-2 items-end">
                        {/* Badges LIVE + Statut sur la même ligne */}
                        <div className="flex items-center gap-2">
                          {/* Badge LIVE - affiché quand un match est en cours */}
                          {tournamentsWithLiveMatches.has(tournament.id) && (
                            <span className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase border-2 border-red-600 inline-flex items-center gap-1.5 bg-red-600 text-white animate-pulse">
                              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                                <circle cx="12" cy="12" r="10"/>
                              </svg>
                              LIVE
                            </span>
                          )}

                          {/* Badge Statut */}
                          <span className={`status-badge px-3 py-1.5 rounded-lg text-xs font-bold uppercase border-2 border-[#ff9900] inline-flex items-center gap-1.5 bg-slate-900 text-[#ff9900] ${tournament.status === 'pending' ? 'status-badge-pending' : ''}`}>
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
                          {(tournament.status === 'finished' || tournament.status === 'completed') && 'Terminé'}
                          </span>
                        </div>

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
                            href={`/${tournament.slug}/opposition?tab=classement`}
                            className="archived-card relative flex items-center gap-4 p-3 border theme-border hover-theme-accent-border rounded-lg transition-colors"
                          >
                            {/* Badge type de tournoi */}
                            <div className="absolute top-1 left-1 z-20">
                              <TournamentTypeBadge type={tournament.tournament_type || 'free'} size="sm" />
                            </div>

                            {/* Logo de la compétition */}
                            <div className="flex-shrink-0">
                              {tournament.custom_emblem_white || tournament.custom_emblem_color || tournament.emblem ? (
                                <div className="w-10 h-10 flex items-center justify-center relative">
                                  {/* Logo blanc - visible en thème sombre */}
                                  <img
                                    src={tournament.custom_emblem_white || tournament.emblem || ''}
                                    alt={tournament.competition_name}
                                    className="archived-logo-white absolute w-8 h-8 object-contain opacity-70"
                                  />
                                  {/* Logo couleur - visible en thème clair */}
                                  {tournament.custom_emblem_color && (
                                    <img
                                      src={tournament.custom_emblem_color}
                                      alt={tournament.competition_name}
                                      className="archived-logo-color absolute w-8 h-8 object-contain opacity-70"
                                    />
                                  )}
                                </div>
                              ) : (
                                <div className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center">
                                  <span className="text-gray-500 text-xs">N/A</span>
                                </div>
                              )}
                            </div>

                            {/* Informations du tournoi */}
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium theme-text text-sm truncate">
                                {tournament.name}
                                {tournament.userRank && tournament.totalParticipants > 0 && (
                                  <span className="theme-text-secondary font-normal">
                                    {' '}({tournament.userRank === 1 ? '1er' : `${tournament.userRank}ème`}/{tournament.totalParticipants})
                                  </span>
                                )}
                              </h4>
                              <p className="text-xs theme-text-secondary">{tournament.competition_name}</p>
                              {tournament.lastMatchDate && (
                                <p className="text-xs theme-text-secondary mt-0.5">
                                  Terminé le {formatEndDate(tournament.lastMatchDate)}
                                </p>
                              )}
                            </div>

                            {/* Badge "Terminé" + Vainqueur */}
                            <div className="flex-shrink-0 text-right">
                              <span className="badge-finished px-2 py-1 rounded-lg text-[10px] font-bold uppercase inline-flex items-center gap-1">
                                <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                  <polyline points="20 6 9 17 4 12"/>
                                </svg>
                                Terminé
                              </span>
                              {tournament.winner && (
                                <p className="text-[10px] theme-text-secondary mt-1 flex items-center justify-end gap-1">
                                  <img src="/images/icons/king.svg" alt="" className="w-3 h-3 icon-filter-yellow" />
                                  Vainqueur : {tournament.winner}
                                </p>
                              )}
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
                              {tournament.custom_emblem_white || tournament.custom_emblem_color || tournament.emblem ? (
                                <div className="w-10 h-10 flex items-center justify-center relative">
                                  {/* Logo blanc - visible en thème sombre */}
                                  <img
                                    src={tournament.custom_emblem_white || tournament.emblem || ''}
                                    alt={tournament.competition_name}
                                    className="archived-logo-white absolute w-8 h-8 object-contain opacity-50"
                                  />
                                  {/* Logo couleur - visible en thème clair */}
                                  {tournament.custom_emblem_color && (
                                    <img
                                      src={tournament.custom_emblem_color}
                                      alt={tournament.competition_name}
                                      className="archived-logo-color absolute w-8 h-8 object-contain opacity-50"
                                    />
                                  )}
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
                              <span className="badge-left px-2 py-1 rounded-lg text-[10px] font-bold uppercase inline-flex items-center gap-1">
                                <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                                  <polyline points="16 17 21 12 16 7"/>
                                  <line x1="21" y1="12" x2="9" y2="12"/>
                                </svg>
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

        {/* Modale quota atteint */}
        {showQuotaModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => setShowQuotaModal(null)}
          >
            {/* Overlay */}
            <div className="absolute inset-0 bg-black/70" />

            {/* Contenu modale */}
            <div
              className="theme-card max-w-md w-full relative z-10 p-6 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Bouton fermer */}
              <button
                onClick={() => setShowQuotaModal(null)}
                className="absolute top-4 right-4 theme-text-secondary hover:text-[#ff9900] transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Titre */}
              <h3 className="text-lg font-bold theme-text text-center mb-2">
                {quotas.canCreateFree ? 'Choisir un type de tournoi' : 'Limite atteinte'}
              </h3>

              {/* Message */}
              <p className="text-sm theme-text-secondary text-center mb-5">
                {quotas.canCreateFree
                  ? `Vous participez à ${quotas.freeTournaments}/${quotas.freeTournamentsMax} tournois Free-Kick.`
                  : `Vous participez déjà à ${quotas.freeTournamentsMax} tournois Free-Kick.`
                }
              </p>

              {/* Options d'achat */}
              <div className="space-y-4">
                {/* Slot Free-Kick */}
                <div className="flex items-center gap-4 p-4 border border-blue-500/50 rounded-lg bg-blue-500/5">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <img src="/images/icons/free-tour.svg" alt="Free-Kick" className="w-5 h-5 icon-filter-blue" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-blue-400 text-base">Slot Free-Kick</h4>
                    <p className="text-sm theme-text-secondary">+1 tournoi gratuit</p>
                    <p className="text-xs theme-text-secondary mt-0.5">5 joueurs · 10 journées max</p>
                  </div>
                  {quotas.canCreateFree ? (
                    <a
                      href="/vestiaire?type=free"
                      className="w-20 rounded-lg badge-glossy bg-blue-500 flex flex-col items-center justify-center py-2"
                    >
                      <span className="text-black font-bold text-base">Créer</span>
                      <span className="text-black text-[10px] font-medium">{quotas.freeTournamentsMax - quotas.freeTournaments} slot{quotas.freeTournamentsMax - quotas.freeTournaments > 1 ? 's' : ''}</span>
                    </a>
                  ) : credits && credits.slot_invite > 0 ? (
                    <a
                      href="/vestiaire?type=free"
                      className="w-20 rounded-lg badge-glossy bg-blue-500 flex flex-col items-center justify-center py-2"
                    >
                      <span className="text-black font-bold text-base">Créer</span>
                      <span className="text-black text-[10px] font-medium">{credits.slot_invite} crédit{credits.slot_invite > 1 ? 's' : ''}</span>
                    </a>
                  ) : (
                    <button
                      onClick={() => handleCheckout('slot_invite')}
                      disabled={isCheckoutLoading === 'slot_invite'}
                      className="w-20 rounded-lg badge-glossy bg-blue-500 flex flex-col items-center justify-center py-2 disabled:opacity-50"
                    >
                      <span className="text-black font-bold text-base">{isCheckoutLoading === 'slot_invite' ? '...' : '0,99€'}</span>
                      <span className="badge-acheter text-white text-xs font-medium transition-colors">Acheter</span>
                    </button>
                  )}
                </div>

                {/* One-Shot */}
                <div className="flex items-center gap-4 p-4 border border-green-500/50 rounded-lg bg-green-500/5">
                  <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <img src="/images/icons/on-shot-tour.svg" alt="One-Shot" className="w-5 h-5 icon-filter-green" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-green-400 text-base">One-Shot</h4>
                    <p className="text-sm theme-text-secondary">Tournoi unique entre amis</p>
                    <p className="text-xs theme-text-secondary mt-0.5">10 joueurs · Saison complète · <span className="text-green-400">Stats+</span></p>
                  </div>
                  {credits && credits.oneshot > 0 ? (
                    <a
                      href="/vestiaire?type=oneshot"
                      className="w-20 rounded-lg badge-glossy bg-green-500 flex flex-col items-center justify-center py-2"
                    >
                      <span className="text-black font-bold text-base">Créer</span>
                      <span className="text-black text-[10px] font-medium">{credits.oneshot} crédit{credits.oneshot > 1 ? 's' : ''}</span>
                    </a>
                  ) : (
                    <button
                      onClick={() => handleCheckout('tournament_creation_oneshot')}
                      disabled={isCheckoutLoading === 'tournament_creation_oneshot'}
                      className="w-20 rounded-lg badge-glossy bg-green-500 flex flex-col items-center justify-center py-2 disabled:opacity-50"
                    >
                      <span className="text-black font-bold text-base">{isCheckoutLoading === 'tournament_creation_oneshot' ? '...' : '4,99€'}</span>
                      <span className="badge-acheter text-white text-xs font-medium transition-colors">Acheter</span>
                    </button>
                  )}
                </div>

                {/* Elite Team */}
                <div className="flex items-center gap-4 p-4 border-2 border-orange-500 rounded-lg bg-orange-500/10 relative">
                  <div className="absolute -top-2.5 left-4">
                    <span className="bg-orange-500 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full">POPULAIRE</span>
                  </div>
                  <div className="w-10 h-10 bg-orange-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <img src="/images/icons/team-elite-tour.svg" alt="Elite Team" className="w-5 h-5 icon-filter-orange" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-orange-400 text-base">Elite Team</h4>
                    <p className="text-sm theme-text-secondary">Pour les groupes passionnés</p>
                    <p className="text-xs theme-text-secondary mt-0.5">20 joueurs · Saison complète · <span className="text-orange-400">Tous bonus</span></p>
                  </div>
                  {credits && credits.elite > 0 ? (
                    <a
                      href="/vestiaire?type=elite"
                      className="w-20 rounded-lg badge-glossy bg-orange-500 flex flex-col items-center justify-center py-2"
                    >
                      <span className="text-black font-bold text-base">Créer</span>
                      <span className="text-black text-[10px] font-medium">{credits.elite} crédit{credits.elite > 1 ? 's' : ''}</span>
                    </a>
                  ) : (
                    <button
                      onClick={() => handleCheckout('tournament_creation_elite')}
                      disabled={isCheckoutLoading === 'tournament_creation_elite'}
                      className="w-20 rounded-lg badge-glossy bg-orange-500 flex flex-col items-center justify-center py-2 disabled:opacity-50"
                    >
                      <span className="text-black font-bold text-base">{isCheckoutLoading === 'tournament_creation_elite' ? '...' : '9,99€'}</span>
                      <span className="badge-acheter text-white text-xs font-medium transition-colors">Acheter</span>
                    </button>
                  )}
                </div>

                {/* Platinium */}
                <div className="flex items-center gap-4 p-4 border border-yellow-500/50 rounded-lg bg-yellow-500/5">
                  <div className="w-10 h-10 bg-yellow-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <img src="/images/icons/premium-tour.svg" alt="Platinium" className="w-5 h-5 icon-filter-yellow" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-yellow-400 text-base">Platinium</h4>
                    <p className="text-sm theme-text-secondary">L'expérience ultime</p>
                    <p className="text-xs theme-text-secondary mt-0.5">De 11 à 30 joueurs · <span className="text-yellow-400">Lot à gagner</span></p>
                  </div>
                  {(() => {
                    const totalPlatiniumCredits = (credits?.platinium_solo || 0) + (credits?.platinium_group_slots || 0)

                    // Cas 1: 0 crédit - afficher prix et ouvrir modal achat
                    if (totalPlatiniumCredits === 0) {
                      return (
                        <button
                          onClick={() => setShowPlatiniumChoice(true)}
                          className="w-20 rounded-lg badge-glossy bg-yellow-500 flex flex-col items-center justify-center py-2"
                        >
                          <span className="text-black font-bold text-base leading-none">6,99€</span>
                          <span className="text-black text-[9px] leading-none">/joueur</span>
                          <span className="badge-acheter text-white text-xs font-medium transition-colors">Choisir</span>
                        </button>
                      )
                    }

                    // Cas 2: 1 crédit - créer directement (sa propre place)
                    if (totalPlatiniumCredits === 1) {
                      return (
                        <a
                          href="/vestiaire?type=platinium&slots=1"
                          className="w-20 rounded-lg badge-glossy bg-yellow-500 flex flex-col items-center justify-center py-2"
                        >
                          <span className="text-black font-bold text-base">Créer</span>
                          <span className="text-black text-[10px] font-medium">1 crédit</span>
                        </a>
                      )
                    }

                    // Cas 3: 2+ crédits - ouvrir modal sélection du nombre de places
                    return (
                      <button
                        onClick={() => {
                          setSelectedPlatiniumSlots(1)
                          setShowPlatiniumSlotSelector(true)
                        }}
                        className="w-20 rounded-lg badge-glossy bg-yellow-500 flex flex-col items-center justify-center py-2"
                      >
                        <span className="text-black font-bold text-base">Créer</span>
                        <span className="text-black text-[10px] font-medium">
                          {totalPlatiniumCredits} crédits
                        </span>
                      </button>
                    )
                  })()}
                </div>
              </div>

              {/* Lien vers pricing */}
              <a
                href="/pricing"
                className="block w-full mt-4 py-2 text-center text-sm theme-text-secondary hover:text-[#ff9900] transition underline"
              >
                Voir le détail des offres
              </a>
            </div>
          </div>
        )}

        {/* Sous-modale choix Platinium */}
        {showPlatiniumChoice && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            onClick={() => setShowPlatiniumChoice(false)}
          >
            {/* Overlay */}
            <div className="absolute inset-0 bg-black/80" />

            {/* Contenu modale */}
            <div
              className="theme-card max-w-sm w-full relative z-10 p-6"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Bouton fermer */}
              <button
                onClick={() => setShowPlatiniumChoice(false)}
                className="absolute top-4 right-4 theme-text-secondary hover:text-yellow-500 transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Titre */}
              <div className="flex items-center justify-center gap-2 mb-4">
                <img src="/images/icons/premium-tour.svg" alt="Platinium" className="w-6 h-6 icon-filter-yellow" />
                <h3 className="text-lg font-bold text-yellow-400">Platinium</h3>
              </div>

              <p className="text-sm theme-text-secondary text-center mb-5">
                Choisissez votre formule
              </p>

              {/* Options */}
              <div className="space-y-3">
                {/* Option 1 place */}
                <button
                  onClick={() => {
                    setShowPlatiniumChoice(false)
                    handleCheckout('platinium_participation')
                  }}
                  disabled={isCheckoutLoading === 'platinium_participation'}
                  className="w-full flex items-center justify-between p-4 border border-yellow-500/50 rounded-lg bg-yellow-500/5 hover:bg-yellow-500/10 transition disabled:opacity-50"
                >
                  <div className="text-left">
                    <h4 className="font-semibold text-yellow-400">1 place</h4>
                    <p className="text-xs theme-text-secondary">Pour rejoindre ou créer un tournoi Platinium</p>
                  </div>
                  <div className="badge-glossy bg-yellow-500 rounded-lg px-3 py-2 text-center">
                    <span className="text-black font-bold text-base block">{isCheckoutLoading === 'platinium_participation' ? '...' : '6,99€'}</span>
                  </div>
                </button>

                {/* Option 11 places */}
                <button
                  onClick={() => {
                    setShowPlatiniumChoice(false)
                    handleCheckout('platinium_group_11')
                  }}
                  disabled={isCheckoutLoading === 'platinium_group_11'}
                  className="w-full flex items-center justify-between p-4 border-2 border-yellow-500 rounded-lg bg-yellow-500/10 hover:bg-yellow-500/15 transition disabled:opacity-50 relative"
                >
                  <div className="absolute -top-2.5 left-4">
                    <span className="bg-yellow-500 text-black text-[10px] font-bold px-2.5 py-0.5 rounded-full">ÉCONOMISEZ 7,69 €</span>
                  </div>
                  <div className="text-left">
                    <h4 className="font-semibold text-yellow-400">11 places</h4>
                    <p className="text-xs theme-text-secondary">Créez votre tournoi pour vous et 10 joueurs</p>
                  </div>
                  <div className="badge-glossy bg-yellow-500 rounded-lg px-3 py-2 text-center">
                    <span className="text-black font-bold text-base block">{isCheckoutLoading === 'platinium_group_11' ? '...' : '69,20€'}</span>
                  </div>
                </button>
              </div>

              {/* Lot à gagner */}
              <div className="flex items-center justify-center gap-3 mt-5 p-3 border border-yellow-500/30 rounded-lg bg-yellow-500/5">
                <img src="/images/le-bon-maillot.svg" alt="Le Bon Maillot" className="h-8" />
                <p className="text-sm text-yellow-400 font-medium text-center">
                  Le vainqueur remportera un maillot neuf et authentique de la part de "Le bon maillot"
                </p>
              </div>

              {/* Bouton retour */}
              <button
                onClick={() => setShowPlatiniumChoice(false)}
                className="block w-full mt-4 py-2 text-center text-sm theme-text-secondary hover:text-yellow-500 transition"
              >
                ← Retour aux offres
              </button>
            </div>
          </div>
        )}

        {/* Modal sélection du nombre de places Platinium (2+ crédits) */}
        {showPlatiniumSlotSelector && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            onClick={() => setShowPlatiniumSlotSelector(false)}
          >
            {/* Overlay */}
            <div className="absolute inset-0 bg-black/80" />

            {/* Contenu modale */}
            <div
              className="theme-card max-w-sm w-full relative z-10 p-6"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Bouton fermer */}
              <button
                onClick={() => setShowPlatiniumSlotSelector(false)}
                className="absolute top-4 right-4 theme-text-secondary hover:text-yellow-500 transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Titre */}
              <div className="flex items-center justify-center gap-2 mb-4">
                <img src="/images/icons/premium-tour.svg" alt="Platinium" className="w-6 h-6 icon-filter-yellow" />
                <h3 className="text-lg font-bold text-yellow-400">Créer un tournoi Platinium</h3>
              </div>

              <p className="text-sm theme-text-secondary text-center mb-6">
                Combien de places souhaitez-vous prépayer ?
              </p>

              {/* Sélecteur +/- */}
              <div className="flex items-center justify-center gap-6 mb-6">
                <button
                  onClick={() => setSelectedPlatiniumSlots(Math.max(1, selectedPlatiniumSlots - 1))}
                  disabled={selectedPlatiniumSlots <= 1}
                  className="w-12 h-12 rounded-full border-2 border-yellow-500 text-yellow-500 text-2xl font-bold flex items-center justify-center hover:bg-yellow-500/10 transition disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  −
                </button>

                <div className="text-center">
                  <span className="text-4xl font-bold text-yellow-400">{selectedPlatiniumSlots}</span>
                  <p className="text-sm theme-text-secondary mt-1">place{selectedPlatiniumSlots > 1 ? 's' : ''}</p>
                </div>

                <button
                  onClick={() => setSelectedPlatiniumSlots(Math.min((credits?.platinium_solo || 0) + (credits?.platinium_group_slots || 0), selectedPlatiniumSlots + 1))}
                  disabled={selectedPlatiniumSlots >= (credits?.platinium_solo || 0) + (credits?.platinium_group_slots || 0)}
                  className="w-12 h-12 rounded-full border-2 border-yellow-500 text-yellow-500 text-2xl font-bold flex items-center justify-center hover:bg-yellow-500/10 transition disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  +
                </button>
              </div>

              {/* Info crédits disponibles */}
              <p className="text-xs theme-text-secondary text-center mb-6">
                Vous avez <span className="text-yellow-400 font-semibold">{(credits?.platinium_solo || 0) + (credits?.platinium_group_slots || 0)}</span> crédits disponibles
              </p>

              {/* Bouton Créer */}
              <a
                href={`/vestiaire?type=platinium&slots=${selectedPlatiniumSlots}`}
                className="block w-full py-3 text-center rounded-lg badge-glossy bg-yellow-500 text-black font-bold text-lg hover:brightness-110 transition"
              >
                Créer avec {selectedPlatiniumSlots} place{selectedPlatiniumSlots > 1 ? 's' : ''}
              </a>

              {/* Bouton retour */}
              <button
                onClick={() => setShowPlatiniumSlotSelector(false)}
                className="block w-full mt-4 py-2 text-center text-sm theme-text-secondary hover:text-yellow-500 transition"
              >
                ← Retour
              </button>
            </div>
          </div>
        )}

        {/* Modale de paiement contextuelle pour rejoindre un tournoi */}
        {joinPaymentModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => setJoinPaymentModal(null)}
          >
            {/* Overlay */}
            <div className="absolute inset-0 bg-black/70" />

            {/* Contenu modale */}
            <div
              className="theme-card max-w-md w-full relative z-10 p-6"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Bouton fermer */}
              <button
                onClick={() => setJoinPaymentModal(null)}
                className="absolute top-4 right-4 theme-text-secondary hover:text-[#ff9900] transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Titre */}
              <h3 className="text-lg font-bold theme-text text-center mb-2">
                Rejoindre "{joinPaymentModal.tournamentName}"
              </h3>

              {/* Message */}
              <p className="text-sm theme-text-secondary text-center mb-5">
                {joinPaymentModal.message}
              </p>

              {/* Option de paiement selon le type */}
              <div className="space-y-4">
                {/* Platinium */}
                {joinPaymentModal.paymentType === 'platinium_participation' && (
                  <div className="flex items-center gap-4 p-4 border border-yellow-500/50 rounded-lg bg-yellow-500/5">
                    <div className="w-10 h-10 bg-yellow-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                      <img src="/images/icons/premium-tour.svg" alt="Platinium" className="w-5 h-5 icon-filter-yellow" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-yellow-400 text-base">Participation Platinium</h4>
                      <p className="text-sm theme-text-secondary">Accès au tournoi avec lot à gagner</p>
                    </div>
                    <button
                      onClick={() => {
                        setJoinPaymentModal(null)
                        handleCheckout('platinium_participation')
                      }}
                      disabled={isCheckoutLoading === 'platinium_participation'}
                      className="w-20 rounded-lg badge-glossy bg-yellow-500 flex flex-col items-center justify-center py-2 disabled:opacity-50"
                    >
                      <span className="text-black font-bold text-base">{isCheckoutLoading === 'platinium_participation' ? '...' : '6,99€'}</span>
                      <span className="badge-acheter text-white text-xs font-medium transition-colors">Payer</span>
                    </button>
                  </div>
                )}

                {/* Slot Free-Kick (quota atteint) */}
                {joinPaymentModal.paymentType === 'slot_invite' && (
                  <>
                    {/* Option 1: Utiliser un slot existant (si disponible) */}
                    {joinPaymentModal.hasAvailableSlot && joinPaymentModal.availableSlotId && (
                      <div className="flex items-center gap-4 p-4 border-2 border-green-500 rounded-lg bg-green-500/10">
                        <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                          <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-green-400 text-base">Utiliser un slot</h4>
                          <p className="text-sm theme-text-secondary">Vous avez {joinPaymentModal.availableSlotsCount} slot{(joinPaymentModal.availableSlotsCount || 0) > 1 ? 's' : ''} disponible{(joinPaymentModal.availableSlotsCount || 0) > 1 ? 's' : ''}</p>
                        </div>
                        <button
                          onClick={handleUseSlot}
                          disabled={isUsingSlot}
                          className="w-20 rounded-lg badge-glossy bg-green-500 flex flex-col items-center justify-center py-2 disabled:opacity-50"
                        >
                          <span className="text-black font-bold text-base">{isUsingSlot ? '...' : 'Gratuit'}</span>
                          <span className="text-black text-xs font-medium">Utiliser</span>
                        </button>
                      </div>
                    )}

                    {/* Séparateur si slot disponible */}
                    {joinPaymentModal.hasAvailableSlot && joinPaymentModal.availableSlotId && (
                      <div className="flex items-center gap-4">
                        <div className="flex-1 h-px bg-gray-600"></div>
                        <span className="text-xs theme-text-secondary">ou</span>
                        <div className="flex-1 h-px bg-gray-600"></div>
                      </div>
                    )}

                    {/* Option 2: Acheter un nouveau slot */}
                    <div className="flex items-center gap-4 p-4 border border-blue-500/50 rounded-lg bg-blue-500/5">
                      <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                        <img src="/images/icons/free-tour.svg" alt="Free-Kick" className="w-5 h-5 icon-filter-blue" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-blue-400 text-base">Acheter un slot</h4>
                        <p className="text-sm theme-text-secondary">Débloquez une place supplémentaire</p>
                      </div>
                      <button
                        onClick={() => {
                          setJoinPaymentModal(null)
                          handleCheckout('slot_invite')
                        }}
                        disabled={isCheckoutLoading === 'slot_invite'}
                        className="w-20 rounded-lg badge-glossy bg-blue-500 flex flex-col items-center justify-center py-2 disabled:opacity-50"
                      >
                        <span className="text-black font-bold text-base">{isCheckoutLoading === 'slot_invite' ? '...' : '0,99€'}</span>
                        <span className="badge-acheter text-white text-xs font-medium transition-colors">Payer</span>
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Bouton annuler */}
              <button
                onClick={() => setJoinPaymentModal(null)}
                className="block w-full mt-4 py-2 text-center text-sm theme-text-secondary hover:text-[#ff9900] transition"
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        {/* Actions : Créer et Rejoindre */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="theme-card">
            <h2 className="text-xl font-bold mb-4 theme-accent-text text-center md:text-left">Creer un tournoi</h2>
            <p className="theme-text-secondary mb-4">
              Lancez votre propre tournoi de pronostics et invitez vos amis a participer.
            </p>
            <div className="space-y-3">
              {/* Bouton principal - affiche toujours la modale de choix du type */}
              <button
                onClick={() => setShowQuotaModal('create')}
                className="flex items-center justify-center gap-2 w-full py-2 px-4 bg-[#ff9900] text-[#111] rounded-md hover:bg-[#e68a00] transition font-semibold"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 419.5 375.3" className="w-5 h-5" fill="currentColor">
                  <path d="M417.1,64.6c-1.7-10.4-8.3-15.8-18.9-15.9c-22.2,0-44.4,0-66.6,0c-1.5,0-3,0-5.1,0c0-2,0-3.9,0-5.7c0-6,0.1-12-0.1-18c-0.3-12.9-10.1-22.7-23-22.8c-15.1-0.1-30.2,0-45.3,0c-46,0-92,0-138,0c-15.8,0-24.9,8.5-25.6,24.3C94,33.8,94.3,41,94.3,48.8c-1.7,0-3.1,0-4.6,0c-22.2,0-44.4,0-66.6,0c-11.2,0-17.8,5.1-19.5,16.2c-8.4,56.5,7.9,104.9,49.1,144.5c23.4,22.4,51.7,36.9,82,47.5c9.7,3.4,19.7,6.2,29.6,9.1c15.5,4.6,24.4,18.4,22.3,34.8c-1.9,14.7-15.1,26.6-30.6,26.5c-12.9,0-23.8,3.7-31.8,14.3c-4.3,5.7-6.5,12.2-6.9,19.3c-0.4,7.7,4.5,13,12.3,13c53.2,0,106.5,0,159.7,0c7.2,0,11.6-4.5,11.7-11.8c0.3-18.8-15.1-34.1-34.5-34.8c-5.7-0.2-11.8-1-17-3.2c-12.1-5-19.1-17.8-18.1-30.7c1.1-13.1,9.8-24,22.6-27.4c24.4-6.6,48-14.8,70.2-27c39.8-21.8,69.2-52.7,85.3-95.6c5.1-13.7,8-27.9,8.9-42.6c0.1-1.3,0.4-2.6,0.7-4c0-4.9,0-9.8,0-14.7C418.7,76.4,418.1,70.5,417.1,64.6z M40.2,122.8c-3.3-12.7-4.5-25.6-3.6-39c1.6-0.1,2.9-0.2,4.2-0.2c16.5,0,32.9,0.1,49.4-0.1c3.5,0,4.8,0.8,5.2,4.6c4,39.9,12.7,78.6,31,114.6c3,5.8,6.3,11.4,10,18.1C89.9,201.2,53.5,173.3,40.2,122.8z M275.3,154.8h-41.8v41.8h-45.3v-41.8h-41.8v-45.3h41.8V67.6h45.3v41.8h41.8V154.8z M380.7,121.6c-7.2,30.8-24.7,54.7-49.6,73.5c-13.3,10-28,17.8-43.3,24.2c-0.8,0.4-1.7,0.6-2.6,0.9c4.7-9.1,9.6-17.9,13.8-26.9c13.5-29.1,20.8-60,25-91.7c0.7-5,1-10,1.8-15c0.2-1.1,1.8-2.8,2.7-2.8c18.1-0.2,36.2-0.1,54.3-0.1c0.4,0,0.8,0.2,1.5,0.4C384.7,96.7,383.6,109.3,380.7,121.6z"/>
                </svg>
                Nouveau tournoi
              </button>
            </div>
          </div>

          <div className="theme-card">
            <h2 className="text-xl font-bold mb-4 theme-accent-text text-center md:text-left">Rejoindre un tournoi</h2>
            <p className="theme-text-secondary mb-4">
              Vous avez recu un code d'invitation ? Rejoignez un tournoi existant.
            </p>
            {!showJoinInput ? (
              <div className="space-y-3">
                {/* Bouton principal - toujours afficher l'input de code d'abord */}
                <button
                  onClick={() => setShowJoinInput(true)}
                  className="flex items-center justify-center gap-2 w-full py-2 px-4 bg-[#ff9900] text-[#111] rounded-md hover:bg-[#e68a00] transition font-semibold"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 419.5 375.3" className="w-5 h-5" fill="currentColor">
                    <path d="M417.1,64.6c-1.7-10.4-8.3-15.8-18.9-15.9c-22.2,0-44.4,0-66.6,0c-1.5,0-3,0-5.1,0c0-2,0-3.9,0-5.7c0-6,0.1-12-0.1-18c-0.3-12.9-10.1-22.7-23-22.8c-15.1-0.1-30.2,0-45.3,0c-46,0-92,0-138,0c-15.8,0-24.9,8.5-25.6,24.3C94,33.8,94.3,41,94.3,48.8c-1.7,0-3.1,0-4.6,0c-22.2,0-44.4,0-66.6,0c-11.2,0-17.8,5.1-19.5,16.2c-8.4,56.5,7.9,104.9,49.1,144.5c23.4,22.4,51.7,36.9,82,47.5c9.7,3.4,19.7,6.2,29.6,9.1c15.5,4.6,24.4,18.4,22.3,34.8c-1.9,14.7-15.1,26.6-30.6,26.5c-12.9,0-23.8,3.7-31.8,14.3c-4.3,5.7-6.5,12.2-6.9,19.3c-0.4,7.7,4.5,13,12.3,13c53.2,0,106.5,0,159.7,0c7.2,0,11.6-4.5,11.7-11.8c0.3-18.8-15.1-34.1-34.5-34.8c-5.7-0.2-11.8-1-17-3.2c-12.1-5-19.1-17.8-18.1-30.7c1.1-13.1,9.8-24,22.6-27.4c24.4-6.6,48-14.8,70.2-27c39.8-21.8,69.2-52.7,85.3-95.6c5.1-13.7,8-27.9,8.9-42.6c0.1-1.3,0.4-2.6,0.7-4c0-4.9,0-9.8,0-14.7C418.7,76.4,418.1,70.5,417.1,64.6z M40.2,122.8c-3.3-12.7-4.5-25.6-3.6-39c1.6-0.1,2.9-0.2,4.2-0.2c16.5,0,32.9,0.1,49.4-0.1c3.5,0,4.8,0.8,5.2,4.6c4,39.9,12.7,78.6,31,114.6c3,5.8,6.3,11.4,10,18.1C89.9,201.2,53.5,173.3,40.2,122.8z M218.6,175.6c-4.7,4.7-9.1,9.7-14.3,13.8c-21.1,16.4-52.6,3.3-56.1-23.2c-1.5-11.3,1.7-21.2,9.6-29.3c7-7.2,14.1-14.3,21.3-21.3c6.7-6.5,14.9-9.6,24.1-9.7c9.6,0.1,17.8,3.4,24.6,9.9c2.9,2.8,3.2,6.9,0.6,9.6c-2.6,2.7-6.6,2.7-9.6-0.1c-9.3-8.6-22.4-8.4-31.4,0.5c-6.6,6.6-13.3,13.2-19.8,19.8c-6.2,6.3-8.2,13.9-5.6,22.4c2.6,8.4,8.6,13.5,17.2,15.1c7.4,1.4,13.9-0.8,19.3-6c3.5-3.3,6.8-6.8,10.3-10.2c3.6-3.5,9.5-2.1,10.9,2.6C220.5,171.7,220.2,173.9,218.6,175.6z M269.4,124.8c-6.9,7.2-14.1,14.2-21.2,21.2c-6.8,6.6-15,9.8-24.6,10c-9.2-0.1-17.4-3.4-24.3-9.9c-2.9-2.8-3.2-6.9-0.6-9.6c2.6-2.7,6.6-2.7,9.6,0c8.1,7.4,19.2,8.4,28,2.4c1.2-0.8,2.3-1.8,3.3-2.8c6.7-6.6,13.3-13.2,19.9-19.9c6.2-6.3,8.2-13.9,5.6-22.4c-2.6-8.4-8.5-13.5-17.2-15.2c-7.3-1.4-13.7,0.6-19.1,5.7c-3.6,3.4-7,7-10.5,10.4c-3.7,3.5-9.4,2.2-10.9-2.6c-0.7-2.1-0.5-4.4,1.1-5.9c5.1-5.1,9.8-10.6,15.6-14.8c21.3-15.3,51.4-1.9,54.9,24.1C280.3,106.9,277.2,116.7,269.4,124.8z M380.7,121.6c-7.2,30.8-24.7,54.7-49.6,73.5c-13.3,10-28,17.8-43.3,24.2c-0.8,0.4-1.7,0.6-2.6,0.9c4.7-9.1,9.6-17.9,13.8-26.9c13.5-29.1,20.8-60,25-91.7c0.7-5,1-10,1.8-15c0.2-1.1,1.8-2.8,2.7-2.8c18.1-0.2,36.2-0.1,54.3-0.1c0.4,0,0.8,0.2,1.5,0.4C384.7,96.7,383.6,109.3,380.7,121.6z"/>
                  </svg>
                  Rejoindre
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <input
                    type="text"
                    value={joinCode}
                    onChange={handleJoinCodeChange}
                    placeholder="CODE 8 CARACTERES"
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

      {/* Modale de célébration pour les nouveaux trophées */}
      {currentTrophy && (
        <TrophyCelebrationModal
          trophy={currentTrophy}
          onClose={closeCurrentTrophy}
        />
      )}
    </div>
  )
}

export default function DashboardClient(props: DashboardClientProps) {
  return <DashboardContent {...props} />
}
