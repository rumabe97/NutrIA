import styles from './SkipLink.module.css';

import { dictionaryFor } from 'i18n/server';

import { MAIN_ID } from './mainId';

import type { Locale } from 'i18n/config';

/**
 * The first thing in the tab order, and invisible until it is.
 *
 * The signed-in shell puts the brand, six section links and a sign-out button
 * ahead of the content on a desktop; the landing page puts a header and the
 * language switcher there. Without this, reaching the first thing on the screen
 * by keyboard costs eight presses on every navigation.
 *
 * It lives in `RootShell` so all three roots get it from one place — one of
 * them acquiring it and the others not is the failure mode a shared shell
 * exists to prevent.
 */
export function SkipLink({ locale }: Readonly<{ locale: Locale }>) {
  return (
    <a className={styles.link} href={`#${MAIN_ID}`}>
      {dictionaryFor(locale).a11y.skipToContent}
    </a>
  );
}
