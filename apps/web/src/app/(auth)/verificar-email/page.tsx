import { Fragment } from 'react';

import Link from 'next/link';

import styles from '../../../components/AuthForm/AuthForm.module.css';

import { Text } from 'ui/components/Text';

/**
 * The landing spot after sign-up. Verification itself happens on the API — the
 * emailed link hits Better Auth's own endpoint — so this page only explains
 * what to do next.
 */
export default function VerifyEmailPage() {
  return (
    <Fragment>
      <h1 className={styles.title}>Confirma tu correo</h1>
      <p className={styles.success}>Te hemos enviado un enlace de confirmación. Ábrelo desde este dispositivo para activar tu cuenta.</p>

      <Text size="sm" style={{ marginTop: 'var(--space-05)' }} tone="secondary">
        Mientras tanto puedes seguir configurando tu perfil: tu plan se generará cuando termines.
      </Text>

      <div className={styles.footer}>
        <Link className={styles.link} href="/inicio">
          Ir a mi cuenta
        </Link>
      </div>
    </Fragment>
  );
}
