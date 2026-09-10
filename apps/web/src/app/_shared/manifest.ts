import { dictionaryFor } from 'i18n/server';
import { withLocale } from 'i18n/routes';

import { BRAND_GREEN, TILE_BACKGROUND } from 'lib/brandIcon';

import type { Locale } from 'i18n/config';
import type { MetadataRoute } from 'next';

/**
 * What a phone needs to put NutrIA on a home screen with a name, an icon and a
 * colour, and open it without browser chrome.
 *
 * `start_url` is the landing page rather than `/inicio`: a manifest is fetched
 * once, at install time, and `/inicio` is behind a session — anybody who
 * installed the app before signing in was bounced to the sign-in screen every
 * single time they opened it. `scope` is the whole site so the signed-in screens
 * still open inside the installed window rather than in a browser tab.
 *
 * One per language, because `start_url` is what decides which language the app
 * opens in, and an installed app that opens in the wrong one has no address bar
 * to correct it with.
 */
export function webManifest(locale: Locale): MetadataRoute.Manifest {
  const dictionary = dictionaryFor(locale);

  return {
    background_color: TILE_BACKGROUND,
    description: dictionary.manifest.description,
    display: 'standalone',
    icons: [
      { sizes: '180x180', src: '/apple-icon', type: 'image/png' },
      { sizes: '512x512', src: '/icon', type: 'image/png' }
    ],
    name: 'NutrIA',
    scope: '/',
    short_name: 'NutrIA',
    start_url: withLocale('/', locale),
    theme_color: BRAND_GREEN
  };
}
