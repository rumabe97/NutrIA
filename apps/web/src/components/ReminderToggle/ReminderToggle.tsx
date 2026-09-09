'use client';
import { useState } from 'react';

import styles from './ReminderToggle.module.css';

import { Switch } from 'ui/components/Switch';
import { Text } from 'ui/components/Text';
import { useDictionary } from 'i18n/LocaleProvider';

import { api, messageFor } from 'lib/api';

/**
 * The one mail this product sends on its own, and the switch that stops it.
 *
 * Optimistic like every other control here: the answer lands before the request
 * does and a failure puts it back. A reminder that cannot be turned off is not
 * a reminder, so this ships with the reminder rather than after it.
 */
export function ReminderToggle({ enabled }: { enabled: boolean }) {
  const dictionary = useDictionary();
  const t = dictionary.profile;
  const [on, setOn] = useState(enabled);
  const [error, setError] = useState<string>();

  async function change(next: boolean) {
    const previous = on;

    setOn(next);
    setError(undefined);

    try {
      await api('/notifications/settings', { body: { checkInEmail: next }, method: 'PATCH' });
    } catch (caught) {
      setOn(previous);
      setError(messageFor(caught, dictionary));
    }
  }

  return (
    <div className={styles.root}>
      <label className={styles.line}>
        <Switch checked={on} onCheckedChange={next => void change(next)} />
        <Text size="sm">{t.reminderCheckIn}</Text>
      </label>
      <Text size="xs" tone="tertiary">
        {t.reminderCheckInHint}
      </Text>
      {error ? (
        <Text className={styles.error} size="xs">
          {error}
        </Text>
      ) : null}
    </div>
  );
}
