'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { isCapacitor } from '@/lib/capacitor'
import Image from 'next/image'

interface LogoutButtonProps {
  className?: string
  iconOnly?: boolean
  children?: React.ReactNode
  title?: string
}

/**
 * Bouton de déconnexion qui gère correctement Capacitor.
 * Dans Capacitor, fait le signOut côté client et navigue avec router.push
 * pour éviter que la redirection n'ouvre Chrome.
 */
export default function LogoutButton({ className, iconOnly = false, children, title }: LogoutButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleLogout = async (e: React.MouseEvent | React.FormEvent) => {
    e.preventDefault()

    if (isCapacitor()) {
      // Dans Capacitor, faire le signOut côté client
      setIsLoading(true)
      try {
        const supabase = createClient()
        await supabase.auth.signOut()
        // Naviguer vers l'accueil avec router.push (reste dans l'app)
        router.push('/')
        router.refresh()
      } catch (error) {
        console.error('[Logout] Error:', error)
        // En cas d'erreur, essayer quand même de rediriger
        router.push('/')
      }
    } else {
      // Sur le web, utiliser le formulaire standard
      const form = document.createElement('form')
      form.method = 'POST'
      form.action = '/auth/signout'
      document.body.appendChild(form)
      form.submit()
    }
  }

  if (iconOnly) {
    return (
      <button
        type="button"
        onClick={handleLogout}
        disabled={isLoading}
        className={className}
        title="Quitter le terrain"
      >
        {isLoading ? (
          <div className="w-6 h-6 animate-spin rounded-full border-2 border-gray-400 border-t-white" />
        ) : (
          children || (
            <Image
              src="/images/icons/logout.svg"
              alt="Déconnexion"
              width={24}
              height={24}
              className="w-6 h-6"
            />
          )
        )}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isLoading}
      className={className}
      title={title}
    >
      {isLoading ? (
        <div className="w-5 h-5 animate-spin rounded-full border-2 border-gray-400 border-t-white" />
      ) : (
        children || 'Déconnexion'
      )}
    </button>
  )
}
