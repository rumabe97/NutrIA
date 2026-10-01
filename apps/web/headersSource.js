/**
 * The `source` pattern of the security headers in `next.config.js`, on its own so a test
 * can run it through Next's own path matcher: it is a hand-built negative lookahead, and a
 * wrong one would put the headers on the proxied API or take them off every page.
 *
 * @param {string | undefined} upstreamBase The API upstream's path without a trailing slash
 *   (`/api/v1`), or nothing when there is no upstream.
 * @returns {string} Every path, or every path but the proxied API prefix when there is one.
 */
export function pagesSource(upstreamBase) {
  if (!upstreamBase) {return '/:path*';}

  const escaped = upstreamBase.slice(1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  return `/:path((?!${escaped}(?:/|$)).*)`;
}
