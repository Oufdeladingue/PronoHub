'use client'

import NavBar from './NavBar'
import NavBarMobile from './NavBarMobile'
import { NavBarProps } from '@/types/navigation'

/**
 * Composant de navigation unifié qui affiche automatiquement
 * la version desktop (NavBar) ou mobile (NavBarMobile) selon la taille de l'écran
 */
export default function Navigation(props: NavBarProps) {
  return (
    <>
      <NavBar {...props} />
      <NavBarMobile {...props} />
    </>
  )
}
