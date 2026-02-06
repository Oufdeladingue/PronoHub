'use client'

interface Reaction {
  emoji: string
  count: number
  users: string[]
  hasReacted: boolean
}

interface MessageReactionsProps {
  reactions: Reaction[]
  onToggleReaction: (emoji: string) => void
}

export default function MessageReactions({ reactions, onToggleReaction }: MessageReactionsProps) {
  if (!reactions || reactions.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {reactions.map((reaction) => (
        <button
          key={reaction.emoji}
          onClick={() => onToggleReaction(reaction.emoji)}
          title={reaction.users.join(', ')}
          className={`
            inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs
            transition-colors cursor-pointer
            ${reaction.hasReacted
              ? 'bg-[#ff9900]/20 border border-[#ff9900] text-[#ff9900]'
              : 'bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
            }
          `}
        >
          <span>{reaction.emoji}</span>
          <span className={reaction.hasReacted ? 'font-semibold' : 'theme-text-secondary'}>
            {reaction.count}
          </span>
        </button>
      ))}
    </div>
  )
}
