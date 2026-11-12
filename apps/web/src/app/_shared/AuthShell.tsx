import Link from 'next/link';

import styles from './AuthShell.module.css';

import { dictionaryFor } from 'i18n/server';
import { withLocale } from 'i18n/routes';

import { HeaderPattern } from 'components/HeaderPattern';
import { LocaleSwitcher } from 'components/LocaleSwitcher';
import { ThemeSwitcher } from 'components/ThemeSwitcher';

import { MAIN_ID } from './mainId';

import type { Locale } from 'i18n/config';
import type { ReactNode } from 'react';

/**
 * The signed-out screens' frame, in whichever language the URL asked for (project 024 phase 7,
 * `reference/02-mobile-complete.jpg`, «Acceder»): the header the app wears — the brand at the
 * start, language and theme at the end, the hatched pattern behind — and one column under it.
 */
export function AuthShell({ children, locale }: Readonly<{ children: ReactNode; locale: Locale }>) {
  const dictionary = dictionaryFor(locale);

  return (
    <div className={styles.shell}>
      <HeaderPattern />

      <header className={styles.header}>
        {/* Home in the language being read, not the one this route happens to be filed under. */}
        <Link aria-label={dictionary.siteNav.brandHome} className={styles.brand} href={withLocale('/', locale)}>
          <span aria-hidden="true" className={styles.mark} />
          NutrIA
        </Link>
        {/* Signing up in the wrong language is a bad first ten minutes. */}
        <div className={styles.actions}>
          <LocaleSwitcher compact={true} />
          <ThemeSwitcher />
        </div>
      </header>

      {/* The brand link and the language switcher sit above it, so the form is
          what the skip link and a route change both land on. */}
      <main className={`${styles.column} motion-enter`} id={MAIN_ID}>
        {children}
      </main>
    </div>
  );
}
