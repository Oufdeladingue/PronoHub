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
};

export default config;
