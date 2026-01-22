/**
 * Utilitaires pour Capacitor (app mobile)
 */

// Détecter si on est dans l'app Capacitor
export function isCapacitor(): boolean {
  if (typeof window === 'undefined') return false
  return !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()
}

// Ouvrir une URL externe (Stripe, etc.)
export async function openExternalUrl(url: string): Promise<void> {
  if (isCapacitor()) {
    // Dans Capacitor, utiliser le plugin Browser pour ouvrir dans un navigateur in-app
    const { Browser } = await import('@capacitor/browser')
    await Browser.open({ url })
  } else {
    // Sur le web, redirection classique
    window.location.href = url
  }
}
