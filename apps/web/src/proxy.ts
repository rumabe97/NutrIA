import { NextResponse } from 'next/server';

import type { NextRequest } from 'next/server';

// Next.js v16 renamed `middleware.ts` → `proxy.ts` and the exported function
// from `middleware` → `proxy`.
//
// This is a **redirect for signed-out visitors, not an authorisation check.**
// It only looks for the presence of a session cookie, which a client can set to
// anything — the real check is `SessionGuard` in apps/api, which validates the
// session on every request. Keeping that distinction explicit matters: a
// cookie-presence test that looks like a security control is how apps end up
// with none.
const SESSION_COOKIE = 'better-auth.session_token';
const PROTECTED = ['/compra', '/inicio', '/onboarding', '/perfil', '/plan'];
const AUTH_ROUTES = ['/acceder', '/registro'];

export function proxy(request: NextRequest): NextResponse {
  const { nextUrl } = request;
  const hasSession = request.cookies.has(SESSION_COOKIE) || request.cookies.has(`__Secure-${SESSION_COOKIE}`);

  if (!hasSession && PROTECTED.some(path => nextUrl.pathname.startsWith(path))) {
    const url = nextUrl.clone();

    url.pathname = '/acceder';
    // Bring them back where they were going once they are signed in.
    url.searchParams.set('siguiente', nextUrl.pathname);

    return NextResponse.redirect(url);
  }

  if (hasSession && AUTH_ROUTES.some(path => nextUrl.pathname.startsWith(path))) {
    const url = nextUrl.clone();

    url.pathname = '/inicio';
    url.search = '';

    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
