'use client';
import { Fragment, useState } from 'react';

import Link from 'next/link';

import styles from '../../../components/AuthForm/AuthForm.module.css';

import { Button } from 'ui/components/Button';
import { Input } from 'ui/components/Input';
import { Text } from 'ui/components/Text';

import { authClient } from 'lib/auth-client';

import type { FormEvent } from 'react';

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);

    const form = new FormData(event.currentTarget);

    await authClient.requestPasswordReset({ email: String(form.get('email')), redirectTo: '/restablecer' });

    setPending(false);
    // Always the same confirmation, whether or not the address exists —
    // otherwise this form tells an attacker which emails are registered.
    setSent(true);
  }

  if (sent) {
    return (
      <Fragment>
        <h1 className={styles.title}>Revisa tu correo</h1>
        <p className={styles.success}>
          Si existe una cuenta con ese correo, te hemos enviado un enlace para restablecer la contraseña. Caduca en una hora.
        </p>
        <div className={styles.footer}>
          <Link className={styles.link} href="/acceder">
            Volver a acceder
          </Link>
        </div>
      </Fragment>
    );
  }

  return (
    <Fragment>
      <h1 className={styles.title}>Recuperar contraseña</h1>
      <Text className={styles.subtitle} tone="secondary">
        Escribe tu correo y te enviaremos un enlace para elegir una nueva.
      </Text>

      <form className={styles.form} noValidate={true} onSubmit={onSubmit}>
        <Input autoComplete="email" label="Correo electrónico" name="email" required={true} type="email" />

        <Button disabled={pending} type="submit">
          {pending ? 'Enviando…' : 'Enviar enlace'}
        </Button>

        <div className={styles.footer}>
          <Link className={styles.link} href="/acceder">
            Volver a acceder
          </Link>
        </div>
      </form>
    </Fragment>
  );
}
