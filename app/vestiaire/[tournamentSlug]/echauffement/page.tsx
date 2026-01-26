'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient, fetchWithAuth } from '@/lib/supabase/client'
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import MatchdayWarningModal from '@/components/MatchdayWarningModal'
import TeamsManager from '@/components/TeamsManager'
import { getAvatarUrl } from '@/lib/avatars'
import { TOURNAMENT_RULES, PRICES, TournamentType } from '@/types/monetization'

interface Tournament {
  id: string
  name: string
  slug: string
  competition_id: number | null
  custom_competition_id?: string | null
  competition_name: string
  max_players: number
  num_matchdays: number
  all_matchdays: boolean
  bonus_match_enabled: boolean
  creator_id: string
  status: string
  created_at: string
  tournament_type?: TournamentType
  is_legacy?: boolean
  prepaid_slots_remaining?: number
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
  has_paid?: boolean
  paid_by_creator?: boolean
  invite_type?: string
  profiles?: {
    username: string
    avatar?: string
  }
}

function EchauffementPageContent() {
  const params = useParams()
  const tournamentSlug = params.tournamentSlug as string
  const { theme } = useTheme()

  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copySuccess, setCopySuccess] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [competitionLogo, setCompetitionLogo] = useState<string | null>(null)
  const [competitionLogoWhite, setCompetitionLogoWhite] = useState<string | null>(null)
  const [competitionLogoColor, setCompetitionLogoColor] = useState<string | null>(null)
  const [nextMatchDate, setNextMatchDate] = useState<Date | null>(null)
  const [timeRemaining, setTimeRemaining] = useState<{days: number, hours: number, minutes: number, seconds: number} | null>(null)
  const [transferConfirmation, setTransferConfirmation] = useState<{ show: boolean, playerId: string, playerName: string }>({ show: false, playerId: '', playerName: '' })
  const [cancelConfirmation, setCancelConfirmation] = useState<boolean>(false)
  const [startConfirmation, setStartConfirmation] = useState<boolean>(false)
  const [leaveWarning, setLeaveWarning] = useState<boolean>(false)
  const [transferSuccess, setTransferSuccess] = useState<{ show: boolean, playerName: string }>({ show: false, playerName: '' })
  const [leaveConfirmation, setLeaveConfirmation] = useState<boolean>(false)
  const [username, setUsername] = useState<string>('utilisateur')
  const [userAvatar, setUserAvatar] = useState<string>('avatar1')
  const [matchdayWarning, setMatchdayWarning] = useState<{
    show: boolean
    remainingMatchdays: number
    plannedMatchdays: number
    currentMatchday: number
    totalMatchdays: number
  } | null>(null)
  const [remainingMatchdaysToPredict, setRemainingMatchdaysToPredict] = useState<number | null>(null)
  const [playerTeams, setPlayerTeams] = useState<Record<string, { teamName: string; teamAvatar: string }>>({})
  const [teamsData, setTeamsData] = useState<{ teamsEnabled: boolean; teams: Array<{ id: string; name: string; members: any[] }> }>({ teamsEnabled: false, teams: [] })
  const [unassignedPlayersWarning, setUnassignedPlayersWarning] = useState<{ show: boolean; count: number }>({ show: false, count: 0 })
  const [shareModal, setShareModal] = useState<boolean>(false)

  // États pour l'extension de joueurs Free-Kick
  const [playerExtensionInfo, setPlayerExtensionInfo] = useState<{
    canExtend: boolean
    isCaptain: boolean
    hasCredit: boolean
    currentMaxPlayers: number
    newMaxPlayers: number
    playersExtended: number
    price: number
    extensionAmount: number
  } | null>(null)
  const [extensionLoading, setExtensionLoading] = useState(false)
  const [showExtensionModal, setShowExtensionModal] = useState(false)

  // Extraire le code du slug (format: nomtournoi_ABCDEFGH)
  const tournamentCode = tournamentSlug.split('_').pop()?.toUpperCase() || ''

  useEffect(() => {
    fetchCurrentUser()
    fetchTournamentData()
  }, [tournamentSlug])

  useEffect(() => {
    if (!tournament?.id) return

    // Charger l'effectif dès que le tournoi est disponible
    fetchPlayers()
    fetchCompetitionLogo()
    fetchNextMatchDate()
    fetchRemainingMatchdays()
    fetchTeamsMapping()
    fetchPlayerExtensionInfo()

    // Actualiser l'effectif et les équipes toutes les 30 secondes (fallback polling)
    const interval = setInterval(() => {
      fetchPlayers()
      fetchTeamsMapping()
    }, 30000)
    return () => clearInterval(interval)
  }, [tournament?.id])

  // =====================================================
  // OPTIMISATION: Supabase Realtime pour les mises à jour instantanées
  // Écoute les changements sur tournament_participants et tournament_teams
  // =====================================================
  useEffect(() => {
    if (!tournament?.id) return

    const supabase = createClient()

    // Canal pour écouter les changements de participants
    const participantsChannel = supabase
      .channel(`tournament-participants-${tournament.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tournament_participants',
          filter: `tournament_id=eq.${tournament.id}`
        },
        () => {
          // Rafraîchir la liste des joueurs quand un participant rejoint/quitte
          fetchPlayers()
        }
      )
      .subscribe()

    // Canal pour écouter les changements d'équipes
    const teamsChannel = supabase
      .channel(`tournament-teams-${tournament.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tournament_teams',
          filter: `tournament_id=eq.${tournament.id}`
        },
        () => {
          // Rafraîchir les équipes quand une équipe est créée/modifiée
          fetchTeamsMapping()
        }
      )
      .subscribe()

    // Canal pour écouter les changements de membres d'équipes
    const teamMembersChannel = supabase
      .channel(`team-members-${tournament.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tournament_team_members'
        },
        () => {
          // Rafraîchir les équipes quand un membre est ajouté/retiré
          fetchTeamsMapping()
        }
      )
      .subscribe()

    // Cleanup: se désabonner des canaux à la destruction du composant
    return () => {
      supabase.removeChannel(participantsChannel)
      supabase.removeChannel(teamsChannel)
      supabase.removeChannel(teamMembersChannel)
    }
  }, [tournament?.id])

  // Vérifier si le tournoi a été lancé (pour les participants non-capitaines)
  useEffect(() => {
    if (!tournament?.id || !tournamentSlug) return

    // Vérifier le statut du tournoi toutes les 3 secondes
    const checkTournamentStatus = async () => {
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('tournaments')
          .select('status')
          .eq('id', tournament.id)
          .single()

        // Si le tournoi est passé en "active", rediriger vers la page opposition
        if (data?.status === 'active') {
          window.location.href = `/${tournamentSlug}/opposition`
        }
      } catch (err) {
        console.error('Error checking tournament status:', err)
      }
    }

    const statusInterval = setInterval(checkTournamentStatus, 3000)
    return () => clearInterval(statusInterval)
  }, [tournament?.id, tournamentSlug])

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

        // Récupérer le username et avatar depuis le profil
        const { data: profile } = await supabase
          .from('profiles')
          .select('username, avatar')
          .eq('id', user.id)
          .single()

        if (profile?.username) {
          setUsername(profile.username)
        }
        if (profile?.avatar) {
          setUserAvatar(profile.avatar)
        }
      }
    } catch (err) {
      console.error('Error fetching current user:', err)
    }
  }

  // Calculer la limite maximale de participants selon le type de tournoi
  const getMaxPlayersLimit = () => {
    if (!tournament) return PRICES.FREE_MAX_PLAYERS

    // Tournois legacy n'ont pas de limite stricte, utiliser max_players du tournoi
    if (tournament.is_legacy) {
      return tournament.max_players || 20
    }

    // Utiliser les regles definies dans monetization.ts
    const tournamentType = tournament.tournament_type || 'free'
    const rules = TOURNAMENT_RULES[tournamentType]
    return rules?.maxPlayers || PRICES.FREE_MAX_PLAYERS
  }

  const fetchPlayers = async () => {
    try {
      const supabase = createClient()

      const { data: playersData, error: playersError } = await supabase
        .from('tournament_participants')
        .select('*, profiles(username, avatar)')
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
    if (!tournament?.competition_id && !tournament?.custom_competition_id) return

    try {
      const supabase = createClient()

      // Compétition custom (Best of Week)
      if (tournament.custom_competition_id) {
        const { data: customCompetition } = await supabase
          .from('custom_competitions')
          .select('custom_emblem_white, custom_emblem_color')
          .eq('id', tournament.custom_competition_id)
          .single()

        if (customCompetition?.custom_emblem_white) {
          setCompetitionLogoWhite(customCompetition.custom_emblem_white)
          setCompetitionLogo(customCompetition.custom_emblem_white)
        }
        if (customCompetition?.custom_emblem_color) {
          setCompetitionLogoColor(customCompetition.custom_emblem_color)
        }
      }
      // Compétition importée classique
      else if (tournament.competition_id) {
        const { data: competition } = await supabase
          .from('competitions')
          .select('emblem, custom_emblem_white, custom_emblem_color')
          .eq('id', tournament.competition_id)
          .single()

        if (competition?.emblem) {
          setCompetitionLogo(competition.emblem)
        }
        if (competition?.custom_emblem_white) {
          setCompetitionLogoWhite(competition.custom_emblem_white)
        }
        if (competition?.custom_emblem_color) {
          setCompetitionLogoColor(competition.custom_emblem_color)
        }
      }
    } catch (err) {
      console.error('Error fetching competition logo:', err)
    }
  }

  const fetchNextMatchDate = async () => {
    if (!tournament?.competition_id && !tournament?.custom_competition_id) return

    try {
      const supabase = createClient()
      const now = new Date()

      // Compétition custom (Best of Week, Les plus belles affiches, etc.)
      if (tournament.custom_competition_id) {
        // Récupérer toutes les journées non terminées
        const { data: matchdays } = await supabase
          .from('custom_competition_matchdays')
          .select('id, status')
          .eq('custom_competition_id', tournament.custom_competition_id)
          .neq('status', 'completed')
          .order('matchday_number', { ascending: true })

        if (matchdays && matchdays.length > 0) {
          // Récupérer les matchs de ces journées
          const matchdayIds = matchdays.map(md => md.id)
          const { data: customMatches } = await supabase
            .from('custom_competition_matches')
            .select('cached_utc_date, football_data_match_id')
            .in('custom_matchday_id', matchdayIds)
            .order('cached_utc_date', { ascending: true })

          if (customMatches && customMatches.length > 0) {
            // Trouver le prochain match (premier match non encore joué)
            const upcomingMatches = customMatches
              .filter((match: any) => new Date(match.cached_utc_date) > now)
              .sort((a: any, b: any) => new Date(a.cached_utc_date).getTime() - new Date(b.cached_utc_date).getTime())

            if (upcomingMatches.length > 0) {
              setNextMatchDate(new Date(upcomingMatches[0].cached_utc_date))
            }
          }
        }
      }
      // Compétition importée classique
      else if (tournament.competition_id) {
        const response = await fetch(`/api/football/competition-matches?competitionId=${tournament.competition_id}`)
        const data = await response.json()

        if (data.matches && data.matches.length > 0) {
          // Trouver le prochain match (premier match non encore joué)
          const upcomingMatches = data.matches
            .filter((match: any) => new Date(match.utc_date) > now)
            .sort((a: any, b: any) => new Date(a.utc_date).getTime() - new Date(b.utc_date).getTime())

          if (upcomingMatches.length > 0) {
            setNextMatchDate(new Date(upcomingMatches[0].utc_date))
          }
        }
      }
    } catch (err) {
      console.error('Error fetching next match date:', err)
    }
  }

  const fetchRemainingMatchdays = async () => {
    if (!tournament?.competition_id && !tournament?.custom_competition_id) return

    try {
      const supabase = createClient()

      // Compétition custom (Best of Week)
      if (tournament.custom_competition_id) {
        const { data: matchdays } = await supabase
          .from('custom_competition_matchdays')
          .select('id, status')
          .eq('custom_competition_id', tournament.custom_competition_id)

        if (matchdays) {
          // Compter les journées restantes (pas completed ni active)
          const remaining = matchdays.filter(md => md.status !== 'completed' && md.status !== 'active').length
          const total = matchdays.length

          const matchdaysToPredict = tournament.all_matchdays
            ? remaining
            : Math.min(tournament.num_matchdays, remaining)

          setRemainingMatchdaysToPredict(matchdaysToPredict)
        }
      }
      // Compétition importée classique
      else if (tournament.competition_id) {
        const { data: competition } = await supabase
          .from('competitions')
          .select('current_matchday, total_matchdays')
          .eq('id', tournament.competition_id)
          .single()

        if (competition?.total_matchdays) {
          const currentMatchday = competition.current_matchday || 0
          const remaining = competition.total_matchdays - currentMatchday

          // Si le tournoi est configuré pour "toutes les journées", on affiche le nombre restant
          // Sinon, on prend le minimum entre le nombre configuré et le nombre restant
          const matchdaysToPredict = tournament.all_matchdays
            ? remaining
            : Math.min(tournament.num_matchdays, remaining)

          setRemainingMatchdaysToPredict(matchdaysToPredict)
        }
      }
    } catch (err) {
      console.error('Error fetching remaining matchdays:', err)
    }
  }

  const fetchTeamsMapping = async () => {
    if (!tournament?.id) return
    // Ne fetch que pour les tournois Elite/Platinium
    if (tournament.tournament_type !== 'elite' && tournament.tournament_type !== 'platinium') return

    try {
      const response = await fetch(`/api/tournaments/${tournament.id}/teams`)
      const data = await response.json()

      if (response.ok && data.teams) {
        // Stocker les données complètes des équipes
        setTeamsData({ teamsEnabled: data.teamsEnabled, teams: data.teams })

        const mapping: Record<string, { teamName: string; teamAvatar: string }> = {}
        data.teams.forEach((team: any) => {
          team.members.forEach((member: any) => {
            mapping[member.userId] = {
              teamName: team.name,
              teamAvatar: team.avatar
            }
          })
        })
        setPlayerTeams(mapping)
      }
    } catch (err) {
      console.error('Error fetching teams mapping:', err)
    }
  }

  // Récupérer les infos d'extension de joueurs pour Free-Kick
  const fetchPlayerExtensionInfo = async () => {
    if (!tournament?.id || tournament.tournament_type !== 'free') return

    try {
      const response = await fetch(`/api/tournaments/extend-players?tournamentId=${tournament.id}`)
      const data = await response.json()

      if (data.success) {
        setPlayerExtensionInfo({
          canExtend: data.canExtend,
          isCaptain: data.isCaptain,
          hasCredit: data.hasCredit,
          currentMaxPlayers: data.currentMaxPlayers,
          newMaxPlayers: data.newMaxPlayers,
          playersExtended: data.playersExtended,
          price: data.price,
          extensionAmount: data.extensionAmount
        })
      }
    } catch (err) {
      console.error('Error fetching player extension info:', err)
    }
  }

  // Acheter un crédit d'extension
  const handleBuyExtension = async () => {
    if (!tournament?.id) return

    setExtensionLoading(true)
    try {
      const response = await fetchWithAuth('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchaseType: 'player_extension',
          tournamentId: tournament.id,
          successUrl: `${window.location.origin}/${tournamentSlug}/echauffement?extension=success`,
          cancelUrl: `${window.location.origin}/${tournamentSlug}/echauffement?extension=cancelled`
        })
      })

      const data = await response.json()

      if (data.url) {
        window.location.href = data.url
      } else {
        throw new Error(data.error || 'Erreur lors de la création du paiement')
      }
    } catch (err: any) {
      console.error('Error creating checkout session:', err)
      alert(err.message || 'Erreur lors de la création du paiement')
    } finally {
      setExtensionLoading(false)
    }
  }

  // Appliquer l'extension avec un crédit existant
  const handleApplyExtension = async () => {
    if (!tournament?.id) return

    setExtensionLoading(true)
    try {
      const response = await fetchWithAuth('/api/tournaments/extend-players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId: tournament.id })
      })

      const data = await response.json()

      if (data.success) {
        // Mettre à jour le tournoi localement
        setTournament({ ...tournament, max_players: data.newMaxPlayers })
        setShowExtensionModal(false)
        // Rafraîchir les infos d'extension
        fetchPlayerExtensionInfo()
        alert(`Extension appliquée ! Vous avez maintenant ${data.newMaxPlayers} places disponibles.`)
      } else if (data.requiresPayment) {
        // Rediriger vers le paiement
        handleBuyExtension()
      } else {
        throw new Error(data.error || 'Erreur lors de l\'extension')
      }
    } catch (err: any) {
      console.error('Error applying extension:', err)
      alert(err.message || 'Erreur lors de l\'extension')
    } finally {
      setExtensionLoading(false)
    }
  }

  const handleIncreaseMaxPlayers = async () => {
    const limit = getMaxPlayersLimit()
    if (!tournament || tournament.max_players >= limit) {
      const typeLabel = tournament?.tournament_type === 'free' ? ' pour un compte gratuit' : ''
      alert(`Limite maximale de ${limit} participants atteinte${typeLabel}`)
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

  const showStartConfirmation = () => {
    // Vérifier le minimum de joueurs selon le type de tournoi
    const minPlayers = tournament?.tournament_type === 'platinium' ? PRICES.PLATINIUM_MIN_PLAYERS : 2
    if (players.length < minPlayers) {
      alert(`Il faut au moins ${minPlayers} participants pour démarrer ce tournoi`)
      return
    }

    // Vérifier si le mode équipe est activé pour les tournois Elite/Platinium
    if ((tournament?.tournament_type === 'elite' || tournament?.tournament_type === 'platinium') && teamsData.teamsEnabled) {
      // Compter les joueurs sans équipe
      const assignedUserIds = new Set<string>()
      teamsData.teams.forEach(team => {
        team.members.forEach((member: any) => {
          assignedUserIds.add(member.userId)
        })
      })

      const unassignedCount = players.filter(p => !assignedUserIds.has(p.user_id)).length

      if (unassignedCount > 0) {
        setUnassignedPlayersWarning({ show: true, count: unassignedCount })
        return
      }
    }

    setStartConfirmation(true)
  }

  const hideStartConfirmation = () => {
    setStartConfirmation(false)
  }

  const handleStartTournament = async () => {
    if (!tournament) return

    try {
      // Appeler l'API de démarrage pour vérifier les journées
      const response = await fetchWithAuth('/api/tournaments/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId: tournament.id,
          adjustMatchdays: false  // Premier appel sans ajustement
        })
      })

      const data = await response.json()

      if (data.warning) {
        // Il y a un problème de journées insuffisantes
        setMatchdayWarning({
          show: true,
          remainingMatchdays: data.remainingMatchdays,
          plannedMatchdays: data.plannedMatchdays,
          currentMatchday: data.currentMatchday,
          totalMatchdays: data.totalMatchdays
        })
        setStartConfirmation(false)
      } else if (data.success) {
        // Démarrage réussi, redirection (plus de /vestiaire/ une fois le tournoi lancé)
        window.location.href = `/${tournamentSlug}/opposition`
      } else {
        throw new Error(data.error || 'Failed to start tournament')
      }
    } catch (err: any) {
      console.error('Error starting tournament:', err)
      alert(err.message || 'Erreur lors du démarrage du tournoi')
      setStartConfirmation(false)
    }
  }

  const handleStartWithAdjustment = async () => {
    if (!tournament) return

    try {
      // Appeler l'API de démarrage avec ajustement automatique
      const response = await fetchWithAuth('/api/tournaments/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId: tournament.id,
          adjustMatchdays: true  // Activer l'ajustement
        })
      })

      const data = await response.json()

      if (data.success) {
        // Fermer le modal et rediriger (plus de /vestiaire/ une fois le tournoi lancé)
        setMatchdayWarning(null)
        window.location.href = `/${tournamentSlug}/opposition`
      } else {
        throw new Error(data.error || 'Failed to start tournament')
      }
    } catch (err: any) {
      console.error('Error starting tournament with adjustment:', err)
      alert(err.message || 'Erreur lors du démarrage du tournoi')
      setMatchdayWarning(null)
    }
  }

  const handleCancelMatchdayWarning = () => {
    setMatchdayWarning(null)
    setStartConfirmation(false)
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
      const response = await fetchWithAuth('/api/tournaments/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId: tournament.id })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de l\'annulation')
      }

      // Rediriger vers le dashboard après succès
      window.location.href = '/dashboard'
    } catch (err: any) {
      console.error('Error cancelling tournament:', err)
      alert(err.message || 'Erreur lors de l\'annulation du tournoi')
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
      const response = await fetchWithAuth('/api/tournaments/transfer-captain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId: tournament.id,
          newCaptainId: transferConfirmation.playerId
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors du transfert')
      }

      setTransferConfirmation({ show: false, playerId: '', playerName: '' })
      setTransferSuccess({ show: true, playerName: transferConfirmation.playerName })
      // Rediriger vers le dashboard après 2 secondes
      setTimeout(() => {
        window.location.href = '/dashboard'
      }, 2000)
    } catch (err: any) {
      console.error('Error transferring captaincy:', err)
      setTransferConfirmation({ show: false, playerId: '', playerName: '' })
      // Afficher l'erreur dans une modal simple (on pourrait aussi créer un état pour ça)
      setTransferSuccess({ show: false, playerName: '' })
    }
  }

  const handleLeaveTournament = async () => {
    if (!tournament || !currentUserId) return

    // Si c'est le capitaine, afficher l'avertissement de transfert obligatoire
    if (currentUserId === tournament.creator_id) {
      setLeaveWarning(true)
      return
    }

    // Sinon, afficher la confirmation de départ
    setLeaveConfirmation(true)
  }

  const confirmLeaveTournament = async () => {
    if (!tournament) return

    try {
      const response = await fetchWithAuth('/api/tournaments/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId: tournament.id })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors du départ')
      }

      // Rediriger vers le dashboard
      window.location.href = '/dashboard'
    } catch (err: any) {
      console.error('Error leaving tournament:', err)
      alert(err.message || 'Erreur lors du départ du tournoi')
      setLeaveConfirmation(false)
    }
  }

  const copyInviteCode = () => {
    navigator.clipboard.writeText(tournamentCode)
    setCopySuccess(true)
    setTimeout(() => setCopySuccess(false), 2000)
  }

  const shareUrl = () => {
    setShareModal(true)
  }

  const getInviteUrl = () => `${window.location.origin}/vestiaire/rejoindre?code=${tournamentCode}`

  const copyShareUrl = () => {
    navigator.clipboard.writeText(getInviteUrl())
    setCopySuccess(true)
    setTimeout(() => setCopySuccess(false), 2000)
  }

  const shareViaEmail = () => {
    const subject = encodeURIComponent(`Rejoins mon tournoi ${tournament?.name} sur PronoHub !`)
    const body = encodeURIComponent(`Salut !\n\nJe t'invite à rejoindre mon tournoi de pronostics "${tournament?.name}" sur PronoHub.\n\nClique sur ce lien pour rejoindre :\n${getInviteUrl()}\n\nOu utilise le code : ${tournamentCode}\n\nÀ bientôt sur le terrain !`)
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank')
  }

  const shareViaWhatsApp = () => {
    const text = encodeURIComponent(`Rejoins mon tournoi "${tournament?.name}" sur PronoHub ! 🏆\n\n${getInviteUrl()}\n\nCode : ${tournamentCode}`)
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  const shareViaMessenger = () => {
    const url = encodeURIComponent(getInviteUrl())
    window.open(`https://www.facebook.com/dialog/send?link=${url}&app_id=966242223397117&redirect_uri=${encodeURIComponent(window.location.href)}`, '_blank')
  }

  const shareViaSMS = () => {
    const text = encodeURIComponent(`Rejoins mon tournoi "${tournament?.name}" sur PronoHub ! Code: ${tournamentCode} - ${getInviteUrl()}`)
    window.open(`sms:?body=${text}`, '_blank')
  }

  const shareViaTelegram = () => {
    const text = encodeURIComponent(`Rejoins mon tournoi "${tournament?.name}" sur PronoHub ! 🏆`)
    const url = encodeURIComponent(getInviteUrl())
    window.open(`https://t.me/share/url?url=${url}&text=${text}`, '_blank')
  }

  const downloadQRCode = async () => {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(getInviteUrl())}`
    try {
      const response = await fetch(qrUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `pronohub-${tournament?.name?.replace(/\s+/g, '-').toLowerCase() || 'tournoi'}-qrcode.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Error downloading QR code:', err)
    }
  }

  const useNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Rejoins mon tournoi ${tournament?.name} sur PronoHub`,
          text: `Je t'invite à rejoindre mon tournoi de pronostics ! Code: ${tournamentCode}`,
          url: getInviteUrl()
        })
      } catch (err) {
        console.log('Share cancelled or failed:', err)
      }
    }
  }

  // Pas de loader séparé - le NavigationLoader global gère l'affichage pendant la navigation
  // On retourne null pendant le chargement pour éviter le double loader
  if (loading) {
    return null
  }

  if (error || !tournament) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black p-4">
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
    )
  }

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden theme-bg">
      {/* Popup de confirmation de démarrage */}
      {startConfirmation && (() => {
        // Calculer les équipes vides s'il y en a
        const emptyTeams = teamsData.teamsEnabled ? teamsData.teams.filter(t => t.members.length === 0) : []

        return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="theme-card rounded-lg shadow-2xl max-w-md w-full p-6 animate-in border-2 border-green-500">
            <div className="text-center mb-6">
              <img src="/images/icons/start-tour.svg" alt="Démarrer" className="w-16 h-16 mx-auto mb-3" />
              <h3 className="text-2xl font-bold theme-text mb-2">
                Démarrer le tournoi
              </h3>
              <p className="theme-text-secondary">
                Le tournoi <span className="font-bold text-green-600 dark:text-green-400">{tournament.name}</span> va démarrer avec <span className="font-bold">{players.length} participants</span>.
              </p>
            </div>

            <div className="bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500 p-4 mb-6">
              <p className="text-sm text-green-800 dark:text-green-300">
                <strong>Tout le monde est chaud ?</strong> Une fois le tournoi démarré, tout le monde aura accès aux pronostics.
              </p>
            </div>

            {/* Avertissement équipes vides */}
            {emptyTeams.length > 0 && (
              <div className="bg-yellow-500/10 border-l-4 border-yellow-500 p-4 mb-6 rounded">
                <p className="text-sm text-yellow-400">
                  <strong>Note :</strong> {emptyTeams.length} équipe{emptyTeams.length > 1 ? 's' : ''} vide{emptyTeams.length > 1 ? 's' : ''} ({emptyTeams.map(t => t.name).join(', ')}) sera{emptyTeams.length > 1 ? 'ont' : ''} automatiquement supprimée{emptyTeams.length > 1 ? 's' : ''} au démarrage.
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={hideStartConfirmation}
                className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition font-semibold"
              >
                Annuler
              </button>
              <button
                onClick={handleStartTournament}
                className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold"
              >
                Démarrer le tournoi
              </button>
            </div>
          </div>
        </div>
        )
      })()}

      {/* Popup de confirmation d'annulation */}
      {cancelConfirmation && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="theme-card rounded-lg shadow-2xl max-w-md w-full p-6 animate-in border-2 border-red-500">
            <div className="text-center mb-6">
              <div className="text-5xl mb-3">⚠️</div>
              <h3 className="text-2xl font-bold theme-text mb-2">
                Annuler le tournoi
              </h3>
              <p className="theme-text-secondary">
                Le tournoi <span className="font-bold text-red-500">{tournament.name}</span> sera supprimé définitivement.
              </p>
            </div>

            <div className="bg-red-500/10 border-l-4 border-red-500 p-4 mb-6 rounded">
              <p className="text-sm text-red-500">
                <strong>Attention :</strong> Cette action est irréversible. Le tournoi sera supprimé pour vous et tous les autres participants. Il n'apparaîtra plus dans "Mes tournois".
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={hideCancelConfirmation}
                className="flex-1 px-4 py-3 theme-card border-2 theme-border rounded-lg hover:opacity-80 transition font-semibold theme-text"
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="theme-card rounded-lg shadow-2xl max-w-md w-full p-6 animate-in border-2 border-[#ff9900]">
            <div className="text-center mb-6">
              <div className="text-5xl mb-3">⚠️</div>
              <h3 className="text-2xl font-bold theme-text mb-2">
                Confirmer le transfert
              </h3>
              <p className="theme-text-secondary">
                Êtes-vous sûr de vouloir transférer le rôle de capitaine à{' '}
                <span className="font-bold theme-accent-text-always">{transferConfirmation.playerName}</span> ?
              </p>
            </div>

            <div className="bg-yellow-500/10 border-l-4 border-yellow-500 p-4 mb-6 rounded">
              <p className="text-sm text-yellow-500">
                <strong>Important :</strong> Vous perdrez tous les privilèges de capitaine. Cette action est irréversible.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={cancelTransfer}
                className="flex-1 px-4 py-3 theme-card border-2 theme-border rounded-lg hover:opacity-80 transition font-semibold theme-text"
              >
                Annuler
              </button>
              <button
                onClick={handleTransferCaptaincy}
                className="flex-1 px-4 py-3 bg-[#ff9900] text-[#111] rounded-lg hover:opacity-80 transition font-semibold"
              >
                Confirmer le transfert
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Popup de succès après transfert de capitanat */}
      {transferSuccess.show && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="theme-card rounded-lg shadow-2xl max-w-md w-full p-6 animate-in border-2 border-green-500">
            <div className="text-center">
              <div className="text-5xl mb-3">✅</div>
              <h3 className="text-2xl font-bold theme-text mb-2">
                Transfert réussi !
              </h3>
              <p className="theme-text-secondary mb-4">
                Le capitanat a été transféré à <span className="font-bold text-green-500">{transferSuccess.playerName}</span>.
              </p>
              <p className="text-sm theme-text-secondary">
                Un email lui a été envoyé pour l'informer de ses nouvelles responsabilités.
              </p>
              <p className="text-xs theme-text-secondary mt-4 opacity-60">
                Redirection vers le dashboard...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Popup d'avertissement pour quitter le tournoi en tant que capitaine */}
      {leaveWarning && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="theme-card rounded-lg shadow-2xl max-w-md w-full p-6 animate-in border-2 border-[#ff9900]">
            <div className="text-center mb-6">
              <div className="text-5xl mb-3">🔒</div>
              <h3 className="text-2xl font-bold theme-text mb-2">
                Transfert obligatoire
              </h3>
              <p className="theme-text-secondary">
                En tant que capitaine, vous devez d'abord transférer le rôle à un autre participant avant de pouvoir quitter le tournoi.
              </p>
            </div>

            <div className="bg-[#ff9900]/10 border-l-4 border-[#ff9900] p-4 mb-6 rounded">
              <p className="text-sm theme-accent-text-always">
                <strong>Important :</strong> Utilisez le bouton "Transférer" à côté du nom d'un participant dans la liste ci-dessous pour lui donner le capitanat.
              </p>
            </div>

            <div className="flex justify-center">
              <button
                onClick={() => setLeaveWarning(false)}
                className="px-6 py-3 bg-[#ff9900] text-[#111] rounded-lg hover:opacity-80 transition font-semibold"
              >
                J'ai compris
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Popup de confirmation pour quitter le tournoi (non-capitaines) */}
      {leaveConfirmation && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="theme-card rounded-lg shadow-2xl max-w-md w-full p-6 animate-in border-2 border-red-500">
            <div className="text-center mb-6">
              <div className="text-5xl mb-3">🚪</div>
              <h3 className="text-2xl font-bold theme-text mb-2">
                Quitter le tournoi ?
              </h3>
              <p className="theme-text-secondary">
                Êtes-vous sûr de vouloir quitter le tournoi <span className="font-bold text-red-500">{tournament?.name}</span> ?
              </p>
            </div>

            <div className="bg-red-500/10 border-l-4 border-red-500 p-4 mb-6 rounded">
              <p className="text-sm text-red-400">
                <strong>Attention :</strong> Cette action est irréversible. Vous ne pourrez plus rejoindre ce tournoi et tous vos pronostics seront supprimés.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setLeaveConfirmation(false)}
                className="flex-1 px-4 py-3 theme-card border-2 theme-border rounded-lg hover:opacity-80 transition font-semibold theme-text"
              >
                Annuler
              </button>
              <button
                onClick={confirmLeaveTournament}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold"
              >
                Confirmer le départ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Popup d'avertissement: joueurs sans équipe */}
      {unassignedPlayersWarning.show && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="theme-card rounded-lg shadow-2xl max-w-md w-full p-6 animate-in border-2 border-red-500">
            <div className="text-center mb-6">
              <div className="text-5xl mb-3">⚠️</div>
              <h3 className="text-2xl font-bold theme-text mb-2">
                Joueurs sans équipe
              </h3>
              <p className="theme-text-secondary">
                <span className="font-bold text-red-500">{unassignedPlayersWarning.count} joueur{unassignedPlayersWarning.count > 1 ? 's' : ''}</span> n'{unassignedPlayersWarning.count > 1 ? 'ont' : 'a'} pas encore été assigné{unassignedPlayersWarning.count > 1 ? 's' : ''} à une équipe.
              </p>
            </div>

            <div className="bg-red-500/10 border-l-4 border-red-500 p-4 mb-6 rounded">
              <p className="text-sm text-red-400">
                <strong>Impossible de démarrer :</strong> En mode équipe, tous les joueurs doivent être assignés à une équipe avant de pouvoir lancer le tournoi.
              </p>
            </div>

            <div className="flex justify-center">
              <button
                onClick={() => setUnassignedPlayersWarning({ show: false, count: 0 })}
                className="px-6 py-3 bg-[#ff9900] text-[#111] rounded-lg hover:opacity-80 transition font-semibold"
              >
                J'ai compris
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal d'extension de joueurs Free-Kick */}
      {showExtensionModal && playerExtensionInfo && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="theme-card rounded-lg shadow-2xl max-w-md w-full p-6 animate-in border-2 border-purple-500">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-purple-500 to-purple-600 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold theme-text mb-2">
                Renfort du banc
              </h3>
              <p className="theme-text-secondary">
                Étendez votre tournoi Free-Kick de <span className="font-bold text-purple-500">{playerExtensionInfo.currentMaxPlayers}</span> à <span className="font-bold text-purple-500">{playerExtensionInfo.newMaxPlayers}</span> joueurs
              </p>
            </div>

            <div className="bg-purple-500/10 border-l-4 border-purple-500 p-4 mb-6 rounded">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-400 font-semibold">
                    +{playerExtensionInfo.extensionAmount} places supplémentaires
                  </p>
                  <p className="text-xs theme-text-secondary mt-1">
                    Extension unique par tournoi
                  </p>
                </div>
                <div className="text-2xl font-bold text-purple-500">
                  {playerExtensionInfo.price}€
                </div>
              </div>
            </div>

            {playerExtensionInfo.hasCredit && (
              <div className="bg-green-500/10 border-l-4 border-green-500 p-4 mb-6 rounded">
                <p className="text-sm text-green-400">
                  <strong>Crédit disponible !</strong> Vous avez un crédit d'extension non utilisé.
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowExtensionModal(false)}
                className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition font-semibold"
                disabled={extensionLoading}
              >
                Annuler
              </button>
              <button
                onClick={playerExtensionInfo.hasCredit ? handleApplyExtension : handleBuyExtension}
                disabled={extensionLoading}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:from-purple-700 hover:to-purple-800 transition font-semibold disabled:opacity-50"
              >
                {extensionLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Chargement...
                  </span>
                ) : playerExtensionInfo.hasCredit ? (
                  'Utiliser mon crédit'
                ) : (
                  `Acheter pour ${playerExtensionInfo.price}€`
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de partage */}
      {shareModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="theme-card rounded-xl shadow-2xl max-w-md w-full overflow-hidden animate-in">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#ff9900] to-[#e68a00] p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-[#111] flex items-center gap-2">
                  <img src="/images/icons/share.svg" alt="Partager" className="w-6 h-6" />
                  Inviter des amis
                </h3>
                <button
                  onClick={() => setShareModal(false)}
                  className="p-1 rounded-lg hover:bg-black/10 transition"
                >
                  <svg className="w-6 h-6 text-[#111]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Lien et code */}
              <div className="text-center">
                <p className="text-sm theme-text-secondary mb-2">Code d'invitation</p>
                <p className="text-3xl font-bold font-mono tracking-wider theme-accent-text-always mb-3">{tournamentCode}</p>
                <div className="flex items-center gap-2 p-3 rounded-lg theme-secondary-bg">
                  <input
                    type="text"
                    readOnly
                    value={getInviteUrl()}
                    className="flex-1 bg-transparent text-sm theme-text truncate outline-none"
                  />
                  <button
                    onClick={copyShareUrl}
                    className="p-2 rounded-lg bg-[#ff9900] hover:bg-[#e68a00] transition"
                    title="Copier le lien"
                  >
                    {copySuccess ? (
                      <svg className="w-5 h-5 text-[#111]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-[#111]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Boutons de partage */}
              <div>
                <p className="text-sm theme-text-secondary mb-3 text-center">Partager via</p>
                <div className="grid grid-cols-3 gap-3">
                  {/* WhatsApp */}
                  <button
                    onClick={shareViaWhatsApp}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-green-500/10 transition group"
                  >
                    <div className="w-12 h-12 rounded-full bg-[#25D366] flex items-center justify-center group-hover:scale-110 transition">
                      <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                      </svg>
                    </div>
                    <span className="text-xs theme-text">WhatsApp</span>
                  </button>

                  {/* Messenger */}
                  <button
                    onClick={shareViaMessenger}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-blue-500/10 transition group"
                  >
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#00B2FF] to-[#006AFF] flex items-center justify-center group-hover:scale-110 transition">
                      <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0C5.373 0 0 4.974 0 11.111c0 3.498 1.744 6.614 4.469 8.654V24l4.088-2.242c1.092.301 2.246.464 3.443.464 6.627 0 12-4.975 12-11.111C24 4.974 18.627 0 12 0zm1.191 14.963l-3.055-3.26-5.963 3.26L10.732 8l3.131 3.259L19.752 8l-6.561 6.963z"/>
                      </svg>
                    </div>
                    <span className="text-xs theme-text">Messenger</span>
                  </button>

                  {/* Telegram */}
                  <button
                    onClick={shareViaTelegram}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-sky-500/10 transition group"
                  >
                    <div className="w-12 h-12 rounded-full bg-[#0088cc] flex items-center justify-center group-hover:scale-110 transition">
                      <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                      </svg>
                    </div>
                    <span className="text-xs theme-text">Telegram</span>
                  </button>

                  {/* Email */}
                  <button
                    onClick={shareViaEmail}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-gray-500/10 transition group"
                  >
                    <div className="w-12 h-12 rounded-full bg-gray-600 flex items-center justify-center group-hover:scale-110 transition">
                      <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <span className="text-xs theme-text">Email</span>
                  </button>

                  {/* SMS */}
                  <button
                    onClick={shareViaSMS}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-green-500/10 transition group"
                  >
                    <div className="w-12 h-12 rounded-full bg-green-600 flex items-center justify-center group-hover:scale-110 transition">
                      <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <span className="text-xs theme-text">SMS</span>
                  </button>

                  {/* Partage natif (mobile) */}
                  {typeof navigator !== 'undefined' && 'share' in navigator && (
                    <button
                      onClick={useNativeShare}
                      className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-[#ff9900]/10 transition group"
                    >
                      <div className="w-12 h-12 rounded-full bg-[#ff9900] flex items-center justify-center group-hover:scale-110 transition">
                        <svg className="w-7 h-7 text-[#111]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                      </div>
                      <span className="text-xs theme-text">Plus...</span>
                    </button>
                  )}
                </div>
              </div>

              {/* QR Code */}
              <div className="border-t theme-border pt-6">
                <p className="text-sm theme-text-secondary mb-3 text-center">Ou partager le QR Code</p>
                <div className="flex items-center justify-center gap-4">
                  <div className="bg-white p-3 rounded-lg">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(getInviteUrl())}`}
                      alt="QR Code"
                      className="w-24 h-24"
                    />
                  </div>
                  <div className="space-y-2">
                    <button
                      onClick={downloadQRCode}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#ff9900] hover:bg-[#e68a00] text-[#111] font-semibold transition"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Télécharger
                    </button>
                    <p className="text-xs theme-text-secondary text-center">Format PNG</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <Navigation
        username={username}
        userAvatar={userAvatar}
        context="tournament"
        tournamentContext={{
          tournamentName: tournament.name,
          competitionName: tournament.competition_name,
          competitionLogo: competitionLogo,
          competitionLogoWhite: competitionLogoWhite,
          status: "pending"
        }}
      />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Contrôles du capitaine */}
        {currentUserId === tournament?.creator_id && (
          <div className="mb-6 theme-card border-2 border-yellow-400">
            <div className="flex flex-col md:flex-row md:items-start gap-4">
              {/* Section gauche avec logo et infos en desktop */}
              <div className="md:flex-1">
                <h2 className="text-base md:text-xl font-bold theme-text flex items-center gap-2 justify-center md:justify-start">
                  <img
                    src="/images/icons/cap.svg"
                    alt="Capitaine"
                    className="w-6 h-6 icon-filter-white"
                  />
                  Les privilèges du capitaine
                </h2>
                <p className="text-sm mt-1 italic text-center md:text-left theme-accent-text-always">Le brassard implique de grandes responsabilités</p>

                {/* Logo de la compétition + infos tournoi - visible uniquement en desktop */}
                {tournament && (
                  <div className="mt-4 hidden md:flex items-center gap-4 px-4">
                    {/* Logo blanc pour thème sombre */}
                    {(competitionLogoWhite || competitionLogo) && (
                      <img
                        src={competitionLogoWhite || competitionLogo || undefined}
                        alt={tournament.competition_name}
                        className="w-14 h-14 object-contain flex-shrink-0 show-on-dark"
                      />
                    )}
                    {/* Logo couleur pour thème clair */}
                    {(competitionLogoColor || competitionLogo) && (
                      <img
                        src={competitionLogoColor || competitionLogo || undefined}
                        alt={tournament.competition_name}
                        className="w-14 h-14 object-contain flex-shrink-0 show-on-light"
                      />
                    )}
                    {/* Placeholder si pas de logo (compétition custom sans logo) */}
                    {!competitionLogo && !competitionLogoWhite && !competitionLogoColor && (
                      <div className="w-14 h-14 flex-shrink-0 rounded-lg bg-[#ff9900]/20 flex items-center justify-center">
                        <span className="text-2xl">🏆</span>
                      </div>
                    )}
                    <div className="flex flex-col gap-0.5">
                      <h3 className="text-lg font-bold theme-text">{tournament.name}</h3>
                      <p className="text-sm theme-text-secondary">{tournament.competition_name}</p>
                      <p className="text-sm theme-text-secondary">
                        {remainingMatchdaysToPredict !== null && (
                          <>Encore {remainingMatchdaysToPredict} journée{remainingMatchdaysToPredict > 1 ? 's' : ''} à pronostiquer</>
                        )}
                        {remainingMatchdaysToPredict === null && tournament.all_matchdays && (
                          <>Toutes les journées</>
                        )}
                        {remainingMatchdaysToPredict === null && !tournament.all_matchdays && (
                          <>{tournament.num_matchdays} journée{tournament.num_matchdays > 1 ? 's' : ''} à pronostiquer</>
                        )}
                      </p>
                    </div>
                  </div>
                )}

                {/* Info pour le transfert - sous le texte en mobile */}
                {players.length > 1 && (
                  <div className="mt-4 captain-info-box md:hidden">
                    <p className="text-sm text-center text-slate-accent">
                      💡 Pour transférer le capitanat, cliquez sur le bouton "Transférer" à côté d'un participant ci-dessous.
                    </p>
                  </div>
                )}
              </div>

              {/* Boutons à droite en desktop (30% de largeur) */}
              <div className="space-y-2 w-full md:w-[30%]">
                <button
                  onClick={showStartConfirmation}
                  disabled={tournament?.tournament_type === 'platinium'
                    ? players.length < PRICES.PLATINIUM_MIN_PLAYERS
                    : players.length < 2}
                  className="btn-captain-action"
                >
                  <img
                    src="/images/icons/start-referee.svg"
                    alt=""
                    className="btn-icon"
                  />
                  Démarrer le tournoi
                </button>
                <button
                  onClick={showCancelConfirmation}
                  className="btn-captain-action"
                >
                  <img
                    src="/images/icons/poubelle.svg"
                    alt=""
                    className="btn-icon"
                  />
                  Annuler le tournoi
                </button>
                <button
                  onClick={handleLeaveTournament}
                  className="btn-captain-action"
                >
                  <img
                    src="/images/icons/dehors.svg"
                    alt=""
                    className="btn-icon"
                  />
                  Quitter le tournoi
                </button>
              </div>
            </div>

            {/* Info pour le transfert - en bas en desktop */}
            {players.length > 1 && (
              <div className="mt-4 captain-info-box hidden md:block">
                <p className="text-sm text-center text-slate-accent">
                  💡 Pour transférer le capitanat, cliquez sur le bouton "Transférer" à côté d'un participant ci-dessous.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Grid 2 colonnes pour tous les types de tournois */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Effectif */}
          <div className="theme-card">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <svg width="24" height="24" viewBox="0 0 512 512" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="theme-accent-text">
                <path d="M438.927,145.082c-6.995-7.467-16.875-11.748-27.105-11.748H387.02c-10.23,0-20.11,4.282-27.104,11.748c-6.994,7.466-10.623,17.603-9.957,27.811l1.1,16.901l2.573,39.471c1.026,15.716,9.877,29.629,23.675,37.219c6.924,3.808,14.517,5.712,22.113,5.712c7.593,0,15.191-1.904,22.113-5.712c13.799-7.589,22.65-21.503,23.674-37.219l2.941-45.103l0.735-11.269C449.551,162.685,445.922,152.548,438.927,145.082z"/>
                <path d="M511.836,358.861l-4.107-22.673c-5.063-27.95-27.206-50.258-55.099-55.51c-4.21-0.794-8.517-1.195-12.801-1.195h-12.371c-2.705,0-5.298,1.075-7.212,2.987l-20.825,20.825l-20.826-20.826c-1.913-1.912-4.507-2.987-7.212-2.987h-12.37c-4.284,0-8.591,0.402-12.801,1.195c-9.069,1.707-17.54,5.17-25.225,10.256c-3.598-0.44-7.223-0.683-10.839-0.683h-22.533c-2.711,0-5.31,1.079-7.224,2.999l-24.636,24.719l-25.248-24.796c-1.907-1.873-4.473-2.922-7.147-2.922h-21.845c-3.514,0-7.038,0.234-10.54,0.649c-7.684-5.074-16.151-8.52-25.191-10.222c-4.21-0.794-8.517-1.195-12.801-1.195h-12.37c-2.705,0-5.299,1.075-7.212,2.987l-20.825,20.826l-20.825-20.826c-1.912-1.912-4.507-2.987-7.212-2.987H72.171c-4.284,0-8.591,0.402-12.801,1.195c-27.894,5.252-50.036,27.559-55.099,55.509l-4.107,22.673c-0.539,2.975,0.269,6.035,2.208,8.356c1.938,2.32,4.805,3.662,7.828,3.662H112.38l-4.2,23.189c-0.539,2.975,0.27,6.035,2.208,8.355s4.805,3.661,7.828,3.661h275.237c3.023,0,5.89-1.341,7.829-3.661c1.937-2.32,2.746-5.381,2.207-8.355l-4.201-23.188H501.8c3.023,0,5.89-1.341,7.829-3.661C511.566,364.897,512.374,361.836,511.836,358.861z"/>
                <path d="M152.082,145.082c-6.995-7.466-16.874-11.748-27.104-11.748h-24.801c-10.23,0-20.109,4.282-27.103,11.747c-6.995,7.466-10.625,17.603-9.96,27.812l1.103,16.902l2.573,39.47c1.025,15.716,9.876,29.629,23.674,37.219c6.923,3.807,14.518,5.712,22.113,5.712c7.595,0,15.19-1.904,22.113-5.712c13.799-7.59,22.65-21.504,23.674-37.219l2.941-45.103l0.735-11.269C162.707,162.685,159.077,152.548,152.082,145.082z"/>
                <path d="M306.374,120.599c-8.741-9.329-21.087-14.681-33.872-14.681h-33.339c-12.785,0-25.131,5.352-33.872,14.681c-8.741,9.329-13.277,21.998-12.445,34.755l1.481,22.72l3.461,53.056c1.299,19.922,12.519,37.561,30.012,47.182c8.777,4.827,18.402,7.24,28.032,7.24c9.626,0,19.257-2.414,28.032-7.24c17.494-9.622,28.713-27.26,30.012-47.182l3.954-60.627v-0.001l0.987-15.148C319.65,142.597,315.115,129.929,306.374,120.599z"/>
              </svg>
              <span className="theme-accent-text">Effectif ({players.length}/{tournament.max_players})</span>
            </h2>

            {/* Alerte minimum joueurs pour Platinium */}
            {tournament?.tournament_type === 'platinium' && players.length < PRICES.PLATINIUM_MIN_PLAYERS && (
              <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/50 rounded-lg">
                <p className="text-sm text-yellow-400 flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                  </svg>
                  Le tournoi ne pourra commencer que lorsque le minimum de {PRICES.PLATINIUM_MIN_PLAYERS} joueurs sera atteint
                </p>
              </div>
            )}

            <div className="space-y-3">
              {players.map((player, index) => {
                const isCaptain = player.user_id === tournament?.creator_id
                const isCreatorViewing = currentUserId === tournament?.creator_id
                const canTransfer = isCreatorViewing && !isCaptain && players.length > 1
                const isPlatinium = tournament?.tournament_type === 'platinium'
                const isPaidByCreator = player.paid_by_creator
                const hasPaid = player.has_paid
                const playerTeam = playerTeams[player.user_id]

                return (
                  <div
                    key={player.id}
                    className="dark-bg-primary dark-border-primary flex items-center gap-3 p-3 rounded-lg border-2"
                  >
                    {/* Avatar avec numéro superposé et badge équipe */}
                    <div className="relative w-12 h-12 flex-shrink-0">
                      <div className="relative w-full h-full rounded-full overflow-hidden border-2 border-[#ff9900]">
                        <Image
                          src={getAvatarUrl(player.user_id === currentUserId ? userAvatar : (player.profiles?.avatar || 'avatar1'))}
                          alt={player.profiles?.username || 'Joueur'}
                          fill
                          className="object-cover"
                          sizes="48px"
                        />
                      </div>
                      {/* Badge équipe en haut à droite */}
                      {playerTeam && (
                        <div className="absolute -top-1 -right-1 w-5 h-5" title={playerTeam.teamName}>
                          <img
                            src={`/images/team-avatars/${playerTeam.teamAvatar}.svg`}
                            alt={playerTeam.teamName}
                            className="w-full h-full"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/images/team-avatars/team1.svg'
                            }}
                          />
                        </div>
                      )}
                      {/* Numéro en badge */}
                      <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${player.user_id === currentUserId ? 'bg-[#ff9900] text-[#111]' : 'participant-number-badge'}`}>
                        {index + 1}
                      </div>
                    </div>

                    {/* Nom + Capitaine + Badge paiement Platinium */}
                    <div className="flex-1">
                      <p className="font-semibold flex items-center gap-2">
                        <span className={player.user_id === currentUserId ? 'text-[#ff9900]' : 'theme-text'}>
                          {player.profiles?.username || 'Joueur'}
                        </span>
                        {isCaptain && (
                          <span className="text-xs dark-text-white font-semibold">(cap.)</span>
                        )}
                      </p>
                      {/* Badge de statut de paiement pour Platinium */}
                      {isPlatinium && (
                        <p className="text-xs mt-0.5">
                          {(hasPaid || isPaidByCreator) ? (
                            <span className="text-green-400 flex items-center gap-1">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                              Payé
                            </span>
                          ) : (
                            <span className="text-gray-500 flex items-center gap-1">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/></svg>
                              En attente paiement
                            </span>
                          )}
                        </p>
                      )}
                    </div>

                    {/* Bouton Transférer */}
                    {canTransfer && (
                      <button
                        onClick={() => showTransferConfirmation(player.user_id, player.profiles?.username || 'Joueur')}
                        className="btn-transfer"
                      >
                        Transférer
                      </button>
                    )}
                  </div>
                )
              })}

              {/* Places vides */}
              {Array.from({ length: tournament.max_players - players.length }).map((_, index) => {
                const isPlatinium = tournament?.tournament_type === 'platinium'
                const prepaidRemaining = tournament?.prepaid_slots_remaining || 0
                const isThisSlotPrepaid = isPlatinium && index < prepaidRemaining

                return (
                  <div
                    key={`empty-${index}`}
                    className={`dark-bg-primary dark-border-primary flex items-center gap-3 p-3 rounded-lg border-2 border-dashed ${isThisSlotPrepaid ? 'opacity-70 border-green-500/50' : 'opacity-50'}`}
                  >
                    <div className="flex-shrink-0 w-10 h-10 relative flex items-center justify-center">
                      <svg width="40" height="40" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" className={isThisSlotPrepaid ? 'text-green-500' : 'empty-jersey-svg'}>
                        <path fill="currentColor" d="M11.91 14.22H4.06l-.5-.5V7.06H2.15l-.48-.38L1 4l.33-.6L5.59 2l.64.32a2.7 2.7 0 0 0 .21.44c.071.103.152.2.24.29.168.169.369.302.59.39a1.82 1.82 0 0 0 1.43 0 1.74 1.74 0 0 0 .59-.39c.09-.095.173-.195.25-.3l.15-.29a1.21 1.21 0 0 0 .05-.14l.64-.32 4.26 1.42L15 4l-.66 2.66-.49.38h-1.44v6.66l-.5.52zm-7.35-1h6.85V6.56l.5-.5h1.52l.46-1.83-3.4-1.14a1.132 1.132 0 0 1-.12.21c-.11.161-.233.312-.37.45a2.75 2.75 0 0 1-.91.61 2.85 2.85 0 0 1-2.22 0A2.92 2.92 0 0 1 6 3.75a2.17 2.17 0 0 1-.36-.44l-.13-.22-3.43 1.14.46 1.83h1.52l.5.5v6.66z"/>
                      </svg>
                      <span className={`absolute font-bold text-xs ${isThisSlotPrepaid ? 'text-green-500' : 'empty-jersey-number'}`}>{players.length + index + 1}</span>
                    </div>
                    <div className="flex-1">
                      {isPlatinium ? (
                        isThisSlotPrepaid ? (
                          <p className="text-green-400 text-sm font-medium flex items-center gap-1">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                            Place prepayee - Gratuit
                          </p>
                        ) : (
                          <p className="text-yellow-400/70 text-sm italic flex items-center gap-1">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z"/></svg>
                            En attente - 6,99€
                          </p>
                        )
                      ) : (
                        <p className="empty-jersey-text italic">En attente...</p>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Boutons gestion des places (visible uniquement pour le capitaine) */}
              {currentUserId === tournament?.creator_id && (
                <div className="space-y-2 mt-4">
                  {/* Bouton Ajouter une place */}
                  {tournament.max_players < getMaxPlayersLimit() && (
                    <button
                      onClick={handleIncreaseMaxPlayers}
                      className="dark-bg-primary dark-border-primary w-full flex items-center justify-center gap-2 p-3 rounded-lg border-2 border-dashed hover:opacity-80 transition font-semibold"
                    >
                      <span className="text-xl dark-text-accent">+</span>
                      <span className="dark-text-accent">
                        Ajouter une place (max {getMaxPlayersLimit()}{tournament.tournament_type === 'free' ? ' en mode gratuit' : ''})
                      </span>
                    </button>
                  )}

                  {/* Bouton Supprimer une place */}
                  {tournament.max_players > (tournament.tournament_type === 'platinium' ? PRICES.PLATINIUM_MIN_PLAYERS : 2) && tournament.max_players > players.length && (
                    <button
                      onClick={handleDecreaseMaxPlayers}
                      className="dark-bg-primary dark-border-primary w-full flex items-center justify-center gap-2 p-3 rounded-lg border-2 border-dashed hover:opacity-80 transition font-semibold"
                    >
                      <span className="text-xl dark-text-accent">−</span>
                      <span className="dark-text-accent">Supprimer une place</span>
                    </button>
                  )}
                </div>
              )}

              {/* Bouton Extension de joueurs pour Free-Kick (visible pour tous) */}
              {tournament.tournament_type === 'free' && playerExtensionInfo?.canExtend && (
                <div className="mt-4">
                  <button
                    onClick={() => setShowExtensionModal(true)}
                    className="w-full flex items-center justify-center gap-2 p-3 rounded-lg bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white transition font-semibold"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <span>Étendre à {playerExtensionInfo.newMaxPlayers} joueurs (+{playerExtensionInfo.extensionAmount})</span>
                    <span className="ml-2 px-2 py-0.5 bg-white/20 rounded text-sm">{playerExtensionInfo.price}€</span>
                  </button>
                </div>
              )}

              {/* Info prochaine journée (visible pour tous) */}
              {timeRemaining && (
                <div className="mt-4 p-4 next-matchday-card border-2 rounded-lg">
                  <h3 className="font-bold next-matchday-title mb-3 flex items-center gap-2">
                    <img src="/images/icons/chrono.svg" alt="Chrono" className="w-5 h-5 icon-orange" />
                    Prochaine journée
                  </h3>
                  <div className="mb-3 p-3 next-matchday-timer rounded-lg border-2">
                    <p className="text-xs theme-text-secondary mb-2 text-center">Prochaine journée dans :</p>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div>
                        <div className="text-2xl font-bold next-matchday-number">{timeRemaining.days}</div>
                        <div className="text-xs theme-text-secondary">jours</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold next-matchday-number">{timeRemaining.hours}</div>
                        <div className="text-xs theme-text-secondary">heures</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold next-matchday-number">{timeRemaining.minutes}</div>
                        <div className="text-xs theme-text-secondary">min</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold next-matchday-number">{timeRemaining.seconds}</div>
                        <div className="text-xs theme-text-secondary">sec</div>
                      </div>
                    </div>
                  </div>
                  <div className="p-3 next-matchday-warning border-l-4 rounded">
                    <p className="text-xs next-matchday-text font-semibold">
                      ⚠️ Si le tournoi n'est pas démarré avant le premier match de la prochaine journée de {tournament.competition_name}, il ne pourra commencer qu'à la journée suivante.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Colonne droite: Equipes + Code d'invitation */}
          <div className="space-y-6">
            {/* Section Equipes (uniquement pour Elite et Platinium) */}
            {(tournament?.tournament_type === 'elite' || tournament?.tournament_type === 'platinium') && (
              <TeamsManager
                tournamentId={tournament.id}
                tournamentType={tournament.tournament_type}
                players={players}
                currentUserId={currentUserId}
                creatorId={tournament.creator_id}
                tournamentStatus={tournament.status}
                onTeamsChange={fetchTeamsMapping}
              />
            )}
            <div className="theme-card">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <img src="/images/icons/code.svg" alt="Code" className="w-6 h-6 icon-orange" />
                <span className="theme-accent-text">Code d'invitation</span>
              </h2>

              <div className="invite-code-container">
                <p className="text-sm mb-2 theme-text-secondary">
                  Partagez ce code avec vos amis :
                </p>
                <div className="text-5xl font-bold tracking-wider mb-4 font-mono invite-code-light">
                  {tournamentCode}
                </div>
                <button
                  onClick={copyInviteCode}
                  className="w-full px-4 py-2 rounded-lg transition font-semibold btn-copy-code flex items-center justify-center gap-2"
                >
                  <img src="/images/icons/copy.svg" alt="Copy" className="w-4 h-4 icon-dark" />
                  {copySuccess ? 'Copié !' : 'Copier le code'}
                </button>
              </div>
            </div>

            {/* QR Code */}
            <div className="theme-card">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <img src="/images/icons/qr.svg" alt="QR" className="w-6 h-6 icon-orange" />
                <span className="theme-accent-text">QR Code</span>
              </h2>

              <div className="qr-container border-2 rounded-lg p-6 text-center">
                <div className="bg-white inline-block p-4 rounded-lg">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                      `${window.location.origin}/vestiaire/rejoindre?code=${tournamentCode}`
                    )}`}
                    alt="QR Code"
                    className="w-48 h-48 mx-auto"
                  />
                </div>
                <p className="text-sm theme-text-secondary mt-4">Scannez pour rejoindre le tournoi</p>
                <button
                  onClick={shareUrl}
                  className="w-full mt-4 px-4 py-2 rounded-lg transition font-semibold btn-share flex items-center justify-center gap-2"
                >
                  <img src="/images/icons/share.svg" alt="Share" className="w-4 h-4 icon-dark" />
                  Partager le lien
                </button>
              </div>
            </div>

            {/* Bouton Quitter le tournoi - uniquement pour les non-capitaines */}
            {currentUserId !== tournament?.creator_id && (
              <div className="theme-card mt-6">
                <button
                  onClick={handleLeaveTournament}
                  className="w-full px-4 py-3 bg-[#ff9900] text-[#111] rounded-lg hover:bg-[#e68a00] transition font-semibold flex items-center justify-center gap-2"
                >
                  <img
                    src="/images/icons/dehors.svg"
                    alt=""
                    className="w-5 h-5"
                  />
                  Quitter le tournoi
                </button>
                <p className="text-xs theme-text-secondary text-center mt-2">
                  Vous ne pourrez plus rejoindre ce tournoi après l'avoir quitté
                </p>
              </div>
            )}
          </div>
        </div>

        </div>
      </main>

      {/* Footer ninja-mode */}
      <Footer variant="full" />

      {/* Modal d'avertissement de journées insuffisantes */}
      {matchdayWarning && (
        <MatchdayWarningModal
          isOpen={matchdayWarning.show}
          onClose={handleCancelMatchdayWarning}
          remainingMatchdays={matchdayWarning.remainingMatchdays}
          plannedMatchdays={matchdayWarning.plannedMatchdays}
          currentMatchday={matchdayWarning.currentMatchday}
          totalMatchdays={matchdayWarning.totalMatchdays}
          onStartWithAdjustment={handleStartWithAdjustment}
          onCancel={handleCancelMatchdayWarning}
        />
      )}
    </div>
  )
}

export default function EchauffementPage() {
  return (
    <ThemeProvider>
      <EchauffementPageContent />
    </ThemeProvider>
  )
}
