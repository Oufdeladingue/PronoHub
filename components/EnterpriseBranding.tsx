'use client'

import { useEffect, useState, createContext, useContext, ReactNode } from 'react'
import { EnterpriseAccount } from '@/types/monetization'

interface EnterpriseBrandingContextType {
  branding: EnterpriseAccount | null
  isEnterprise: boolean
  loading: boolean
}

const EnterpriseBrandingContext = createContext<EnterpriseBrandingContextType>({
  branding: null,
  isEnterprise: false,
  loading: true,
})

export function useEnterpriseBranding() {
  return useContext(EnterpriseBrandingContext)
}

interface EnterpriseBrandingProviderProps {
  tournamentId: string
  children: ReactNode
}

export function EnterpriseBrandingProvider({ tournamentId, children }: EnterpriseBrandingProviderProps) {
  const [branding, setBranding] = useState<EnterpriseAccount | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchBranding()
  }, [tournamentId])

  const fetchBranding = async () => {
    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/branding`)
      const data = await response.json()
      if (data.success && data.branding) {
        setBranding(data.branding)
      }
    } catch (error) {
      console.error('Error fetching branding:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <EnterpriseBrandingContext.Provider value={{ branding, isEnterprise: !!branding, loading }}>
      {branding && (
        <style jsx global>{`
          :root {
            --enterprise-primary: ${branding.primary_color};
            --enterprise-secondary: ${branding.secondary_color};
          }
          .enterprise-theme .theme-accent {
            background-color: var(--enterprise-primary) !important;
          }
          .enterprise-theme .theme-accent-text {
            color: var(--enterprise-primary) !important;
          }
          .enterprise-theme .theme-gradient {
            background: linear-gradient(to right, var(--enterprise-primary), var(--enterprise-secondary)) !important;
          }
        `}</style>
      )}
      <div className={branding ? 'enterprise-theme' : ''}>
        {children}
      </div>
    </EnterpriseBrandingContext.Provider>
  )
}

// Composant pour afficher le logo entreprise
export function EnterpriseLogoHeader() {
  const { branding, isEnterprise, loading } = useEnterpriseBranding()

  if (loading || !isEnterprise || !branding) {
    return null
  }

  return (
    <div className="flex items-center justify-center py-4 border-b border-gray-700">
      {branding.custom_logo_url ? (
        <img
          src={branding.custom_logo_url}
          alt={branding.company_name}
          className="h-12 object-contain"
        />
      ) : (
        <div className="text-xl font-bold" style={{ color: branding.primary_color }}>
          {branding.company_name}
        </div>
      )}
    </div>
  )
}

// Badge "Powered by PronoHub" pour les tournois entreprise
export function PoweredByBadge() {
  const { isEnterprise } = useEnterpriseBranding()

  if (!isEnterprise) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 bg-gray-800 px-3 py-1.5 rounded-full text-xs text-gray-400 flex items-center gap-2">
      Powered by
      <span className="text-orange-500 font-semibold">PronoHub</span>
    </div>
  )
}
