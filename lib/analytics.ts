import posthog from 'posthog-js'

function isPostHogReady(): boolean {
  return typeof window !== 'undefined' && posthog.__loaded
}

// === Identification ===

export function identifyUser(userId: string, properties?: Record<string, string>) {
  if (!isPostHogReady()) return
  posthog.identify(userId, properties)
}

export function resetUser() {
  if (!isPostHogReady()) return
  posthog.reset()
}

// === Auth ===

export function trackSignup(method: 'email' | 'google') {
  if (!isPostHogReady()) return
  posthog.capture('user_signed_up', { method })
}

export function trackLogin(method: 'email' | 'google') {
  if (!isPostHogReady()) return
  posthog.capture('user_logged_in', { method })
}

export function trackLogout() {
  if (!isPostHogReady()) return
  posthog.capture('user_logged_out')
  posthog.reset()
}

export function trackUsernameChosen() {
  if (!isPostHogReady()) return
  posthog.capture('username_chosen')
}

// === Tournois ===

export function trackTournamentCreated(props: { type: string, competition: string }) {
  if (!isPostHogReady()) return
  posthog.capture('tournament_created', props)
}

export function trackTournamentJoined(props: { method: 'code' | 'link' }) {
  if (!isPostHogReady()) return
  posthog.capture('tournament_joined', props)
}

// === Pronostics ===

export function trackPredictionSubmitted(props: { tournamentId: string, matchday: number }) {
  if (!isPostHogReady()) return
  posthog.capture('prediction_submitted', props)
}

// === Plateforme ===

export function trackPlatform(platform: 'web' | 'capacitor') {
  if (!isPostHogReady()) return
  posthog.capture('app_opened', { platform })
}
