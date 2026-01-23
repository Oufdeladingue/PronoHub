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
      serverClientId: '583607440165-79me5hd3vkuu6m6t876nf5kjrmk895ug.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
    },
  },
};

export default config;
