'use client';
import { useState } from 'react';

import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

import styles from 'components/AuthForm/AuthForm.module.css';

import { Button } from 'ui/components/Button';
import { Input } from 'ui/components/Input';
import { Text } from 'ui/components/Text';
import { useDictionary } from 'i18n/LocaleProvider';

import { signIn } from 'lib/auth-client';
import { syncLocaleFromProfile } from 'lib/locale-sync';

import type { FormEvent } from 'react';

/**
 * Reads `?siguiente` so the proxy's redirect returns the user to where they
 * were headed. That needs useSearchParams, which is why this is a separate
 * client component behind a Suspense boundary rather than part of the page.
 */
export function SignInForm() {
  const router = useRouter();
  const dictionary = useDictionary();
  const params = useSearchParams();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setPending(true);

    const form = new FormData(event.currentTarget);
    const { error: signInError } = await signIn.email({ email: String(form.get('email')), password: String(form.get('password')) });

    setPending(false);

    if (signInError) {
      // One message for wrong password and unknown account alike: telling them
      // apart turns this form into an account-enumeration oracle.
      setError(dictionary.auth.invalidCredentials);

      return;
    }

    // The profile column is the durable preference; the cookie is only a cache of
    // it. Syncing here is what makes a language chosen on one device survive
    // signing in on another — without it the new device keeps whatever its
    // browser negotiated.
    await syncLocaleFromProfile();

    router.push(params.get('siguiente') ?? '/inicio');
    router.refresh();
  }

  return (
    <form className={styles.form} noValidate={true} onSubmit={onSubmit}>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <Input autoComplete="email" label={dictionary.auth.email} name="email" required={true} type="email" />
      <Input autoComplete="current-password" label={dictionary.auth.password} name="password" required={true} type="password" />

      <Link className={`${styles.link} ${styles.forgot}`} href="/recuperar">
        {dictionary.auth.forgotPassword}
      </Link>

      <Button loading={pending} type="submit">
        {pending ? dictionary.auth.signingIn : dictionary.auth.signIn}
      </Button>

      <div className={styles.footer}>
        <Text size="sm" tone="secondary">
          {dictionary.auth.noAccount}{' '}
          <Link className={styles.link} href="/registro">
            {dictionary.auth.toSignUp}
          </Link>
        </Text>
      </div>
    </form>
  );
}
