/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  skipTrailingSlashRedirect: true,
  serverExternalPackages: ['geoip-lite'],
  // Proxy PostHog à travers notre propre domaine pour éviter les ad blockers et problèmes CORS/CSP
  async rewrites() {
    return [
      {
        source: '/ingest/static/:path*',
        destination: 'https://us-assets.i.posthog.com/static/:path*',
      },
      {
        source: '/ingest/:path*',
        destination: 'https://us.i.posthog.com/:path*',
      },
    ]
  },
  async headers() {
    // Skip security headers in development/test mode (no HTTPS)
    const isProduction = process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_APP_URL?.startsWith('https://pronohub')

    if (!isProduction) {
      return []
    }

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
          // COOP: Isolation de l'origine pour prévenir les attaques cross-origin
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          // COEP: Isolation des ressources cross-origin
          { key: 'Cross-Origin-Embedder-Policy', value: 'credentialless' },
          // CORP: Protection des ressources
          { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://www.googletagmanager.com https://eu-assets.i.posthog.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: https: blob:",
              "font-src 'self' https://fonts.gstatic.com data:",
              "connect-src 'self' https://*.supabase.co https://api.stripe.com https://api.football-data.org wss://*.supabase.co https://eu.i.posthog.com https://eu-assets.i.posthog.com",
              "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self' https://pronohub.club https://www.pronohub.club",
              "upgrade-insecure-requests",
            ].join('; ')
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
