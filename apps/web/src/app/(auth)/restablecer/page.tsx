import { Fragment, Suspense } from 'react';

import styles from 'components/AuthForm/AuthForm.module.css';

import { getDictionary } from 'i18n/server';
import { Text } from 'ui/components/Text';

import { ResetPasswordForm } from 'components/ResetPasswordForm';

export default async function ResetPasswordPage() {
  const dictionary = await getDictionary();

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
