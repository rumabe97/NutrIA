'use client';
import { useEffect, useState } from 'react';

import styles from 'components/ReminderToggle/ReminderToggle.module.css';

import { Switch } from 'ui/components/Switch';
import { Text } from 'ui/components/Text';
import { useDictionary } from 'i18n/LocaleProvider';

import { messageFor } from 'lib/api';
import { pushState, turnPushOff, turnPushOn } from 'lib/push';

import type { PushState } from 'lib/push';

/**
 * The check-in reminder on this device (`0054`), beside the mail's switch.
 *
 * Per browser, not per account: permission is granted to a browser, and
 * somebody with a laptop and a phone decides for each. Where this browser
 * cannot receive it, no switch is drawn — a sentence says what would make it
 * possible instead, because a switch that cannot work is not a switch.
 */
export function PushToggle({ publicKey }: Readonly<{ publicKey: string }>) {
  const dictionary = useDictionary();
  const t = dictionary.profile;
  const [state, setState] = useState<PushState | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let current = true;

    void pushState().then(next => {
      if (current) {
        setState(next);
      }
    });

    return () => {
      current = false;
    };
  }, []);

  async function change(next: boolean) {
    if (pending) {
      return;
    }

    setPending(true);
    setError(undefined);

    try {
      setState(next ? await turnPushOn(publicKey) : await turnPushOff());
    } catch (caught) {
      setError(messageFor(caught, dictionary));
    } finally {
      setPending(false);
    }
  }

  // Until the browser has said what it can do, nothing: a switch that flips
  // itself a moment after the page appears reads as a switch that is broken.
  if (state === null) {
    return null;
  }

  const notes = { blocked: t.pushBlocked, 'install-first': t.pushInstallFirst, unsupported: t.pushUnsupported };

  if (state === 'blocked' || state === 'install-first' || state === 'unsupported') {
    return (
      <Text size="xs" tone="tertiary">
        {notes[state]}
      </Text>
    );
  }

  return (
    <div className={styles.root}>
      <label className={styles.line}>
        <Switch checked={state === 'on'} onCheckedChange={next => void change(next)} />
        <Text size="sm">{t.pushLabel}</Text>
      </label>
      <Text size="xs" tone="tertiary">
        {t.pushHint}
      </Text>
      {error ? (
        <Text className={styles.error} size="xs">
          {error}
        </Text>
      ) : null}
    </div>
  );
}
