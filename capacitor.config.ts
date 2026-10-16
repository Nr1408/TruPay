import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.trupay.ai',
  appName: 'TruPay',
  webDir: 'dist',
  plugins: {
    FirebaseAuthentication: {
      providers: ["google.com", "phone"],
      skipNativeAuth: false
    },
    CapacitorHttp: {
      enabled: true
    }
  },
  android: {
    allowMixedContent: true
  },
  server: {
    allowNavigation: ["10.10.37.139", "10.10.37.139:5000", "*"],
    cleartext: true
  }
};

export default config;
