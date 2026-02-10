// Types pour le système de navigation unifié

export type NavContext = 'app' | 'tournament' | 'admin' | 'creation'

export interface BaseNavProps {
  username: string
  userAvatar: string
  context?: NavContext
}

// Props spécifiques au contexte "app"
export interface AppNavContext {
  showBackToDashboard?: boolean
  hideProfileLink?: boolean
}

// Props spécifiques au contexte "tournament"
export interface TournamentNavContext {
  tournamentName: string
  competitionName: string
  competitionLogo?: string | null
  competitionLogoWhite?: string | null
  status: 'pending' | 'active' | 'finished'
}

// Props spécifiques au contexte "admin"
export interface AdminNavContext {
  currentPage?: 'general' | 'data' | 'settings' | 'logos' | 'usage' | 'custom' | 'communications'
}

// Props spécifiques au contexte "creation" (page de création de tournoi)
export interface CreationNavContext {
  competitionName: string
  competitionLogo?: string | null
  competitionLogoWhite?: string | null
  remainingMatchdays: number
}

// Props du composant NavBar unifié
export interface NavBarProps extends BaseNavProps {
  appContext?: AppNavContext
  tournamentContext?: TournamentNavContext
  adminContext?: AdminNavContext
  creationContext?: CreationNavContext
}
