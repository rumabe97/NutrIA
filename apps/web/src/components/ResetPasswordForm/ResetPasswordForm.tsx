'use client';
import { Fragment, useId, useState } from 'react';

import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

import styles from 'components/AuthForm/AuthForm.module.css';

import { Button } from 'ui/components/Button';
import { Input } from 'ui/components/Input';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';
import { withLocale } from 'i18n/routes';

import { PasswordMeter } from 'components/PasswordMeter';

import { PASSWORD_MIN_LENGTH } from 'core/entities/Password';

import { authClient } from 'lib/auth-client';
import { PASSWORD_RULES, passwordLengthRefusal, passwordRefusalMessage } from 'lib/newPassword';

import type { FormEvent } from 'react';

/** Needs the `?token` query parameter, hence a client component behind Suspense. */
export function ResetPasswordForm() {
  const router = useRouter();
  const dictionary = useDictionary();
  const locale = useLocale();
  const token = useSearchParams().get('token');
  const [error, setError] = useState<string>();
  // A refused password is said on its field too, next to the button: the alert at the top
  // is announced, but on a phone it can be off-screen when the button is pressed.
  const [fieldError, setFieldError] = useState<{ field: 'confirm' | 'password'; message: string }>();
  // Each submit remounts the alert, so the same refusal twice is announced twice.
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState(false);
  // A spent or expired token: no password will be accepted with it, so the way out is a new link.
  const [linkExpired, setLinkExpired] = useState(false);
  // Only the length is kept, for the meter: the password itself stays in the field.
  const [passwordLength, setPasswordLength] = useState(0);
  const hintId = useId();
  const levelId = useId();

  const askNewLink = (
    <div className={styles.footer}>
      <Link className={`${styles.link} ${styles.standaloneLink}`} href={withLocale('/recuperar', locale)}>
        {dictionary.auth.askNewLink}
      </Link>
    </div>
  );

  if (!token) {
    return (
      <Fragment>
        <p className={styles.error} role="alert">
          {dictionary.auth.invalidLink}
        </p>
        {askNewLink}
      </Fragment>
    );
  }

  function refuse(field: 'confirm' | 'password', message: string) {
    setError(message);
    setFieldError({ field, message });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setFieldError(undefined);
    setLinkExpired(false);
    setAttempt(previous => previous + 1);

    const form = new FormData(event.currentTarget);
    const password = String(form.get('password'));

    const lengthRefusal = passwordLengthRefusal(password);

    if (lengthRefusal) {
      refuse('password', passwordRefusalMessage(lengthRefusal, dictionary) ?? dictionary.errors.internal);

      return;
    }

    if (password !== String(form.get('confirm'))) {
      refuse('confirm', dictionary.auth.passwordsDoNotMatch);

      return;
    }

    setPending(true);

    const { error: resetError } = await authClient.resetPassword({ newPassword: password, token: token as string });

    setPending(false);

    if (resetError) {
      // A refused password says why, on its field. An invalid or expired token skips the
      // password checks and Better Auth answers INVALID_TOKEN: only that is the link.
      const refusal = passwordRefusalMessage(resetError.code, dictionary);

      if (refusal) {
        refuse('password', refusal);
      } else if (resetError.code === 'INVALID_TOKEN') {
        setError(dictionary.auth.invalidLink);
        setLinkExpired(true);
      } else {
        // Better Auth's rate limit answers 429: that one is a wait, not a failure.
        setError(resetError.status === 429 ? dictionary.auth.tooManyAttempts : dictionary.errors.internal);
      }

      return;
    }

    router.push(withLocale('/acceder', locale));
  }

  return (
    <form className={styles.form} noValidate={true} onSubmit={onSubmit}>
      {error ? (
        <p className={styles.error} key={attempt} role="alert">
          {error}
        </p>
      ) : null}
      {linkExpired ? askNewLink : null}

      <Input
        autoComplete="new-password"
        describedBy={`${hintId} ${levelId}`}
        error={fieldError?.field === 'password' ? fieldError.message : undefined}
        label={dictionary.auth.newPassword}
        minLength={PASSWORD_MIN_LENGTH}
        name="password"
        onChange={event => {
          setPasswordLength(event.currentTarget.value.length);
          // A refusal is about the password that was sent: once it is edited, it no longer applies.
          setFieldError(previous => (previous?.field === 'password' ? undefined : previous));
        }}
        passwordrules={PASSWORD_RULES}
        required={true}
        type="password"
      />
      <PasswordMeter hintId={hintId} length={passwordLength} levelId={levelId} />
      <Input
        autoComplete="new-password"
        error={fieldError?.field === 'confirm' ? fieldError.message : undefined}
        label={dictionary.auth.confirmPassword}
        name="confirm"
        onChange={() => setFieldError(previous => (previous?.field === 'confirm' ? undefined : previous))}
        required={true}
        type="password"
      />

      <Button loading={pending} type="submit">
        {pending ? dictionary.common.saving : dictionary.auth.savePassword}
      </Button>
    </form>
  );
}
