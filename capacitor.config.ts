import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mangosense.app',
  appName: 'Mangosense',
  webDir: 'www', // Changed from 'dist/Mangosense-main' to 'dist'
  server: {
    androidScheme: 'https'
  },
  android: {
    allowMixedContent: true,
    captureInput: true
  }
};

export default config;
