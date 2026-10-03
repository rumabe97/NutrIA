/**
 * The Content-Security-Policy of the web app, on its own so a test can pin it and so
 * `next.config.js` stays a list of what is sent, not of what the policy says.
 *
 * Report-only (project 011, phase 9): a browser reports what it would have blocked and
 * blocks nothing. There are no nonces — a nonce makes a page dynamic and `/` must stay
 * prerendered and cached — so scripts and styles allow `'unsafe-inline'`, which Next's own
 * bootstrap needs. What the policy still catches is a foreign origin, a plugin, a framing
 * parent and a changed `<base>`.
 *
 * Every origin below is one the app really loads from:
 *
 * - `'self'`: the pages, their scripts, styles, fonts (system fonts only, no webfont host),
 *   the manifest and the service worker (`/sw.js`, `worker-src`).
 * - the API origin, for `fetch` and for pictures served by path. In production the browser
 *   only talks to its own host (the API is proxied), so it adds nothing there.
 * - `*.public.blob.vercel-storage.com`: dish pictures, loaded through a plain `<img>`.
 * - `data:` / `blob:` images: the stub API's pictures, and previews.
 * - Google sign-in: a navigation to Google and back, not a subresource, so it needs no
 *   entry. WebAuthn needs none either. Web Push goes browser to push service, outside CSP.
 *
 * @param {{ apiUrl: string | undefined, development: boolean }} options `apiUrl` is
 *   `NEXT_PUBLIC_API_URL`, the address the browser calls the API at.
 * @returns {string} The header value.
 */
export function contentSecurityPolicy({ apiUrl, development }) {
  const api = apiOrigin(apiUrl);
  const withApi = (/** @type {string[]} */ ...sources) => (api ? [...sources, api] : sources).join(' ');

  const directives = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${development ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${withApi("'self'", 'data:', 'blob:', 'https://*.public.blob.vercel-storage.com')}`,
    "font-src 'self'",
    `connect-src ${withApi("'self'")}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'"
  ];

  if (api && apiUrl) {
    directives.push(`report-uri ${apiUrl.replace(/\/+$/, '')}/csp-report`);
  }

  return directives.join('; ');
}

/** @param {string | undefined} apiUrl @returns {string | undefined} */
function apiOrigin(apiUrl) {
  if (!apiUrl) {return undefined;}

  try {
    return new URL(apiUrl).origin;
  } catch {
    return undefined;
  }
}
