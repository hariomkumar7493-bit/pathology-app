import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ssdiagnostic.pathlabpro',
  appName: 'PathLab Pro',
  webDir: 'dist',
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    }
  },
  server: {
    androidScheme: 'https',
    url: 'https://patholabpro.online',
    cleartext: true,
  }
};

export default config;
