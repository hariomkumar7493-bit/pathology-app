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
  }
};

export default config;
