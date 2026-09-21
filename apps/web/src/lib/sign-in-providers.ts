import { API_UPSTREAM_URL } from './env';

/** Every provider this app can draw a button for, in the order the API lists them. */
export const SOCIAL_PROVIDERS = ['google', 'apple'] as const;

export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number];

const REVALIDATE_SECONDS = 300;
const TIMEOUT_MS = 3000;

/**
 * Only what this app knows how to draw survives. The API may learn a provider
 * before the web app has a mark and a name for it, and a button with neither is
 * worse than no button.
 */
export function parseProviders(body: unknown): readonly SocialProvider[] {
  const listed = (body as { providers?: unknown } | null)?.providers;

  if (!Array.isArray(listed)) {
    return [];
  }

  return SOCIAL_PROVIDERS.filter(provider => listed.includes(provider));
}

/**
 * Which "Continue with…" buttons the sign-in and sign-up pages draw (`0058`).
 *
 * Asked of the API, because the API is what holds a provider's credentials: a
 * flag in this app's environment could promise a button the API cannot honour.
 * Asked on the server and kept for five minutes, so the pages stay static, the
 * buttons are in the first paint rather than popping in under somebody's thumb,
 * and a provider switched on reaches the page without a deploy.
 *
 * Any failure is no buttons. The form underneath them always works.
 */
export async function signInProviders(): Promise<readonly SocialProvider[]> {
  try {
    const response = await fetch(`${API_UPSTREAM_URL}/settings/sign-in-providers`, {
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });

    return response.ok ? parseProviders(await response.json()) : [];
  } catch {
    return [];
  }
}
