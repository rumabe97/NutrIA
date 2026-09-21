import { Fragment } from 'react';

import styles from './PrivacyScreen.module.css';

import { dictionaryFor } from 'i18n/server';
import { Heading } from 'ui/components/Heading';
import { Text } from 'ui/components/Text';

import { SiteFooter } from 'components/SiteFooter';
import { SiteHeader } from 'components/SiteHeader';

import { MAIN_ID } from './mainId';

import type { Locale } from 'i18n/config';

/**
 * The privacy policy, in whichever language the route is mounted under (`0058`).
 *
 * A document, not a marketing page: one column, no hero, no card — long
 * paragraphs read better at a narrower measure than the rest of the site, so
 * `--prose-max` bounds the column instead of `--content-max`. Content lives in
 * the dictionary (`dictionary.privacy`) rather than in this file, the same
 * split the FAQ already uses, so a wording change is a translation change, not
 * a code change.
 */
export function PrivacyScreen({ locale }: Readonly<{ locale: Locale }>) {
  const dictionary = dictionaryFor(locale);
  const t = dictionary.privacy;

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
              {paragraph}
            </Text>
          ))}

          {t.sections.map(section => (
            <section className={styles.section} key={section.heading}>
              <Heading level="2" size="md">
                {section.heading}
              </Heading>

              {section.paragraphs.map(paragraph => (
                <Text className={styles.paragraph} key={paragraph}>
                  {paragraph}
                </Text>
              ))}

              {section.list ? (
                <ul className={styles.list}>
                  {section.list.map(item => (
                    <li key={item}>
                      <Text as="span">{item}</Text>
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
