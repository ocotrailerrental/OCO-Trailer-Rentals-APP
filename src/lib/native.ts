import { Capacitor } from '@capacitor/core'

/**
 * Helpers for the iOS and Android apps. On the website every function here is a
 * no-op, so the same code ships to both.
 */

/** True inside the App Store / Google Play app, false in a browser. */
export const isNativeApp = () => Capacitor.isNativePlatform()

/**
 * The public website. Used wherever a link has to work outside the app — chiefly
 * auth emails. Inside the app `window.location.origin` is `capacitor://localhost`
 * or `https://localhost`, which would make a password-reset email link that opens
 * nothing.
 */
export const SITE_URL = 'https://ocotrailerrentals.com'

export function publicOrigin() {
  if (typeof window === 'undefined') return SITE_URL
  return isNativeApp() ? SITE_URL : window.location.origin
}

let started = false

/** Wire up the native shell once, after the app has hydrated. */
export async function startNativeShell() {
  if (started || !isNativeApp()) return
  started = true

  const [{ App }, { SplashScreen }, { StatusBar, Style }] = await Promise.all([
    import('@capacitor/app'),
    import('@capacitor/splash-screen'),
    import('@capacitor/status-bar'),
  ])

  // Android hardware back: go back a page, or leave the app from the first one.
  void App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) window.history.back()
    else void App.exitApp()
  })

  // A link to ocotrailerrentals.com opened on the phone (a booking email, say)
  // lands on the matching screen in the app instead of the home screen.
  void App.addListener('appUrlOpen', ({ url }) => {
    try {
      const target = new URL(url)
      const path = `${target.pathname}${target.search}${target.hash}`
      if (path && path !== window.location.pathname + window.location.search) {
        window.location.assign(path)
      }
    } catch {
      /* not a URL we understand; stay where we are */
    }
  })

  if (Capacitor.getPlatform() === 'android') {
    await StatusBar.setBackgroundColor({ color: '#16272F' }).catch(() => undefined)
  }
  await StatusBar.setStyle({ style: Style.Dark }).catch(() => undefined)
  await SplashScreen.hide().catch(() => undefined)
}
