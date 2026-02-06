'use client'

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🎉']

interface ReactionPickerProps {
  onSelect: (emoji: string) => void
  onClose: () => void
  position?: 'top' | 'bottom'
}

export default function ReactionPicker({ onSelect, onClose, position = 'top' }: ReactionPickerProps) {
  return (
    <>
      {/* Backdrop invisible pour fermer */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />

      {/* Picker */}
      <div
        className={`
          absolute z-50 flex items-center gap-1 p-1.5
          bg-white dark:bg-gray-800 rounded-full shadow-lg
          border border-gray-200 dark:border-gray-600
          ${position === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'}
          left-0
        `}
      >
        {REACTION_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => {
              onSelect(emoji)
              onClose()
            }}
            className="w-8 h-8 flex items-center justify-center text-xl hover:scale-125 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-transform"
          >
            {emoji}
          </button>
        ))}
      </div>
    </>
  )
}
