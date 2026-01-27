'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'

type Theme = 'light' | 'dark'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Initialiser le thème depuis localStorage immédiatement (SSR-safe)
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme') as Theme | null
      console.log('[ThemeContext] Initialisation, localStorage.theme:', savedTheme)
      return (savedTheme === 'light' || savedTheme === 'dark') ? savedTheme : 'dark'
    }
    return 'dark'
  })
  const [mounted, setMounted] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    setMounted(true)

    // Ne charger depuis la BDD que si l'utilisateur est connecté
    // Le thème est déjà initialisé depuis localStorage dans useState
    async function loadUserTheme() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('theme_preference')
          .eq('id', user.id)
          .single()

        // Utiliser la préférence BDD seulement si elle est différente de celle en localStorage
        const localTheme = localStorage.getItem('theme')
        if (profile?.theme_preference &&
            (profile.theme_preference === 'light' || profile.theme_preference === 'dark') &&
            profile.theme_preference !== localTheme) {
          console.log('[ThemeContext] Sync depuis BDD:', profile.theme_preference)
          setThemeState(profile.theme_preference)
          document.documentElement.setAttribute('data-theme', profile.theme_preference)
          localStorage.setItem('theme', profile.theme_preference)
        }
      }
    }

    loadUserTheme()
  }, [])

  const setTheme = async (newTheme: Theme) => {
    console.log('[ThemeContext] setTheme appelé avec:', newTheme)
    setThemeState(newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
    localStorage.setItem('theme', newTheme)
    console.log('[ThemeContext] localStorage.theme après setItem:', localStorage.getItem('theme'))

    // Sauvegarder dans la base de données si l'utilisateur est connecté
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      console.log('[ThemeContext] Sauvegarde du thème en BDD pour user:', user.id)
      await supabase
        .from('profiles')
        .update({ theme_preference: newTheme })
        .eq('id', user.id)
    }
  }

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    console.log('[ThemeContext] toggleTheme: de', theme, 'vers', newTheme)
    setTheme(newTheme)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
