'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ThemeProvider } from '@/contexts/ThemeContext'
import ThemeToggle from '@/components/ThemeToggle'

interface Tournament {
  id: string
  name: string
  slug: string
  competition_id: number
  competition_name: string
  max_players: number
  num_matchdays: number
  all_matchdays: boolean
  bonus_match_enabled: boolean
  creator_id: string
  status: string
  created_at: string
}

interface Competition {
  id: number
  name: string
  emblem: string
}

interface Player {
  id: string
  user_id: string
  joined_at: string
  profiles?: {
    username: string
  }
}

export default function EchauffementPage() {
  const params = useParams()
  const tournamentSlug = params.tournamentSlug as string

  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copySuccess, setCopySuccess] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [maxParticipantsLimit, setMaxParticipantsLimit] = useState<number>(10)
  const [competitionLogo, setCompetitionLogo] = useState<string | null>(null)
  const [nextMatchDate, setNextMatchDate] = useState<Date | null>(null)
  const [timeRemaining, setTimeRemaining] = useState<{days: number, hours: number, minutes: number, seconds: number} | null>(null)
  const [transferConfirmation, setTransferConfirmation] = useState<{ show: boolean, playerId: string, playerName: string }>({ show: false, playerId: '', playerName: '' })
  const [cancelConfirmation, setCancelConfirmation] = useState<boolean>(false)

  // Extraire le code du slug (format: nomtournoi_ABCDEFGH)
  const tournamentCode = tournamentSlug.split('_').pop()?.toUpperCase() || ''

  useEffect(() => {
    fetchCurrentUser()
    fetchMaxParticipantsLimit()
    fetchTournamentData()
  }, [tournamentSlug])

  useEffect(() => {
    if (!tournament?.id) return

    // Charger les joueurs dès que le tournoi est disponible
    fetchPlayers()
    fetchCompetitionLogo()
    fetchNextMatchDate()

    // Actualiser les joueurs toutes les 5 secondes
    const interval = setInterval(fetchPlayers, 5000)
    return () => clearInterval(interval)
  }, [tournament?.id])

  // Timer en temps réel pour le compte à rebours
  useEffect(() => {
    if (!nextMatchDate) return

    const updateTimer = () => {
      const now = new Date()
      const diff = nextMatchDate.getTime() - now.getTime()

      if (diff <= 0) {
        setTimeRemaining({ days: 0, hours: 0, minutes: 0, seconds: 0 })
        return
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      setTimeRemaining({ days, hours, minutes, seconds })
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [nextMatchDate])

  const fetchTournamentData = async () => {
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      // Récupérer le tournoi par le code (pas le slug complet)
      const { data: tournamentData, error: tournamentError } = await supabase
        .from('tournaments')
        .select('*')
        .eq('slug', tournamentCode)
        .single()

      if (tournamentError) throw new Error('Tournoi non trouvé')

      setTournament(tournamentData)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchCurrentUser = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
      }
    } catch (err) {
      console.error('Error fetching current user:', err)
    }
  }

  const fetchMaxParticipantsLimit = async () => {
    try {
      const response = await fetch('/api/settings/public')
      const data = await response.json()
      if (data.success && data.settings?.free_tier_max_players) {
        setMaxParticipantsLimit(parseInt(data.settings.free_tier_max_players, 10))
      }
    } catch (err) {
      console.error('Error fetching max participants limit:', err)
    }
  }

  const fetchPlayers = async () => {
    try {
      const supabase = createClient()

      const { data: playersData, error: playersError } = await supabase
        .from('tournament_participants')
        .select('*, profiles(username)')
        .eq('tournament_id', tournament?.id)
        .order('joined_at', { ascending: true })

      if (!playersError && playersData) {
        setPlayers(playersData)
      }
    } catch (err) {
      console.error('Error fetching players:', err)
    }
  }

  const fetchCompetitionLogo = async () => {
    if (!tournament?.competition_id) return

    try {
      const supabase = createClient()
      const { data: competition } = await supabase
        .from('competitions')
        .select('emblem')
        .eq('id', tournament.competition_id)
        .single()

      if (competition?.emblem) {
        setCompetitionLogo(competition.emblem)
      }
    } catch (err) {
      console.error('Error fetching competition logo:', err)
    }
  }

  const fetchNextMatchDate = async () => {
    if (!tournament?.competition_id) return

    try {
      // Récupérer les matchs de la compétition
      const response = await fetch(`/api/football/competition-matches?competitionId=${tournament.competition_id}`)
      const data = await response.json()

      if (data.matches && data.matches.length > 0) {
        // Trouver le prochain match (premier match non encore joué)
        const now = new Date()
        const upcomingMatches = data.matches
          .filter((match: any) => new Date(match.utc_date) > now)
          .sort((a: any, b: any) => new Date(a.utc_date).getTime() - new Date(b.utc_date).getTime())

        if (upcomingMatches.length > 0) {
          setNextMatchDate(new Date(upcomingMatches[0].utc_date))
        }
      }
    } catch (err) {
      console.error('Error fetching next match date:', err)
    }
  }

  const handleIncreaseMaxPlayers = async () => {
    if (!tournament || tournament.max_players >= maxParticipantsLimit) {
      alert(`Limite maximale de ${maxParticipantsLimit} participants atteinte pour un compte gratuit`)
      return
    }

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('tournaments')
        .update({ max_players: tournament.max_players + 1, max_participants: tournament.max_players + 1 })
        .eq('id', tournament.id)

      if (error) throw error

      setTournament({ ...tournament, max_players: tournament.max_players + 1 })
    } catch (err) {
      console.error('Error increasing max players:', err)
      alert('Erreur lors de l\'augmentation du nombre de places')
    }
  }

  const handleDecreaseMaxPlayers = async () => {
    if (!tournament) return

    // Minimum de 2 places
    if (tournament.max_players <= 2) {
      alert('Un tournoi comporte au minimum deux places')
      return
    }

    // Ne peut pas réduire en dessous du nombre de participants actuels (protection contre suppression d'une place occupée)
    if (tournament.max_players <= players.length) {
      alert('Impossible de supprimer une place déjà occupée par un joueur')
      return
    }

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('tournaments')
        .update({ max_players: tournament.max_players - 1, max_participants: tournament.max_players - 1 })
        .eq('id', tournament.id)

      if (error) throw error

      setTournament({ ...tournament, max_players: tournament.max_players - 1 })
    } catch (err) {
      console.error('Error decreasing max players:', err)
      alert('Erreur lors de la réduction du nombre de places')
    }
  }

  const handleStartTournament = async () => {
    if (!tournament) return

    if (players.length < 2) {
      alert('Il faut au moins 2 participants pour démarrer le tournoi')
      return
    }

    if (confirm(`Démarrer le tournoi avec ${players.length} participants ?`)) {
      try {
        const supabase = createClient()
        const { error } = await supabase
          .from('tournaments')
          .update({ status: 'active' })
          .eq('id', tournament.id)

        if (error) throw error

        alert('Tournoi démarré ! Redirection...')
        // TODO: Rediriger vers la page du tournoi actif
      } catch (err) {
        console.error('Error starting tournament:', err)
        alert('Erreur lors du démarrage du tournoi')
      }
    }
  }

  const showCancelConfirmation = () => {
    setCancelConfirmation(true)
  }

  const hideCancelConfirmation = () => {
    setCancelConfirmation(false)
  }

  const handleCancelTournament = async () => {
    if (!tournament) return

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('tournaments')
        .delete()
        .eq('id', tournament.id)

      if (error) throw error

      window.location.href = '/dashboard'
    } catch (err) {
      console.error('Error cancelling tournament:', err)
      alert('Erreur lors de l\'annulation du tournoi')
    }
  }

  const showTransferConfirmation = (playerId: string, playerName: string) => {
    setTransferConfirmation({ show: true, playerId, playerName })
  }

  const cancelTransfer = () => {
    setTransferConfirmation({ show: false, playerId: '', playerName: '' })
  }

  const handleTransferCaptaincy = async () => {
    if (!tournament) return

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('tournaments')
        .update({ creator_id: transferConfirmation.playerId })
        .eq('id', tournament.id)

      if (error) throw error

      alert('Capitaine transféré avec succès')
      setTransferConfirmation({ show: false, playerId: '', playerName: '' })
      fetchTournamentData()
    } catch (err) {
      console.error('Error transferring captaincy:', err)
      alert('Erreur lors du transfert')
    }
  }

  const handleLeaveTournament = async () => {
    if (!tournament || !currentUserId) return

    // Il y a d'autres participants, demander de transférer le capitanat
    alert('Vous devez d\'abord transférer le rôle de capitaine à un autre participant avant de quitter')
  }

  const copyInviteCode = () => {
    navigator.clipboard.writeText(tournamentCode)
    setCopySuccess(true)
    setTimeout(() => setCopySuccess(false), 2000)
  }

  const shareUrl = () => {
    const url = `${window.location.origin}/vestiaire/rejoindre?code=${tournamentCode}`
    navigator.clipboard.writeText(url)
    alert('Lien d\'invitation copié !')
  }

  if (loading) {
    return (
      <ThemeProvider>
      <div className="min-h-screen theme-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-green-600 mx-auto mb-4"></div>
          <p className="theme-text-secondary">Chargement...</p>
        </div>
      </div>
      </ThemeProvider>
    )
  }

  if (error || !tournament) {
    return (
      <ThemeProvider>
      <div className="min-h-screen theme-bg flex items-center justify-center p-4">
        <div className="theme-card p-8 max-w-md w-full text-center">
          <div className="text-red-600 text-5xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold theme-text mb-2">Tournoi introuvable</h1>
          <p className="theme-text-secondary mb-6">{error || 'Ce tournoi n\'existe pas'}</p>
          <Link
            href="/vestiaire"
            className="inline-block px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
          >
            Retour au vestiaire
          </Link>
        </div>
      </div>
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider>
    <div className="min-h-screen theme-bg">
      {/* Popup de confirmation d'annulation */}
      {cancelConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6 animate-in">
            <div className="text-center mb-6">
              <div className="text-5xl mb-3">⚠️</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Annuler le tournoi
              </h3>
              <p className="text-gray-600">
                Le tournoi <span className="font-bold text-red-600">{tournament.name}</span> sera supprimé définitivement.
              </p>
            </div>

            <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
              <p className="text-sm text-red-800">
                <strong>Attention :</strong> Cette action est irréversible. Le tournoi sera supprimé pour vous et tous les autres participants. Il n'apparaîtra plus dans "Mes tournois".
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={hideCancelConfirmation}
                className="flex-1 px-4 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition font-semibold"
              >
                Annuler
              </button>
              <button
                onClick={handleCancelTournament}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold"
              >
                Supprimer le tournoi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Popup de confirmation de transfert */}
      {transferConfirmation.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6 animate-in">
            <div className="text-center mb-6">
              <div className="text-5xl mb-3">⚠️</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Confirmer le transfert
              </h3>
              <p className="text-gray-600">
                Êtes-vous sûr de vouloir transférer le rôle de capitaine à{' '}
                <span className="font-bold text-blue-600">{transferConfirmation.playerName}</span> ?
              </p>
            </div>

            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
              <p className="text-sm text-yellow-800">
                <strong>Important :</strong> Vous perdrez tous les privilèges de capitaine. Cette action est irréversible.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={cancelTransfer}
                className="flex-1 px-4 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition font-semibold"
              >
                Annuler
              </button>
              <button
                onClick={handleTransferCaptaincy}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
              >
                Confirmer le transfert
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="theme-nav">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src="/images/logo.svg" alt="PronoHub" className="w-17 h-17" />
              <ThemeToggle />
            </div>
            <div className="flex items-center gap-4">
              {competitionLogo && (
                <img
                  src={competitionLogo}
                  alt={tournament.competition_name}
                  className="w-16 h-16 object-contain"
                />
              )}
              <div>
                <h1 className="text-3xl font-bold theme-text">{tournament.name}</h1>
                <p className="theme-text-secondary mt-1">{tournament.competition_name}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="inline-block bg-yellow-100 border-2 border-yellow-400 rounded-lg px-4 py-2">
                <p className="text-xs text-yellow-800 font-semibold">PHASE</p>
                <p className="text-lg font-bold text-yellow-900">ÉCHAUFFEMENT</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Contrôles du capitaine */}
        {currentUserId === tournament?.creator_id && (
          <div className="mb-6 theme-card border-2 border-yellow-400">
            <div className="mb-4">
              <h2 className="text-xl font-bold theme-text flex items-center gap-2">
                <img src="/images/icons/cap.svg" alt="Capitaine" className="w-6 h-6 dark:brightness-0 dark:invert" />
                Les privilèges du capitaine
              </h2>
              <p className="text-sm theme-text-secondary mt-1 italic">Le brassard implique de grandes responsabilités</p>
            </div>

            <div className="space-y-2">
              <button
                onClick={handleStartTournament}
                disabled={players.length < 2}
                className="w-full px-4 py-2 bg-[#ff9900] text-[#111] rounded-md hover:bg-green-600 hover:text-white disabled:bg-gray-300 disabled:cursor-not-allowed disabled:hover:bg-gray-300 transition font-semibold flex items-center justify-center gap-2"
              >
                <img src="/images/icons/start.svg" alt="" className="w-5 h-5" />
                Démarrer le tournoi {tournament.name}
              </button>
              <button
                onClick={showCancelConfirmation}
                className="w-full px-4 py-2 bg-[#ff9900] text-[#111] rounded-md hover:bg-red-600 hover:text-white transition font-semibold flex items-center justify-center gap-2"
              >
                <img src="/images/icons/cancel.svg" alt="" className="w-5 h-5" />
                Annuler le tournoi {tournament.name}
              </button>
              <button
                onClick={handleLeaveTournament}
                className="w-full px-4 py-2 bg-[#ff9900] text-[#111] rounded-md hover:bg-orange-600 hover:text-white transition flex items-center justify-center gap-2"
              >
                <img src="/images/icons/quit.svg" alt="" className="w-5 h-5" />
                Quitter le tournoi {tournament.name}
              </button>
            </div>

            {/* Info pour le transfert */}
            {players.length > 1 && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  💡 Pour transférer le capitanat, cliquez sur le bouton "Transférer" à côté d'un participant ci-dessous.
                </p>
              </div>
            )}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Joueurs */}
          <div className="theme-card">
            <h2 className="text-xl font-bold theme-text mb-4 flex items-center gap-2">
              <span className="text-2xl">👥</span>
              Joueurs ({players.length}/{tournament.max_players})
            </h2>

            <div className="space-y-3">
              {players.map((player, index) => {
                const isCaptain = player.user_id === tournament?.creator_id
                const isCreatorViewing = currentUserId === tournament?.creator_id
                const canTransfer = isCreatorViewing && !isCaptain && players.length > 1

                return (
                  <div
                    key={player.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border-2 border-gray-200"
                  >
                    <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold theme-text">
                        {player.profiles?.username || 'Joueur'}
                      </p>
                      {isCaptain && (
                        <span className="text-xs text-yellow-600 font-semibold">⭐ Capitaine</span>
                      )}
                    </div>
                    {canTransfer && (
                      <button
                        onClick={() => showTransferConfirmation(player.user_id, player.profiles?.username || 'Joueur')}
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition"
                      >
                        Transférer
                      </button>
                    )}
                  </div>
                )
              })}

              {/* Places vides */}
              {Array.from({ length: tournament.max_players - players.length }).map((_, index) => (
                <div
                  key={`empty-${index}`}
                  className="flex items-center gap-3 p-3 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300"
                >
                  <div className="flex-shrink-0 w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center text-gray-500">
                    {players.length + index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-400 italic">En attente...</p>
                  </div>
                </div>
              ))}

              {/* Boutons gestion des places (visible uniquement pour le capitaine) */}
              {currentUserId === tournament?.creator_id && (
                <div className="space-y-2">
                  {/* Bouton Ajouter une place */}
                  {tournament.max_players < maxParticipantsLimit && (
                    <button
                      onClick={handleIncreaseMaxPlayers}
                      className="w-full flex items-center justify-center gap-2 p-3 bg-green-50 rounded-lg border-2 border-dashed border-green-400 hover:bg-green-100 transition text-green-700 font-semibold"
                    >
                      <span className="text-xl">+</span>
                      <span>Ajouter une place (limité à {maxParticipantsLimit} joueurs)</span>
                    </button>
                  )}

                  {/* Bouton Supprimer une place */}
                  {tournament.max_players > 2 && tournament.max_players > players.length && (
                    <button
                      onClick={handleDecreaseMaxPlayers}
                      className="w-full flex items-center justify-center gap-2 p-3 bg-red-50 rounded-lg border-2 border-dashed border-red-400 hover:bg-red-100 transition text-red-700 font-semibold"
                    >
                      <span className="text-xl">−</span>
                      <span>Supprimer une place</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Code d'invitation */}
          <div className="space-y-6">
            <div className="theme-card">
              <h2 className="text-xl font-bold theme-text mb-4 flex items-center gap-2">
                <span className="text-2xl">🎫</span>
                Code d'invitation
              </h2>

              <div className="bg-gradient-to-r from-purple-100 to-blue-100 border-2 border-purple-300 rounded-lg p-6 text-center">
                <p className="text-sm text-gray-600 mb-2">Partagez ce code avec vos amis :</p>
                <div className="text-5xl font-bold text-purple-700 tracking-wider mb-4 font-mono">
                  {tournamentCode}
                </div>
                <button
                  onClick={copyInviteCode}
                  className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-semibold"
                >
                  {copySuccess ? '✓ Copié !' : '📋 Copier le code'}
                </button>
              </div>
            </div>

            {/* QR Code */}
            <div className="theme-card">
              <h2 className="text-xl font-bold theme-text mb-4 flex items-center gap-2">
                <span className="text-2xl">📱</span>
                QR Code
              </h2>

              <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-6 text-center">
                <div className="bg-white inline-block p-4 rounded-lg">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                      `${window.location.origin}/vestiaire/rejoindre?code=${tournamentCode}`
                    )}`}
                    alt="QR Code"
                    className="w-48 h-48 mx-auto"
                  />
                </div>
                <p className="text-sm text-gray-600 mt-4">Scannez pour rejoindre le tournoi</p>
                <button
                  onClick={shareUrl}
                  className="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
                >
                  📤 Partager le lien
                </button>
              </div>
            </div>

            {/* Info prochaine journée */}
            <div className="bg-gradient-to-r from-orange-50 to-red-50 border-2 border-orange-300 rounded-lg p-6">
              <h3 className="font-bold text-orange-900 mb-3 flex items-center gap-2">
                <span className="text-xl">⏰</span>
                Prochaine journée
              </h3>

              {timeRemaining && (
                <div className="mb-4 p-4 bg-white rounded-lg border-2 border-orange-200">
                  <p className="text-xs text-gray-600 mb-2 text-center">Prochaine journée dans :</p>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div>
                      <div className="text-2xl font-bold text-orange-700">{timeRemaining.days}</div>
                      <div className="text-xs text-gray-600">jours</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-orange-700">{timeRemaining.hours}</div>
                      <div className="text-xs text-gray-600">heures</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-orange-700">{timeRemaining.minutes}</div>
                      <div className="text-xs text-gray-600">min</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-orange-700">{timeRemaining.seconds}</div>
                      <div className="text-xs text-gray-600">sec</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="p-3 bg-red-100 border-l-4 border-red-500 rounded">
                <p className="text-xs text-red-800 font-semibold">
                  ⚠️ Si le tournoi n'est pas démarré avant le premier match de la prochaine journée de {tournament.competition_name}, il ne pourra commencer qu'à la journée suivante.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Retour */}
        <div className="mt-8 text-center">
          <Link
            href="/dashboard"
            className="inline-block px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
          >
            ← Sortir du vestiaire
          </Link>
        </div>
      </main>
    </div>
    </ThemeProvider>
  )
}
