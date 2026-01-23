import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'club.pronohub.app',
  appName: 'PronoHub',
  webDir: 'out',
  server: {
    // Charge l'application depuis l'URL de production
    url: 'https://www.pronohub.club',
    cleartext: false,
  },
  android: {
    // Autorise les liens externes à s'ouvrir dans le navigateur système
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
