'use client';
import { Fragment, useEffect, useRef, useState } from 'react';

import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

import authStyles from 'components/AuthForm/AuthForm.module.css';
import styles from './TwoFactorChallenge.module.css';

import { Button } from 'ui/components/Button';
import { Checkbox } from 'ui/components/Checkbox';
import { Input } from 'ui/components/Input';
import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';
import { withLocale } from 'i18n/routes';

import { CtaLink } from 'components/CtaLink';

import { authClient } from 'lib/auth-client';
import { backupCode, totpCode, twoFactorRefusal } from 'lib/twoFactor';
import { forgetOfflineCopies } from 'lib/offline';
import { ownPath } from 'lib/ownPath';
import { syncLocaleFromProfile } from 'lib/locale-sync';

import type { FormEvent } from 'react';

type Method = 'backup' | 'totp';

/**
 * The second step of a sign-in with two-factor on: the code from the authenticator,
 * or one backup code, through Better Auth's own `/two-factor/verify-totp` and
 * `/verify-backup-code`. They accept only the short-lived cookie the password step
 * left, and answer with the session — so nothing here runs until a code is right.
 *
 * Then what `SignInForm` does after a password: no offline copy of the last person's
 * plan, the account's language, and `?siguiente` or `/inicio`. A pending sign-in that
 * expired or ran out of attempts can only start again at the password; the refusal
 * says so and links there.
 */
export function TwoFactorChallenge() {
  const router = useRouter();
  const dictionary = useDictionary();
  const locale = useLocale();
  const params = useSearchParams();
  const t = dictionary.twoFactor;
  const [method, setMethod] = useState<Method>('totp');
  const [trust, setTrust] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [fieldError, setFieldError] = useState<string>();
  const [restart, setRestart] = useState(false);
  // Each submit remounts the alert, so the same refusal twice is announced twice.
  const [attempt, setAttempt] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);
  const switched = useRef(false);
  const next = params.get('siguiente') ?? undefined;
  const signInPath = `${withLocale('/acceder', locale)}${next ? `?${new URLSearchParams({ siguiente: next }).toString()}` : ''}`;

  // Changing the kind of code replaces the field: focus goes to the new one. Not on mount:
  // a screen reader starts at the title, and the field is the next thing it reads.
  useEffect(() => {
    if (switched.current) {
      codeRef.current?.focus();
    }
  }, [method]);

  function refuse(message: string, onField: boolean) {
    setError(message);
    setFieldError(onField ? message : undefined);

    if (onField) {
      codeRef.current?.focus();
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setFieldError(undefined);
    setAttempt(previous => previous + 1);

    const typed = String(new FormData(event.currentTarget).get('code'));
    const code = method === 'totp' ? totpCode(typed) : backupCode(typed);

    if (!code) {
      refuse(method === 'totp' ? t.codeMissing : t.backupCodeMissing, true);

      return;
    }

    setPending(true);

    const { error: verifyError } =
      method === 'totp'
        ? await authClient.twoFactor.verifyTotp({ code, trustDevice: trust })
        : await authClient.twoFactor.verifyBackupCode({ code, trustDevice: trust });

    if (verifyError) {
      setPending(false);

      const refusal = twoFactorRefusal(verifyError.code, verifyError.status, dictionary);

      setRestart(refusal.restart);
      refuse(refusal.message, refusal.field === 'code');

      return;
    }

    // As after a password: whoever used this device before leaves no copy behind (`0053`),
    // and the account's language wins over this browser's guess.
    await forgetOfflineCopies();
    await syncLocaleFromProfile();

    router.push(ownPath(next, '/inicio'));
    router.refresh();
  }

  function switchMethod() {
    switched.current = true;
    setError(undefined);
    setFieldError(undefined);
    setMethod(previous => (previous === 'totp' ? 'backup' : 'totp'));
  }

  return (
    <Fragment>
      <Text className={authStyles.subtitle} tone="secondary">
        {method === 'totp' ? t.challengeSubtitle : t.challengeBackupSubtitle}
      </Text>

      <form className={authStyles.form} noValidate={true} onSubmit={onSubmit}>
        {error ? (
          <p className={authStyles.error} key={attempt} role="alert">
            {error}
          </p>
        ) : null}

        {method === 'totp' ? (
          <Input
            autoComplete="one-time-code"
            className={styles.code}
            error={fieldError}
            inputMode="numeric"
            key="totp"
            label={t.code}
            name="code"
            onChange={() => setFieldError(undefined)}
            ref={codeRef}
            required={true}
            type="text"
          />
        ) : (
          <Input
            autoCapitalize="none"
            autoComplete="one-time-code"
            autoCorrect="off"
            className={styles.code}
            error={fieldError}
            hint={t.backupCodeHint}
            inputMode="text"
            key="backup"
            label={t.backupCode}
            name="code"
            onChange={() => setFieldError(undefined)}
            ref={codeRef}
            required={true}
            spellCheck={false}
            type="text"
          />
        )}

        <Checkbox checked={trust} label={t.trustDevice} onCheckedChange={checked => setTrust(checked === true)} />

        {/* Once the pending sign-in is gone no code can work: the one way on is the password. */}
        {restart ? (
          <CtaLink href={signInPath}>{dictionary.auth.backToSignIn}</CtaLink>
        ) : (
          <Button loading={pending} type="submit">
            {pending ? t.verifying : t.verify}
          </Button>
        )}

        {restart ? null : (
          <div className={styles.alternatives}>
            <Button disabled={pending} onClick={switchMethod} type="button" variant="tertiary">
              {method === 'totp' ? t.useBackup : t.useApp}
            </Button>
            <Link className={`${authStyles.link} ${authStyles.standaloneLink}`} href={signInPath}>
              {dictionary.auth.backToSignIn}
            </Link>
          </div>
        )}
      </form>
    </Fragment>
  );
}
