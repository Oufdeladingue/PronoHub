/**
 * Système de debug pour tester l'affichage des modales incitatives
 *
 * Usage dans la console du navigateur:
 *
 * // Afficher la modale d'extension de durée
 * window.debugShowModal('duration_extension')
 *
 * // Afficher la modale d'extension de joueurs (2-1 places)
 * window.debugShowModal('player_extension_2_1')
 *
 * // Afficher la modale d'extension de joueurs (0 places)
 * window.debugShowModal('player_extension_0')
 *
 * // Afficher la modale stats
 * window.debugShowModal('stats_option')
 */

export type DebugModalType =
  | 'duration_extension'
  | 'player_extension_2_1'
  | 'player_extension_0'
  | 'stats_option'

interface DebugModalState {
  type: DebugModalType | null
  isOpen: boolean
  tournamentId?: string
}

// State global pour les modales de debug
let debugModalState: DebugModalState = {
  type: null,
  isOpen: false
}

// Callbacks pour notifier les composants
const listeners: Set<(state: DebugModalState) => void> = new Set()

export function subscribeToDebugModals(callback: (state: DebugModalState) => void) {
  listeners.add(callback)
  return () => listeners.delete(callback)
}

export function showDebugModal(type: DebugModalType, tournamentId?: string) {
  debugModalState = { type, isOpen: true, tournamentId }
  listeners.forEach(cb => cb(debugModalState))
  console.log(`[DEBUG] Affichage de la modale: ${type}`, tournamentId ? `(tournoi: ${tournamentId})` : '')
}

export function hideDebugModal() {
  debugModalState = { type: null, isOpen: false }
  listeners.forEach(cb => cb(debugModalState))
}

export function getDebugModalState() {
  return debugModalState
}

// Initialiser les fonctions debug côté client uniquement
export function initDebugModals() {
  if (typeof window === 'undefined') return

  // Vérifier que window n'est pas undefined
  if (!window) return

  try {
    // Utiliser l'objet window global
    Object.assign(window, {
      debugShowModal: showDebugModal,
      debugHideModal: hideDebugModal
    })

    console.log(`
%c🔧 Debug Modals disponibles

Utilisation:
  window.debugShowModal('duration_extension')    // Extension de durée
  window.debugShowModal('player_extension_2_1')  // Extension joueurs (2-1 places)
  window.debugShowModal('player_extension_0')    // Extension joueurs (0 places)
  window.debugShowModal('stats_option')          // Option stats

Fermer la modale:
  window.debugHideModal()
  `, 'color: #ff9900; font-weight: bold;')
  } catch (error) {
    console.error('[Debug Modals] Erreur initialisation:', error)
  }
}
