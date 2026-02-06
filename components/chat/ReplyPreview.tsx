'use client'

interface ReplyPreviewProps {
  username: string
  message: string
  onClose: () => void
}

export default function ReplyPreview({ username, message, onClose }: ReplyPreviewProps) {
  // Tronquer le message
  const truncatedMessage = message.length > 60 ? message.substring(0, 60) + '...' : message

  return (
    <div className="flex items-center gap-2 p-2 mb-2 bg-gray-100 dark:bg-gray-700/50 rounded-lg border-l-2 border-[#ff9900]">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-xs">
          <svg className="w-3 h-3 text-[#ff9900]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
          <span className="text-[#ff9900] font-medium">Réponse à @{username}</span>
        </div>
        <p className="text-xs theme-text-secondary truncate mt-0.5">{truncatedMessage}</p>
      </div>
      <button
        onClick={onClose}
        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        title="Annuler la réponse"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
