import { BRAND_GREEN, TILE_BACKGROUND } from 'lib/brandIcon';

import type { MetadataRoute } from 'next';

/**
 * The web app manifest: what a phone needs to put NutrIA on a home screen with a
 * name, an icon and a colour, and open it without browser chrome.
 *
 * Spanish, fixed: a manifest is fetched once and cached by the platform, outside
 * any request that could carry a locale.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: TILE_BACKGROUND,
    description: 'Planes de alimentación personalizados, ajustados cada dos semanas.',
    display: 'standalone',
    icons: [
      { sizes: '180x180', src: '/apple-icon', type: 'image/png' },
      { sizes: '512x512', src: '/icon', type: 'image/png' }
    ],
    name: 'NutrIA',
    short_name: 'NutrIA',
    start_url: '/inicio',
    theme_color: BRAND_GREEN
  };
}
