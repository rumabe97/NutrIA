'use client';
import { Fragment, useId, useState } from 'react';

import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

import styles from 'components/AuthForm/AuthForm.module.css';

import { Button } from 'ui/components/Button';
import { Input } from 'ui/components/Input';
import { useDictionary } from 'i18n/LocaleProvider';

import { PasswordMeter } from 'components/PasswordMeter';

import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from 'core/entities/Password';

import { authClient } from 'lib/auth-client';
import { PASSWORD_RULES, passwordLengthRefusal, passwordRefusalMessage } from 'lib/newPassword';

import type { FormEvent } from 'react';

/** Needs the `?token` query parameter, hence a client component behind Suspense. */
export function ResetPasswordForm() {
  const router = useRouter();
  const dictionary = useDictionary();
  const token = useSearchParams().get('token');
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  // Only the length is kept, for the meter: the password itself stays in the field.
  const [passwordLength, setPasswordLength] = useState(0);
  const meterId = useId();

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

    const lengthRefusal = passwordLengthRefusal(password);

    if (lengthRefusal) {
      setError(passwordRefusalMessage(lengthRefusal, dictionary));

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
      // A refused password says why; anything else is the link (an invalid or expired
      // token skips the password checks, and Better Auth answers INVALID_TOKEN).
      setError(passwordRefusalMessage(resetError.code, dictionary) ?? dictionary.auth.invalidLink);

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
        aria-describedby={meterId}
        autoComplete="new-password"
        label={dictionary.auth.newPassword}
        maxLength={PASSWORD_MAX_LENGTH}
        minLength={PASSWORD_MIN_LENGTH}
        name="password"
        onChange={event => setPasswordLength(event.currentTarget.value.length)}
        passwordrules={PASSWORD_RULES}
        required={true}
        type="password"
      />
      <PasswordMeter id={meterId} length={passwordLength} />
      <Input autoComplete="new-password" label={dictionary.auth.confirmPassword} name="confirm" required={true} type="password" />

      <Button loading={pending} type="submit">
        {pending ? dictionary.common.saving : dictionary.auth.savePassword}
      </Button>
    </form>
  );
}
