'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

interface DurationExtensionSelectorModalProps {
  isOpen: boolean
  onClose: () => void
  currentEndMatchday: number
  maxCompetitionMatchday: number
  maxAdditional: number
  onConfirm: (matchdaysToAdd: number) => Promise<void>
}

export default function DurationExtensionSelectorModal({
  isOpen,
  onClose,
  currentEndMatchday,
  maxCompetitionMatchday,
  maxAdditional,
  onConfirm
}: DurationExtensionSelectorModalProps) {
  const [selectedMatchdays, setSelectedMatchdays] = useState(maxAdditional)
  const [applying, setApplying] = useState(false)

  if (!isOpen) return null

  const handleConfirm = async () => {
    try {
      setApplying(true)
      await onConfirm(selectedMatchdays)
      onClose()
    } catch (error) {
      console.error('Error applying extension:', error)
    } finally {
      setApplying(false)
    }
  }

  const newEndMatchday = currentEndMatchday + selectedMatchdays

  return (
    <div className="modal-backdrop">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold theme-text">
            Choisir la durée d'extension
          </h2>
          <button
            onClick={onClose}
            disabled={applying}
            className="theme-text-secondary hover:theme-text transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info actuelle */}
        <div className="bg-gray-100 dark:bg-gray-700/50 rounded-lg p-4 mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm theme-text-secondary">Fin actuelle :</span>
            <span className="font-semibold theme-text">Journée {currentEndMatchday}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm theme-text-secondary">Fin de la compétition :</span>
            <span className="font-semibold theme-text">Journée {maxCompetitionMatchday}</span>
          </div>
        </div>

        {/* Curseur */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <label className="text-sm font-medium theme-text">
              Nombre de journées à ajouter
            </label>
            <span className="text-2xl font-bold text-[#ff9900]">
              +{selectedMatchdays}
            </span>
          </div>

          <input
            type="range"
            min="1"
            max={maxAdditional}
            value={selectedMatchdays}
            onChange={(e) => setSelectedMatchdays(parseInt(e.target.value))}
            disabled={applying}
            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[#ff9900]"
          />

          <div className="flex justify-between text-xs theme-text-secondary mt-2">
            <span>1 journée</span>
            <span>{maxAdditional} journées (max)</span>
          </div>
        </div>

        {/* Nouvelle fin */}
        <div className="bg-[#ff9900]/10 border border-[#ff9900]/20 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium theme-text">
              Nouvelle fin du tournoi :
            </span>
            <span className="text-lg font-bold text-[#ff9900]">
              Journée {newEndMatchday}
            </span>
          </div>
          <p className="text-xs theme-text-secondary mt-2">
            Votre tournoi sera prolongé de <strong className="text-[#ff9900]">{selectedMatchdays} journée{selectedMatchdays > 1 ? 's' : ''}</strong>
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={applying}
            className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg theme-text hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors font-medium disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={handleConfirm}
            disabled={applying}
            className="flex-1 px-4 py-3 bg-[#ff9900] hover:bg-[#ff9900]/90 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {applying ? 'Application...' : 'Confirmer'}
          </button>
        </div>
      </div>
    </div>
  )
}
