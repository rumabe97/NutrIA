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

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    if (!upstream) {return [];}

    const { origin, pathname } = new URL(upstream);
    const base = pathname.replace(/\/+$/, '');

    return [{ destination: `${origin}${base}/:path*`, source: `${base}/:path*` }];
  }
};

export default nextConfig;
