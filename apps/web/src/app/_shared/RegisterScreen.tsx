'use client';
import { Fragment, useId, useState } from 'react';

import Link from 'next/link';

import styles from 'components/AuthForm/AuthForm.module.css';

import { Button } from 'ui/components/Button';
import { Input } from 'ui/components/Input';
import { interpolate } from 'i18n/interpolate';
import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';
import { withLocale } from 'i18n/routes';

import { LegalNotice } from 'components/LegalNotice';
import { PasswordMeter } from 'components/PasswordMeter';
import { SocialSignIn } from 'components/SocialSignIn';

import { PASSWORD_MIN_LENGTH } from 'core/entities/Password';

import { forgetOfflineCopies } from 'lib/offline';
import { PASSWORD_RULES, passwordLengthRefusal, passwordRefusalMessage } from 'lib/newPassword';
import { signUp } from 'lib/auth-client';

import type { Dictionary } from 'i18n/dictionaries/es-ES';
import type { FormEvent } from 'react';
import type { SocialProvider } from 'lib/sign-in-providers';

function signUpFailure(status: number, dictionary: Dictionary): string {
  return status === 429 ? dictionary.auth.tooManyAttempts : dictionary.auth.signUpFailed;
}

export function RegisterScreen({ providers = [] }: Readonly<{ providers?: readonly SocialProvider[] }>) {
  const dictionary = useDictionary();
  const locale = useLocale();
  const [error, setError] = useState<string>();
  // The address the sign-up was sent for: from then on the screen says "check your email", whoever that address belongs to.
  const [sentTo, setSentTo] = useState<string>();
  // A refused password is said on the field too, next to the button: the alert at the top
  // is announced, but at 320px it is off-screen when the button is pressed.
  const [passwordError, setPasswordError] = useState<string>();
  // Each submit remounts the alert, so the same refusal twice is announced twice.
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState(false);
  // Only the length is kept, for the meter: the password itself stays in the field.
  const [passwordLength, setPasswordLength] = useState(0);
  const hintId = useId();
  const levelId = useId();

  function refusePassword(message: string) {
    setError(message);
    setPasswordError(message);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setPasswordError(undefined);
    setAttempt(previous => previous + 1);

    const form = new FormData(event.currentTarget);
    const password = String(form.get('password'));

    const lengthRefusal = passwordLengthRefusal(password);

    if (lengthRefusal) {
      refusePassword(passwordRefusalMessage(lengthRefusal, dictionary) ?? dictionary.auth.signUpFailed);

      return;
    }

    setPending(true);

    const email = String(form.get('email'));
    const { error: signUpError } = await signUp.email({ email, name: String(form.get('name')), password });

    setPending(false);

    if (signUpError) {
      // A refused password says why, by its code, on the field and in the alert.
      const refusal = passwordRefusalMessage(signUpError.code, dictionary);

      if (refusal) {
        refusePassword(refusal);

        return;
      }

      // An address that already has an account is no failure: the API answers
      // it as a new one (PLAN 011 phase 8). Its rate limit answers 429: that
      // one is a wait, not a failure.
      setError(signUpFailure(signUpError.status, dictionary));

      return;
    }

    // A new account on a device somebody else used: their copies go first (`0053`).
    await forgetOfflineCopies();
    // Sign-up opens no session (PLAN 011 phase 8): the same "check your email" for every
    // address, new or not. The mail says the rest — the link that signs a new person in,
    // or to the owner of an existing account, that somebody tried.
    setSentTo(email);
  }

  if (sentTo) {
    return (
      <Fragment>
        <h1 className={styles.title}>{dictionary.auth.checkEmail}</h1>
        <p className={styles.success} role="status">
          {interpolate(dictionary.auth.signUpSent, { email: sentTo })}
        </p>
        <Text size="sm" style={{ marginTop: 'var(--space-05)' }} tone="secondary">
          {dictionary.auth.signUpSentInstalled}
        </Text>
        <div className={styles.footer}>
          <Link className={styles.link} href={withLocale('/acceder', locale)}>
            {dictionary.auth.backToSignIn}
          </Link>
        </div>
      </Fragment>
    );
  }

  return (
    <Fragment>
      <h1 className={styles.title}>{dictionary.auth.createAccount}</h1>
      <Text className={styles.subtitle} tone="secondary">
        {dictionary.auth.createAccountSubtitle}
      </Text>

      {/* Above every control that creates an account, the buttons included. */}
      <LegalNotice />

      {/* A new account lands on onboarding whichever way it was made. */}
      <SocialSignIn next="/onboarding" providers={providers} />

      <form className={styles.form} noValidate={true} onSubmit={onSubmit}>
        {error ? (
          <p className={styles.error} key={attempt} role="alert">
            {error}
          </p>
        ) : null}

        <Input autoComplete="name" label={dictionary.auth.name} name="name" required={true} type="text" />
        <Input autoComplete="email" label={dictionary.auth.email} name="email" required={true} type="email" />
        <Input
          autoComplete="new-password"
          describedBy={`${hintId} ${levelId}`}
          error={passwordError}
          label={dictionary.auth.password}
          minLength={PASSWORD_MIN_LENGTH}
          name="password"
          onChange={event => {
            setPasswordLength(event.currentTarget.value.length);
            // A refusal is about the password that was sent: once it is edited, it no longer applies.
            setPasswordError(undefined);
          }}
          passwordrules={PASSWORD_RULES}
          required={true}
          type="password"
        />
        <PasswordMeter hintId={hintId} length={passwordLength} levelId={levelId} />

        <Button loading={pending} type="submit">
          {pending ? dictionary.auth.signUpPending : dictionary.auth.signUp}
        </Button>

        <div className={styles.footer}>
          <Text size="sm" tone="secondary">
            {dictionary.auth.haveAccount}{' '}
            <Link className={styles.link} href={withLocale('/acceder', locale)}>
              {dictionary.auth.toSignIn}
            </Link>
          </Text>
        </div>
      </form>
    </Fragment>
  );
}
