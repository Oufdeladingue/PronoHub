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
      return (savedTheme === 'light' || savedTheme === 'dark') ? savedTheme : 'dark'
    }
    return 'dark'
  })
  const [mounted, setMounted] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    setMounted(true)

    // Charger le thème depuis le localStorage en premier
    const savedTheme = localStorage.getItem('theme') as Theme | null
    if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
      setThemeState(savedTheme)
      document.documentElement.setAttribute('data-theme', savedTheme)
    } else {
      // Si pas de thème sauvegardé ou valeur invalide, utiliser dark par défaut
      setThemeState('dark')
      document.documentElement.setAttribute('data-theme', 'dark')
      localStorage.setItem('theme', 'dark')
    }

    // Puis charger depuis la base de données si l'utilisateur est connecté
    async function loadUserTheme() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('theme_preference')
          .eq('id', user.id)
          .single()

        // Utiliser la préférence BDD seulement si elle est explicitement 'light' ou 'dark'
        if (profile?.theme_preference === 'light' || profile?.theme_preference === 'dark') {
          setThemeState(profile.theme_preference)
          document.documentElement.setAttribute('data-theme', profile.theme_preference)
          localStorage.setItem('theme', profile.theme_preference)
        } else {
          // Si pas de préférence valide en BDD, forcer dark comme défaut
          setThemeState('dark')
          document.documentElement.setAttribute('data-theme', 'dark')
          localStorage.setItem('theme', 'dark')
        }
      }
    }

    loadUserTheme()
  }, [])

  const setTheme = async (newTheme: Theme) => {
    setThemeState(newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
    localStorage.setItem('theme', newTheme)

    // Sauvegarder dans la base de données si l'utilisateur est connecté
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase
        .from('profiles')
        .update({ theme_preference: newTheme })
        .eq('id', user.id)
    }
  }

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light')
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
