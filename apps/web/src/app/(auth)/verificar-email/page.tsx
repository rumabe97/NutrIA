import { Fragment } from 'react';

import Link from 'next/link';

import styles from '../../../components/AuthForm/AuthForm.module.css';

import { getDictionary } from 'i18n/server';
import { Text } from 'ui/components/Text';

/**
 * The landing spot after sign-up. Verification itself happens on the API — the
 * emailed link hits Better Auth's own endpoint — so this page only explains
 * what to do next.
 */
export default async function VerifyEmailPage() {
  const dictionary = await getDictionary();

  return (
    <Fragment>
      <h1 className={styles.title}>{dictionary.auth.verifyTitle}</h1>
      <p className={styles.success}>{dictionary.auth.verifyBody}</p>

      <Text size="sm" style={{ marginTop: 'var(--space-05)' }} tone="secondary">
        {dictionary.auth.verifyMeanwhile}
      </Text>

      <div className={styles.footer}>
        <Link className={styles.link} href="/inicio">
          {dictionary.auth.goToAccount}
        </Link>
      </div>
    </Fragment>
  );
}
