'use client';
import { Fragment, useState } from 'react';

import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

import styles from 'components/AuthForm/AuthForm.module.css';

import { Button } from 'ui/components/Button';
import { Input } from 'ui/components/Input';
import { useDictionary } from 'i18n/LocaleProvider';

import { authClient } from 'lib/auth-client';
import { interpolate } from 'lib/format';

import type { FormEvent } from 'react';

const MIN_PASSWORD_LENGTH = 8;

/** Needs the `?token` query parameter, hence a client component behind Suspense. */
export function ResetPasswordForm() {
  const router = useRouter();
  const dictionary = useDictionary();
  const token = useSearchParams().get('token');
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  if (!token) {
    return (
      <Fragment>
        <p className={styles.error} role="alert">
          {dictionary.auth.invalidLink}
        </p>
        <div className={styles.footer}>
          <Link className={styles.link} href="/recuperar">
            {dictionary.auth.askNewLink}
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
      setError(interpolate(dictionary.auth.passwordTooShort, { count: MIN_PASSWORD_LENGTH }));

      return;
    }

    if (password !== String(form.get('confirm'))) {
      setError(dictionary.auth.passwordsDoNotMatch);

      return;
    }

    setPending(true);

    const { error: resetError } = await authClient.resetPassword({ newPassword: password, token: token as string });

    setPending(false);

    if (resetError) {
      setError(dictionary.auth.invalidLink);

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
        hint={interpolate(dictionary.auth.passwordHint, { count: MIN_PASSWORD_LENGTH })}
        label={dictionary.auth.newPassword}
        minLength={MIN_PASSWORD_LENGTH}
        name="password"
        required={true}
        type="password"
      />
      <Input autoComplete="new-password" label={dictionary.auth.confirmPassword} name="confirm" required={true} type="password" />

      <Button loading={pending} type="submit">
        {pending ? dictionary.common.saving : dictionary.auth.savePassword}
      </Button>
    </form>
  );
}
