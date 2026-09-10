import { DEFAULT_LOCALE, LOCALES } from 'i18n/config';
import { withLocale } from 'i18n/routes';

import type { Dictionary } from 'i18n/dictionaries/es-ES';
import type { Locale } from 'i18n/config';

/**
 * The origin every absolute URL the site hands out is built from.
 *
 * An environment variable rather than a constant because the production origin
 * is a `*.vercel.app` host today and a real domain later, and a canonical link
 * — or a sitemap — pointing at the wrong origin is worse than none: it tells a
 * search engine the page it just read is a copy of one somewhere else. Declared
 * in `turbo.json` `globalEnv` — a variable missing there is silently absent
 * from the build.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

/**
 * Every route that has words of its own.
 *
 * The keys are the paths, so a route and its title cannot drift apart: this
 * type is what `pageMetadata` accepts, and a page nobody wrote a title for does
 * not compile.
 */
export type PagePath = keyof Dictionary['pages'];

/** The landing page, which is the one page that leads with the brand rather than ending with it. */
export const HOME: PagePath = '/';

/**
 * The public pages worth a search result — the only ones the sitemap names.
 *
 * Sign-in and sign-up are here because they are real entry points: people
 * search for "nutria acceder" and should land on the form rather than on a
 * homepage they then have to navigate.
 */
export const INDEXABLE_PATHS: readonly PagePath[] = ['/', '/acceder', '/registro'];

/**
 * Public, reachable, and meaningless in a search result.
 *
 * Three of them are transactional dead ends that do nothing without a token
 * from an email, and the fourth is only ever reached by a redirect just after
 * signing up. They say `noindex, follow` rather than being hidden: a crawler
 * that reads them still passes through to the pages they link to.
 */
export const UNINDEXED_PATHS: readonly PagePath[] = ['/pendiente', '/recuperar', '/restablecer', '/verificar-email'];

/**
 * The signed-in tree.
 *
 * A visitor without a session is redirected away from every one of these, so a
 * crawler could never index anything but a redirect. Saying so in `robots.txt`
 * spends no crawl budget discovering that. Prefix matching does the rest:
 * `/plan` covers `/plan/historial` and every meal under it.
 */
export const PRIVATE_PATHS: readonly PagePath[] = [
  '/admin',
  '/check-in',
  '/compra',
  '/inicio',
  '/onboarding',
  '/perfil',
  '/plan',
  '/progreso'
];

/**
 * What `robots.txt` closes.
 *
 * The signed-in tree, plus `/pendiente` — which is public, but is only ever
 * arrived at by a redirect just after signing up. Nothing links to it, so
 * closing it costs no discoverability and saves a crawl of a page whose whole
 * content is "check your email".
 */
export const DISALLOWED_PATHS: readonly PagePath[] = [...PRIVATE_PATHS, '/pendiente'];

/** A site-relative path as the absolute URL a sitemap, a canonical or a robots directive needs. */
export function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).toString();
}

/**
 * The same path in every language, keyed the way `hreflang` and a sitemap's
 * `xhtml:link` both want it, with Spanish as the answer for a reader whose
 * language we do not publish.
 */
export function languageUrls(path: PagePath, absolute = false): Record<string, string> {
  const format = (locale: Locale): string => (absolute ? absoluteUrl(withLocale(path, locale)) : withLocale(path, locale));
  const urls: Record<string, string> = { 'x-default': format(DEFAULT_LOCALE) };

  for (const locale of LOCALES) {
    urls[locale] = format(locale);
  }

  return urls;
}
