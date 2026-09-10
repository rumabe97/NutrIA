import { LOCALES } from 'i18n/config';
import { withLocale } from 'i18n/routes';

import { absoluteUrl, INDEXABLE_PATHS, languageUrls } from './_shared/pages';

import type { MetadataRoute } from 'next';

/**
 * The pages a search engine is invited to index, each one listed once per
 * language and each entry naming every language it exists in.
 *
 * The pairing is stated twice on purpose — here and in each page's `hreflang`.
 * A sitemap is often the first thing a crawler reads, and telling it there that
 * `/registro` and `/en/registro` are one page in two languages is what stops
 * the two from being weighed against each other before either is fetched.
 *
 * Only the indexable pages are here. The transactional screens say `noindex`,
 * and a sitemap that submits a URL the page then refuses is a contradiction a
 * search console reports back as an error rather than resolving.
 *
 * No `lastModified`, `priority` or `changeFrequency`: the last two are ignored
 * outright, and a modification date we do not actually track would be a
 * fabricated one.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return INDEXABLE_PATHS.flatMap(path =>
    LOCALES.map(locale => ({ alternates: { languages: languageUrls(path, true) }, url: absoluteUrl(withLocale(path, locale)) }))
  );
}
