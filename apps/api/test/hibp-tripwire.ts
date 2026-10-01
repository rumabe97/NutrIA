/**
 * No suite ever reaches Have I Been Pwned (project 011, phase 1).
 *
 * The API checks a new password against HIBP's range endpoint, through Better
 * Auth's `isPasswordCompromised`, which fetches with the global `fetch` at call
 * time. Under `NODE_ENV=test` that check is off; this is what makes "off" a
 * fact rather than a promise. Installed for every suite by `setup-e2e.ts`: a
 * request to HIBP's host is recorded and refused before anything leaves the
 * machine, and every other request goes to the `fetch` that was there before.
 *
 * Kept on a global symbol, not in this module's scope, so it is installed once
 * per test file however many times the module is evaluated, and a suite that
 * reads `hibpAttempts()` reads the same list the tripwire writes. A suite that
 * replaces `fetch` itself (`social-sign-in.e2e-spec.ts`) captures the tripwire
 * as its "real" one and passes through it.
 */
const HIBP_HOST = 'api.pwnedpasswords.com';
const KEY = Symbol.for('nutria.e2e.hibpTripwire');

type Tripwire = { readonly attempts: string[]; readonly fetch: typeof fetch };

function urlOf(input: Parameters<typeof fetch>[0]): string {
  return typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}

export function installHibpTripwire(): void {
  const slots = globalThis as unknown as Record<symbol, Tripwire | undefined>;

  if (slots[KEY]) {
    return;
  }

  const attempts: string[] = [];
  const previous = globalThis.fetch;
  const tripwire = ((input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const url = urlOf(input);

    if (hostOf(url) === HIBP_HOST) {
      // The path's last segment is a hash prefix: kept for the count, never printed.
      attempts.push(url);

      return Promise.reject(new Error('An end-to-end suite may not call Have I Been Pwned'));
    }

    return previous(input, init);
  }) as typeof fetch;

  slots[KEY] = { attempts, fetch: tripwire };
  globalThis.fetch = tripwire;
}

/** Whether `setup-e2e.ts` installed the tripwire in this test file. */
export function hibpTripwireInstalled(): boolean {
  return (globalThis as unknown as Record<symbol, Tripwire | undefined>)[KEY] !== undefined;
}

/** How many requests to HIBP the tripwire refused in this test file. */
export function hibpAttempts(): number {
  return (globalThis as unknown as Record<symbol, Tripwire | undefined>)[KEY]?.attempts.length ?? 0;
}
