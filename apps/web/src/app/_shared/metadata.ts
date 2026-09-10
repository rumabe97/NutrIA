import { activeLocale, dictionaryFor } from 'i18n/server';
import { LOCALES } from 'i18n/config';
import { withLocale } from 'i18n/routes';

import { PAGE_BACKGROUND } from 'lib/brandIcon';

import { HOME, languageUrls, SITE_URL, UNINDEXED_PATHS } from './pages';

import type { Locale } from 'i18n/config';
import type { Metadata, Viewport } from 'next';
import type { PagePath } from './pages';

/** The name the title template appends, and the name Open Graph calls the site. */
const BRAND = 'NutrIA';

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
 * The name, the sentence and the title template every page inherits.
 *
 * Built from the dictionary rather than written twice: the description is the
 * same sentence the hero shows, and a search result or a shared link in the
 * wrong language is the first thing a reader sees.
 *
 * `template` is what lets each page below carry only its own name — "Tu plan"
 * becomes "Tu plan · NutrIA" — so no page has to remember the suffix and none
 * of them can spell it differently. `default` is the landing page's own title,
 * the one place the brand leads instead of trailing.
 */
export function rootMetadata(locale: Locale): Metadata {
  const dictionary = dictionaryFor(locale);

  return {
    description: dictionary.landing.lede,
    // Per language, because a manifest's `start_url` decides which language an
    // installed app opens in, and an installed app has no address bar to correct.
    manifest: withLocale('/manifest.webmanifest', locale),
    metadataBase: new URL(SITE_URL),
    openGraph: openGraphFor(locale),
    title: { default: dictionary.pages[HOME].title, template: `%s · ${BRAND}` },
    twitter: { card: 'summary_large_image' }
  };
}

/**
 * Everything a public page says about itself: its name, its sentence, its
 * address, its translations, and whether it belongs in an index at all.
 *
 * The alternates are reciprocal on purpose — each page names every language
 * including itself, which is what makes a search engine treat the two as one
 * page in two languages rather than two pages competing for the same words.
 * `x-default` is Spanish, the language a reader gets when the engine has no
 * better guess: the same answer an unprefixed URL gives. Both are relative and
 * resolved against `metadataBase`, so a change of domain is one environment
 * variable rather than a search-and-replace.
 *
 * Deliberately no `openGraph` block. Next merges metadata one key deep, so a
 * page that sets any of it replaces all of the root's — including the
 * `opengraph-image` the root's tree contributes, which is the whole point of
 * having one. Left alone, `og:title` and `og:description` are filled from the
 * title and description above and the card keeps its picture. The one field
 * that costs is `og:url`, and every scraper falls back to the URL it fetched,
 * which for these pages is the canonical one anyway.
 */
export function pageMetadata(locale: Locale, path: PagePath): Metadata {
  const dictionary = dictionaryFor(locale);
  const page = dictionary.pages[path];
  const canonical = withLocale(path, locale);
  const description = 'description' in page ? page.description : dictionary.landing.lede;

  return {
    alternates: { canonical, languages: languageUrls(path) },
    description,
    // `follow` on purpose: these pages are worthless in a result list but they
    // still link onward, and a crawler told to stop reading here would stop
    // there too.
    robots: UNINDEXED_PATHS.includes(path) ? { follow: true, index: false } : undefined,
    // The landing page is the one title that leads with the brand, so it opts
    // out of the layout's "%s · NutrIA" template rather than being run through it.
    title: path === HOME ? { absolute: page.title } : page.title
  };
}

/**
 * A signed-in screen's title.
 *
 * There is nothing else to say: no crawler reaches these, and a description
 * would be copy written for a reader who does not exist. The title is not
 * decoration either — it is what a screen reader announces when the screen
 * changes, and every one of these announcing "NutrIA" was WCAG 2.4.2 failing
 * on fourteen screens at once.
 */
export async function appMetadata(path: PagePath): Promise<Metadata> {
  return { title: dictionaryFor(await activeLocale()).pages[path].title };
}

/** What Open Graph needs before a page adds its own words: who published it, and in which language. */
function openGraphFor(locale: Locale): Metadata['openGraph'] {
  return {
    alternateLocale: LOCALES.filter(other => other !== locale).map(openGraphLocale),
    locale: openGraphLocale(locale),
    siteName: BRAND,
    type: 'website'
  };
}

/** Open Graph writes a locale `es_ES`, not `es-ES`, and a card renders in the wrong language when it disagrees. */
function openGraphLocale(locale: Locale): string {
  return locale.replace('-', '_');
}
