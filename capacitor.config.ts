import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.crate.musiclibrary',
  appName: 'CRATE',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // Allows streaming from your PC's local Express helper over LAN Wi-Fi (http://192.168.x.x:5174)
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
