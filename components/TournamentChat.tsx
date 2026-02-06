'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { createClient, fetchWithAuth } from '@/lib/supabase/client'
import { getAvatarUrl } from '@/lib/avatars'
import { QuotedMessage, ReplyPreview, ReactionPicker, MessageReactions } from './chat'

interface Reader {
  user_id: string
  username: string
  avatar: string
}

interface Reaction {
  emoji: string
  count: number
  users: string[]
  hasReacted: boolean
}

interface ReplyTo {
  id: string
  message: string
  username: string
}

interface Message {
  id: string
  message: string
  created_at: string
  user_id: string
  username: string
  avatar: string
  readers?: Reader[]
  reply_to_id?: string | null
  reply_to?: ReplyTo | null
  reactions?: Reaction[]
}

interface TournamentChatProps {
  tournamentId: string
  currentUserId: string
  currentUsername: string
  currentUserAvatar: string
}

// Liste d'émojis populaires pour l'input
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
  // Nouveaux états pour réactions et réponses
  const [replyTo, setReplyTo] = useState<ReplyTo | null>(null)
  const [reactionPickerMessageId, setReactionPickerMessageId] = useState<string | null>(null)
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null)
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
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
    messagesEndRef.current?.scrollIntoView({ behavior: force ? 'auto' : 'smooth' })
    isFirstLoadRef.current = false
  }

  // Scroll vers un message spécifique
  const scrollToMessage = (messageId: string) => {
    const element = document.getElementById(`msg-${messageId}`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // Highlight temporaire
      element.classList.add('bg-[#ff9900]/10')
      setTimeout(() => element.classList.remove('bg-[#ff9900]/10'), 2000)
    }
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
          .filter(u => u !== currentUsername)
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

      setTimeout(() => scrollToBottom(true), 100)
    } catch (error) {
      console.error('Error fetching messages:', error)
      setLoading(false)
    }
  }

  // Toggle réaction sur un message
  const toggleReaction = async (messageId: string, emoji: string) => {
    try {
      const response = await fetchWithAuth(`/api/tournaments/${tournamentId}/messages/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, emoji })
      })

      if (!response.ok) throw new Error('Failed to toggle reaction')

      const result = await response.json()

      // Mettre à jour localement les réactions
      setMessages(prev => prev.map(msg => {
        if (msg.id !== messageId) return msg

        const reactions = [...(msg.reactions || [])]
        const existingIndex = reactions.findIndex(r => r.emoji === emoji)

        if (result.action === 'added') {
          if (existingIndex >= 0) {
            reactions[existingIndex] = {
              ...reactions[existingIndex],
              count: reactions[existingIndex].count + 1,
              users: [...reactions[existingIndex].users, currentUsername],
              hasReacted: true
            }
          } else {
            reactions.push({
              emoji,
              count: 1,
              users: [currentUsername],
              hasReacted: true
            })
          }
        } else if (result.action === 'removed') {
          if (existingIndex >= 0) {
            if (reactions[existingIndex].count <= 1) {
              reactions.splice(existingIndex, 1)
            } else {
              reactions[existingIndex] = {
                ...reactions[existingIndex],
                count: reactions[existingIndex].count - 1,
                users: reactions[existingIndex].users.filter(u => u !== currentUsername),
                hasReacted: false
              }
            }
          }
        }

        return { ...msg, reactions }
      }))
    } catch (error) {
      console.error('Error toggling reaction:', error)
    }
  }

  // Détecter les mentions dans le texte
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    const position = e.target.selectionStart

    setNewMessage(value)
    setCursorPosition(position)

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

  // Répondre à un message
  const handleReply = (msg: Message) => {
    setReplyTo({
      id: msg.id,
      message: msg.message,
      username: msg.username
    })
    inputRef.current?.focus()
  }

  // Gestion du long press pour mobile (réactions)
  const handleTouchStart = (messageId: string) => {
    const timer = setTimeout(() => {
      setReactionPickerMessageId(messageId)
    }, 500)
    setLongPressTimer(timer)
  }

  const handleTouchEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer)
      setLongPressTimer(null)
    }
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
        body: JSON.stringify({
          message: newMessage.trim(),
          reply_to_id: replyTo?.id || null
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to send message')
      }

      setNewMessage('')
      setCursorPosition(0)
      setReplyTo(null)
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

  // S'abonner aux nouveaux messages et réactions en temps réel
  useEffect(() => {
    const messagesChannel = supabase
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
          const { data: profile } = await supabase
            .from('profiles')
            .select('username, avatar')
            .eq('id', payload.new.user_id)
            .single()

          // Récupérer le reply_to si présent
          let replyToData = null
          if (payload.new.reply_to_id) {
            const { data: replyMsg } = await supabase
              .from('tournament_messages')
              .select('id, message, user_id, profiles:user_id(username)')
              .eq('id', payload.new.reply_to_id)
              .single()

            if (replyMsg) {
              replyToData = {
                id: replyMsg.id,
                message: replyMsg.message,
                username: (replyMsg.profiles as any)?.username || 'Inconnu'
              }
            }
          }

          const newMsg: Message = {
            id: payload.new.id,
            message: payload.new.message,
            created_at: payload.new.created_at,
            user_id: payload.new.user_id,
            username: profile?.username || 'Inconnu',
            avatar: profile?.avatar || 'avatar1',
            reply_to_id: payload.new.reply_to_id,
            reply_to: replyToData,
            reactions: []
          }

          setMessages(prev => [...prev, newMsg])
          setTimeout(() => scrollToBottom(true), 100)
        }
      )
      .subscribe()

    // S'abonner aux réactions
    const reactionsChannel = supabase
      .channel(`tournament-${tournamentId}-reactions`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_reactions'
        },
        async (payload) => {
          // Recharger les messages pour avoir les réactions à jour
          // (solution simple, on pourrait optimiser)
          fetchMessages()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(messagesChannel)
      supabase.removeChannel(reactionsChannel)
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
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <p className="theme-text-secondary">Aucun message pour le moment.</p>
            <p className="theme-text-secondary text-sm mt-2">Soyez le premier à écrire !</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isCurrentUser = msg.user_id === currentUserId

            return (
              <div
                key={msg.id}
                id={`msg-${msg.id}`}
                className="flex gap-3 transition-colors duration-500 rounded-lg relative group"
                onMouseEnter={() => setHoveredMessageId(msg.id)}
                onMouseLeave={() => setHoveredMessageId(null)}
                onTouchStart={() => handleTouchStart(msg.id)}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd}
              >
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
                <div className="flex flex-col flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-sm font-bold ${isCurrentUser ? 'text-[#ff9900]' : 'theme-text'}`}>
                      {msg.username}
                    </span>
                    <span className="text-xs theme-text-secondary">dit :</span>
                    <span className="text-xs theme-text-secondary">
                      {formatDate(msg.created_at)}
                    </span>
                    {/* Lecteurs du message */}
                    {msg.readers && msg.readers.length > 0 && (
                      <div className="flex items-center gap-1 ml-1">
                        <span className="text-[10px] text-gray-400 dark:text-gray-500">• Lu par</span>
                        <div className="flex -space-x-1.5">
                          {msg.readers.slice(0, 5).map((reader) => (
                            <div
                              key={reader.user_id}
                              className="relative w-4 h-4 rounded-full overflow-hidden border border-gray-300 dark:border-gray-600 opacity-60 cursor-pointer hover:opacity-100 transition-opacity group/reader"
                              onClick={() => openReadersModal(msg.readers || [])}
                              title={reader.username}
                            >
                              <Image
                                src={getAvatarUrl(reader.avatar)}
                                alt={reader.username}
                                fill
                                className="object-cover"
                                sizes="16px"
                              />
                              <div className="hidden md:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-0.5 bg-gray-800 dark:bg-gray-700 text-white text-[10px] rounded whitespace-nowrap opacity-0 group-hover/reader:opacity-100 transition-opacity pointer-events-none z-10">
                                {reader.username}
                              </div>
                            </div>
                          ))}
                          {msg.readers.length > 5 && (
                            <div
                              className="w-4 h-4 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-[8px] text-gray-500 dark:text-gray-300 border border-gray-300 dark:border-gray-600 cursor-pointer"
                              onClick={() => openReadersModal(msg.readers || [])}
                            >
                              +{msg.readers.length - 5}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Message cité (réponse) */}
                  {msg.reply_to && (
                    <QuotedMessage
                      username={msg.reply_to.username}
                      message={msg.reply_to.message}
                      onClick={() => scrollToMessage(msg.reply_to!.id)}
                    />
                  )}

                  <div className="theme-text text-sm whitespace-pre-wrap break-words">
                    {formatMessageWithMentions(msg.message)}
                  </div>

                  {/* Réactions sous le message */}
                  <MessageReactions
                    reactions={msg.reactions || []}
                    onToggleReaction={(emoji) => toggleReaction(msg.id, emoji)}
                  />
                </div>

                {/* Boutons d'action (desktop: hover, mobile: long press pour reactions) */}
                <div
                  className={`
                    absolute right-0 top-0 flex items-center gap-1
                    transition-opacity duration-200
                    ${hoveredMessageId === msg.id ? 'opacity-100' : 'opacity-0 md:group-hover:opacity-100'}
                  `}
                >
                  {/* Bouton répondre */}
                  <button
                    onClick={() => handleReply(msg)}
                    className="p-1.5 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    title="Répondre"
                  >
                    <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                    </svg>
                  </button>

                  {/* Bouton réaction */}
                  <div className="relative">
                    <button
                      onClick={() => setReactionPickerMessageId(reactionPickerMessageId === msg.id ? null : msg.id)}
                      className="p-1.5 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      title="Réagir"
                    >
                      <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </button>

                    {/* Reaction Picker */}
                    {reactionPickerMessageId === msg.id && (
                      <ReactionPicker
                        onSelect={(emoji) => toggleReaction(msg.id, emoji)}
                        onClose={() => setReactionPickerMessageId(null)}
                        position="top"
                      />
                    )}
                  </div>
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

        {/* Preview de la réponse */}
        {replyTo && (
          <ReplyPreview
            username={replyTo.username}
            message={replyTo.message}
            onClose={() => setReplyTo(null)}
          />
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
                placeholder={replyTo ? `Répondre à @${replyTo.username}...` : 'Écrivez votre message...'}
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
