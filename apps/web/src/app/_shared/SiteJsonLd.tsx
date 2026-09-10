import { dictionaryFor } from 'i18n/server';
import { withLocale } from 'i18n/routes';

import { absoluteUrl, SITE_URL } from './pages';
import { JsonLd } from './JsonLd';

import type { Locale } from 'i18n/config';

/**
 * Who publishes this site, and what the site is — the two things a search
 * engine will otherwise guess from whatever text is nearest the logo.
 *
 * Deliberately only those two. There is no `aggregateRating` because nobody has
 * rated NutrIA, no `offers` because nothing is priced, and no `SearchAction`
 * because the site has no search — every one of those is markup describing a
 * thing that does not exist, which is a spam violation rather than an
 * optimisation. `SoftwareApplication` is left out for a quieter reason: without
 * a price or a rating it earns no rich result at all, so it would add a
 * warning in Search Console and nothing else.
 *
 * The organisation carries one `@id` across both languages because it is one
 * organisation; the site nodes differ because `/` and `/en` are two entry
 * points and each says which language it is written in.
 */
export function SiteJsonLd({ locale }: Readonly<{ locale: Locale }>) {
  const dictionary = dictionaryFor(locale);
  const home = absoluteUrl(withLocale('/', locale));
  const organisation = `${SITE_URL}/#organization`;

  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@graph': [
          { '@id': organisation, '@type': 'Organization', logo: absoluteUrl('/icon'), name: 'NutrIA', url: SITE_URL },
          {
            '@id': `${home}#website`,
            '@type': 'WebSite',
            description: dictionary.landing.lede,
            inLanguage: locale,
            name: 'NutrIA',
            publisher: { '@id': organisation },
            url: home
          }
        ]
      }}
    />
  );
}
