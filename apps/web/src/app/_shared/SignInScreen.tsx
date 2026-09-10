import { Fragment, Suspense } from 'react';

import styles from 'components/AuthForm/AuthForm.module.css';

import { dictionaryFor } from 'i18n/server';
import { Text } from 'ui/components/Text';

import { SignInForm } from 'components/SignInForm';

import type { Locale } from 'i18n/config';

export function SignInScreen({ locale }: Readonly<{ locale: Locale }>) {
  const dictionary = dictionaryFor(locale);

  return (
    <Fragment>
      <h1 className={styles.title}>{dictionary.auth.signInTitle}</h1>
      <Text className={styles.subtitle} tone="secondary">
        {dictionary.auth.signInSubtitle}
      </Text>

      {/* useSearchParams needs a Suspense boundary, otherwise the whole route
          opts out of static rendering. */}
      <Suspense fallback={null}>
        <SignInForm />
      </Suspense>
    </Fragment>
  );
}
