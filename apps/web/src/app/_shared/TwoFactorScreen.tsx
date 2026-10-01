import { Fragment, Suspense } from 'react';

import styles from 'components/AuthForm/AuthForm.module.css';

import { dictionaryFor } from 'i18n/server';

import { TwoFactorChallenge } from 'components/TwoFactorChallenge';

import type { Locale } from 'i18n/config';

/**
 * The second step of a sign-in with two-factor on. Static like the sign-in page: the
 * pending sign-in lives in a cookie only the API reads, and `src/proxy.ts` sends a
 * visit without one back to `/acceder`.
 */
export function TwoFactorScreen({ locale }: Readonly<{ locale: Locale }>) {
  const dictionary = dictionaryFor(locale);

  return (
    <Fragment>
      <h1 className={styles.title}>{dictionary.twoFactor.challengeTitle}</h1>

      {/* useSearchParams needs a Suspense boundary, otherwise the whole route
          opts out of static rendering. */}
      <Suspense fallback={null}>
        <TwoFactorChallenge />
      </Suspense>
    </Fragment>
  );
}
