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

  const isCaptain = currentUserId === creatorId
  const canEdit = isCaptain && tournamentStatus === 'pending'

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
          {/* Liste des equipes */}
          <div className="space-y-4 mb-4">
            {teams.map(team => (
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
          {unassignedPlayers.length === 0 && teams.length > 0 && (
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
        </>
      )}
    </div>
  )
}
