import { DEFAULT_LOCALE, LOCALES } from 'i18n/config';
import { dictionaryFor } from 'i18n/server';
import { withLocale } from 'i18n/routes';

import { PAGE_BACKGROUND } from 'lib/brandIcon';

import type { Locale } from 'i18n/config';
import type { Metadata, Viewport } from 'next';

/**
 * The origin every absolute URL in the page's head is built from.
 *
 * An environment variable rather than a constant because the production origin
 * is a `*.vercel.app` host today and a real domain later, and a canonical link
 * pointing at the wrong origin is worse than none: it tells a search engine the
 * page it just read is a copy of one somewhere else. Declared in `turbo.json`
 * `globalEnv` — a variable missing there is silently absent from the build.
 */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

/**
 * The colour a phone's browser paints its own chrome to match the page — one per
 * scheme, because the page background follows the scheme and a dark bar over a
 * light page looks like a mistake.
 */
export const siteViewport: Viewport = {
  themeColor: [
    { color: PAGE_BACKGROUND.light, media: '(prefers-color-scheme: light)' },
    { color: PAGE_BACKGROUND.dark, media: '(prefers-color-scheme: dark)' }
  ]
};

/**
 * The name and sentence every page inherits.
 *
 * Built from the dictionary rather than written twice: the description is the
 * same sentence the hero shows, and a search result or a shared link in the
 * wrong language is the first thing a reader sees.
 */
export function rootMetadata(locale: Locale): Metadata {
  const dictionary = dictionaryFor(locale);

  return { description: dictionary.landing.lede, metadataBase: new URL(SITE_URL), title: `NutrIA — ${dictionary.landing.title}` };
}

/**
 * What a page says about its own address and its translations.
 *
 * Reciprocal on purpose: each page names every language including itself, which
 * is what makes a search engine treat the two as one page in two languages
 * rather than two pages competing for the same words. `x-default` is Spanish,
 * the language a reader gets when the engine has no better guess — the same
 * answer an unprefixed URL gives.
 *
 * Both are relative and resolved against `metadataBase`, so a change of domain
 * is one environment variable rather than a search-and-replace.
 */
export function pageMetadata(locale: Locale, path: string): Metadata {
  const languages: Record<string, string> = { 'x-default': withLocale(path, DEFAULT_LOCALE) };

  for (const other of LOCALES) {
    languages[other] = withLocale(path, other);
  }

  return { alternates: { canonical: withLocale(path, locale), languages } };
}
