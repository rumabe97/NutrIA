import { webManifest } from '../../_shared/manifest';

/**
 * A route handler rather than a second `manifest.ts`, because Next's file
 * convention for manifests exists only at the root of `app/` — and one manifest
 * for two languages means an English install that opens in Spanish.
 *
 * The English root layout points `<link rel="manifest">` here.
 */
// Nothing here depends on the request, so it is a file at build time rather than
// a function on every install — the same treatment Next gives the root manifest.
export const dynamic = 'force-static';

export function GET(): Response {
  return Response.json(webManifest('en-GB'), { headers: { 'content-type': 'application/manifest+json' } });
}
