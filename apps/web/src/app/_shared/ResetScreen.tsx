import { Fragment, Suspense } from 'react';

import styles from 'components/AuthForm/AuthForm.module.css';

import { dictionaryFor } from 'i18n/server';
import { Text } from 'ui/components/Text';

import { ResetPasswordForm } from 'components/ResetPasswordForm';

import type { Locale } from 'i18n/config';

export function ResetScreen({ locale }: Readonly<{ locale: Locale }>) {
  const dictionary = dictionaryFor(locale);

  return (
    <Fragment>
      <h1 className={styles.title}>{dictionary.auth.chooseNewPassword}</h1>
      <Text className={styles.subtitle} tone="secondary">
        {dictionary.auth.chooseNewPasswordSubtitle}
      </Text>

      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </Fragment>
  );
}
