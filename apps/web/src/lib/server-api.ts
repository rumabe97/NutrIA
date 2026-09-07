import { cookies } from 'next/headers';

import { API_URL } from './env';

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
  const cookieHeader = (await cookies()).toString();

  try {
    const response = await fetch(`${API_URL}${path}`, { cache: 'no-store', headers: { Cookie: cookieHeader } });

    if (!response.ok) {return null;}

    return (await response.json()) as T;
  } catch {
    return null;
  }
}
