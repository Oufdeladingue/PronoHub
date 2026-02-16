'use client'

import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: {
        sitekey: string
        callback: (token: string) => void
        'error-callback'?: () => void
        'expired-callback'?: () => void
        theme?: 'light' | 'dark' | 'auto'
        size?: 'normal' | 'compact' | 'invisible'
      }) => string
      remove: (widgetId: string) => void
      reset: (widgetId: string) => void
    }
  }
}

interface TurnstileWidgetProps {
  onVerify: (token: string) => void
  onError?: () => void
  onExpire?: () => void
}

export default function TurnstileWidget({ onVerify, onError, onExpire }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const scriptLoadedRef = useRef(false)

  // Store callbacks in refs so useEffect doesn't depend on them
  const onVerifyRef = useRef(onVerify)
  const onErrorRef = useRef(onError)
  const onExpireRef = useRef(onExpire)
  onVerifyRef.current = onVerify
  onErrorRef.current = onError
  onExpireRef.current = onExpire

  useEffect(() => {
    // If Turnstile is not configured, skip
    if (!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) return

    const renderWidget = () => {
      if (!containerRef.current || !window.turnstile) return
      if (widgetIdRef.current) return // Already rendered

      const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
      if (!siteKey) return

      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: (token: string) => onVerifyRef.current(token),
        'error-callback': () => onErrorRef.current?.(),
        'expired-callback': () => onExpireRef.current?.(),
        theme: 'dark',
        size: 'invisible',
      })
    }

    // Load script if not already loaded
    if (!scriptLoadedRef.current && !document.getElementById('cf-turnstile-script')) {
      const script = document.createElement('script')
      script.id = 'cf-turnstile-script'
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      script.async = true
      script.onload = () => {
        scriptLoadedRef.current = true
        renderWidget()
      }
      document.head.appendChild(script)
    } else if (window.turnstile) {
      renderWidget()
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current)
        widgetIdRef.current = null
      }
    }
  }, []) // No dependencies — runs once, callbacks accessed via refs

  // If not configured, don't render anything
  if (!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) return null

  return <div ref={containerRef} className="flex justify-center" />
}
