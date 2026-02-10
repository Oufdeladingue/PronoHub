'use client'

import { useState, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'

// Import dynamique pour éviter les erreurs SSR
const Picker = dynamic(
  () => import('emoji-picker-react').then(mod => mod.default),
  { ssr: false }
)

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void
}

export default function EmojiPicker({ onEmojiSelect }: EmojiPickerProps) {
  const [showPicker, setShowPicker] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  // Fermer le picker si on clique dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setShowPicker(false)
      }
    }

    if (showPicker) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showPicker])

  const handleEmojiClick = (emojiObject: any) => {
    onEmojiSelect(emojiObject.emoji)
    setShowPicker(false)
  }

  return (
    <div className="relative" ref={pickerRef}>
      <button
        type="button"
        onClick={() => setShowPicker(!showPicker)}
        className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
        title="Ajouter un emoji"
      >
        😀 Emoji
      </button>

      {showPicker && (
        <div className="absolute z-50 mt-2">
          <Picker
            onEmojiClick={handleEmojiClick}
            width={320}
            height={400}
          />
        </div>
      )}
    </div>
  )
}
