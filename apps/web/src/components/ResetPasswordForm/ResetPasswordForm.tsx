'use client';
import { Fragment, useState } from 'react';

import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

import styles from 'components/AuthForm/AuthForm.module.css';

import { Button } from 'ui/components/Button';
import { Input } from 'ui/components/Input';

import { authClient } from 'lib/auth-client';

import type { FormEvent } from 'react';

const MIN_PASSWORD_LENGTH = 8;

/** Needs the `?token` query parameter, hence a client component behind Suspense. */
export function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get('token');
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  if (!token) {
    return (
      <Fragment>
        <p className={styles.error} role="alert">
          Este enlace no es válido o ha caducado.
        </p>
        <div className={styles.footer}>
          <Link className={styles.link} href="/recuperar">
            Pedir un enlace nuevo
          </Link>
        </div>
      </Fragment>
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);

    const form = new FormData(event.currentTarget);
    const password = String(form.get('password'));

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);

      return;
    }

    if (password !== String(form.get('confirm'))) {
      setError('Las contraseñas no coinciden.');

      return;
    }

    setPending(true);

    const { error: resetError } = await authClient.resetPassword({ newPassword: password, token: token as string });

    setPending(false);

    if (resetError) {
      setError('Este enlace no es válido o ha caducado.');

      return;
    }

    router.push('/acceder');
  }

  return (
    <form className={styles.form} noValidate={true} onSubmit={onSubmit}>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <Input
        autoComplete="new-password"
        hint={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres.`}
        label="Nueva contraseña"
        minLength={MIN_PASSWORD_LENGTH}
        name="password"
        required={true}
        type="password"
      />
      <Input autoComplete="new-password" label="Repite la contraseña" name="confirm" required={true} type="password" />

      <Button disabled={pending} type="submit">
        {pending ? 'Guardando…' : 'Guardar contraseña'}
      </Button>
    </form>
  );
}
