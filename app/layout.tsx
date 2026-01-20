import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import AgeGate from "@/components/AgeGate";
import { UserProvider } from "@/contexts/UserContext";
import NavigationLoader from "@/components/NavigationLoader";

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
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const theme = localStorage.getItem('theme') || 'dark';
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
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-9999 focus:px-4 focus:py-2 focus:bg-[#ff9900] focus:text-black focus:rounded-lg focus:font-semibold"
        >
          Aller au contenu principal
        </a>
        <UserProvider>
          <Suspense fallback={null}>
            <NavigationLoader />
          </Suspense>
          <AgeGate />
          {children}
        </UserProvider>
      </body>
    </html>
  );
}
