'use client';
import { useState } from 'react';

import styles from './PushTestButton.module.css';

import { Button } from 'ui/components/Button';
import { useDictionary } from 'i18n/LocaleProvider';

import { api, messageFor } from 'lib/api';
import { interpolate } from 'lib/format';

type PushTest = { readonly configured: boolean; readonly delivered: number; readonly devices: number };

/**
 * A test notification to the owner's own devices (`0054`): the reminder's own
 * words, marked as a test. It works whatever the switch above says, because it
 * reaches nobody else, and it records nothing.
 *
 * The answer says which of four things happened. "Sent" and "nothing arrived"
 * look alike from here, and the difference is either a phone or a setting.
 */
export function PushTestButton() {
  const dictionary = useDictionary();
  const t = dictionary.admin;
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<string>();

  async function send() {
    setPending(true);
    setResult(undefined);

    try {
      const sent = await api<PushTest>('/admin/push-test', { method: 'POST' });

      setResult(
        !sent.configured
          ? t.pushTestUnconfigured
          : sent.devices === 0
            ? t.pushTestNoDevice
            : sent.delivered === 0
              ? interpolate(t.pushTestRefused, { count: sent.devices })
              : interpolate(t.pushTestSent, { count: sent.delivered })
      );
    } catch (caught) {
      setResult(messageFor(caught, dictionary));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={styles.root}>
      <Button disabled={pending} onClick={() => void send()} type="button" variant="secondary">
        {t.pushTest}
      </Button>
      {result ? (
        <p className={styles.result} role="status">
          {result}
        </p>
      ) : null}
    </div>
  );
}
