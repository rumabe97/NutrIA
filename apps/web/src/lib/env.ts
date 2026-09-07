/**
 * The web app's entire environment surface.
 *
 * One variable, and it is public by construction. No database URL, no auth secret,
 * no AI key ever reaches this app — they live in `apps/api`, which is the only
 * process that holds them.
 */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

/**
 * Splits an API URL into the two values Better Auth's client needs *separately*.
 *
 * Its `withPath` helper returns the base URL untouched when that URL already has a
 * path, which means passing `http://host/api/v1` as `baseURL` makes it **silently
 * discard** `basePath` and post to `http://host/api/sign-up/email`. That 404s, and
 * it looks like a server fault rather than a client misconfiguration. Passing a
 * path-less origin is what guarantees the base path is applied.
 *
 * The base path is derived from the API URL rather than hardcoded, so it follows
 * the server's `API_PREFIX` instead of drifting from it.
 */
export function authTargets(apiUrl: string): { readonly basePath: string; readonly origin: string } {
  const parsed = new URL(apiUrl);

  return { basePath: `${parsed.pathname.replace(/\/+$/, '')}/auth`, origin: parsed.origin };
}

export const { basePath: AUTH_BASE_PATH, origin: AUTH_ORIGIN } = authTargets(API_URL);
