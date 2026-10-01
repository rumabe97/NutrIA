/**
 * When the API lives on another host, the browser still only ever talks to this
 * one: `/api/v1/*` is proxied to `API_UPSTREAM_URL` here, so the session cookie
 * is an ordinary first-party cookie on this host — which `proxy.ts` and the
 * server-side reads both need to see. Without this, two hosts on a public suffix
 * such as `*.vercel.app` are different *sites* to a browser and no cookie can
 * span them: sign-in succeeds and every protected page bounces to sign-in.
 *
 * `API_UPSTREAM_URL` is server-only and read at build time; unset, there is no
 * rewrite and the browser reaches the API directly, which is local development.
 * Both sides must carry the same prefix — the browser calls `/api/v1/...` because
 * `NEXT_PUBLIC_API_URL` ends in it, and the upstream is expected at the same path.
 */
const upstream = process.env.API_UPSTREAM_URL;
const upstreamUrl = upstream ? new URL(upstream) : undefined;
const upstreamBase = upstreamUrl?.pathname.replace(/\/+$/, '');

/**
 * The simple security headers on every page (report `0007` § 3.2 D7): no framing — the
 * reset link carries its token in the URL — no MIME sniffing, the origin and not the path
 * in a referrer, and none of the three powerful features, which nothing in this app uses.
 * No CSP yet: that is phase 9 of project 011, report-only first.
 *
 * The proxied API paths are left out. The API answers with its own set (helmet: a stricter
 * `no-referrer`, its own CSP), and a second value for the same header on a proxied response
 * would at best be noise and at worst an invalid pair a browser ignores. Static headers do
 * not make a page dynamic: `/` is still prerendered and served from the cache.
 */
const SECURITY_HEADERS = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' }
];

/** Every path, or every path but the proxied API prefix when there is one. */
function pagesSource() {
  if (!upstreamBase) {return '/:path*';}

  const escaped = upstreamBase.slice(1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  return `/:path((?!${escaped}(?:/|$)).*)`;
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [{ headers: SECURITY_HEADERS, source: pagesSource() }];
  },

  async rewrites() {
    if (!upstreamUrl) {return [];}

    return [{ destination: `${upstreamUrl.origin}${upstreamBase}/:path*`, source: `${upstreamBase}/:path*` }];
  }
};

export default nextConfig;
