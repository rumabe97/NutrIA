'use client';
import { useEffect, useId, useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import styles from './DeleteAccount.module.css';

import { Button } from 'ui/components/Button';
import { Input } from 'ui/components/Input';
import { Text } from 'ui/components/Text';
import { useDictionary } from 'i18n/LocaleProvider';

import { api, messageFor } from 'lib/api';
import { deletionRefusal, SIGN_IN_AGAIN_PATH } from 'lib/accountDeletion';
import { forgetOfflineCopies } from 'lib/offline';
import { forgetPushOnThisDevice } from 'lib/push';
import { interpolate } from 'lib/format';
import { signOut } from 'lib/auth-client';

/**
 * Typed confirmation rather than a second "are you sure" button.
 *
 * This deletes health data irreversibly, and a confirm dialog is dismissed by
 * reflex. Making the user type the word is the cheapest way to ensure the
 * action was intended — which is why the word is translated too: typing a word
 * you cannot read is a reflex again, not a decision.
 */
export function DeleteAccount() {
  const router = useRouter();
  const dictionary = useDictionary();
  const [confirming, setConfirming] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  // The API refused because this session is too old to delete with: nothing was deleted,
  // and signing in again is the only way through, so that is the one thing offered.
  const [signInAgain, setSignInAgain] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const signInAgainRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cancelled = useRef(false);
  const reasonId = useId();

  const word = dictionary.profile.deleteWord;

  // Focus goes to the way through, which carries the reason as its description: the
  // destructive button it replaces has just left the page, and focus with it.
  useEffect(() => {
    if (signInAgain) {
      signInAgainRef.current?.focus();
    }
  }, [signInAgain]);

  // Cancel removes the button that had focus; hand it back to the one that opened this.
  useEffect(() => {
    if (!confirming && cancelled.current) {
      cancelled.current = false;
      triggerRef.current?.focus();
    }
  }, [confirming]);

  async function remove() {
    setError(undefined);
    setPending(true);

    try {
      await api('/users/me', { method: 'DELETE' });
      await forgetOfflineCopies();
      // The subscription's row went with the account; this undoes the browser's half.
      await forgetPushOnThisDevice();
      router.push('/');
      router.refresh();
    } catch (caught) {
      setPending(false);

      if (deletionRefusal(caught) === 'signInAgain') {
        setSignInAgain(true);

        return;
      }

      setError(messageFor(caught, dictionary));
    }
  }

  /** The same sign-out as the menu's, then the sign-in page, which brings them back here. */
  async function signOutAndBack() {
    setSigningOut(true);

    try {
      await forgetPushOnThisDevice();
      await signOut();
      await forgetOfflineCopies();
      router.push(SIGN_IN_AGAIN_PATH);
      router.refresh();
    } catch {
      // Offline, most likely: the button comes back, and the reason above still stands.
      setSigningOut(false);
    }
  }

  function cancel() {
    cancelled.current = true;
    setConfirming(false);
    setSignInAgain(false);
  }

  if (!confirming) {
    return (
      <div className={styles.wrapper}>
        <Button onClick={() => setConfirming(true)} ref={triggerRef} type="button" variant="secondary">
          {dictionary.profile.dangerTitle}
        </Button>
      </div>
    );
  }

  if (signInAgain) {
    return (
      <div className={`${styles.wrapper} ${styles.confirm}`}>
        {/* An alert, so it is heard even where moving focus is not announced; the button
            below also names it as its description, so landing on it says why. */}
        <p className={styles.signInAgain} id={reasonId} role="alert">
          {dictionary.profile.deleteSignInAgainBody}
        </p>

        <div className={styles.actions}>
          <Button aria-describedby={reasonId} loading={signingOut} onClick={() => void signOutAndBack()} ref={signInAgainRef} type="button">
            {dictionary.profile.deleteSignInAgain}
          </Button>
          <Button disabled={signingOut} onClick={cancel} type="button" variant="secondary">
            {dictionary.common.cancel}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.wrapper} ${styles.confirm}`}>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <Text size="sm" tone="secondary">
        {interpolate(dictionary.profile.deletePrompt, { word })}
      </Text>

      <Input
        autoComplete="off"
        label={interpolate(dictionary.profile.deleteTypeLabel, { word })}
        onChange={event => setValue(event.target.value)}
        value={value}
      />

      <div className={styles.actions}>
        {/* Red, because this one cannot be undone: the colour is the last warning before the word typed above takes effect. */}
        <Button disabled={value !== word} loading={pending} onClick={remove} type="button" variant="destructive">
          {pending ? dictionary.profile.deletePending : dictionary.profile.deleteConfirm}
        </Button>
        <Button onClick={cancel} type="button" variant="secondary">
          {dictionary.common.cancel}
        </Button>
      </div>
    </div>
  );
}
