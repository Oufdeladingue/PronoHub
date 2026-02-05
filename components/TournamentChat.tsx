'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { createClient, fetchWithAuth } from '@/lib/supabase/client'
import { getAvatarUrl } from '@/lib/avatars'

interface Reader {
  user_id: string
  username: string
  avatar: string
}

interface Message {
  id: string
  message: string
  created_at: string
  user_id: string
  username: string
  avatar: string
  readers?: Reader[]
}

interface TournamentChatProps {
  tournamentId: string
  currentUserId: string
  currentUsername: string
  currentUserAvatar: string
}

// Liste d'émojis populaires
const EMOJIS = ['😀', '😂', '😍', '😎', '🤔', '👍', '👎', '🎉', '⚽', '🏆', '🔥', '💪', '👏', '🙌', '😭', '😡', '🤩', '🥳', '😴', '🤯']

export default function TournamentChat({ tournamentId, currentUserId, currentUsername, currentUserAvatar }: TournamentChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [participants, setParticipants] = useState<string[]>([])
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false)
  const [mentionSearch, setMentionSearch] = useState('')
  const [cursorPosition, setCursorPosition] = useState(0)
  const [showReadersModal, setShowReadersModal] = useState(false)
  const [selectedReaders, setSelectedReaders] = useState<Reader[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const supabase = createClient()
  const isFirstLoadRef = useRef(true)

  // Ouvrir la modale des lecteurs (mobile)
  const openReadersModal = (readers: Reader[]) => {
    setSelectedReaders(readers)
    setShowReadersModal(true)
  }

  // Fonction pour formater la date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diffInSeconds < 60) return 'À l\'instant'
    if (diffInSeconds < 3600) return `Il y a ${Math.floor(diffInSeconds / 60)} min'`
    if (diffInSeconds < 86400) return `Il y a ${Math.floor(diffInSeconds / 3600)}h`
    if (diffInSeconds < 604800) return `Il y a ${Math.floor(diffInSeconds / 86400)}j`

    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  }

  // Scroll vers le bas
  const scrollToBottom = (force: boolean = false) => {
    // Toujours scroller vers le bas, même au premier chargement
    messagesEndRef.current?.scrollIntoView({ behavior: force ? 'auto' : 'smooth' })
    isFirstLoadRef.current = false
  }

  // Charger les participants du tournoi
  const fetchParticipants = async () => {
    try {
      const { data } = await supabase
        .from('tournament_participants')
        .select('profiles:user_id(username)')
        .eq('tournament_id', tournamentId)

      if (data) {
        const usernames = data
          .map(p => (p.profiles as any)?.username)
          .filter(Boolean)
          .filter(u => u !== currentUsername) // Ne pas inclure l'utilisateur actuel
        setParticipants(usernames)
      }
    } catch (error) {
      console.error('Error fetching participants:', error)
    }
  }

  // Charger les messages
  const fetchMessages = async () => {
    try {
      const response = await fetchWithAuth(`/api/tournaments/${tournamentId}/messages`)
      if (!response.ok) throw new Error('Failed to fetch messages')

      const data = await response.json()
      setMessages(data.messages || [])
      setLoading(false)

      // Scroll vers le bas après chargement (force au premier chargement)
      setTimeout(() => scrollToBottom(true), 100)
    } catch (error) {
      console.error('Error fetching messages:', error)
      setLoading(false)
    }
  }

  // Détecter les mentions dans le texte
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    const position = e.target.selectionStart

    setNewMessage(value)
    setCursorPosition(position)

    // Vérifier si on est en train de taper une mention
    const textBeforeCursor = value.slice(0, position)
    const match = textBeforeCursor.match(/@(\w*)$/)

    if (match) {
      setMentionSearch(match[1].toLowerCase())
      setShowMentionSuggestions(true)
    } else {
      setShowMentionSuggestions(false)
    }
  }

  // Insérer une mention
  const insertMention = (username: string) => {
    const textBeforeCursor = newMessage.slice(0, cursorPosition)
    const textAfterCursor = newMessage.slice(cursorPosition)
    const beforeMention = textBeforeCursor.replace(/@\w*$/, '')

    const newText = `${beforeMention}@${username} ${textAfterCursor}`
    setNewMessage(newText)
    setShowMentionSuggestions(false)

    // Focus sur l'input
    setTimeout(() => {
      inputRef.current?.focus()
      const newPosition = beforeMention.length + username.length + 2
      inputRef.current?.setSelectionRange(newPosition, newPosition)
    }, 0)
  }

  // Insérer un emoji
  const insertEmoji = (emoji: string) => {
    const position = cursorPosition
    const textBefore = newMessage.slice(0, position)
    const textAfter = newMessage.slice(position)

    setNewMessage(`${textBefore}${emoji}${textAfter}`)
    setShowEmojiPicker(false)

    // Focus sur l'input
    setTimeout(() => {
      inputRef.current?.focus()
      const newPosition = position + emoji.length
      inputRef.current?.setSelectionRange(newPosition, newPosition)
    }, 0)
  }

  // Formater le message avec les mentions
  const formatMessageWithMentions = (text: string) => {
    const parts = text.split(/(@\w+)/g)
    return parts.map((part, index) => {
      if (part.startsWith('@')) {
        const username = part.slice(1)
        const isMentioningCurrentUser = username === currentUsername
        return (
          <span
            key={index}
            className={`font-bold ${
              isMentioningCurrentUser
                ? 'text-[#ff9900] bg-[#ff9900]/20 px-1 rounded'
                : 'text-blue-600 dark:text-blue-400'
            }`}
          >
            {username}
          </span>
        )
      }
      return part
    })
  }

  // Envoyer un message
  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newMessage.trim() || sending) return

    setSending(true)
    try {
      const response = await fetchWithAuth(`/api/tournaments/${tournamentId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: newMessage.trim() })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to send message')
      }

      setNewMessage('')
      setCursorPosition(0)
      // Le message sera ajouté via Realtime
    } catch (error: any) {
      console.error('Error sending message:', error)
      alert(error.message || 'Erreur lors de l\'envoi du message')
    } finally {
      setSending(false)
    }
  }

  // Charger les messages et participants au montage
  useEffect(() => {
    fetchMessages()
    fetchParticipants()
  }, [tournamentId])

  // S'abonner aux nouveaux messages en temps réel
  useEffect(() => {
    const channel = supabase
      .channel(`tournament-${tournamentId}-messages`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tournament_messages',
          filter: `tournament_id=eq.${tournamentId}`
        },
        async (payload) => {
          // Récupérer les infos du profil de l'utilisateur
          const { data: profile } = await supabase
            .from('profiles')
            .select('username, avatar')
            .eq('id', payload.new.user_id)
            .single()

          const newMsg: Message = {
            id: payload.new.id,
            message: payload.new.message,
            created_at: payload.new.created_at,
            user_id: payload.new.user_id,
            username: profile?.username || 'Inconnu',
            avatar: profile?.avatar || 'avatar1'
          }

          setMessages(prev => [...prev, newMsg])
          // Forcer le scroll pour les nouveaux messages
          setTimeout(() => scrollToBottom(true), 100)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tournamentId, supabase])

  if (loading) {
    return (
      <div className="theme-card p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ff9900] mx-auto"></div>
        <p className="theme-text-secondary mt-4">Chargement de la causerie...</p>
      </div>
    )
  }

  return (
    <div className="theme-card flex flex-col max-h-[60vh] md:h-[600px]">
      {/* Zone des messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <p className="theme-text-secondary">Aucun message pour le moment.</p>
            <p className="theme-text-secondary text-sm mt-2">Soyez le premier à écrire !</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isCurrentUser = msg.user_id === currentUserId

            return (
              <div key={msg.id} className="flex gap-3">
                {/* Avatar toujours à gauche */}
                <div className="relative w-8 h-8 rounded-full overflow-hidden border-2 border-[#ff9900] flex-shrink-0">
                  <Image
                    src={getAvatarUrl(msg.avatar)}
                    alt={msg.username}
                    fill
                    className="object-cover"
                    sizes="32px"
                  />
                </div>

                {/* Message */}
                <div className="flex flex-col flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-sm font-bold ${isCurrentUser ? 'text-[#ff9900]' : 'theme-text'}`}>
                      {msg.username}
                    </span>
                    <span className="text-xs theme-text-secondary">dit :</span>
                    <span className="text-xs theme-text-secondary">
                      {formatDate(msg.created_at)}
                    </span>
                  </div>

                  <div className="theme-text text-sm whitespace-pre-wrap break-words">
                    {formatMessageWithMentions(msg.message)}
                  </div>

                  {/* Lecteurs du message */}
                  {msg.readers && msg.readers.length > 0 && (
                    <div className="flex items-center gap-1 mt-1.5">
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 mr-0.5">Lu par</span>
                      <div className="flex -space-x-1.5">
                        {msg.readers.slice(0, 5).map((reader) => (
                          <div
                            key={reader.user_id}
                            className="relative w-5 h-5 rounded-full overflow-hidden border border-gray-300 dark:border-gray-600 opacity-60 cursor-pointer hover:opacity-100 transition-opacity group"
                            onClick={() => openReadersModal(msg.readers || [])}
                            title={reader.username}
                          >
                            <Image
                              src={getAvatarUrl(reader.avatar)}
                              alt={reader.username}
                              fill
                              className="object-cover"
                              sizes="20px"
                            />
                            {/* Tooltip desktop */}
                            <div className="hidden md:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-0.5 bg-gray-800 dark:bg-gray-700 text-white text-[10px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                              {reader.username}
                            </div>
                          </div>
                        ))}
                        {msg.readers.length > 5 && (
                          <div
                            className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-[9px] text-gray-500 dark:text-gray-300 border border-gray-300 dark:border-gray-600 cursor-pointer"
                            onClick={() => openReadersModal(msg.readers || [])}
                          >
                            +{msg.readers.length - 5}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Formulaire d'envoi */}
      <div className="border-t theme-border p-4">
        {/* Suggestions de mentions */}
        {showMentionSuggestions && (
          <div className="mb-2 p-2 bg-gray-100 dark:bg-gray-700 rounded-lg max-h-32 overflow-y-auto">
            {participants
              .filter(p => p.toLowerCase().startsWith(mentionSearch))
              .slice(0, 5)
              .map((username) => (
                <button
                  key={username}
                  onClick={() => insertMention(username)}
                  className="block w-full text-left px-2 py-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-sm text-gray-900 dark:text-gray-100 font-medium cursor-pointer"
                >
                  @{username}
                </button>
              ))}
          </div>
        )}

        {/* Sélecteur d'émojis */}
        {showEmojiPicker && (
          <div className="mb-2 p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
            <div className="grid grid-cols-10 gap-1">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => insertEmoji(emoji)}
                  className="text-2xl hover:scale-125 transition-transform"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={sendMessage} className="flex gap-2">
          {/* Avatar de l'utilisateur */}
          <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-[#ff9900] flex-shrink-0">
            <Image
              src={getAvatarUrl(currentUserAvatar)}
              alt={currentUsername}
              fill
              className="object-cover"
              sizes="40px"
            />
          </div>

          <div className="flex-1 flex flex-col gap-2">
            <div className="flex gap-2">
              <textarea
                ref={inputRef}
                value={newMessage}
                onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendMessage(e)
                  }
                }}
                placeholder="Écrivez votre message..."
                maxLength={500}
                disabled={sending}
                rows={2}
                className="flex-1 theme-input text-sm resize-none"
              />
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="btn-emoji-picker px-3 py-1 rounded-lg transition text-xl"
                  title="Ajouter un emoji"
                >
                  😀
                </button>
                <button
                  type="submit"
                  disabled={!newMessage.trim() || sending}
                  className="btn-send-message px-3 py-2 rounded-lg font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed transition flex items-center justify-center"
                >
                  {sending ? (
                    <span className="text-sm">...</span>
                  ) : (
                    <img src="/images/icons/send.svg" alt="Envoyer" className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
            <p className="text-xs theme-text-secondary">
              {newMessage.length}/500 • @ pour mentionner
            </p>
          </div>
        </form>
      </div>

      {/* Modale lecteurs (mobile) */}
      {showReadersModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowReadersModal(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-xl p-4 max-w-xs w-full max-h-[60vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold theme-text">Lu par</h3>
              <button
                onClick={() => setShowReadersModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                ✕
              </button>
            </div>
            <div className="space-y-2">
              {selectedReaders.map((reader) => (
                <div key={reader.user_id} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                  <div className="relative w-8 h-8 rounded-full overflow-hidden border border-gray-300 dark:border-gray-600">
                    <Image
                      src={getAvatarUrl(reader.avatar)}
                      alt={reader.username}
                      fill
                      className="object-cover"
                      sizes="32px"
                    />
                  </div>
                  <span className="theme-text text-sm font-medium">{reader.username}</span>
                </div>
              ))}
              {selectedReaders.length === 0 && (
                <p className="text-sm theme-text-secondary text-center py-2">Aucun lecteur</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
