import type { CapacitorConfig } from '@capacitor/cli'

/**
 * The iOS and Android apps.
 *
 * Both ship the single-page build in `native-dist/` (`npm run build:native`),
 * loaded from the device rather than from ocotrailerrentals.com, so the app opens
 * without a network round trip and is a real app to Apple's review, not a
 * website in a frame. It talks to the same Supabase project and the same Stripe
 * account as the website.
 *
 * Bundle ID / application ID is permanent once the app is in a store. Do not
 * change it after the first upload.
 */
const config: CapacitorConfig = {
  appId: 'com.ocotrailerrentals.app',
  appName: 'OCO Trailer Rentals',
  webDir: 'native-dist',
  server: {
    // Android serves the bundle from https://localhost so cookies, storage and
    // Stripe.js see a secure origin. iOS uses capacitor://localhost, which
    // WKWebView also treats as secure.
    androidScheme: 'https',
  },
  ios: {
    contentInset: 'automatic',
    limitsNavigationsToAppBoundDomains: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: '#16272F',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#16272F',
      overlaysWebView: false,
    },
  },
}

export default config
