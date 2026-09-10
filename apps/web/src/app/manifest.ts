import { DEFAULT_LOCALE } from 'i18n/config';

import { webManifest } from './_shared/manifest';

import type { MetadataRoute } from 'next';

/** The default language's manifest, at the address Next's file convention gives it. The English one is served from `/en`. */
export default function manifest(): MetadataRoute.Manifest {
  return webManifest(DEFAULT_LOCALE);
}
