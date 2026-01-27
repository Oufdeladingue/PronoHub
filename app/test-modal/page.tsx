'use client'

import { useState } from 'react'
import MaxScoreModal from '@/components/MaxScoreModal'

export default function TestModalPage() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
      <div className="max-w-2xl w-full space-y-8">
        {/* En-tête */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-white">
            Test de la Modale Score Maximum
          </h1>
          <p className="text-gray-400 text-lg">
            Clique sur le bouton pour voir la modale qui s'affiche quand on essaie de dépasser 9 buts
          </p>
        </div>

        {/* Simulation d'un compteur de score */}
        <div className="bg-slate-800 rounded-xl p-8 border border-slate-700">
          <div className="flex items-center justify-center gap-6">
            <div className="text-center">
              <div className="text-gray-400 text-sm mb-2">Paris SG</div>
              <div className="flex items-center gap-2">
                <button
                  className="w-10 h-10 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-bold transition-colors"
                  disabled
                >
                  -
                </button>
                <div className="w-16 h-16 flex items-center justify-center bg-white rounded-lg">
                  <span className="text-3xl font-bold text-gray-900">9</span>
                </div>
                <button
                  onClick={() => setIsOpen(true)}
                  className="w-10 h-10 rounded-lg bg-[#ff9900] hover:bg-[#ff7700] text-white font-bold transition-colors shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  +
                </button>
              </div>
            </div>

            <div className="text-3xl font-bold text-gray-500">VS</div>

            <div className="text-center">
              <div className="text-gray-400 text-sm mb-2">Marseille</div>
              <div className="flex items-center gap-2">
                <button
                  className="w-10 h-10 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-bold transition-colors"
                  disabled
                >
                  -
                </button>
                <div className="w-16 h-16 flex items-center justify-center bg-white rounded-lg">
                  <span className="text-3xl font-bold text-gray-900">0</span>
                </div>
                <button
                  className="w-10 h-10 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-bold transition-colors"
                  disabled
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 text-center">
            <p className="text-gray-400 text-sm">
              👆 Clique sur le <span className="text-[#ff9900] font-bold">+</span> du Paris SG pour tester la modale
            </p>
          </div>
        </div>

        {/* Bouton direct pour les tests rapides */}
        <div className="text-center">
          <button
            onClick={() => setIsOpen(true)}
            className="bg-gradient-to-r from-[#ff9900] to-[#ff7700] hover:from-[#ff7700] hover:to-[#ff6600] text-white font-bold py-4 px-8 rounded-lg transition-all duration-200 transform hover:scale-105 shadow-xl"
          >
            🎭 Ouvrir la modale directement
          </button>
        </div>

        {/* Info messages */}
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
          <h3 className="text-white font-bold mb-3">Messages aléatoires :</h3>
          <ul className="text-gray-400 text-sm space-y-2">
            <li>• "Ce score déclenche un visionnage de la VAR : et c'est refusé pour quelques centimètres..."</li>
            <li>• "Tu tentes de débloquer le badge 'Humiliation gratuite' ? C'est trop pour une seule équipe..."</li>
            <li>• "À ce niveau-là, on ne parle plus de football mais de baby-foot ! Concentre-toi"</li>
            <li>• "Tu penses que le gardien adverse va rater le bus ?"</li>
            <li>• "Ce score est historiquement possible… mais statistiquement suspect et logiquement refusé !"</li>
          </ul>
          <p className="text-gray-500 text-xs mt-4">
            Un message différent s'affiche à chaque ouverture de la modale
          </p>
        </div>
      </div>

      {/* Modale */}
      <MaxScoreModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </div>
  )
}
