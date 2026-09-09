'use client';
import { useState } from 'react';

import styles from './RegistrationSwitch.module.css';

import { Switch } from 'ui/components/Switch';
import { Text } from 'ui/components/Text';
import { useDictionary } from 'i18n/LocaleProvider';

import { api, messageFor } from 'lib/api';

/**
 * The door itself: whether anyone new may sign up at all (`0031`).
 *
 * Separate from activation, which decides whether an account that exists may
 * be used. Closing this stops accounts being created; it changes nothing for
 * the people already in, and nothing about who still waits.
 */
export function RegistrationSwitch({ open }: { open: boolean }) {
  const dictionary = useDictionary();
  const t = dictionary.admin;
  const [on, setOn] = useState(open);
  const [error, setError] = useState<string>();

  async function change(next: boolean) {
    const previous = on;

    setOn(next);
    setError(undefined);

    try {
      await api('/admin/settings', { body: { registrationOpen: next }, method: 'PATCH' });
    } catch (caught) {
      setOn(previous);
      setError(messageFor(caught, dictionary));
    }
  }

  return (
    <div className={styles.root}>
      <label className={styles.line}>
        <Switch checked={on} onCheckedChange={next => void change(next)} />
        <Text size="sm">{t.registrationOpen}</Text>
      </label>
      <Text size="xs" tone="tertiary">
        {on ? t.registrationOpenHint : t.registrationClosedHint}
      </Text>
      {error ? (
        <Text className={styles.error} size="xs">
          {error}
        </Text>
      ) : null}
    </div>
  );
}
