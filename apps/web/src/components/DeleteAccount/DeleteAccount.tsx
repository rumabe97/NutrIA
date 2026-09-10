'use client';
import { useState } from 'react';

import { useRouter } from 'next/navigation';

import styles from './DeleteAccount.module.css';

import { Button } from 'ui/components/Button';
import { Input } from 'ui/components/Input';
import { Text } from 'ui/components/Text';
import { useDictionary } from 'i18n/LocaleProvider';

import { api, messageFor } from 'lib/api';
import { interpolate } from 'lib/format';

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

  const word = dictionary.profile.deleteWord;

  async function remove() {
    setError(undefined);
    setPending(true);

    try {
      await api('/users/me', { method: 'DELETE' });
      router.push('/');
      router.refresh();
    } catch (caught) {
      setError(messageFor(caught, dictionary));
      setPending(false);
    }
  }

  if (!confirming) {
    return (
      <div className={styles.wrapper}>
        <Button onClick={() => setConfirming(true)} type="button" variant="secondary">
          {dictionary.profile.dangerTitle}
        </Button>
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
        <Button disabled={value !== word} loading={pending} onClick={remove} type="button">
          {pending ? dictionary.profile.deletePending : dictionary.profile.deleteConfirm}
        </Button>
        <Button onClick={() => setConfirming(false)} type="button" variant="secondary">
          {dictionary.common.cancel}
        </Button>
      </div>
    </div>
  );
}
