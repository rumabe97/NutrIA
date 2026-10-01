'use client';
import { useEffect, useRef, useState } from 'react';

import styles from 'components/TwoFactorCard/TwoFactorCard.module.css';

import { Button } from 'ui/components/Button';
import { Input } from 'ui/components/Input';
import { Text } from 'ui/components/Text';
import { useDictionary } from 'i18n/LocaleProvider';

import { TwoFactorQr } from 'components/TwoFactorQr';

import { authClient } from 'lib/auth-client';
import { totpCode, totpSecret, twoFactorRefusal } from 'lib/twoFactor';

import type { FormEvent, KeyboardEvent } from 'react';

interface TwoFactorSetupProps {
  onCancel: () => void;
  /** The first right code turned the factor on. */
  onConfirmed: () => void;
  /** What `/two-factor/enable` answered: the address the authenticator adds. */
  totpUri: string;
}

/**
 * Adding NutrIA to an authenticator, three ways for three situations: the QR code for
 * a second device, the `otpauth://` link for an app on this one (the iPhone's Passwords
 * opens it), and the key in text for an app that takes neither. Then one code from the
 * app, through `/two-factor/verify-totp` — Better Auth turns the factor on with the
 * first right one, and not before: a setup abandoned here leaves the account as it was.
 */
export function TwoFactorSetup({ onCancel, onConfirmed, totpUri }: TwoFactorSetupProps) {
  const dictionary = useDictionary();
  const t = dictionary.twoFactor;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [fieldError, setFieldError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const titleRef = useRef<HTMLParagraphElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const secret = totpSecret(totpUri);

  // The password form that opened this has left the page: focus goes to what replaced it.
  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setFieldError(undefined);
    setAttempt(previous => previous + 1);

    const code = totpCode(String(new FormData(event.currentTarget).get('code')));

    if (!code) {
      setError(t.codeMissing);
      setFieldError(t.codeMissing);
      codeRef.current?.focus();

      return;
    }

    setPending(true);

    const { error: verifyError } = await authClient.twoFactor.verifyTotp({ code });

    if (!verifyError) {
      onConfirmed();

      return;
    }

    setPending(false);

    const refusal = twoFactorRefusal(verifyError.code, verifyError.status, dictionary);

    setError(refusal.message);
    setFieldError(refusal.field === 'code' ? refusal.message : undefined);
    codeRef.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && !pending) {
      event.preventDefault();
      onCancel();
    }
  }

  return (
    <div className={styles.step} onKeyDown={onKeyDown}>
      <p className={styles.question} ref={titleRef} tabIndex={-1}>
        {t.scanTitle}
      </p>
      <Text size="sm" tone="secondary">
        {t.scanBody}
      </Text>

      <div className={styles.scan}>
        <TwoFactorQr label={t.qrLabel} uri={totpUri} />
        <div className={styles.manual}>
          <a className={styles.link} href={totpUri}>
            {t.addToApp}
          </a>
          {secret ? (
            <p className={styles.secretBlock}>
              <span className={styles.secretLabel}>{t.secret}</span>
              {/* Selectable as one piece; the spaces are for reading, and apps ignore them. */}
              <code className={styles.secret}>{secret}</code>
            </p>
          ) : null}
        </div>
      </div>

      <form className={styles.form} noValidate={true} onSubmit={submit}>
        {error ? (
          <p className={styles.error} key={attempt} role="alert">
            {error}
          </p>
        ) : null}

        <Input
          autoComplete="one-time-code"
          className={styles.code}
          error={fieldError}
          hint={t.confirmHint}
          inputMode="numeric"
          label={t.code}
          name="code"
          onChange={() => setFieldError(undefined)}
          ref={codeRef}
          required={true}
          type="text"
        />

        <div className={styles.actions}>
          <Button loading={pending} type="submit">
            {t.confirm}
          </Button>
          <Button disabled={pending} onClick={onCancel} type="button" variant="secondary">
            {dictionary.common.cancel}
          </Button>
        </div>
      </form>
    </div>
  );
}
