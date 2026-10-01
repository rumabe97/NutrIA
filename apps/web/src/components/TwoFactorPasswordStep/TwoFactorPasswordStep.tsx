'use client';
import { useEffect, useId, useRef, useState } from 'react';

import styles from 'components/TwoFactorCard/TwoFactorCard.module.css';

import { Button } from 'ui/components/Button';
import { Input } from 'ui/components/Input';
import { Text } from 'ui/components/Text';
import { useDictionary } from 'i18n/LocaleProvider';

import type { FormEvent, KeyboardEvent } from 'react';
import type { TwoFactorRefusal } from 'lib/twoFactor';

interface TwoFactorPasswordStepProps {
  /** What happens once the password is right, said before it is typed. */
  body: string;
  /** The button that sends it. */
  confirm: string;
  /** Turning the factor off weakens the account: that one is red. */
  destructive?: boolean;
  /** The account's address, in a hidden username field, for a password manager. */
  email: string;
  onCancel: () => void;
  /** Sends the password; a refusal comes back to be shown here, nothing when it went through. */
  onSubmit: (password: string) => Promise<TwoFactorRefusal | undefined>;
  /** The question, or the step's name. */
  title: string;
}

/**
 * The password every change to the second factor asks for first — turning it on, off,
 * and new backup codes — inline in the card, under its own `h4`, the way `SessionList` asks before closing
 * the other sessions. Opening it puts focus in the field; Escape and "Cancelar" put it
 * back where it was, which is the caller's job.
 */
export function TwoFactorPasswordStep({ body, confirm, destructive = false, email, onCancel, onSubmit, title }: TwoFactorPasswordStepProps) {
  const dictionary = useDictionary();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [fieldError, setFieldError] = useState<string>();
  // Each submit remounts the alert, so the same refusal twice is announced twice.
  const [attempt, setAttempt] = useState(0);
  const passwordRef = useRef<HTMLInputElement>(null);
  const titleId = useId();

  useEffect(() => {
    passwordRef.current?.focus();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setFieldError(undefined);
    setAttempt(previous => previous + 1);

    const password = String(new FormData(event.currentTarget).get('password'));

    if (password === '') {
      setError(dictionary.twoFactor.passwordMissing);
      setFieldError(dictionary.twoFactor.passwordMissing);
      passwordRef.current?.focus();

      return;
    }

    setPending(true);

    const refusal = await onSubmit(password);

    if (!refusal) {
      // The caller has moved on to the next step, which takes this form off the page.
      return;
    }

    setPending(false);
    setError(refusal.message);
    setFieldError(refusal.field === 'password' ? refusal.message : undefined);
    // Back on the field with what was typed selected: typing again replaces it.
    passwordRef.current?.focus();
    passwordRef.current?.select();
  }

  /** Escape answers with "no", as it would in a dialog. */
  function onKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === 'Escape' && !pending) {
      event.preventDefault();
      onCancel();
    }
  }

  return (
    <form aria-labelledby={titleId} className={styles.step} noValidate={true} onKeyDown={onKeyDown} onSubmit={submit}>
      <h4 className={styles.question} id={titleId}>
        {title}
      </h4>
      <Text size="sm" tone="secondary">
        {body}
      </Text>

      {/* Which account this password belongs to, for a password manager; never shown or sent. */}
      <input autoComplete="username" hidden={true} name="username" readOnly={true} type="text" value={email} />

      {error ? (
        <p className={styles.error} key={attempt} role="alert">
          {error}
        </p>
      ) : null}

      <Input
        autoComplete="current-password"
        error={fieldError}
        label={dictionary.twoFactor.password}
        name="password"
        onChange={() => setFieldError(undefined)}
        ref={passwordRef}
        required={true}
        type="password"
      />

      <div className={styles.actions}>
        <Button loading={pending} type="submit" variant={destructive ? 'destructive' : 'primary'}>
          {confirm}
        </Button>
        <Button disabled={pending} onClick={onCancel} type="button" variant="tertiary">
          {dictionary.common.cancel}
        </Button>
      </div>
    </form>
  );
}
