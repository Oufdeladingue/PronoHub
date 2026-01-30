import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'club.pronohub.app',
  appName: 'PronoHub',
  webDir: 'out',
  server: {
    // Charger depuis Vercel pour éviter de rebuild l'APK à chaque changement
    url: 'https://www.pronohub.club',
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '468891081637-deuj1678e2kdrse16logq5ksk7qc2fru.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
    },
  },
};

export default config;
