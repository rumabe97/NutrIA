/**
 * The page's half of the offline copies (`0053`). The other half is
 * `public/sw.js`, which keeps them, and names the same cache.
 */
export const OFFLINE_PAGES_CACHE = 'nutria-pages-v1';

/** At the site root, so the worker's scope is the whole site. */
const SERVICE_WORKER_URL = '/sw.js';

function worker(): ServiceWorker | null {
  // Absent outside a secure context — a phone on the LAN over plain HTTP.
  return 'serviceWorker' in navigator ? navigator.serviceWorker.controller : null;
}

/**
 * Production only: under `next dev` the worker would hold on to files the dev
 * server rewrites on every save.
 */
export async function registerServiceWorker(): Promise<void> {
  if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) {
    return;
  }

  try {
    await navigator.serviceWorker.register(SERVICE_WORKER_URL);
  } catch {
    // The app without offline copies is still the whole app.
  }
}

/** Asks the worker to fetch both copies again. `leaving` is the moment the app is put away, when the latest ticks matter most. */
export function refreshOfflineCopies(leaving = false): void {
  worker()?.postMessage({ force: leaving, type: 'refresh' });
}

/**
 * Drops every copy, at the moments the session they belong to ends or changes:
 * sign-in, sign-out, account deletion.
 *
 * Both through the worker and here. Through it, so a refresh it already has in
 * flight — sent with the old session — is not stored afterwards; here, because
 * a worker that is not running would not hear it.
 */
export async function forgetOfflineCopies(): Promise<void> {
  worker()?.postMessage({ type: 'forget' });

  if (typeof caches !== 'undefined') {
    await caches.delete(OFFLINE_PAGES_CACHE).catch(() => false);
  }
}
