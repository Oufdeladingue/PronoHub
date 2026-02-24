'use client'

import { useEffect, Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'

// Initialiser PostHog une seule fois
// On utilise /ingest comme proxy (via rewrites Next.js) pour éviter les ad blockers et problèmes CSP
if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: '/ingest',
    ui_host: 'https://eu.posthog.com',
    person_profiles: 'identified_only',
    capture_pageview: false, // On capture manuellement via le routeur Next.js
    capture_pageleave: true,
    autocapture: false, // Désactivé pour économiser le quota (clicked button, clicked image, etc.)
    capture_performance: false, // Désactivé pour économiser le quota (Web vitals)
    loaded: (posthog) => {
      if (process.env.NODE_ENV === 'development') posthog.debug()
    },
    // Bloquer TOUS les events sur les pages admin (pageleave, web vitals, autocapture, etc.)
    before_send: (event) => {
      if (!event) return event
      const url = event.properties?.$current_url || event.properties?.$pathname || window.location.pathname
      if (typeof url === 'string' && url.includes('/sys-panel')) {
        return null
      }
      return event
    },
  })
}

// Composant qui capture les pageviews à chaque navigation
function PostHogPageview() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (pathname && posthog) {
      // Ignorer les pages admin
      if (pathname.startsWith('/sys-panel')) return

      let url = window.origin + pathname
      if (searchParams?.toString()) {
        url += '?' + searchParams.toString()
      }
      posthog.capture('$pageview', { $current_url: url })
    }
  }, [pathname, searchParams])

  return null
}

export default function PostHogProviderWrapper({ children }: { children: React.ReactNode }) {
  // Si PostHog n'est pas configuré, rendre les children directement
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    return <>{children}</>
  }

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageview />
      </Suspense>
      {children}
    </PHProvider>
  )
}
