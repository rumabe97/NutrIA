'use client';
import { useState } from 'react';

import { useDictionary } from 'i18n/LocaleProvider';

import { SettingSwitch } from 'components/SettingSwitch';

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
    <SettingSwitch checked={on} error={error} hint={t.reminderCheckInHint} label={t.reminderCheckIn} onCheckedChange={next => void change(next)} />
  );
}
