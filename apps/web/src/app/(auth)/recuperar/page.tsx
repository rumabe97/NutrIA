'use client';
import { Fragment, useState } from 'react';

import Link from 'next/link';

import styles from '../../../components/AuthForm/AuthForm.module.css';

import { Button } from 'ui/components/Button';
import { Input } from 'ui/components/Input';
import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { authClient } from 'lib/auth-client';

import type { FormEvent } from 'react';

export default function ForgotPasswordPage() {
  const dictionary = useDictionary();
  const locale = useLocale();
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);

    const form = new FormData(event.currentTarget);

    // The mail is written in the language the person is reading, not the
    // browser's own preference list — the same tag every API call carries.
    await authClient.requestPasswordReset({
      email: String(form.get('email')),
      fetchOptions: { headers: { 'Accept-Language': locale } },
      redirectTo: '/restablecer'
    });

    setPending(false);
    // Always the same confirmation, whether or not the address exists —
    // otherwise this form tells an attacker which emails are registered.
    setSent(true);
  }

  if (sent) {
    return (
      <Fragment>
        <h1 className={styles.title}>{dictionary.auth.checkEmail}</h1>
        <p className={styles.success}>{dictionary.auth.recoverSent}</p>
        <div className={styles.footer}>
          <Link className={styles.link} href="/acceder">
            {dictionary.auth.backToSignIn}
          </Link>
        </div>
      </Fragment>
    );
  }

  return (
    <Fragment>
      <h1 className={styles.title}>{dictionary.auth.recoverTitle}</h1>
      <Text className={styles.subtitle} tone="secondary">
        {dictionary.auth.recoverSubtitle}
      </Text>

      <form className={styles.form} noValidate={true} onSubmit={onSubmit}>
        <Input autoComplete="email" label={dictionary.auth.email} name="email" required={true} type="email" />

        <Button loading={pending} type="submit">
          {pending ? dictionary.auth.sending : dictionary.auth.sendLink}
        </Button>

        <div className={styles.footer}>
          <Link className={styles.link} href="/acceder">
            {dictionary.auth.backToSignIn}
          </Link>
        </div>
      </form>
    </Fragment>
  );
}
