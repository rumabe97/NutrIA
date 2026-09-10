import { dictionaryFor } from 'i18n/server';

import { PAGE_BACKGROUND } from 'lib/brandIcon';

import type { Locale } from 'i18n/config';
import type { Metadata, Viewport } from 'next';

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

  return { description: dictionary.landing.lede, title: `NutrIA — ${dictionary.landing.title}` };
}
