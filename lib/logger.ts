/**
 * Système de logging persistant pour Capacitor
 * Les logs sont stockés dans un tableau global et affichés sur /logs
 */

// Stockage global des logs (max 500 entrées)
const MAX_LOGS = 500
export const globalLogs: Array<{ time: string; level: string; message: string }> = []

// Fonction pour ajouter un log
function addLog(level: string, ...args: any[]) {
  const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')
  const time = new Date().toISOString().split('T')[1].split('.')[0] // HH:MM:SS

  globalLogs.push({ time, level, message })

  // Limiter le nombre de logs
  if (globalLogs.length > MAX_LOGS) {
    globalLogs.shift()
  }
}

// Intercepter console.log/warn/error dès le chargement
if (typeof window !== 'undefined') {
  const originalLog = console.log
  const originalWarn = console.warn
  const originalError = console.error

  console.log = (...args: any[]) => {
    addLog('LOG', ...args)
    originalLog.apply(console, args)
  }

  console.warn = (...args: any[]) => {
    addLog('WARN', ...args)
    originalWarn.apply(console, args)
  }

  console.error = (...args: any[]) => {
    addLog('ERROR', ...args)
    originalError.apply(console, args)
  }

  // Log de démarrage
  console.log('[Logger] Système de logging initialisé')
}

export function clearLogs() {
  globalLogs.length = 0
}
