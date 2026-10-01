'use client';
import { useId, useState } from 'react';

import { useRouter } from 'next/navigation';

import styles from 'components/AuthForm/AuthForm.module.css';

import { Button } from 'ui/components/Button';
import { Input } from 'ui/components/Input';
import { useDictionary } from 'i18n/LocaleProvider';

import { PasswordMeter } from 'components/PasswordMeter';

import { PASSWORD_MIN_LENGTH } from 'core/entities/Password';

import { authClient } from 'lib/auth-client';
import { PASSWORD_RULES, passwordLengthRefusal, passwordRefusalMessage } from 'lib/newPassword';

import type { FormEvent } from 'react';

type Field = 'confirm' | 'current' | 'password';

interface ChangePasswordFormProps {
  /** The forced-change screen: on success the app opens again, at `/inicio`. */
  forced?: boolean;
  /** Called after a change, which has closed every other session — the list showing them is stale. */
  onChanged?: () => void;
}

/**
 * Current password, new one, and the new one again, through Better Auth's own
 * `/change-password`. The API closes every other session whatever this sends
 * (project 011); `revokeOtherSessions` is said here too so the request reads as
 * what it does. Better Auth answers with a fresh cookie for this device, so the
 * person stays signed in here.
 *
 * Refusals as `ResetPasswordForm` gives them: by code, on the field, and in the
 * form's alert. A wrong current password is Better Auth's `INVALID_PASSWORD` and
 * goes on the current field; the new password's refusals are phase 1's.
 */
export function ChangePasswordForm({ forced = false, onChanged }: ChangePasswordFormProps) {
  const router = useRouter();
  const dictionary = useDictionary();
  const t = dictionary.security;
  const [error, setError] = useState<string>();
  // On the field as well as in the alert: at 320px the alert is off-screen when the button is pressed.
  const [fieldError, setFieldError] = useState<{ field: Field; message: string }>();
  // Each submit remounts the alert, so the same refusal twice is announced twice.
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState(false);
  const [changed, setChanged] = useState(false);
  // Only the length is kept, for the meter: the password itself stays in the field.
  const [passwordLength, setPasswordLength] = useState(0);
  const hintId = useId();
  const levelId = useId();

  function refuse(field: Field, message: string) {
    setError(message);
    setFieldError({ field, message });
  }

  /** A refusal is about what was sent: once that field is edited, it no longer applies. */
  function clearFieldError(field: Field) {
    setFieldError(previous => (previous?.field === field ? undefined : previous));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setFieldError(undefined);
    setChanged(false);
    setAttempt(previous => previous + 1);

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const currentPassword = String(form.get('current'));
    const password = String(form.get('password'));

    if (currentPassword === '') {
      refuse('current', t.currentPasswordMissing);

      return;
    }

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

    const { error: changeError } = await authClient.changePassword({ currentPassword, newPassword: password, revokeOtherSessions: true });

    if (changeError) {
      setPending(false);

      const refusal = passwordRefusalMessage(changeError.code, dictionary);

      if (refusal) {
        refuse('password', refusal);
      } else if (changeError.code === 'INVALID_PASSWORD') {
        refuse('current', t.wrongCurrentPassword);
      } else {
        // Better Auth's rate limit answers 429: that one is a wait, not a failure.
        setError(changeError.status === 429 ? dictionary.auth.tooManyAttempts : dictionary.errors.internal);
      }

      return;
    }

    if (forced) {
      // The lock is lifted with the change; the button keeps its spinner until the app is back.
      router.push('/inicio');
      router.refresh();

      return;
    }

    setPending(false);
    formElement.reset();
    setPasswordLength(0);
    setChanged(true);
    onChanged?.();
  }

  return (
    <form className={styles.form} noValidate={true} onSubmit={onSubmit}>
      {error ? (
        <p className={styles.error} key={attempt} role="alert">
          {error}
        </p>
      ) : null}
      {changed ? (
        <p className={styles.success} role="status">
          {t.passwordChanged}
        </p>
      ) : null}

      <Input
        autoComplete="current-password"
        error={fieldError?.field === 'current' ? fieldError.message : undefined}
        label={t.currentPassword}
        name="current"
        onChange={() => clearFieldError('current')}
        required={true}
        type="password"
      />
      <Input
        autoComplete="new-password"
        describedBy={`${hintId} ${levelId}`}
        error={fieldError?.field === 'password' ? fieldError.message : undefined}
        label={dictionary.auth.newPassword}
        minLength={PASSWORD_MIN_LENGTH}
        name="password"
        onChange={event => {
          setPasswordLength(event.currentTarget.value.length);
          clearFieldError('password');
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
        onChange={() => clearFieldError('confirm')}
        required={true}
        type="password"
      />

      <Button loading={pending} type="submit">
        {pending ? dictionary.common.saving : t.changePassword}
      </Button>
    </form>
  );
}
