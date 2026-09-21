import { Fragment } from 'react';

import styles from './LegalScreen.module.css';

import { dictionaryFor } from 'i18n/server';
import { Heading } from 'ui/components/Heading';
import { interpolate } from 'i18n/interpolate';
import { LEGAL_IDENTITY } from 'i18n/legalIdentity';
import { Text } from 'ui/components/Text';

import { SiteFooter } from 'components/SiteFooter';
import { SiteHeader } from 'components/SiteHeader';

import { MAIN_ID } from './mainId';

import type { Locale } from 'i18n/config';

/** The two documents this screen can print, named by their key in the dictionary. */
type LegalDocument = 'privacy' | 'terms';

/**
 * A legal document — the privacy policy or the terms of use — in whichever
 * language the route is mounted under (`0058`).
 *
 * A document, not a marketing page: one column, no hero, no card — long
 * paragraphs read better at a narrower measure than the rest of the site, so
 * `--prose-max` bounds the column instead of `--content-max`. The words live in
 * the dictionary (`dictionary.privacy`, `dictionary.terms`) rather than here,
 * the same split the FAQ already uses, so a wording change is a translation
 * change, not a code change — and both documents have one shape, so a third is
 * a dictionary entry and a route.
 */
export function LegalScreen({ document, locale }: Readonly<{ document: LegalDocument; locale: Locale }>) {
  const dictionary = dictionaryFor(locale);
  const t = dictionary[document];
  // The documents say `{name}` and `{email}`; who that is lives in one file.
  const fill = (text: string): string => interpolate(text, LEGAL_IDENTITY);

  return (
    <Fragment>
      <SiteHeader />

      <main className={styles.main} id={MAIN_ID}>
        <article className={styles.article}>
          <Heading level="1" size="xl">
            {t.title}
          </Heading>
          <Text className={styles.updated} size="sm" tone="secondary">
            {t.updated}
          </Text>

          {t.intro.map(paragraph => (
            <Text className={styles.paragraph} key={paragraph}>
              {fill(paragraph)}
            </Text>
          ))}

          {t.sections.map(section => (
            <section className={styles.section} key={section.heading}>
              <Heading level="2" size="md">
                {section.heading}
              </Heading>

              {section.paragraphs.map(paragraph => (
                <Text className={styles.paragraph} key={paragraph}>
                  {fill(paragraph)}
                </Text>
              ))}

              {section.list ? (
                <ul className={styles.list}>
                  {section.list.map(item => (
                    <li key={item}>
                      <Text as="span">{fill(item)}</Text>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </article>
      </main>

      <SiteFooter />
    </Fragment>
  );
}
