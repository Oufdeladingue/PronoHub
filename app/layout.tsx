import type { Metadata } from "next";
import "./globals.css";
import AgeGate from "@/components/AgeGate";
import { UserProvider } from "@/contexts/UserContext";

export const metadata: Metadata = {
  title: "PronoHub - Tournois de Pronostics Football",
  description: "Créez et participez à des tournois de pronostics sportifs avec vos amis",
  icons: {
    icon: '/favicon.svg',
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
