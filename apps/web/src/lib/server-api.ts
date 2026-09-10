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
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
}
