'use client'

interface QuotedMessageProps {
  username: string
  message: string
  onClick?: () => void
}

export default function QuotedMessage({ username, message, onClick }: QuotedMessageProps) {
  // Tronquer le message à 100 caractères
  const truncatedMessage = message.length > 100 ? message.substring(0, 100) + '...' : message

  return (
    <div
      onClick={onClick}
      className={`
        border-l-2 border-[#ff9900] pl-2 py-1 mb-1
        bg-gray-100/50 dark:bg-gray-700/30 rounded-r
        ${onClick ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50' : ''}
      `}
    >
      <span className="text-xs font-semibold text-[#ff9900]">@{username}</span>
      <p className="text-xs theme-text-secondary line-clamp-2">{truncatedMessage}</p>
    </div>
  )
}
