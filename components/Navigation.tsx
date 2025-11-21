'use client'

import NavBar from './NavBar'
import NavBarMobile from './NavBarMobile'
import { NavBarProps } from '@/types/navigation'
import { ThemeProvider } from '@/contexts/ThemeContext'

/**
 * Composant de navigation unifié qui affiche automatiquement
 * la version desktop (NavBar) ou mobile (NavBarMobile) selon la taille de l'écran
 */
export default function Navigation(props: NavBarProps) {
  return (
    <ThemeProvider>
      <NavBar {...props} />
      <NavBarMobile {...props} />
    </ThemeProvider>
  )
}
