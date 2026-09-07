import { Fragment, Suspense } from 'react';

import styles from 'components/AuthForm/AuthForm.module.css';

import { Text } from 'ui/components/Text';

import { SignInForm } from 'components/SignInForm';

export default function SignInPage() {
  return (
    <Fragment>
      <h1 className={styles.title}>Bienvenido de nuevo</h1>
      <Text className={styles.subtitle} tone="secondary">
        Accede para ver tu plan de hoy.
      </Text>

      {/* useSearchParams needs a Suspense boundary, otherwise the whole route
          opts out of static rendering. */}
      <Suspense fallback={null}>
        <SignInForm />
      </Suspense>
    </Fragment>
  );
}
