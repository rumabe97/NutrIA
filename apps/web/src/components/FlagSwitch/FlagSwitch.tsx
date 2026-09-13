'use client';
import { useState } from 'react';

import { useDictionary } from 'i18n/LocaleProvider';

import { SettingSwitch } from 'components/SettingSwitch';

import { api, messageFor } from 'lib/api';

import type { FlagName } from 'core/domain/Flag';

type FlagSwitchProps = {
  readonly enabled: boolean;
  /** Which switch, by the registry's name. The API rejects anything the registry does not declare. */
  readonly flag: FlagName;
  readonly label: string;
  /** Shown under the switch, and it changes with the position: what is true *now*, not what the switch does. */
  readonly offHint: string;
  readonly onHint: string;
};

/**
 * One switch on `/admin`, for one flag.
 *
 * Optimistic, and it puts itself back if the write fails: a switch that stays
 * where you left it while the server disagreed is a switch that lies about the
 * state of the service, which is the one thing it exists to report.
 *
 * The copy is passed in rather than looked up here, because what each flag
 * means is a sentence about that flag and belongs next to the others in the
 * dictionary — not in a component that would then have to know all of them.
 */
export function FlagSwitch({ enabled, flag, label, offHint, onHint }: FlagSwitchProps) {
  const dictionary = useDictionary();
  const [on, setOn] = useState(enabled);
  const [error, setError] = useState<string>();

  async function change(next: boolean) {
    const previous = on;

    setOn(next);
    setError(undefined);

    try {
      await api('/admin/settings', { body: { enabled: next, flag }, method: 'PATCH' });
    } catch (caught) {
      setOn(previous);
      setError(messageFor(caught, dictionary));
    }
  }

  return <SettingSwitch checked={on} error={error} hint={on ? onHint : offHint} label={label} onCheckedChange={next => void change(next)} />;
}
