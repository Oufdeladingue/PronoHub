import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import AgeGate from "@/components/AgeGate";
import { UserProvider } from "@/contexts/UserContext";
import NavigationLoader from "@/components/NavigationLoader";
import CapacitorSessionProvider from "@/components/CapacitorSessionProvider";
import PushNotificationsProvider from "@/components/PushNotificationsProvider";

// Optimisation: next/font charge les fonts de manière optimale
// - Hébergement local (pas de requête externe à Google)
// - Pas de layout shift (font-display: swap automatique)
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "PronoHub - Tournois de Pronostics Football",
  description: "Créez et participez à des tournois de pronostics sportifs avec vos amis. Défiez vos amis sur la Ligue 1, Premier League, Champions League et plus encore !",
  icons: {
    icon: '/favicon.svg',
    apple: '/favicon.svg',
  },
  metadataBase: new URL('https://www.pronohub.club'),
  openGraph: {
    title: 'PronoHub - Tournois de Pronostics Football',
    description: 'Créez et participez à des tournois de pronostics sportifs avec vos amis',
    url: 'https://www.pronohub.club',
    siteName: 'PronoHub',
    locale: 'fr_FR',
    type: 'website',
    images: [
      {
        url: '/images/logo.svg',
        width: 200,
        height: 200,
        alt: 'PronoHub - Tournois de pronostics entre amis',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PronoHub - Tournois de Pronostics Football',
    description: 'Créez et participez à des tournois de pronostics sportifs avec vos amis',
    images: ['/images/logo.svg'],
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
        {/* Skip to content link pour l'accessibilité */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-9999 focus:px-4 focus:py-2 focus:bg-[#ff9900] focus:text-black focus:rounded-lg focus:font-semibold focus:outline-2 focus:outline-offset-2 focus:outline-[#ff9900]"
        >
          Aller au contenu principal
        </a>
        <CapacitorSessionProvider>
          <UserProvider>
            <PushNotificationsProvider>
              <Suspense fallback={null}>
                <NavigationLoader />
              </Suspense>
              <AgeGate />
              {children}
            </PushNotificationsProvider>
          </UserProvider>
        </CapacitorSessionProvider>
      </body>
    </html>
  );
}
