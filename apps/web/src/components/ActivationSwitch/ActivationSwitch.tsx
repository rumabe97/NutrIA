'use client';
import { useState } from 'react';

import styles from './ActivationSwitch.module.css';

import { Switch } from 'ui/components/Switch';
import { Text } from 'ui/components/Text';
import { useDictionary } from 'i18n/LocaleProvider';

import { api, messageFor } from 'lib/api';

/**
 * Who turns the second lock (`0031`): confirming an address either opens the
 * account or leaves it in the queue for the owner.
 *
 * It does not stop anybody signing up — an account always gets created, and
 * always gets its confirmation mail. What it changes is what that confirmation
 * is worth, and therefore whether the owner gets a mail about it.
 */
export function ActivationSwitch({ automatic }: { automatic: boolean }) {
  const dictionary = useDictionary();
  const t = dictionary.admin;
  const [on, setOn] = useState(automatic);
  const [error, setError] = useState<string>();

  async function change(next: boolean) {
    const previous = on;

    setOn(next);
    setError(undefined);

    try {
      await api('/admin/settings', { body: { automaticActivation: next }, method: 'PATCH' });
    } catch (caught) {
      setOn(previous);
      setError(messageFor(caught, dictionary));
    }
  }

  return (
    <div className={styles.root}>
      <label className={styles.line}>
        <Switch checked={on} onCheckedChange={next => void change(next)} />
        <Text size="sm">{t.automaticActivation}</Text>
      </label>
      <Text size="xs" tone="tertiary">
        {on ? t.automaticHint : t.manualHint}
      </Text>
      {error ? (
        <Text className={styles.error} size="xs">
          {error}
        </Text>
      ) : null}
    </div>
  );
}
