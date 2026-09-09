'use client';
import { Fragment, useState } from 'react';

import { useRouter } from 'next/navigation';
import Link from 'next/link';

import styles from '../../../components/AuthForm/AuthForm.module.css';

import { Button } from 'ui/components/Button';
import { Input } from 'ui/components/Input';
import { Text } from 'ui/components/Text';
import { useDictionary } from 'i18n/LocaleProvider';

import { interpolate } from 'lib/format';
import { signUp } from 'lib/auth-client';

import type { FormEvent } from 'react';

const MIN_PASSWORD_LENGTH = 8;

export default function RegisterPage() {
  const router = useRouter();
  const dictionary = useDictionary();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);

    const form = new FormData(event.currentTarget);
    const password = String(form.get('password'));

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(interpolate(dictionary.auth.passwordTooShort, { count: MIN_PASSWORD_LENGTH }));

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
      // 403 is the door being shut (0031), which is a state to explain rather
      // than a failure to apologise for.
      if (signUpError.status === 403) {
        setError(dictionary.errors.registrationClosed);

        return;
      }

      setError(signUpError.status === 422 ? dictionary.auth.emailTaken : dictionary.auth.signUpFailed);

      return;
    }

    router.push('/onboarding');
  }

  return (
    <Fragment>
      <h1 className={styles.title}>{dictionary.auth.createAccount}</h1>
      <Text className={styles.subtitle} tone="secondary">
        {dictionary.auth.createAccountSubtitle}
      </Text>

      <form className={styles.form} noValidate={true} onSubmit={onSubmit}>
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}

        <Input autoComplete="name" label={dictionary.auth.name} name="name" required={true} type="text" />
        <Input autoComplete="email" label={dictionary.auth.email} name="email" required={true} type="email" />
        <Input
          autoComplete="new-password"
          hint={interpolate(dictionary.auth.passwordHint, { count: MIN_PASSWORD_LENGTH })}
          label={dictionary.auth.password}
          minLength={MIN_PASSWORD_LENGTH}
          name="password"
          required={true}
          type="password"
        />

        <Button loading={pending} type="submit">
          {pending ? dictionary.auth.signUpPending : dictionary.auth.signUp}
        </Button>

        <div className={styles.footer}>
          <Text size="sm" tone="secondary">
            {dictionary.auth.haveAccount}{' '}
            <Link className={styles.link} href="/acceder">
              {dictionary.auth.toSignIn}
            </Link>
          </Text>
        </div>
      </form>
    </Fragment>
  );
}
