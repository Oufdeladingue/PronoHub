'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { getAvatarUrl } from '@/lib/avatars'

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

interface TeamMember {
  id: string
  userId: string
  username: string
  avatar: string
  joinedAt: string
}

interface Team {
  id: string
  name: string
  avatar: string
  members: TeamMember[]
}

interface TeamRequest {
  id: string
  userId: string
  username: string
  avatar: string
  requestType: 'join' | 'suggest'
  status: 'pending' | 'approved' | 'rejected'
  message: string | null
  captainResponse: string | null
  createdAt: string
  processedAt: string | null
  targetTeamId: string | null
  targetTeamName: string | null
  targetTeamAvatar: string | null
  suggestedTeamName: string | null
  suggestedTeamAvatar: string | null
}

interface TeamsManagerProps {
  tournamentId: string
  tournamentType: string
  players: Player[]
  currentUserId: string | null
  creatorId: string
  tournamentStatus: string
  onTeamsChange?: () => void
}

// Liste des avatars d'équipe disponibles (8 couleurs distinctes)
const TEAM_AVATARS = [
  'team1', 'team2', 'team3', 'team4',
  'team5', 'team6', 'team7', 'team8'
]

export default function TeamsManager({
  tournamentId,
  tournamentType,
  players,
  currentUserId,
  creatorId,
  tournamentStatus,
  onTeamsChange
}: TeamsManagerProps) {
  const [teamsEnabled, setTeamsEnabled] = useState(false)
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [newTeamName, setNewTeamName] = useState('')
  const [newTeamAvatar, setNewTeamAvatar] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingTeam, setEditingTeam] = useState<string | null>(null)
  const [editTeamName, setEditTeamName] = useState('')
  const [editTeamAvatar, setEditTeamAvatar] = useState('')
  const [draggedPlayer, setDraggedPlayer] = useState<Player | null>(null)

  // States pour les demandes d'équipe (joueurs non-capitaines)
  const [teamRequests, setTeamRequests] = useState<TeamRequest[]>([])
  const [myPendingRequest, setMyPendingRequest] = useState<TeamRequest | null>(null)
  const [showSuggestModal, setShowSuggestModal] = useState(false)
  const [suggestTeamName, setSuggestTeamName] = useState('')
  const [suggestTeamAvatar, setSuggestTeamAvatar] = useState('team1')
  const [requestLoading, setRequestLoading] = useState(false)
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0)

  // States pour le modal de gestion des demandes (capitaine)
  const [showRequestsModal, setShowRequestsModal] = useState(false)
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null)

  const isCaptain = currentUserId === creatorId
  const canEdit = isCaptain && tournamentStatus === 'pending'
  const isPlayer = !isCaptain && tournamentStatus === 'pending' && currentUserId

  // Types de tournois qui supportent les equipes
  const supportsTeams = tournamentType === 'elite' || tournamentType === 'platinium'

  // Calculer les avatars deja utilises par les equipes existantes
  const usedAvatars = new Set(teams.map(t => t.avatar))

  // Obtenir les avatars disponibles (non utilises)
  const getAvailableAvatars = (excludeTeamId?: string) => {
    const used = new Set(teams.filter(t => t.id !== excludeTeamId).map(t => t.avatar))
    return TEAM_AVATARS.filter(avatar => !used.has(avatar))
  }

  // Obtenir le premier avatar disponible
  const getFirstAvailableAvatar = (excludeTeamId?: string) => {
    const available = getAvailableAvatars(excludeTeamId)
    return available.length > 0 ? available[0] : 'team1'
  }

  useEffect(() => {
    if (supportsTeams) {
      fetchTeams()
      fetchTeamRequests()
    }
  }, [tournamentId, supportsTeams])

  const fetchTeams = async () => {
    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/teams`)
      const data = await response.json()

      if (response.ok) {
        setTeamsEnabled(data.teamsEnabled)
        setTeams(data.teams || [])
      }
    } catch (error) {
      console.error('Error fetching teams:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchTeamRequests = async () => {
    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/team-requests`)
      const data = await response.json()

      if (response.ok) {
        setTeamRequests(data.requests || [])
        setPendingRequestsCount(data.pendingCount || 0)

        // Trouver ma demande en attente
        const myPending = (data.requests || []).find(
          (r: TeamRequest) => r.userId === currentUserId && r.status === 'pending'
        )
        setMyPendingRequest(myPending || null)
      }
    } catch (error) {
      console.error('Error fetching team requests:', error)
    }
  }

  // Postuler pour rejoindre une équipe
  const applyToTeam = async (teamId: string) => {
    if (!isPlayer || myPendingRequest) return

    setRequestLoading(true)
    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/team-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestType: 'join',
          targetTeamId: teamId
        })
      })

      const data = await response.json()

      if (response.ok) {
        fetchTeamRequests()
      } else {
        alert(data.error || 'Erreur lors de la demande')
      }
    } catch (error) {
      console.error('Error applying to team:', error)
    } finally {
      setRequestLoading(false)
    }
  }

  // Suggérer une nouvelle équipe
  const suggestTeam = async () => {
    if (!isPlayer || myPendingRequest || !suggestTeamName.trim()) return

    setRequestLoading(true)
    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/team-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestType: 'suggest',
          suggestedTeamName: suggestTeamName.trim(),
          suggestedTeamAvatar: suggestTeamAvatar
        })
      })

      const data = await response.json()

      if (response.ok) {
        setShowSuggestModal(false)
        setSuggestTeamName('')
        setSuggestTeamAvatar('team1')
        fetchTeamRequests()
      } else {
        alert(data.error || 'Erreur lors de la suggestion')
      }
    } catch (error) {
      console.error('Error suggesting team:', error)
    } finally {
      setRequestLoading(false)
    }
  }

  // Annuler ma demande
  const cancelMyRequest = async () => {
    if (!myPendingRequest) return

    setRequestLoading(true)
    try {
      const response = await fetch(
        `/api/tournaments/${tournamentId}/team-requests?requestId=${myPendingRequest.id}`,
        { method: 'DELETE' }
      )

      if (response.ok) {
        setMyPendingRequest(null)
        fetchTeamRequests()
      }
    } catch (error) {
      console.error('Error cancelling request:', error)
    } finally {
      setRequestLoading(false)
    }
  }

  // Traiter une demande (capitaine)
  const processRequest = async (requestId: string, action: 'approve' | 'reject', options?: { teamName?: string; teamAvatar?: string; targetTeamId?: string }) => {
    setProcessingRequestId(requestId)
    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/team-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          ...options
        })
      })

      const data = await response.json()

      if (response.ok) {
        fetchTeamRequests()
        fetchTeams()
        onTeamsChange?.()
      } else {
        alert(data.error || 'Erreur lors du traitement')
      }
    } catch (error) {
      console.error('Error processing request:', error)
    } finally {
      setProcessingRequestId(null)
    }
  }

  // Vérifier si le joueur actuel est dans une équipe
  const isCurrentUserInTeam = () => {
    return teams.some(team => team.members.some(m => m.userId === currentUserId))
  }

  // Obtenir l'équipe du joueur actuel
  const getCurrentUserTeam = () => {
    return teams.find(team => team.members.some(m => m.userId === currentUserId))
  }

  const toggleTeamsEnabled = async () => {
    if (!canEdit) return

    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/teams`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamsEnabled: !teamsEnabled })
      })

      if (response.ok) {
        setTeamsEnabled(!teamsEnabled)
      }
    } catch (error) {
      console.error('Error toggling teams:', error)
    }
  }

  const createTeam = async () => {
    if (!canEdit || !newTeamName.trim()) return

    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTeamName.trim().slice(0, 15),
          avatar: newTeamAvatar
        })
      })

      if (response.ok) {
        const data = await response.json()
        setTeams([...teams, { ...data.team, members: [] }])
        setNewTeamName('')
        setNewTeamAvatar('')
        setShowCreateForm(false)
      } else {
        const data = await response.json()
        alert(data.error || 'Erreur lors de la création de l\'équipe')
      }
    } catch (error) {
      console.error('Error creating team:', error)
    }
  }

  const updateTeam = async (teamId: string) => {
    if (!canEdit || !editTeamName.trim()) return

    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/teams/${teamId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editTeamName.trim().slice(0, 15),
          avatar: editTeamAvatar
        })
      })

      if (response.ok) {
        setTeams(teams.map(t =>
          t.id === teamId ? { ...t, name: editTeamName.trim().slice(0, 15), avatar: editTeamAvatar } : t
        ))
        setEditingTeam(null)
      }
    } catch (error) {
      console.error('Error updating team:', error)
    }
  }

  const deleteTeam = async (teamId: string) => {
    if (!canEdit) return
    if (!confirm('Supprimer cette équipe ? Les membres seront retirés.')) return

    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/teams/${teamId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setTeams(teams.filter(t => t.id !== teamId))
      }
    } catch (error) {
      console.error('Error deleting team:', error)
    }
  }

  const addMemberToTeam = async (teamId: string, userId: string) => {
    if (!canEdit) return

    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/teams/${teamId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      })

      if (response.ok) {
        // Rafraichir les donnees
        fetchTeams()
        // Notifier le parent du changement
        onTeamsChange?.()
      } else {
        const data = await response.json()
        alert(data.error || 'Erreur lors de l\'ajout du membre')
      }
    } catch (error) {
      console.error('Error adding member:', error)
    }
  }

  const removeMemberFromTeam = async (teamId: string, userId: string) => {
    if (!canEdit) return

    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/teams/${teamId}/members?userId=${userId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        fetchTeams()
        // Notifier le parent du changement
        onTeamsChange?.()
      }
    } catch (error) {
      console.error('Error removing member:', error)
    }
  }

  // Drag & Drop handlers
  const handleDragStart = (e: React.DragEvent, player: Player) => {
    setDraggedPlayer(player)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent, teamId: string) => {
    e.preventDefault()
    if (draggedPlayer && canEdit) {
      addMemberToTeam(teamId, draggedPlayer.user_id)
    }
    setDraggedPlayer(null)
  }

  const handleDragEnd = () => {
    setDraggedPlayer(null)
  }

  // Trouver les joueurs non assignes a une equipe
  const getUnassignedPlayers = () => {
    const assignedUserIds = new Set<string>()
    teams.forEach(team => {
      team.members.forEach(member => {
        assignedUserIds.add(member.userId)
      })
    })
    return players.filter(p => !assignedUserIds.has(p.user_id))
  }

  // Ne pas afficher si le type de tournoi ne supporte pas les equipes
  if (!supportsTeams) {
    return null
  }

  if (loading) {
    return (
      <div className="theme-card animate-pulse">
        <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
        <div className="h-20 bg-gray-300 dark:bg-gray-700 rounded"></div>
      </div>
    )
  }

  const unassignedPlayers = getUnassignedPlayers()

  return (
    <div className="theme-card">
      {/* Header avec toggle */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="theme-accent-text">
            <path d="M17 20C17 18.3431 14.7614 17 12 17C9.23858 17 7 18.3431 7 20M21 17.0004C21 15.7702 19.7659 14.7129 18 14.25M3 17.0004C3 15.7702 4.2341 14.7129 6 14.25M18 10.2361C18.6137 9.68679 19 8.8885 19 8C19 6.34315 17.6569 5 16 5C15.2316 5 14.5308 5.28885 14 5.76389M6 10.2361C5.38625 9.68679 5 8.8885 5 8C5 6.34315 6.34315 5 8 5C8.76835 5 9.46924 5.28885 10 5.76389M12 14C10.3431 14 9 12.6569 9 11C9 9.34315 10.3431 8 12 8C13.6569 8 15 9.34315 15 11C15 12.6569 13.6569 14 12 14Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="theme-accent-text">Équipes</span>
        </h2>

        {/* Toggle pour activer/desactiver les equipes (capitaine uniquement) */}
        {canEdit && (
          <button
            onClick={toggleTeamsEnabled}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              teamsEnabled ? 'bg-[#ff9900]' : 'bg-gray-400'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                teamsEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        )}
      </div>

      {/* Message si desactive */}
      {!teamsEnabled && (
        <div className="text-center py-6 theme-text-secondary">
          <p className="text-sm">
            {canEdit
              ? 'Activez les équipes pour permettre aux participants de jouer en groupe'
              : 'Le mode équipe n\'est pas activé pour ce tournoi'}
          </p>
        </div>
      )}

      {/* Contenu si active */}
      {teamsEnabled && (
        <>
          {/* Liste des equipes - l'équipe de l'utilisateur actuel en premier */}
          <div className="space-y-4 mb-4">
            {[...teams]
              .sort((a, b) => {
                const aHasUser = a.members.some(m => m.userId === currentUserId)
                const bHasUser = b.members.some(m => m.userId === currentUserId)
                if (aHasUser && !bHasUser) return -1
                if (!aHasUser && bHasUser) return 1
                return 0
              })
              .map(team => (
              <div
                key={team.id}
                className={`rounded-lg p-3 border-2 ${canEdit ? 'dark-bg-primary dark-border-primary' : 'team-card-viewer'}`}
                onDragOver={canEdit ? handleDragOver : undefined}
                onDrop={canEdit ? (e) => handleDrop(e, team.id) : undefined}
              >
                {/* Header de l'equipe */}
                {editingTeam === team.id ? (
                  <div className="flex flex-col gap-2 mb-3">
                    <input
                      type="text"
                      value={editTeamName}
                      onChange={(e) => setEditTeamName(e.target.value)}
                      maxLength={15}
                      className="px-2 py-1 rounded border theme-border theme-bg theme-text text-sm"
                      placeholder="Nom de l'équipe"
                    />
                    <div className="flex gap-1 flex-wrap">
                      {TEAM_AVATARS.map(avatar => {
                        const isUsedByOther = teams.some(t => t.id !== team.id && t.avatar === avatar)
                        return (
                          <button
                            key={avatar}
                            type="button"
                            onClick={() => !isUsedByOther && setEditTeamAvatar(avatar)}
                            disabled={isUsedByOther}
                            className={`w-7 h-7 rounded border-2 ${
                              editTeamAvatar === avatar ? 'border-[#ff9900]' : 'border-transparent'
                            } ${isUsedByOther ? 'opacity-30 cursor-not-allowed' : ''}`}
                            title={isUsedByOther ? 'Avatar déjà utilisé' : avatar}
                          >
                            <img
                              src={`/images/team-avatars/${avatar}.svg`}
                              alt={avatar}
                              className="w-full h-full"
                            />
                          </button>
                        )
                      })}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateTeam(team.id)}
                        className="px-2 py-1 bg-green-600 text-white rounded text-sm"
                      >
                        OK
                      </button>
                      <button
                        onClick={() => setEditingTeam(null)}
                        className="px-2 py-1 bg-gray-500 text-white rounded text-sm"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <img
                          src={`/images/team-avatars/${team.avatar}.svg`}
                          alt={team.name}
                          className="w-10 h-10"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/images/team-avatars/team1.svg'
                          }}
                        />
                        <div>
                          <span className="font-bold theme-text">{team.name}</span>
                          <span className="text-xs theme-text-secondary ml-2">({team.members.length} membre{team.members.length > 1 ? 's' : ''})</span>
                        </div>
                      </div>
                      {canEdit && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingTeam(team.id)
                              setEditTeamName(team.name)
                              setEditTeamAvatar(team.avatar)
                            }}
                            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                            title="Modifier"
                          >
                            <svg className="w-4 h-4 theme-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => deleteTeam(team.id)}
                            className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-500"
                            title="Supprimer"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                    {/* Trait de séparation */}
                    <div className="team-header-separator" />
                  </div>
                )}

                {/* Membres de l'équipe */}
                <div className={canEdit ? 'space-y-2' : 'flex flex-wrap gap-2 pl-3'}>
                  {team.members.length === 0 ? (
                    canEdit ? (
                      <div className={`text-center py-4 border-2 border-dashed rounded-lg ${
                        draggedPlayer ? 'border-[#ff9900] bg-[#ff9900]/10' : 'theme-border'
                      }`}>
                        <p className="text-sm theme-text-secondary">
                          Glissez des joueurs ici
                        </p>
                      </div>
                    ) : null
                  ) : canEdit ? (
                    team.members.map(member => (
                      <div
                        key={member.id}
                        className="flex items-center gap-2 p-2 team-member-item rounded"
                      >
                        <div className="relative w-8 h-8 rounded-full overflow-hidden border border-[#ff9900]">
                          <Image
                            src={getAvatarUrl(member.avatar)}
                            alt={member.username}
                            fill
                            className="object-cover"
                            sizes="32px"
                          />
                        </div>
                        <span className={`flex-1 text-sm ${member.userId === currentUserId ? 'team-member-current-user' : 'theme-text'}`}>{member.username}</span>
                        <button
                          onClick={() => removeMemberFromTeam(team.id, member.userId)}
                          className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-500"
                          title="Retirer"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))
                  ) : (
                    /* Affichage compact pour les non-capitaines */
                    team.members.map(member => (
                      <div
                        key={member.id}
                        className="flex items-center gap-2 px-2 py-1 team-member-chip rounded-full"
                        title={member.username}
                      >
                        <div className="relative w-6 h-6 rounded-full overflow-hidden border border-[#ff9900]">
                          <Image
                            src={getAvatarUrl(member.avatar)}
                            alt={member.username}
                            fill
                            className="object-cover"
                            sizes="24px"
                          />
                        </div>
                        <span className={`text-sm ${member.userId === currentUserId ? 'team-member-current-user' : 'theme-text'}`}>{member.username}</span>
                      </div>
                    ))
                  )}
                </div>

                {/* Bouton Postuler à cette équipe (joueurs non-capitaines) */}
                {isPlayer && !team.members.some(m => m.userId === currentUserId) && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    {myPendingRequest?.targetTeamId === team.id ? (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-yellow-500 flex items-center gap-1">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/>
                          </svg>
                          Demande en attente
                        </span>
                        <button
                          onClick={cancelMyRequest}
                          disabled={requestLoading}
                          className="text-xs px-2 py-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                        >
                          Annuler
                        </button>
                      </div>
                    ) : !myPendingRequest ? (
                      <button
                        onClick={() => applyToTeam(team.id)}
                        disabled={requestLoading}
                        className="w-full px-3 py-2 text-sm bg-[#ff9900]/10 text-[#ff9900] rounded-lg hover:bg-[#ff9900]/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                        Postuler à cette équipe
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Bouton ajouter equipe (capitaine uniquement) */}
          {canEdit && (
            <div className="mb-4">
              {showCreateForm ? (
                <div className="dark-bg-primary dark-border-primary border-2 rounded-lg p-3">
                  <div className="flex flex-col gap-2">
                    <input
                      type="text"
                      value={newTeamName}
                      onChange={(e) => setNewTeamName(e.target.value)}
                      maxLength={15}
                      className="px-3 py-2 rounded border theme-border theme-bg theme-text"
                      placeholder="Nom de l'équipe (max 15 car.)"
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-sm theme-text-secondary">Avatar:</span>
                      <div className="flex gap-1 flex-wrap">
                        {TEAM_AVATARS.map(avatar => {
                          const isUsed = usedAvatars.has(avatar)
                          return (
                            <button
                              key={avatar}
                              onClick={() => !isUsed && setNewTeamAvatar(avatar)}
                              disabled={isUsed}
                              className={`w-8 h-8 rounded border-2 ${
                                newTeamAvatar === avatar ? 'border-[#ff9900]' : 'border-transparent'
                              } ${isUsed ? 'opacity-30 cursor-not-allowed' : ''}`}
                              title={isUsed ? 'Avatar déjà utilisé' : avatar}
                            >
                              <img
                                src={`/images/team-avatars/${avatar}.svg`}
                                alt={avatar}
                                className="w-full h-full"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = '/images/team-avatars/team1.svg'
                                }}
                              />
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={createTeam}
                        disabled={!newTeamName.trim()}
                        className="flex-1 px-3 py-2 bg-[#ff9900] text-[#111] rounded font-semibold hover:bg-[#e68a00] transition disabled:opacity-50"
                      >
                        Créer l'équipe
                      </button>
                      <button
                        onClick={() => setShowCreateForm(false)}
                        className="px-3 py-2 bg-gray-500 text-white rounded font-semibold hover:bg-gray-600 transition"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setNewTeamAvatar(getFirstAvailableAvatar())
                    setShowCreateForm(true)
                  }}
                  className="w-full px-4 py-3 border-2 border-dashed theme-border rounded-lg hover:border-[#ff9900] transition flex items-center justify-center gap-2"
                >
                  <span className="text-xl theme-accent-text">+</span>
                  <span className="theme-accent-text font-semibold">Créer une équipe</span>
                </button>
              )}
            </div>
          )}

          {/* Joueurs non assignes (draggable) - visible uniquement pour le capitaine */}
          {canEdit && unassignedPlayers.length > 0 && (
            <div className="border-t-2 theme-border pt-4">
              <h3 className="text-sm font-semibold theme-text-secondary mb-2">
                Joueurs sans équipe ({unassignedPlayers.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {unassignedPlayers.map(player => (
                  <div
                    key={player.id}
                    draggable={true}
                    onDragStart={(e) => handleDragStart(e, player)}
                    onDragEnd={handleDragEnd}
                    className="flex items-center gap-2 px-3 py-2 team-member-item rounded-full cursor-grab active:cursor-grabbing"
                  >
                    <div className="relative w-6 h-6 rounded-full overflow-hidden border border-[#ff9900]">
                      <Image
                        src={getAvatarUrl(player.profiles?.avatar || 'avatar1')}
                        alt={player.profiles?.username || 'Joueur'}
                        fill
                        className="object-cover"
                        sizes="24px"
                      />
                    </div>
                    <span className="text-sm theme-text">{player.profiles?.username || 'Joueur'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Message si tous les joueurs sont assignes */}
          {unassignedPlayers.length === 0 && teams.length > 0 && !isPlayer && (
            <div className="text-center py-3">
              <div className="text-green-500 text-sm">
                <svg className="w-5 h-5 inline mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
                Tous les joueurs sont dans une équipe
              </div>
              <p className="text-xs theme-text-secondary mt-2">Faîtes glisser les joueurs dans leurs équipes</p>
            </div>
          )}

          {/* Bouton Suggérer une équipe (joueurs non-capitaines) */}
          {isPlayer && (
            <div className="border-t-2 theme-border pt-4 mt-4">
              {myPendingRequest?.requestType === 'suggest' ? (
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-yellow-500 font-semibold flex items-center gap-1">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/>
                      </svg>
                      Suggestion en attente
                    </span>
                    <button
                      onClick={cancelMyRequest}
                      disabled={requestLoading}
                      className="text-xs px-2 py-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                    >
                      Annuler
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <img
                      src={`/images/team-avatars/${myPendingRequest.suggestedTeamAvatar || 'team1'}.svg`}
                      alt=""
                      className="w-8 h-8"
                    />
                    <span className="theme-text font-medium">{myPendingRequest.suggestedTeamName}</span>
                  </div>
                </div>
              ) : !myPendingRequest ? (
                <button
                  onClick={() => {
                    setSuggestTeamAvatar(getFirstAvailableAvatar())
                    setShowSuggestModal(true)
                  }}
                  className="w-full px-4 py-3 border-2 border-dashed border-[#ff9900]/50 rounded-lg hover:border-[#ff9900] hover:bg-[#ff9900]/5 transition flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5 text-[#ff9900]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span className="text-[#ff9900] font-semibold">Suggérer une équipe</span>
                </button>
              ) : null}
            </div>
          )}

          {/* Bouton Gérer les demandes (capitaine) */}
          {canEdit && pendingRequestsCount > 0 && (
            <div className="border-t-2 theme-border pt-4 mt-4">
              <button
                onClick={() => setShowRequestsModal(true)}
                className="w-full px-4 py-3 bg-[#ff9900] text-[#111] rounded-lg hover:bg-[#e68a00] transition flex items-center justify-center gap-2 font-semibold"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                Demandes en attente
                <span className="ml-1 px-2 py-0.5 bg-white/20 rounded-full text-sm">{pendingRequestsCount}</span>
              </button>
            </div>
          )}
        </>
      )}

      {/* Modal Suggérer une équipe */}
      {showSuggestModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="theme-card rounded-lg shadow-2xl max-w-md w-full p-6 animate-in border-2 border-[#ff9900]">
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold theme-text mb-2">Suggérer une équipe</h3>
              <p className="text-sm theme-text-secondary">
                Proposez une nouvelle équipe au capitaine
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium theme-text mb-1">Nom de l'équipe</label>
                <input
                  type="text"
                  value={suggestTeamName}
                  onChange={(e) => setSuggestTeamName(e.target.value)}
                  maxLength={15}
                  className="w-full px-3 py-2 rounded border theme-border theme-bg theme-text"
                  placeholder="Ex: Les Champions"
                />
                <p className="text-xs theme-text-secondary mt-1">{suggestTeamName.length}/15 caractères</p>
              </div>

              <div>
                <label className="block text-sm font-medium theme-text mb-2">Avatar</label>
                <div className="flex gap-2 flex-wrap">
                  {TEAM_AVATARS.map(avatar => {
                    const isUsed = usedAvatars.has(avatar)
                    return (
                      <button
                        key={avatar}
                        onClick={() => !isUsed && setSuggestTeamAvatar(avatar)}
                        disabled={isUsed}
                        className={`w-10 h-10 rounded border-2 ${
                          suggestTeamAvatar === avatar ? 'border-[#ff9900]' : 'border-transparent'
                        } ${isUsed ? 'opacity-30 cursor-not-allowed' : ''}`}
                        title={isUsed ? 'Avatar déjà utilisé' : ''}
                      >
                        <img
                          src={`/images/team-avatars/${avatar}.svg`}
                          alt={avatar}
                          className="w-full h-full"
                        />
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowSuggestModal(false)
                  setSuggestTeamName('')
                }}
                className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition font-semibold"
              >
                Annuler
              </button>
              <button
                onClick={suggestTeam}
                disabled={!suggestTeamName.trim() || requestLoading}
                className="flex-1 px-4 py-3 bg-[#ff9900] text-[#111] rounded-lg hover:bg-[#e68a00] transition font-semibold disabled:opacity-50"
              >
                {requestLoading ? 'Envoi...' : 'Suggérer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Gérer les demandes (capitaine) */}
      {showRequestsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="theme-card rounded-lg shadow-2xl max-w-lg w-full p-6 animate-in border-2 border-[#ff9900] max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold theme-text">Demandes d'équipe</h3>
              <button
                onClick={() => setShowRequestsModal(false)}
                className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
              >
                <svg className="w-5 h-5 theme-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {teamRequests.filter(r => r.status === 'pending').length === 0 ? (
                <p className="text-center theme-text-secondary py-8">Aucune demande en attente</p>
              ) : (
                teamRequests.filter(r => r.status === 'pending').map(request => (
                  <div key={request.id} className="p-4 dark-bg-primary dark-border-primary border-2 rounded-lg">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-[#ff9900]">
                        <Image
                          src={getAvatarUrl(request.avatar)}
                          alt={request.username}
                          fill
                          className="object-cover"
                          sizes="40px"
                        />
                      </div>
                      <div>
                        <p className="font-semibold theme-text">{request.username}</p>
                        <p className="text-xs theme-text-secondary">
                          {new Date(request.createdAt).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>

                    {request.requestType === 'join' ? (
                      <div className="mb-3 p-2 bg-blue-500/10 rounded">
                        <p className="text-sm theme-text">
                          Souhaite rejoindre <span className="font-semibold">{request.targetTeamName}</span>
                        </p>
                      </div>
                    ) : (
                      <div className="mb-3 p-2 bg-purple-500/10 rounded">
                        <p className="text-sm theme-text mb-2">Suggère une nouvelle équipe :</p>
                        <div className="flex items-center gap-2">
                          <img
                            src={`/images/team-avatars/${request.suggestedTeamAvatar || 'team1'}.svg`}
                            alt=""
                            className="w-8 h-8"
                          />
                          <span className="font-semibold theme-text">{request.suggestedTeamName}</span>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={() => processRequest(request.id, 'approve')}
                        disabled={processingRequestId === request.id}
                        className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-semibold disabled:opacity-50"
                      >
                        {processingRequestId === request.id ? '...' : 'Approuver'}
                      </button>
                      <button
                        onClick={() => processRequest(request.id, 'reject')}
                        disabled={processingRequestId === request.id}
                        className="flex-1 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-semibold disabled:opacity-50"
                      >
                        Refuser
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => setShowRequestsModal(false)}
              className="w-full mt-6 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition font-semibold"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
