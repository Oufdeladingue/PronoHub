import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'club.pronohub.app',
  appName: 'PronoHub',
  webDir: 'out',
  // IMPORTANT: Ne PAS utiliser server.url car ça empêche les plugins natifs de fonctionner
  // L'APK charge maintenant depuis les assets locaux (out/)
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
