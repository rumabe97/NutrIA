import { Fragment, Suspense } from 'react';

import styles from 'components/AuthForm/AuthForm.module.css';

import { getDictionary } from 'i18n/server';
import { Text } from 'ui/components/Text';

import { SignInForm } from 'components/SignInForm';

export default async function SignInPage() {
  const dictionary = await getDictionary();

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
