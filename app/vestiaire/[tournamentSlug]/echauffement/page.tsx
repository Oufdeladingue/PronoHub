'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

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

    // Actualiser les joueurs toutes les 5 secondes
    const interval = setInterval(fetchPlayers, 5000)
    return () => clearInterval(interval)
  }, [tournament?.id])

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
      if (data.success && data.settings?.max_participants_free) {
        setMaxParticipantsLimit(data.settings.max_participants_free)
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
    if (!tournament || tournament.max_players <= players.length) {
      alert('Impossible de réduire en dessous du nombre de participants actuels')
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

  const handleCancelTournament = async () => {
    if (!tournament) return

    if (confirm('Êtes-vous sûr de vouloir annuler ce tournoi ? Cette action est irréversible.')) {
      try {
        const supabase = createClient()
        const { error } = await supabase
          .from('tournaments')
          .delete()
          .eq('id', tournament.id)

        if (error) throw error

        alert('Tournoi annulé')
        window.location.href = '/vestiaire'
      } catch (err) {
        console.error('Error cancelling tournament:', err)
        alert('Erreur lors de l\'annulation du tournoi')
      }
    }
  }

  const handleTransferCaptaincy = async (newCaptainId: string) => {
    if (!tournament) return

    if (confirm('Transférer le rôle de capitaine à ce joueur ?')) {
      try {
        const supabase = createClient()
        const { error } = await supabase
          .from('tournaments')
          .update({ creator_id: newCaptainId })
          .eq('id', tournament.id)

        if (error) throw error

        alert('Capitaine transféré avec succès')
        fetchTournamentData()
      } catch (err) {
        console.error('Error transferring captaincy:', err)
        alert('Erreur lors du transfert')
      }
    }
  }

  const handleLeaveTournament = async () => {
    if (!tournament || !currentUserId) return

    if (players.length === 1) {
      // Le créateur est seul, proposer d'annuler le tournoi
      handleCancelTournament()
    } else {
      // Il y a d'autres participants, demander de transférer le capitanat
      alert('Vous devez d\'abord transférer le rôle de capitaine à un autre participant avant de quitter')
    }
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
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    )
  }

  if (error || !tournament) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-red-600 text-5xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Tournoi introuvable</h1>
          <p className="text-gray-600 mb-6">{error || 'Ce tournoi n\'existe pas'}</p>
          <Link
            href="/vestiaire"
            className="inline-block px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
          >
            Retour au vestiaire
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      {/* Header */}
      <div className="bg-white shadow-md border-b-4 border-green-500">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{tournament.name}</h1>
              <p className="text-gray-600 mt-1">{tournament.competition_name}</p>
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
          <div className="mb-6 bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-400 rounded-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-2xl">⚙️</span>
              Contrôles du Capitaine
            </h2>

            <div className="grid md:grid-cols-2 gap-4">
              {/* Gestion du nombre de places */}
              <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <span>👥</span>
                  Places disponibles
                </h3>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleDecreaseMaxPlayers}
                    disabled={tournament.max_players <= players.length}
                    className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
                  >
                    −
                  </button>
                  <span className="text-2xl font-bold text-gray-900">
                    {tournament.max_players}
                  </span>
                  <button
                    onClick={handleIncreaseMaxPlayers}
                    disabled={tournament.max_players >= maxParticipantsLimit}
                    className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
                  >
                    +
                  </button>
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  Max: {maxParticipantsLimit} (compte gratuit)
                </p>
              </div>

              {/* Actions */}
              <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <span>🎮</span>
                  Actions
                </h3>
                <div className="space-y-2">
                  <button
                    onClick={handleStartTournament}
                    disabled={players.length < 2}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition font-semibold"
                  >
                    🚀 Démarrer le tournoi
                  </button>
                  <button
                    onClick={handleLeaveTournament}
                    className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition"
                  >
                    {players.length === 1 ? '❌ Annuler le tournoi' : '🚪 Quitter (transférer capitanat)'}
                  </button>
                </div>
              </div>
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
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
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
                      <p className="font-semibold text-gray-900">
                        {player.profiles?.username || 'Joueur'}
                      </p>
                      {isCaptain && (
                        <span className="text-xs text-yellow-600 font-semibold">⭐ Capitaine</span>
                      )}
                    </div>
                    {canTransfer && (
                      <button
                        onClick={() => handleTransferCaptaincy(player.user_id)}
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
            </div>
          </div>

          {/* Code d'invitation */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
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
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
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
              <h3 className="font-bold text-orange-900 mb-2 flex items-center gap-2">
                <span className="text-xl">⏰</span>
                Prochaine journée
              </h3>
              <p className="text-sm text-orange-800">
                Le tournoi démarrera dès que tous les joueurs auront rejoint et que la prochaine journée
                de {tournament.competition_name} commencera.
              </p>
            </div>
          </div>
        </div>

        {/* Retour */}
        <div className="mt-8 text-center">
          <Link
            href="/vestiaire"
            className="inline-block px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
          >
            ← Retour au vestiaire
          </Link>
        </div>
      </main>
    </div>
  )
}
