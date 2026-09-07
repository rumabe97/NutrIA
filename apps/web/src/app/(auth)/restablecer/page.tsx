import { Fragment, Suspense } from 'react';

import styles from 'components/AuthForm/AuthForm.module.css';

import { Text } from 'ui/components/Text';

import { ResetPasswordForm } from 'components/ResetPasswordForm';

export default function ResetPasswordPage() {
  return (
    <Fragment>
      <h1 className={styles.title}>Elige una contraseña nueva</h1>
      <Text className={styles.subtitle} tone="secondary">
        Después podrás acceder con ella.
      </Text>

      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </Fragment>
  );
}
