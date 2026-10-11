import { useEffect, useState } from 'react'

/**
 * Registers the service worker (public/sw.js) that makes Athlete-Hub installable.
 * Only production builds register it: the dev server serves unbundled files that must never be cached.
 * Browsers allow service workers only on https:// or localhost.
 */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return
  if (import.meta.env.DEV) {
    // Drop a worker left over from an earlier production preview on this address.
    navigator.serviceWorker.getRegistrations().then((registrations) => registrations.forEach((registration) => registration.unregister()))
    return
  }
  if (!window.isSecureContext) return
  const register = () => navigator.serviceWorker.register('/sw.js').catch((error) => console.warn('Service worker registration failed:', error))
  // Wait for the page to finish loading so the worker does not compete with it, unless that already happened.
  if (document.readyState === 'complete') register()
  else window.addEventListener('load', register, { once: true })
}

export const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true

const isIos = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

// The browser fires beforeinstallprompt once, often before React mounts; keep it for whoever asks.
let deferredPrompt = null
const listeners = new Set()
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredPrompt = event
    listeners.forEach((listener) => listener())
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    listeners.forEach((listener) => listener())
  })
}

/**
 * How this device can install the app:
 * - 'prompt': the browser offers an install dialog (Chrome, Edge, Samsung Internet on https or localhost)
 * - 'ios': iPhone/iPad Safari — install through Share → Add to Home Screen
 * - null: already installed, or the browser cannot install from this address
 */
export function useInstallPrompt() {
  const [, setVersion] = useState(0)

  useEffect(() => {
    const update = () => setVersion((value) => value + 1)
    listeners.add(update)
    return () => listeners.delete(update)
  }, [])

  const mode = isStandalone() ? null : deferredPrompt ? 'prompt' : isIos() ? 'ios' : null

  const install = async () => {
    if (!deferredPrompt) return false
    const prompt = deferredPrompt
    deferredPrompt = null
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    listeners.forEach((listener) => listener())
    return outcome === 'accepted'
  }

  return { mode, install }
}
