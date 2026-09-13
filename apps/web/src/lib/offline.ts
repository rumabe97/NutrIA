import { forgetPendingTicks } from './pendingTicks';

/**
 * The page's half of the offline copies (`0053`). The other half is
 * `public/sw.js`, which keeps them, and names the same cache.
 */
export const OFFLINE_PAGES_CACHE = 'nutria-pages-v1';

/** The screens the worker always keeps a copy of — the same list as `OFFLINE_PATHS` in `sw.js`. */
export const OFFLINE_PATHS: readonly string[] = ['/inicio', '/plan', '/compra'];

/** At the site root, so the worker's scope is the whole site. */
const SERVICE_WORKER_URL = '/sw.js';

/**
 * Production only: under `next dev` the worker would hold on to files the dev
 * server rewrites on every save.
 */
function supported(): boolean {
  // `serviceWorker` is absent outside a secure context — a phone on the LAN over plain HTTP.
  return process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator;
}

export async function registerServiceWorker(): Promise<void> {
  if (!supported()) {
    return;
  }

  try {
    await navigator.serviceWorker.register(SERVICE_WORKER_URL);
  } catch {
    // The app without offline copies is still the whole app.
  }
}

/**
 * Asks the worker to fetch both copies again. `leaving` is the moment the app
 * is put away, when the latest ticks matter most.
 *
 * Through `ready`, not `controller`. On the first visit after the worker is
 * installed, the page loaded before the worker existed, so nothing controls it
 * and `controller` is null: a request sent there went nowhere, and nothing was
 * stored until the next change of screen. That is what the first try on a phone
 * found — open the app, turn on airplane mode, and there was no copy to open.
 * `ready` waits for the worker to be active, whether or not it controls the page.
 */
export async function refreshOfflineCopies(leaving = false): Promise<void> {
  if (!supported()) {
    return;
  }

  (await navigator.serviceWorker.ready).active?.postMessage({ force: leaving, type: 'refresh' });
}

/** The screens with a copy on this device, by path — so that, offline, only those are drawn as links. */
export async function storedPages(): Promise<ReadonlySet<string>> {
  if (typeof caches === 'undefined') {
    return new Set();
  }

  const cache = await caches.open(OFFLINE_PAGES_CACHE);

  return new Set((await cache.keys()).map(request => new URL(request.url).pathname));
}

/**
 * Drops every copy, at the moments the session they belong to ends or changes:
 * sign-in, sign-up, sign-out, account deletion.
 *
 * Both through the worker and here. Through it, so a refresh it already has in
 * flight — sent with the old session — is not stored afterwards; here, because
 * a worker that is not running would not hear it. The registration is asked
 * for, not waited on: signing out must not hang on a worker that never came.
 */
export async function forgetOfflineCopies(): Promise<void> {
  // Ticks still waiting for a connection belong to the session that made them (`0055`).
  forgetPendingTicks();

  if ('serviceWorker' in navigator) {
    try {
      (await navigator.serviceWorker.getRegistration())?.active?.postMessage({ type: 'forget' });
    } catch {
      // No registration to ask; the caches below are dropped all the same.
    }
  }

  if (typeof caches !== 'undefined') {
    await caches.delete(OFFLINE_PAGES_CACHE).catch(() => false);
  }
}
