import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import { UserProvider } from "@/contexts/UserContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import NavigationLoader from "@/components/NavigationLoader";
import CapacitorSessionProvider from "@/components/CapacitorSessionProvider";
import PushNotificationsProvider from "@/components/PushNotificationsProvider";
import DebugModalContainer from "@/components/modals/DebugModalContainer";
import PostHogProvider from "@/components/PostHogProvider";
// Importer le logger dès le début pour capturer tous les logs
import "@/lib/logger";

// Optimisation: next/font charge les fonts de manière optimale
// - Hébergement local (pas de requête externe à Google)
// - Pas de layout shift (font-display: swap automatique)
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "PronoHub Football - Tournois de Pronostics entre Amis",
  description: "Créez et participez à des tournois de pronostics sportifs avec vos amis. Défiez vos amis sur la Ligue 1, Premier League, Champions League et plus encore !",
  icons: {
    icon: '/favicon.svg',
    apple: '/favicon.svg',
  },
  metadataBase: new URL('https://www.pronohub.club'),
  openGraph: {
    title: 'PronoHub Football - Tournois de Pronostics entre Amis',
    description: 'Créez et participez à des tournois de pronostics sportifs avec vos amis',
    url: 'https://www.pronohub.club',
    siteName: 'PronoHub Football',
    locale: 'fr_FR',
    type: 'website',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'PronoHub Football - Tournois de pronostics entre amis',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PronoHub Football - Tournois de Pronostics entre Amis',
    description: 'Créez et participez à des tournois de pronostics sportifs avec vos amis',
    images: ['/opengraph-image'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: 'https://www.pronohub.club',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning className={inter.variable}>
      <head>
        {/* Viewport avec viewport-fit=cover pour gérer les safe areas sur mobile */}
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        {/* CRITIQUE: Couleur theme pour Android WebView - LUE IMMÉDIATEMENT */}
        <meta name="theme-color" content="#1e293b" />
        {/* Preconnect aux origines critiques pour réduire la latence */}
        <link rel="preconnect" href="https://txpmihreaxmtsxlgmdko.supabase.co" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://txpmihreaxmtsxlgmdko.supabase.co" />
        {/* Note: pas de preconnect Google Fonts car next/font héberge les fonts localement */}
        {/* Preload du logo LCP pour le chargement initial */}
        <link rel="preload" href="/images/logo.svg" as="image" type="image/svg+xml" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var theme = localStorage.getItem('theme');
                if (!theme) {
                  theme = 'dark';
                  localStorage.setItem('theme', 'dark');
                }
                document.documentElement.setAttribute('data-theme', theme);
              })();
            `,
          }}
        />
      </head>
      <body className={`${inter.className} antialiased`}>
        {/* JSON-LD Structured Data pour Google */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@graph': [
                {
                  '@type': 'Organization',
                  name: 'PronoHub',
                  url: 'https://www.pronohub.club',
                  logo: 'https://www.pronohub.club/images/logo.svg',
                  description: 'Application de tournois de pronostics football entre amis',
                },
                {
                  '@type': 'WebApplication',
                  name: 'PronoHub Football',
                  url: 'https://www.pronohub.club',
                  applicationCategory: 'SportsApplication',
                  operatingSystem: 'Android, Web',
                  offers: {
                    '@type': 'Offer',
                    price: '0',
                    priceCurrency: 'EUR',
                  },
                  description: 'Créez et participez à des tournois de pronostics sportifs avec vos amis. Ligue 1, Premier League, Champions League et plus encore.',
                  inLanguage: 'fr',
                },
                {
                  '@type': 'FAQPage',
                  mainEntity: [
                    {
                      '@type': 'Question',
                      name: 'PronoHub est-il gratuit ?',
                      acceptedAnswer: {
                        '@type': 'Answer',
                        text: 'Oui, PronoHub est 100 % gratuit. Créez vos tournois, invitez vos amis et jouez sans aucun frais.',
                      },
                    },
                    {
                      '@type': 'Question',
                      name: 'Comment créer un tournoi de pronostics ?',
                      acceptedAnswer: {
                        '@type': 'Answer',
                        text: 'Inscrivez-vous gratuitement, cliquez sur « Créer un tournoi », choisissez vos compétitions (Ligue 1, Premier League, Champions League…) et partagez le lien d\'invitation à vos amis.',
                      },
                    },
                    {
                      '@type': 'Question',
                      name: 'Quelles compétitions sont disponibles ?',
                      acceptedAnswer: {
                        '@type': 'Answer',
                        text: 'PronoHub couvre les principales compétitions européennes : Ligue 1, Premier League, La Liga, Serie A, Bundesliga, Champions League, Europa League et plus encore.',
                      },
                    },
                    {
                      '@type': 'Question',
                      name: 'Combien de joueurs peuvent participer à un tournoi ?',
                      acceptedAnswer: {
                        '@type': 'Answer',
                        text: 'Il n\'y a pas de limite ! Invitez autant d\'amis que vous le souhaitez dans votre tournoi de pronostics.',
                      },
                    },
                  ],
                },
              ],
            }),
          }}
        />
        {/* Skip to content link pour l'accessibilité - visible uniquement au focus clavier */}
        <a
          href="#main-content"
          className="skip-to-content"
        >
          Aller au contenu principal
        </a>
        <CapacitorSessionProvider>
          <PostHogProvider>
          <ThemeProvider>
            <UserProvider>
              <PushNotificationsProvider>
                <Suspense fallback={null}>
                  <NavigationLoader />
                </Suspense>
                {children}
                <DebugModalContainer />
              </PushNotificationsProvider>
            </UserProvider>
          </ThemeProvider>
          </PostHogProvider>
        </CapacitorSessionProvider>
      </body>
    </html>
  );
}
