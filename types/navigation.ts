// Types pour le système de navigation unifié

export type NavContext = 'app' | 'tournament' | 'admin'

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
  status: 'pending' | 'active' | 'finished'
}

// Props spécifiques au contexte "admin"
export interface AdminNavContext {
  currentPage?: 'general' | 'import' | 'settings'
}

// Props du composant NavBar unifié
export interface NavBarProps extends BaseNavProps {
  appContext?: AppNavContext
  tournamentContext?: TournamentNavContext
  adminContext?: AdminNavContext
}
