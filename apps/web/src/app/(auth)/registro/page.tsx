'use client';
import { Fragment, useState } from 'react';

import { useRouter } from 'next/navigation';
import Link from 'next/link';

import styles from '../../../components/AuthForm/AuthForm.module.css';

import { Button } from 'ui/components/Button';
import { Input } from 'ui/components/Input';
import { Text } from 'ui/components/Text';

import { signUp } from 'lib/auth-client';

import type { FormEvent } from 'react';

const MIN_PASSWORD_LENGTH = 8;

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);

    const form = new FormData(event.currentTarget);
    const password = String(form.get('password'));

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);

      return;
    }

    setPending(true);

    const { error: signUpError } = await signUp.email({
      email: String(form.get('email')),
      name: String(form.get('name')),
      password
    });

    setPending(false);

    if (signUpError) {
      // Better Auth distinguishes "email already registered" from everything
      // else. Both are shown as-is: at sign-*up* an existing address is
      // information the visitor already has, and hiding it only produces a
      // confusing dead end.
      setError(signUpError.status === 422 ? 'Ya existe una cuenta con ese correo.' : 'No hemos podido crear la cuenta. Inténtalo de nuevo.');

      return;
    }

    router.push('/onboarding/1');
  }

  return (
    <Fragment>
      <h1 className={styles.title}>Crea tu cuenta</h1>
      <Text className={styles.subtitle} tone="secondary">
        Unos minutos de preguntas y tendrás tu primer plan de catorce días.
      </Text>

      <form className={styles.form} noValidate={true} onSubmit={onSubmit}>
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}

        <Input autoComplete="name" label="Nombre" name="name" required={true} type="text" />
        <Input autoComplete="email" label="Correo electrónico" name="email" required={true} type="email" />
        <Input
          autoComplete="new-password"
          hint={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres.`}
          label="Contraseña"
          minLength={MIN_PASSWORD_LENGTH}
          name="password"
          required={true}
          type="password"
        />

        <Button disabled={pending} type="submit">
          {pending ? 'Creando tu cuenta…' : 'Crear mi plan'}
        </Button>

        <div className={styles.footer}>
          <Text size="sm" tone="secondary">
            ¿Ya tienes cuenta?{' '}
            <Link className={styles.link} href="/acceder">
              Accede
            </Link>
          </Text>
        </div>
      </form>
    </Fragment>
  );
}
