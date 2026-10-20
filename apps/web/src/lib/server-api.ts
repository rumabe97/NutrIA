import { cookies } from 'next/headers';

import { activeLocale } from '../i18n/server';
import { API_UPSTREAM_URL } from './env';

/**
 * Server-side read of the API, for React Server Components.
 *
 * The browser's session cookie does not travel with a server-to-server fetch on
 * its own, so it is forwarded explicitly. Returns `null` on any failure rather
 * than throwing: a server component that throws replaces a whole page with an
 * error boundary, and a dashboard section that cannot load should degrade to an
 * empty state, not take the page down.
 */
export async function serverApi<T>(path: string): Promise<T | null> {
  return (await serverApiResult<T>(path)).body;
}

/**
 * What the API answered, for the one kind of screen that has to tell two
 * failures apart.
 *
 * `serverApi` collapses everything that is not a 200 into `null`, which is the
 * right default — a section that cannot load should become an empty state, not
 * an error page. But a page whose 409 means *"this is premium"* and whose 404
 * means *"this is not yours"* cannot be written against `null`: it would have
 * to guess, and the guess that shows a paying customer a page saying their past
 * is gone is the wrong one (`0021` § *Amended*). `code` is the body's own
 * `code` when there is one, which is what the screen switches on.
 */
export async function serverApiResult<T>(path: string): Promise<{ readonly body: T | null; readonly code: string | null; readonly status: number }> {
  const [cookieStore, locale] = await Promise.all([cookies(), activeLocale()]);

  try {
    const response = await fetch(`${API_UPSTREAM_URL}${path}`, {
      cache: 'no-store',
      // Sent on every call, for the same reason the browser client sends it: the
      // locale decision is made once and travels, rather than being rediscovered
      // by whichever feature needs it first.
      headers: { 'Accept-Language': locale, Cookie: cookieStore.toString() }
    });

    if (!response.ok) {
      // The code, when the answer carries one. A body that is not JSON, or
      // carries no code, reads as none rather than throwing: this path is
      // already the failure path.
      const code = await response
        .json()
        .then((body: unknown) => (typeof body === 'object' && body !== null && 'code' in body && typeof body.code === 'string' ? body.code : null))
        .catch(() => null);

      return { body: null, code, status: response.status };
    }

    return { body: (await response.json()) as T, code: null, status: response.status };
  } catch {
    // Nothing answered at all: 0 is not a status any server sends, so a caller
    // switching on one cannot mistake it for a refusal.
    return { body: null, code: null, status: 0 };
  }
}
