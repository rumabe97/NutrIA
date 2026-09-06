/**
 * Reads a required env var. Throws with a clear message at module-load time if it's
 * missing — much friendlier than the Supabase SDK errors you'd otherwise get on first
 * auth call (often surfacing as a CORS / 404 / "Invalid API key" deep in a request).
 *
 * Imported by `client.ts`, `server.ts`, and `middleware.ts`.
 *
 * Use the variant that matches the var's exposure:
 *   - `required('SOMETHING')`        — server-only, never reaches the browser.
 *   - `requiredPublic('NEXT_PUBLIC_…')` — inlined into client bundles at build time
 *     by Next.js and shipped to every visitor. Only use for values that are *meant*
 *     to be public (e.g. Supabase URL + publishable anon key). Never pass a service
 *     role key or any other secret through this function.
 *
 * `requiredPublic` is typed to require the `NEXT_PUBLIC_` prefix — passing anything
 * else is a TypeScript error, making the exposure boundary visible at the call site
 * (and harder for AI agents to skip past).
 */

type PublicEnvName = `NEXT_PUBLIC_${string}`;

/**
 * @knipignore — the server-only half of the documented pair above; auth has no
 * server-only env vars yet, but the variant must exist so secrets are never funnelled
 * through `requiredPublic`.
 */
export function required(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required env var: ${name}. Set it in your .env file.`);
  }

  return value;
}

export function requiredPublic(name: PublicEnvName): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required env var: ${name}. Set it in your .env file.`);
  }

  return value;
}
