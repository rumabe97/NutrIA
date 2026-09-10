import { LOCALES } from 'i18n/config';
import { withLocale } from 'i18n/routes';

import { absoluteUrl, DISALLOWED_PATHS } from './_shared/pages';

import type { MetadataRoute } from 'next';

/**
 * What a crawler may read.
 *
 * The public tree is open and the signed-in one is closed, in both languages —
 * `/en/inicio` does not exist, but a directive costs nothing and a link someone
 * writes by hand should not send a crawler hunting for a 404. The sitemap is
 * given as an absolute URL because the `Sitemap:` line is the one place in
 * `robots.txt` where a relative path is not allowed.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { allow: '/', disallow: DISALLOWED_PATHS.flatMap(path => LOCALES.map(locale => withLocale(path, locale))), userAgent: '*' },
    sitemap: absoluteUrl('/sitemap.xml')
  };
}
