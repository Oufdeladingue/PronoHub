'use client'

import { AlertTriangle, Calendar, TrendingDown } from 'lucide-react'

interface MatchdayWarningModalProps {
  isOpen: boolean
  onClose: () => void
  remainingMatchdays: number
  plannedMatchdays: number
  currentMatchday: number
  totalMatchdays: number
  onStartWithAdjustment: () => void
  onCancel: () => void
}

export default function MatchdayWarningModal({
  isOpen,
  onClose,
  remainingMatchdays,
  plannedMatchdays,
  currentMatchday,
  totalMatchdays,
  onStartWithAdjustment,
  onCancel
}: MatchdayWarningModalProps) {
  if (!isOpen) return null

  const canAdjust = remainingMatchdays > 0

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-yellow-500 to-orange-500 p-6 rounded-t-xl">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-full backdrop-blur-sm">
              <AlertTriangle className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">
                Attention : Ajustement requis
              </h2>
              <p className="text-white/90 text-sm mt-1">
                Nombre de journées insuffisant
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Situation actuelle */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-gray-700">
                <Calendar className="w-5 h-5" />
                <span className="font-medium">Situation actuelle</span>
              </div>
              <span className="text-sm text-gray-500">
                Journée {currentMatchday}/{totalMatchdays}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="bg-white rounded-lg p-3 border-2 border-red-200">
                <div className="text-red-600 text-sm font-medium mb-1">
                  Tours prévus
                </div>
                <div className="text-3xl font-bold text-red-700">
                  {plannedMatchdays}
                </div>
              </div>

              <div className="bg-white rounded-lg p-3 border-2 border-orange-200">
                <div className="text-orange-600 text-sm font-medium mb-1">
                  Journées restantes
                </div>
                <div className="text-3xl font-bold text-orange-700">
                  {remainingMatchdays}
                </div>
              </div>
            </div>
          </div>

          {/* Explication */}
          <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
            <div className="flex gap-3">
              <TrendingDown className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900">
                <p className="font-medium mb-2">Que s'est-il passé ?</p>
                <p className="text-blue-800">
                  Entre la création de votre tournoi et maintenant, la compétition a continué.
                  Il ne reste plus que <strong>{remainingMatchdays} journée(s)</strong> de championnat,
                  alors que vous aviez prévu <strong>{plannedMatchdays} tours</strong>.
                </p>
              </div>
            </div>
          </div>

          {/* Options */}
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900 text-lg">
              Que souhaitez-vous faire ?
            </h3>

            {canAdjust ? (
              <>
                {/* Option 1 : Ajuster */}
                <button
                  onClick={onStartWithAdjustment}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold py-4 px-6 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 flex items-center justify-between group"
                >
                  <div className="text-left">
                    <div className="text-lg">
                      Démarrer avec {remainingMatchdays} tours
                    </div>
                    <div className="text-sm text-white/80 mt-1">
                      Ajuster automatiquement le nombre de tours
                    </div>
                  </div>
                  <div className="bg-white/20 px-3 py-1 rounded-full text-sm group-hover:bg-white/30 transition-colors">
                    Recommandé
                  </div>
                </button>

                {/* Option 2 : Annuler */}
                <button
                  onClick={onCancel}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-4 px-6 rounded-lg transition-colors duration-200 border border-gray-300"
                >
                  <div className="text-left">
                    <div>Annuler le démarrage</div>
                    <div className="text-sm text-gray-500 mt-1">
                      Revenir à la page d'échauffement
                    </div>
                  </div>
                </button>
              </>
            ) : (
              /* Aucune journée restante */
              <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6 text-center">
                <div className="text-red-600 font-semibold text-lg mb-2">
                  Impossible de démarrer le tournoi
                </div>
                <p className="text-red-700 text-sm mb-4">
                  Il n'y a plus de journées disponibles dans cette compétition pour la saison en cours.
                </p>
                <button
                  onClick={onCancel}
                  className="bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  Fermer
                </button>
              </div>
            )}
          </div>

          {/* Info supplémentaire */}
          <div className="text-xs text-gray-500 bg-gray-50 rounded p-3">
            <strong>💡 Astuce :</strong> Pour éviter ce problème à l'avenir, démarrez votre tournoi
            dès que vous avez le nombre minimum de participants requis.
          </div>
        </div>
      </div>
    </div>
  )
}
