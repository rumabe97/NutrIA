import Link from 'next/link';

import styles from './AuthShell.module.css';

import { dictionaryFor } from 'i18n/server';
import { withLocale } from 'i18n/routes';

import { LocaleSwitcher } from 'components/LocaleSwitcher';

import type { Locale } from 'i18n/config';
import type { ReactNode } from 'react';

/** The card the signed-out screens sit in, in whichever language the URL asked for. */
export function AuthShell({ children, locale }: Readonly<{ children: ReactNode; locale: Locale }>) {
  const dictionary = dictionaryFor(locale);

  return (
    <div className={styles.shell}>
      <div className={styles.card}>
        {/* Home in the language being read, not the one this route happens to be filed under. */}
        <Link aria-label={dictionary.siteNav.brandHome} className={styles.brand} href={withLocale('/', locale)}>
          <span aria-hidden="true" className={styles.mark} />
          NutrIA
        </Link>
        {/* Signing up in the wrong language is a bad first ten minutes. */}
        <div className={styles.locale}>
          <LocaleSwitcher compact={true} />
        </div>
        {children}
      </div>
    </div>
  );
}
