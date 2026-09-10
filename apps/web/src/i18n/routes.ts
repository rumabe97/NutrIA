/**
 * Which URL belongs to which language.
 *
 * Spanish is served unprefixed and English under `/en`, so every public page has
 * one address per language and a crawler can index both. The prefix is the only
 * thing that decides a public page's language: deciding it from a cookie or an
 * `Accept-Language` header is what kept two languages on one URL — the English
 * half unindexable — and what pulled the whole tree out of static rendering.
 */

import { DEFAULT_LOCALE, LOCALES } from './config';

import type { Locale } from './config';

/**
 * The path segment each locale is served from.
 *
 * The default locale deliberately has none: `/`, `/registro` and `/acceder` are
 * links people already hold, and moving them under `/es/…` would break every one
 * of them to buy nothing.
 */
const SEGMENTS: Record<Locale, string> = { 'en-GB': '/en', 'es-ES': '' };

/**
 * The paths that exist in both trees.
 *
 * The signed-in screens are not among them: they sit behind a session, are never
 * crawled, and take their language from the account's preference instead. Add a
 * public route here when you add it to both `src/app/(es)` and `src/app/en`, or
 * the switcher and the proxy will keep sending people to the Spanish one.
 */
export const LOCALISED_PATHS: readonly string[] = [
  '/',
  '/acceder',
  '/pendiente',
  '/recuperar',
  '/registro',
  '/restablecer',
  '/verificar-email'
];

/** The language a URL asks for. Anything unprefixed is the default one. */
export function localeFromPathname(pathname: string): Locale {
  return LOCALES.find(locale => SEGMENTS[locale] !== '' && isUnder(pathname, SEGMENTS[locale])) ?? DEFAULT_LOCALE;
}

/** The same page with its language segment removed — the form the proxy and the switcher both compare. */
export function withoutLocale(pathname: string): string {
  const segment = SEGMENTS[localeFromPathname(pathname)];

  if (segment === '') {return pathname;}

  const rest = pathname.slice(segment.length);

  return rest === '' ? '/' : rest;
}

/** The same page in another language. */
export function withLocale(path: string, locale: Locale): string {
  const segment = SEGMENTS[locale];

  if (segment === '') {return path;}

  // `/en/` and `/en` are different URLs to Next, and only the second is a route.
  return path === '/' ? segment : `${segment}${path}`;
}

/** Whether this page is one of the ones that exists in every language. */
export function isLocalised(pathname: string): boolean {
  return LOCALISED_PATHS.includes(withoutLocale(pathname));
}

/** A prefix match on whole segments, so `/english` is not read as English. */
function isUnder(pathname: string, segment: string): boolean {
  return pathname === segment || pathname.startsWith(`${segment}/`);
}
