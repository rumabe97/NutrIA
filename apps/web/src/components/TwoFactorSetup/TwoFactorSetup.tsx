'use client';
import { Fragment, useEffect, useId, useRef, useState } from 'react';

import styles from 'components/TwoFactorCard/TwoFactorCard.module.css';

import { Button, buttonClassName } from 'ui/components/Button';
import { Input } from 'ui/components/Input';
import { Text } from 'ui/components/Text';
import { useDictionary } from 'i18n/LocaleProvider';

import { TwoFactorQr } from 'components/TwoFactorQr';

import { useFleetingStatus } from 'hooks/useFleetingStatus';

import { authClient } from 'lib/auth-client';
import { secretGroups, totpCode, totpSecret, twoFactorRefusal } from 'lib/twoFactor';

import type { FormEvent } from 'react';

interface TwoFactorSetupProps {
  onCancel: () => void;
  /** The first right code turned the factor on. */
  /** `otherSessionsClosed`: the API closed the account's other sessions when the factor went on — false when it could not. */
  onConfirmed: (otherSessionsClosed: boolean) => void;
  /** What `/two-factor/enable` answered: the address the authenticator adds. */
  totpUri: string;
}

/**
 * Steps 2 and 3 of turning the factor on. Adding NutrIA to an authenticator three ways,
 * for three situations: the QR code for a second device, the `otpauth://` link for an
 * app on this one — the one-handed phone user cannot scan their own screen — and the key
 * in text for an app that takes neither. Then one code from the app, through
 * `/two-factor/verify-totp`: Better Auth turns the factor on with the first right one,
 * and not before, so a setup abandoned anywhere here leaves the account as it was.
 *
 * Each step's title takes focus when it arrives, because the button pressed has gone.
 */
export function TwoFactorSetup({ onCancel, onConfirmed, totpUri }: TwoFactorSetupProps) {
  const dictionary = useDictionary();
  const t = dictionary.twoFactor;
  const [step, setStep] = useState<'confirm' | 'scan'>('scan');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [fieldError, setFieldError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const [copied, sayCopied] = useFleetingStatus();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const captionId = useId();
  const secret = totpSecret(totpUri);

  useEffect(() => {
    titleRef.current?.focus();
  }, [step]);

  async function copySecret() {
    try {
      await navigator.clipboard.writeText(secret ?? '');
      sayCopied(t.secretCopied);
    } catch {
      sayCopied(t.copyFailed);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setFieldError(undefined);
    setAttempt(previous => previous + 1);

    const code = totpCode(String(new FormData(event.currentTarget).get('code')));

    if (!code) {
      refuse(t.codeMissing, true);

      return;
    }

    setPending(true);

    const { data, error: verifyError } = await authClient.twoFactor.verifyTotp({ code });

    if (!verifyError) {
      // Only a plain `true` claims the sessions closed: an answer without the field says nothing it cannot back.
      onConfirmed((data as { otherSessionsClosed?: unknown } | null)?.otherSessionsClosed === true);

      return;
    }

    setPending(false);

    const refusal = twoFactorRefusal(verifyError.code, verifyError.status, dictionary, 'settings');

    refuse(refusal.message, refusal.field === 'code');
  }

  function refuse(message: string, onField: boolean) {
    setError(message);
    setFieldError(onField ? message : undefined);
    codeRef.current?.focus();
    codeRef.current?.select();
  }

  if (step === 'scan') {
    return (
      <div className={styles.step}>
        <h4 className={styles.question} ref={titleRef} tabIndex={-1}>
          {t.stepScan}
        </h4>

        <div className={styles.scan}>
          <TwoFactorQr labelledBy={captionId} uri={totpUri} />
          <div className={styles.manual}>
            <Text id={captionId} size="sm" tone="secondary">
              {t.scanCaption}
            </Text>
            <a className={buttonClassName({ className: styles.wrap, variant: 'secondary' })} href={totpUri} translate="no">
              {t.addToApp}
            </a>
            {secret ? (
              <div className={styles.secretBlock}>
                <span className={styles.secretLabel}>{t.secret}</span>
                {/* Groups that never break inside, plain spaces between them: it wraps between
                    groups at 320px and a reader reads it group by group. */}
                <code className={styles.secret} translate="no">
                  {/* The space outside the span: a break after a space follows the space's own
                      white-space, so inside a nowrap span it would never wrap. */}
                  {secretGroups(secret).map(group => (
                    <Fragment key={group.at}>
                      {group.at > 0 ? ' ' : null}
                      <span className={styles.group}>{group.text}</span>
                    </Fragment>
                  ))}
                </code>
                <div className={styles.actions}>
                  <Button onClick={() => void copySecret()} type="button" variant="secondary">
                    {t.copySecret}
                  </Button>
                </div>
              </div>
            ) : null}
            {/* Mounted empty, so "copied" is announced when its words arrive. */}
            <p className={copied ? styles.done : 'visually-hidden'} role="status">
              {copied ?? null}
            </p>
          </div>
        </div>

        <div className={styles.actions}>
          <Button onClick={() => setStep('confirm')} type="button">
            {dictionary.common.continue}
          </Button>
          <Button onClick={onCancel} type="button" variant="tertiary">
            {dictionary.common.cancel}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form className={styles.step} noValidate={true} onSubmit={submit}>
      <h4 className={styles.question} ref={titleRef} tabIndex={-1}>
        {t.stepConfirm}
      </h4>

      {error ? (
        <p className={styles.error} key={attempt} role="alert">
          {error}
        </p>
      ) : null}

      <Input
        autoComplete="one-time-code"
        className={styles.code}
        enterKeyHint="go"
        error={fieldError}
        hint={t.confirmHint}
        inputMode="numeric"
        label={t.confirmCode}
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
        {/* Back to the same key: nothing is made again. */}
        <Button disabled={pending} onClick={() => setStep('scan')} type="button" variant="tertiary">
          {dictionary.common.back}
        </Button>
        <Button disabled={pending} onClick={onCancel} type="button" variant="tertiary">
          {dictionary.common.cancel}
        </Button>
      </div>
    </form>
  );
}
