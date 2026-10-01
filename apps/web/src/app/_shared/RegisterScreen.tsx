'use client';
import { Fragment, useId, useState } from 'react';

import { useRouter } from 'next/navigation';
import Link from 'next/link';

import styles from 'components/AuthForm/AuthForm.module.css';

import { Button } from 'ui/components/Button';
import { Input } from 'ui/components/Input';
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

import type { FormEvent } from 'react';
import type { SocialProvider } from 'lib/sign-in-providers';

export function RegisterScreen({ providers = [] }: Readonly<{ providers?: readonly SocialProvider[] }>) {
  const router = useRouter();
  const dictionary = useDictionary();
  const locale = useLocale();
  const [error, setError] = useState<string>();
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

    const { error: signUpError } = await signUp.email({ email: String(form.get('email')), name: String(form.get('name')), password });

    setPending(false);

    if (signUpError) {
      // A refused password says why, by its code, on the field and in the alert.
      const refusal = passwordRefusalMessage(signUpError.code, dictionary);

      if (refusal) {
        refusePassword(refusal);

        return;
      }

      // Better Auth distinguishes "email already registered" from everything
      // else. Both are shown as-is: at sign-*up* an existing address is
      // information the visitor already has, and hiding it only produces a
      // confusing dead end.
      setError(signUpError.status === 422 ? dictionary.auth.emailTaken : dictionary.auth.signUpFailed);

      return;
    }

    // A new account on a device somebody else used: their copies go first (`0053`).
    await forgetOfflineCopies();
    router.push('/onboarding');
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
          onChange={event => setPasswordLength(event.currentTarget.value.length)}
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
