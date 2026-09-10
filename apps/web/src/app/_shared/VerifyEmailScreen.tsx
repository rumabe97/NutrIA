import { Fragment } from 'react';

import Link from 'next/link';

import styles from 'components/AuthForm/AuthForm.module.css';

import { dictionaryFor } from 'i18n/server';
import { Text } from 'ui/components/Text';

import type { Locale } from 'i18n/config';

/**
 * The landing spot after sign-up. Verification itself happens on the API — the
 * emailed link hits Better Auth's own endpoint — so this page only explains
 * what to do next.
 */
export function VerifyEmailScreen({ locale }: Readonly<{ locale: Locale }>) {
  const dictionary = dictionaryFor(locale);

  return (
    <Fragment>
      <h1 className={styles.title}>{dictionary.auth.verifyTitle}</h1>
      <p className={styles.success}>{dictionary.auth.verifyBody}</p>

      <Text size="sm" style={{ marginTop: 'var(--space-05)' }} tone="secondary">
        {dictionary.auth.verifyMeanwhile}
      </Text>

      <div className={styles.footer}>
        {/* The signed-in screens have no English URL of their own — the account's
            own preference carries the language from here on. */}
        <Link className={styles.link} href="/inicio">
          {dictionary.auth.goToAccount}
        </Link>
      </div>
    </Fragment>
  );
}
