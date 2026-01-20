import type { Metadata } from "next";
import "./globals.css";
import AgeGate from "@/components/AgeGate";
import { UserProvider } from "@/contexts/UserContext";

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
    <html lang="fr" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
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
      <body className="antialiased">
        <UserProvider>
          <AgeGate />
          {children}
        </UserProvider>
      </body>
    </html>
  );
}
