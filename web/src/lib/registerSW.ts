/**
 * Service-worker rescue. The PWA was disabled for initial staging (see
 * vite.config.ts note) because a stale Workbox precache from an earlier
 * deploy was locking users onto an "You're offline" page. The server now
 * serves a kill-switch `/sw.js` that unregisters any existing SW on its
 * next update check.
 *
 * This client-side helper is a belt-and-braces cleanup: on every page load
 * it also unregisters any SW + purges caches, so users who happen to have
 * a live SW instance also get rescued the first time the new JS bundle
 * reaches them.
 *
 * When we re-enable PWA later (real offline support, update banner), swap
 * this back to `new Workbox('/sw.js').register()` and drop the cleanup.
 */
export function registerServiceWorker(): void {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;
  if (import.meta.env.DEV) return;

  (async () => {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {
      // best-effort; failure must never block the app
    }
  })().catch(() => {});
}
