import { NextResponse } from 'next/server';

import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, parseLocale } from './i18n/config';
import { isLocalised, localeFromPathname, withLocale, withoutLocale } from './i18n/routes';

import type { Locale } from './i18n/config';
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
// Written without a language segment and matched against the stripped path, so
// each route is named once and `/en/inicio` is as protected as `/inicio`. `/en`
// is a language, not a route, and must never match any of these.
const PROTECTED = ['/admin', '/compra', '/inicio', '/onboarding', '/pendiente', '/perfil', '/plan', '/progreso'];
const AUTH_ROUTES = ['/acceder', '/registro'];

export function proxy(request: NextRequest): NextResponse {
  const { nextUrl } = request;
  const hasSession = request.cookies.has(SESSION_COOKIE) || request.cookies.has(`__Secure-${SESSION_COOKIE}`);
  const path = withoutLocale(nextUrl.pathname);
  const asked = localeFromPathname(nextUrl.pathname);
  const chosen = parseLocale(request.cookies.get(LOCALE_COOKIE)?.value);
  // The URL wins whenever it names a language. The cookie speaks only for the
  // addresses that cannot carry one — every unprefixed path, which is all of
  // Spanish and all of the signed-in app.
  const locale = asked === DEFAULT_LOCALE ? (chosen ?? DEFAULT_LOCALE) : asked;

  // The links this app shares with its signed-in chrome — the header's sign-in
  // link, the footer's — are unprefixed and cannot know which language they are
  // being read in. Somebody who has chosen English would land on the Spanish
  // page; send them to the twin instead, so a URL and its language never
  // disagree. Nobody who has chosen nothing is ever redirected: Spanish URLs
  // stay exactly as they were for every first-time visitor and every crawler.
  if (locale !== asked && isLocalised(nextUrl.pathname)) {
    const url = nextUrl.clone();

    url.pathname = withLocale(path, locale);

    return NextResponse.redirect(url);
  }

  if (!hasSession && PROTECTED.some(protectedPath => path.startsWith(protectedPath))) {
    const url = nextUrl.clone();

    url.pathname = withLocale('/acceder', locale);
    // Bring them back where they were going once they are signed in. The
    // stripped path, because that is the address the signed-in screens have.
    url.searchParams.set('siguiente', path);

    return remember(NextResponse.redirect(url), asked, chosen);
  }

  if (hasSession && AUTH_ROUTES.some(authPath => path.startsWith(authPath))) {
    const url = nextUrl.clone();

    url.pathname = '/inicio';
    url.search = '';

    return remember(NextResponse.redirect(url), asked, chosen);
  }

  return remember(NextResponse.next(), asked, chosen);
}

/**
 * Records the language the URL asked for.
 *
 * Following a link into `/en` is a choice, and the pages that cannot carry the
 * prefix — the signed-in screens, and the shared header and footer — have
 * nothing else to read. Without this, a visitor who arrives at `/en` from a
 * search result is thrown back into Spanish by the first link they click.
 *
 * Only ever written when the URL names a language the cookie does not already
 * hold, so the steady state adds no header at all.
 */
function remember(response: NextResponse, asked: Locale, chosen: Locale | null): NextResponse {
  if (asked === DEFAULT_LOCALE || asked === chosen) {return response;}

  response.cookies.set(LOCALE_COOKIE, asked, { maxAge: LOCALE_COOKIE_MAX_AGE, path: '/', sameSite: 'lax' });

  return response;
}

// `api/` is excluded: when the API is proxied through this host (`next.config.js`),
// every API call would otherwise pass through here first — a redirect check that
// can never apply to it, paid on the hottest path in the app.
export const config = { matcher: ['/((?!api/|_next/static|_next/image|favicon.ico).*)'] };
